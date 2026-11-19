import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoom,joinRoom,setConnection,startEncounter,submitVote,expireVote,
 roomView,MAX_PLAYERS,TURN_DURATION_MS,PARTY_STEP_MS,selectPartyDestination,
 advancePartyMovement,transferLeadership,submitTurn,expireTurn} from '../src/jrpg-room-rules.mjs';

const empty=()=>createRoom({id:'room1',partyId:'party1',hostId:'p1',now:0});
const seatN=n=>{let s=empty();for(let i=1;i<=n;i++)
 s=joinRoom(s,{id:'p'+i,displayName:'Player '+i},i);return s;};
let sequence=0;
const vote=(s,actorId,kind,now,choiceIndex,ballotId)=>
 submitVote(s,{actorId,kind,choiceIndex,now,ballotId:ballotId??s.battle.ballot.id,
  actionId:'vote_'+(++sequence)});
test('maximum six co-op seats and rejoin',()=>{
 let s=seatN(6);assert.equal(MAX_PLAYERS,6);
 assert.throws(()=>joinRoom(s,{id:'p7',displayName:'Seventh'},10),/room_full/);
 s=joinRoom(s,{id:'p3',displayName:'Player 3'},11);assert.equal(s.players.length,6);
});
test('leader starts one collective ballot; movement remains leader-only',()=>{
 let s=seatN(3);
 assert.throws(()=>startEncounter(s,{actorId:'p2',now:100}),/leader_only/);
 assert.throws(()=>selectPartyDestination(s,{actorId:'p2',target:{x:11,y:9},expectedVersion:s.version,now:100}),/leader_only/);
 s=startEncounter(s,{actorId:'p1',now:100});
 assert.equal(roomView(s).battle.ballot.votesRequired,3);
 assert.throws(()=>selectPartyDestination(s,{actorId:'p1',target:{x:11,y:9},expectedVersion:s.version,now:101}),/travel_unavailable_during_battle/);
 assert.throws(()=>submitTurn(s,{}),/use_submitVote/);
 assert.throws(()=>expireTurn(s,9999),/use_expireVote/);
});
test('all members vote, winning action resolves once, enemy responds once per ballot',()=>{
 let s=startEncounter(seatN(3),{actorId:'p1',now:100});
 s=vote(s,'p1','listen',101);
 s=vote(s,'p2','listen',102);
 assert.equal(s.battle.round,1);assert.equal(s.battle.fog,10);
 const peek=roomView(s);
 assert.equal(peek.battle.ballot.votesReceived,2);
 assert.deepEqual(peek.battle.ballot.votedPlayerIds,['p1','p2']);
 assert.equal(JSON.stringify(peek).includes('"votes":'),false); // private until resolved
 s=vote(s,'p3','guard',103);
 assert.equal(s.battle.round,2);
 assert.deepEqual(s.battle.seals,['S']);
 assert.equal(s.battle.morale,18);
 assert.equal(s.battle.log.filter(x=>x.kind==='enemy-turn').length,1);
 assert.equal(s.battle.lastResult.choice,'listen');
 assert.deepEqual(s.battle.lastResult.counts,{listen:2,guard:1});
 assert.equal(s.battle.lastResult.voteCount,3);
 assert.equal(s.battle.lastResult.resolution,'all-voted');
});
test('simultaneous ballot votes do not require shared mutable state version',()=>{
 let s=startEncounter(seatN(2),{actorId:'p1',now:100});
 const version=s.version,ballotId=s.battle.ballot.id;
 s=submitVote(s,{actorId:'p1',actionId:'same',kind:'listen',ballotId,now:101});
 assert.equal(s.version,version+1);
 assert.equal(submitVote(s,{actorId:'p1',actionId:'same',kind:'listen',ballotId,now:101}),s);
 assert.throws(()=>vote(s,'p1','guard',102),/already_voted/);
 s=vote(s,'p2','listen',103);
 assert.equal(s.battle.lastResult.choice,'listen');
 assert.throws(()=>vote(s,'p2','listen',104,undefined,ballotId),/stale_ballot/);
});
test('leader breaks ties only, cannot overrule a clear majority',()=>{
 let s=startEncounter(seatN(3),{actorId:'p1',now:100});
 s=vote(s,'p1','guard',101);
 s=vote(s,'p2','listen',102);
 s=vote(s,'p3','listen',103);
 assert.equal(s.battle.lastResult.choice,'listen');
 assert.equal(s.battle.lastResult.tieBreak,null);
 let t=startEncounter(seatN(2),{actorId:'p1',now:100});
 t=vote(t,'p1','guard',101);t=vote(t,'p2','listen',102);
 assert.equal(t.battle.lastResult.choice,'guard');
 assert.equal(t.battle.lastResult.tieBreak,'safe-guard'); // leader chose Guard, which is the tied safe option
 assert.equal(t.battle.morale,20);
});
test('vote deadline handles absent/disconnected voters and safe no-vote fallback',()=>{
 let s=startEncounter(seatN(3),{actorId:'p1',now:1000});
 s=vote(s,'p2','listen',1001);
 s=setConnection(s,'p3',false);
 assert.equal(expireVote(s,1000+TURN_DURATION_MS-1),s);
 s=expireVote(s,1000+TURN_DURATION_MS);
 assert.equal(s.battle.lastResult.choice,'listen');
 assert.equal(s.battle.lastResult.voteCount,1);
 assert.equal(s.battle.lastResult.resolution,'deadline');
 assert.equal(s.players.length,3);
 let none=startEncounter(seatN(2),{actorId:'p1',now:1000});
 none=expireVote(none,1000+TURN_DURATION_MS);
 assert.equal(none.battle.lastResult.choice,'guard');
 assert.equal(none.battle.lastResult.tieBreak,'safe-guard');
 assert.equal(none.battle.morale,20);
});
test('leader absent at tied ballot deadline gives safe Guard, not arbitrary attack',()=>{
 let s=startEncounter(seatN(3),{actorId:'p1',now:100});
 s=vote(s,'p2','listen',101);
 s=vote(s,'p3','guard',102);
 s=expireVote(s,100+TURN_DURATION_MS);
 assert.equal(s.battle.lastResult.choice,'guard');
 assert.equal(s.battle.lastResult.tieBreak,'safe-guard');
 assert.equal(s.battle.lastResult.voteCount,2);
});
test('server validates all choices and refuses duplicate, unseated or late votes',()=>{
 let s=startEncounter(seatN(3),{actorId:'p1',now:100});
 assert.throws(()=>vote(s,'intruder','listen',101),/not_in_room/);
 assert.throws(()=>vote(s,'p1','plan',101),/invalid_vote_choice/);
 assert.throws(()=>vote(s,'p1','case-choice',101,1),/invalid_vote_choice/);
 assert.throws(()=>vote(s,'p1','listen',100+TURN_DURATION_MS),/vote_expired/);
 assert.equal(s.battle.ballot.votes.length,0);
 s=vote(s,'p1','listen',101);
 assert.throws(()=>vote(s,'p1','listen',102),/already_voted/);
});
test('collective S/O/A/P success and answer rationale remain server-controlled',()=>{
 let s=startEncounter(seatN(1),{actorId:'p1',now:0});
 assert.equal(JSON.stringify(roomView(s)).includes('correctIndex'),false);
 s=vote(s,'p1','listen',10);
 s=vote(s,'p1','verify',20);
 const snapshot=roomView(s);
 assert.equal(snapshot.battle.availableActions.includes('case-choice:1'),true);
 s=vote(s,'p1','case-choice',30,1);
 s=vote(s,'p1','assess',40);
 s=vote(s,'p1','plan',50);
 assert.equal(s.battle.status,'won');
 assert.equal(s.phase,'finished');
 assert.equal(s.battle.log.filter(x=>x.kind==='enemy-turn').length,4);
 assert.equal('xp' in s,false);
 assert.equal('gold' in s,false);
});
test('wrong majority case answer gets remediation, never auto-awards success',()=>{
 let s=startEncounter(seatN(3),{actorId:'p1',now:0});
 for(const action of ['listen','verify']){
  s=vote(s,'p1',action,s.battle.round*100);
  s=vote(s,'p2',action,s.battle.round*100+1);
  s=vote(s,'p3',action,s.battle.round*100+2);
 }
 s=vote(s,'p1','case-choice',300,0);
 s=vote(s,'p2','case-choice',301,0);
 s=vote(s,'p3','case-choice',302,1);
 assert.equal(s.battle.caseResolved,false);
 assert.equal(s.battle.lastResult.choice,'case-choice:0');
 assert.equal(s.battle.lastResult.voteCount,3);
});
test('leader movement and transfer remain separate from who gets to vote',()=>{
 let s=seatN(3);
 assert.throws(()=>transferLeadership(s,{actorId:'p2',newLeaderId:'p3',expectedVersion:s.version}),/leader_only/);
 s=transferLeadership(s,{actorId:'p1',newLeaderId:'p2',expectedVersion:s.version});
 assert.equal(roomView(s).leaderId,'p2');
 assert.throws(()=>selectPartyDestination(s,{actorId:'p1',target:{x:10,y:9},expectedVersion:s.version,now:200}),/leader_only/);
 s=selectPartyDestination(s,{actorId:'p2',target:{x:10,y:9},expectedVersion:s.version,now:200});
 s=startEncounter(s,{actorId:'p2',now:300});
 s=vote(s,'p1','listen',301);s=vote(s,'p2','guard',302);s=vote(s,'p3','listen',303);
 assert.equal(s.battle.lastResult.choice,'listen');
 assert.equal(s.battle.lastResult.tieBreak,null);
 assert.equal(s.battle.round,2);
});
test('shared leader position, blocked routes and transfer permissions',()=>{
 let s=seatN(6);
 assert.equal(roomView(s).players.filter(p=>p.isLeader).length,1);
 assert.throws(()=>selectPartyDestination(s,{actorId:'p1',target:{x:4,y:4},expectedVersion:s.version,now:100}),/blocked_destination/);
 s=selectPartyDestination(s,{actorId:'p1',target:{x:11,y:9},expectedVersion:s.version,now:100});
 assert.equal(s.world.route.length,2);
 assert.deepEqual(advancePartyMovement(s,100+PARTY_STEP_MS).world.position,{x:10,y:9});
 s=advancePartyMovement(s,100+PARTY_STEP_MS*2);
 assert.deepEqual(roomView(s).world.position,{x:11,y:9});
 s=setConnection(s,'p2',false);
 assert.throws(()=>transferLeadership(s,{actorId:'p1',newLeaderId:'p2',expectedVersion:s.version}),/invalid_new_leader/);
 s=setConnection(s,'p2',true);
 s=transferLeadership(s,{actorId:'p1',newLeaderId:'p2',expectedVersion:s.version});
 assert.equal(s.leaderId,'p2');
});
test('Guild Master approach still works with leader-only travel',()=>{
 let s=seatN(2);
 s=selectPartyDestination(s,{actorId:'p1',target:{x:9,y:7},expectedVersion:s.version,now:10});
 s=advancePartyMovement(s,10+PARTY_STEP_MS);
 assert.deepEqual(s.world.position,{x:9,y:8});
 assert.equal(s.world.lastInteraction,'guild-master');
});

test('malformed case indices and disconnected voters cannot vote',()=>{
 let s=startEncounter(seatN(2),{actorId:'p1',now:100});
 s=vote(s,'p1','listen',101);s=vote(s,'p2','listen',102);
 s=vote(s,'p1','verify',103);s=vote(s,'p2','verify',104);
 assert.throws(()=>vote(s,'p1','case-choice',105,'1'),/invalid_vote_choice/);
 assert.throws(()=>vote(s,'p1','case-choice',105,1.3),/invalid_vote_choice/);
 s=setConnection(s,'p1',false);
 assert.throws(()=>vote(s,'p1','case-choice',106,1),/voter_disconnected/);
 s=setConnection(s,'p1',true);
 s=vote(s,'p1','case-choice',107,1);
 assert.equal(roomView(s).battle.ballot.votesReceived,1);
});
