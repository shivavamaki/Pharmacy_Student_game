import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoom,joinRoom,setConnection,startEncounter,submitTurn,expireTurn,roomView,MAX_PLAYERS,TURN_DURATION_MS,PARTY_STEP_MS,selectPartyDestination,advancePartyMovement,transferLeadership} from '../src/jrpg-room-rules.mjs';
const empty=()=>createRoom({id:'room1',partyId:'party1',hostId:'p1',now:0});
const seatN=n=>{let s=empty();for(let i=1;i<=n;i++)s=joinRoom(s,{id:'p'+i,displayName:'Player '+i},i);return s;};
const action=(s,actorId,kind,now,choiceIndex)=>submitTurn(s,{actorId,kind,now,choiceIndex,actionId:'action_'+s.version,expectedVersion:s.version});
test('maximum six online seats even if a seventh tries to join',()=>{
 let s=seatN(6);assert.equal(MAX_PLAYERS,6);
 assert.throws(()=>joinRoom(s,{id:'p7',displayName:'Seventh'},10),/room_full/);
 s=joinRoom(s,{id:'p3',displayName:'Player 3'},11);assert.equal(s.players.length,6);
});
test('only host starts; every player gets one turn before enemy acts once',()=>{
 let s=seatN(3);
 assert.throws(()=>startEncounter(s,{actorId:'p2',now:100}),/leader_only/);
 s=startEncounter(s,{actorId:'p1',now:100});
 assert.throws(()=>action(s,'p2','listen',101),/not_your_turn/);
 s=action(s,'p1','listen',101);
 s=action(s,'p2','guard',102);
 assert.equal(s.battle.round,1);
 s=action(s,'p3','guard',103);
 assert.equal(s.battle.round,2);
 assert.equal(s.battle.morale,18);
 assert.equal(s.battle.log.filter(x=>x.kind==='enemy-turn').length,1);
});
test('replayed actions are idempotent and version conflict is rejected',()=>{
 let s=startEncounter(seatN(1),{actorId:'p1',now:100});
 const cmd={actorId:'p1',actionId:'once',kind:'listen',expectedVersion:s.version,now:101};
 const n=submitTurn(s,cmd);
 assert.equal(submitTurn(n,cmd),n);
 assert.throws(()=>submitTurn(n,{...cmd,actionId:'twice'}),/stale_turn/);
});
test('disconnect retains seat and timeout performs auto-guard',()=>{
 let s=startEncounter(seatN(2),{actorId:'p1',now:1000});
 s=setConnection(s,'p1',false);
 assert.equal(expireTurn(s,1000+TURN_DURATION_MS-1),s);
 s=expireTurn(s,1000+TURN_DURATION_MS);
 assert.equal(s.players.length,2);
 assert.equal(s.battle.turnIndex,1);
 assert.equal(s.battle.log.at(-1).kind,'timeout');
 s=setConnection(s,'p1',true);assert.equal(s.players[0].connected,true);
});
test('server-only answer key and shared S/O/A/P win without official awards',()=>{
 let s=startEncounter(seatN(1),{actorId:'p1',now:0});
 assert.equal(JSON.stringify(roomView(s)).includes('correctIndex'),false);
 s=action(s,'p1','listen',10);
 s=action(s,'p1','verify',20);
 s=action(s,'p1','case-choice',30,1);
 s=action(s,'p1','assess',40);
 s=action(s,'p1','plan',50);
 assert.equal(s.battle.status,'won');
 assert.equal(s.phase,'finished');
 assert.equal('xp' in s,false);
 assert.equal('gold' in s,false);
});
test('invalid and out-of-turn actions fail without changing room',()=>{
 let s=startEncounter(seatN(2),{actorId:'p1',now:0});
 assert.throws(()=>action(s,'intruder','guard',1),/not_in_room/);
 assert.throws(()=>action(s,'p1','plan',1),/requires_assessment/);
 assert.throws(()=>action(s,'p1','bad',1),/invalid_action/);
 assert.throws(()=>action(s,'p1','guard',TURN_DURATION_MS),/turn_expired/);
 assert.equal(s.battle.round,1);
});

test('only leader selects destination; whole party follows one authoritative map position',()=>{
 let s=seatN(6);
 assert.equal(s.leaderId,'p1');
 assert.equal(roomView(s).players.filter(p=>p.isLeader).length,1);
 assert.throws(()=>selectPartyDestination(s,{actorId:'p2',target:{x:11,y:9},expectedVersion:s.version,now:100}),/leader_only/);
 s=selectPartyDestination(s,{actorId:'p1',target:{x:11,y:9},expectedVersion:s.version,now:100});
 assert.equal(s.world.route.length,2);
 const before=s.world.position;
 assert.deepEqual(advancePartyMovement(s,100+PARTY_STEP_MS-1).world.position,before);
 s=advancePartyMovement(s,100+PARTY_STEP_MS);
 assert.deepEqual(roomView(s).world.position,{x:10,y:9});
 assert.equal(roomView(s).players.length,6);
 s=advancePartyMovement(s,100+PARTY_STEP_MS*2);
 assert.deepEqual(roomView(s).world.position,{x:11,y:9});
 assert.equal(roomView(s).world.isMoving,false);
});
test('leader can approach NPC; blocked destinations and premature travel fail',()=>{
 let s=seatN(2);
 assert.throws(()=>selectPartyDestination(s,{actorId:'p1',target:{x:4,y:4},expectedVersion:s.version,now:10}),/blocked_destination/);
 assert.throws(()=>selectPartyDestination(s,{actorId:'p1',target:{x:10,y:9},expectedVersion:s.version-1,now:10}),/stale_destination/);
 s=selectPartyDestination(s,{actorId:'p1',target:{x:9,y:7},expectedVersion:s.version,now:10});
 s=advancePartyMovement(s,10+PARTY_STEP_MS);
 assert.deepEqual(s.world.position,{x:9,y:8});
 assert.equal(s.world.lastInteraction,'guild-master');
 s=startEncounter(s,{actorId:'p1',now:1000});
 assert.throws(()=>selectPartyDestination(s,{actorId:'p1',target:{x:11,y:9},expectedVersion:s.version,now:1001}),/travel_unavailable_during_battle/);
});
test('leadership transfer changes world-control rights without controlling other players turns',()=>{
 let s=seatN(3);
 assert.throws(()=>transferLeadership(s,{actorId:'p2',newLeaderId:'p3',expectedVersion:s.version}),/leader_only/);
 s=transferLeadership(s,{actorId:'p1',newLeaderId:'p2',expectedVersion:s.version});
 assert.equal(roomView(s).leaderId,'p2');
 assert.throws(()=>selectPartyDestination(s,{actorId:'p1',target:{x:10,y:9},expectedVersion:s.version,now:200}),/leader_only/);
 s=selectPartyDestination(s,{actorId:'p2',target:{x:10,y:9},expectedVersion:s.version,now:200});
 s=startEncounter(s,{actorId:'p2',now:300});
 assert.equal(s.battle.turnIndex,0);
 // Player 1 remains the actor for their own battle turn; leader cannot impersonate them.
 assert.throws(()=>action(s,'p2','listen',301),/not_your_turn/);
 s=action(s,'p1','listen',301);
 assert.equal(s.battle.turnIndex,1);
 s=action(s,'p2','guard',302);
 assert.equal(s.battle.turnIndex,2);
});
test('offline member retains seat and only connected successor can be nominated',()=>{
 let s=seatN(2);
 s=setConnection(s,'p2',false);
 assert.throws(()=>transferLeadership(s,{actorId:'p1',newLeaderId:'p2',expectedVersion:s.version}),/invalid_new_leader/);
 s=setConnection(s,'p2',true);
 s=transferLeadership(s,{actorId:'p1',newLeaderId:'p2',expectedVersion:s.version});
 assert.equal(s.leaderId,'p2');
});
