import { PLAYER_START, routeToDestination } from '../../jrpg-walk/src/world.mjs';
// Pure server-authoritative online co-op rules. NOT wired to production Worker.
// Adapter must verify Firebase identity and D1 membership before calling these functions.
export const MAX_PLAYERS = 6;
export const TURN_DURATION_MS = 45_000;
export const PARTY_STEP_MS = 160; // one validated map tile per step
const scenario = Object.freeze({
  id:'training',foe:'Whispering Doubt',fog:10,enemyImpact:2,
  prompt:'คำสั่งยาในสถานการณ์จำลองมีข้อมูลไม่ครบ ควรทำอย่างไร?',
  choices:['เดาข้อมูลที่ขาด','ตรวจสอบกับผู้รับผิดชอบก่อนดำเนินการ','ดำเนินการต่อเพื่อให้เร็วขึ้น'],
  correctIndex:1
});
const fail = code => { const e=new Error(code); e.code=code; throw e; };
const validId = value => typeof value==='string' && /^[A-Za-z0-9_-]{1,100}$/.test(value);
const validNow = now => Number.isSafeInteger(now) && now>=0;
const clone = value => structuredClone(value);
function checkRoom(s){if(!s||!validId(s.id)||!Array.isArray(s.players))fail('invalid_room');}
export function createRoom({id,partyId,hostId,now=0}){
  if(!validId(id)||!validId(partyId)||!validId(hostId)||!validNow(now))fail('invalid_room');
  return {id,partyId,hostId,leaderId:hostId,phase:'lobby',maxPlayers:MAX_PLAYERS,players:[],battle:null,
    world:{position:{...PLAYER_START},destination:null,route:[],nextStepAt:null,lastInteraction:null},
    version:1,createdAt:now,recentActionKeys:[]};
}
export function joinRoom(state,{id,displayName},now=0){
  checkRoom(state);
  if(!validId(id)||typeof displayName!=='string'||!displayName.trim()||displayName.length>100||!validNow(now))fail('invalid_player');
  const next=clone(state), existing=next.players.find(p=>p.id===id);
  if(existing){existing.connected=true;next.version++;return next;}
  if(next.phase!=='lobby')fail('room_started');
  if(next.players.length>=MAX_PLAYERS)fail('room_full');
  next.players.push({id,displayName:displayName.trim(),connected:true,joinedAt:now});
  next.version++;return next;
}
// Only the verified leader can issue party-wide destination orders; individual player
// devices are followers on the world map. The future Durable Object must serialize
// calls and enforce party membership and clock checks before applying them.
export function selectPartyDestination(state,{actorId,target,expectedVersion,now}){
 checkRoom(state);
 if(actorId!==state.leaderId)fail('leader_only');
 if(!state.players.some(p=>p.id===actorId))fail('leader_not_seated');
 if(state.phase!=='lobby')fail('travel_unavailable_during_battle');
 if(!validNow(now)||!target||!Number.isInteger(target.x)||!Number.isInteger(target.y))fail('invalid_destination');
 if(expectedVersion!==state.version)fail('stale_destination');
 const plan=routeToDestination(state.world.position,target);
 if(!plan)fail('blocked_destination');
 const next=clone(state);
 next.world.destination=plan.target;
 next.world.route=plan.path;
 next.world.nextStepAt=plan.path.length?now+PARTY_STEP_MS:null;
 next.world.lastInteraction=plan.path.length?null:plan.interaction;
 next.version++;return next;
}
// Advance the team's *single authoritative location* at the server-defined pace.
// Members' visual formations derive from this shared location, never separate client moves.
export function advancePartyMovement(state,now){
 checkRoom(state);if(!validNow(now))fail('invalid_clock');
 if(state.phase!=='lobby'||!state.world.route.length||now<state.world.nextStepAt)return state;
 const next=clone(state);
 while(next.world.route.length&&now>=next.world.nextStepAt){
  next.world.position=next.world.route.shift();
  next.world.nextStepAt+=PARTY_STEP_MS;
 }
 if(!next.world.route.length){
  const route=routeToDestination(next.world.position,next.world.destination);
  next.world.lastInteraction=route?.interaction||null;
  next.world.destination=null;next.world.nextStepAt=null;
 }
 next.version++;return next;
}
export function transferLeadership(state,{actorId,newLeaderId,expectedVersion}){
 checkRoom(state);
 if(actorId!==state.leaderId)fail('leader_only');
 if(expectedVersion!==state.version)fail('stale_leadership');
 if(state.phase!=='lobby')fail('leader_change_unavailable');
 if(!validId(newLeaderId)||!state.players.some(p=>p.id===newLeaderId&&p.connected))fail('invalid_new_leader');
 const next=clone(state);
 next.leaderId=newLeaderId;
 next.world.destination=null;next.world.route=[];next.world.nextStepAt=null;
 next.version++;return next;
}
// Other independent workflows (assignment/evidence upload, individual reflections)
// are separate authenticated Worker endpoints and deliberately have NO leader guard.
export function setConnection(state,id,connected){
  checkRoom(state);
  if(typeof connected!=='boolean')fail('invalid_connection');
  const next=clone(state),seat=next.players.find(p=>p.id===id);
  if(!seat)fail('not_in_room');
  seat.connected=connected;next.version++;return next;
}
// Each ballot is one cooperative combat round. The connected players seated when
// the ballot opens are the electorate. Everyone gets one equally weighted vote.
// We wait for all eligible votes or the 45-second deadline, whichever happens first.
export const VOTE_DURATION_MS = TURN_DURATION_MS;
const voteKey=(kind,choiceIndex)=>kind==='case-choice'?'case-choice:'+choiceIndex:kind;
const voteChoices=(battle)=>{
 const allowed=['listen','guard'];
 if(battle.seals.includes('S')&&battle.focus>=1)allowed.push('verify');
 if(battle.seals.includes('O')&&!battle.caseResolved)
  allowed.push(...scenario.choices.map((_,i)=>'case-choice:'+i));
 if(battle.seals.includes('O')&&battle.caseResolved&&battle.focus>=1)allowed.push('assess');
 if(battle.seals.includes('A')&&battle.focus>=2)allowed.push('plan');
 return allowed;
};
function openBallot(next,now,id){
 const electorate=next.players.filter(p=>p.connected).map(p=>p.id);
 next.battle.ballot={id,eligiblePlayerIds:electorate,votes:[],deadlineAt:now+VOTE_DURATION_MS};
 next.battle.deadlineAt=next.battle.ballot.deadlineAt;
}
export function startEncounter(state,{actorId,now=0}){
 checkRoom(state);
 if(!validNow(now))fail('invalid_clock');
 if(actorId!==state.leaderId)fail('leader_only');
 if(state.phase!=='lobby')fail('room_started');
 if(!state.players.some(p=>p.id===actorId&&p.connected))fail('leader_not_connected');
 if(state.players.length<1||state.players.length>MAX_PLAYERS)fail('invalid_seats');
 const next=clone(state);next.phase='battle';
 next.world.destination=null;next.world.route=[];next.world.nextStepAt=null;
 next.battle={status:'active',round:1,morale:20,focus:4,fog:scenario.fog,
  seals:[],caseResolved:false,log:[],lastResult:null,ballot:null};
 openBallot(next,now,1);
 next.version++;return next;
}
function applyWinningAction(battle,{kind,choiceIndex}){
 const has=k=>battle.seals.includes(k);
 let damage=0,shield=0,note='';
 switch(kind){
 case 'listen':
  if(!has('S'))battle.seals.push('S');battle.focus=Math.min(6,battle.focus+1);
  note='Listen (S)';break;
 case 'verify':
  if(!has('S')||battle.focus<1)fail('invalid_resolved_action');
  battle.focus--;if(!has('O'))battle.seals.push('O');damage=2;note='Verify (O)';break;
 case 'assess':
  if(!has('O')||!battle.caseResolved||battle.focus<1)fail('invalid_resolved_action');
  battle.focus--;if(!has('A'))battle.seals.push('A');damage=3;note='Assess (A)';break;
 case 'plan':
  if(!has('A')||battle.focus<2)fail('invalid_resolved_action');
  battle.focus-=2;if(!has('P'))battle.seals.push('P');damage=5;note='Plan (P)';break;
 case 'guard':
  battle.focus=Math.min(6,battle.focus+2);shield=scenario.enemyImpact;note='Team Guard / Consult';break;
 case 'case-choice':
  if(!has('O')||battle.caseResolved||!Number.isInteger(choiceIndex)||
    choiceIndex<0||choiceIndex>=scenario.choices.length)fail('invalid_resolved_action');
  if(choiceIndex===scenario.correctIndex){
   battle.caseResolved=true;battle.focus=Math.min(6,battle.focus+1);note='Correct case reasoning';
  }else{battle.morale=Math.max(0,battle.morale-2);note='Case needs remediation';}
  break;
 default:fail('invalid_resolved_action');
 }
 if(damage){
  battle.fog=Math.max(0,battle.fog-damage);
  if(battle.fog===0&&!['S','O','A','P'].every(has))battle.fog=1;
 }
 return {shield,note};
}
function finishBallot(next,now){
 const battle=next.battle,ballot=battle.ballot;
 if(!ballot||battle.status!=='active')fail('no_open_vote');
 const counts=new Map();
 for(const vote of ballot.votes){
  const key=voteKey(vote.kind,vote.choiceIndex);
  counts.set(key,(counts.get(key)||0)+1);
 }
 const highest=counts.size?Math.max(...counts.values()):0;
 const tied=highest?Array.from(counts.keys()).filter(k=>counts.get(k)===highest):[];
 const leaderVote=ballot.votes.find(v=>v.actorId===next.leaderId);
 const leaderKey=leaderVote&&voteKey(leaderVote.kind,leaderVote.choiceIndex);
 // One vote each; the leader can only break a deadlock, never override a majority.
 // When the leader did not vote among the tied options, safely Guard.
 const tieBreak=tied.length>1||tied.length===0;
 const winnerKey=tied.length===1?tied[0]:(leaderKey&&tied.includes(leaderKey)?leaderKey:'guard');
 let winner;
 if(winnerKey.startsWith('case-choice:')){
  winner={kind:'case-choice',choiceIndex:Number(winnerKey.slice('case-choice:'.length))};
 }else winner={kind:winnerKey};
 const {shield,note}=applyWinningAction(battle,winner);
 battle.lastResult={ballotId:ballot.id,choice:winnerKey,counts:Object.fromEntries(counts),
  voteCount:ballot.votes.length,eligibleCount:ballot.eligiblePlayerIds.length,
  resolution:ballot.votes.length===ballot.eligiblePlayerIds.length?'all-voted':'deadline',
  tieBreak:tieBreak?(winnerKey==='guard'?'safe-guard':'leader-vote'):null};
 battle.log.push({actorId:'party',kind:winner.kind,note,round:battle.round,votes:ballot.votes.length});
 if(battle.morale<=0){battle.status='lost';next.phase='finished';}
 else if(battle.fog===0&&['S','O','A','P'].every(k=>battle.seals.includes(k))){
  battle.status='won';next.phase='finished';
 }else{
  battle.morale=Math.max(0,battle.morale-Math.max(0,scenario.enemyImpact-shield));
  battle.log.push({actorId:'enemy',kind:'enemy-turn',note:'Fog of confusion',round:battle.round});
  if(battle.morale===0){battle.status='lost';next.phase='finished';}
 }
 battle.log=battle.log.slice(-32);
 if(next.phase==='battle'){
  battle.round++;
  openBallot(next,now,ballot.id+1);
 }else{
  battle.ballot=null;
  battle.deadlineAt=null;
 }
 return next;
}
export function submitVote(state,{actorId,actionId,kind,choiceIndex,ballotId,now}){
 checkRoom(state);
 if(!validId(actorId)||!validId(actionId))fail('invalid_vote_id');
 if(!state.players.some(p=>p.id===actorId))fail('not_in_room');
 const key=actorId+':'+actionId;
 if(state.recentActionKeys.includes(key))return state; // idempotent retry
 if(state.phase!=='battle'||!state.battle?.ballot)fail('no_open_vote');
 if(!validNow(now))fail('invalid_clock');
 const ballot=state.battle.ballot;
 if(ballotId!==ballot.id)fail('stale_ballot');
 if(now>=ballot.deadlineAt)fail('vote_expired');
 if(!ballot.eligiblePlayerIds.includes(actorId))fail('not_eligible_this_ballot');
 if(ballot.votes.some(v=>v.actorId===actorId))fail('already_voted');
 const selection=voteKey(kind,choiceIndex);
 if(!voteChoices(state.battle).includes(selection))fail('invalid_vote_choice');
 const next=clone(state);
 next.battle.ballot.votes.push({actorId,kind,choiceIndex:kind==='case-choice'?choiceIndex:null});
 next.recentActionKeys.push(key);
 next.recentActionKeys=next.recentActionKeys.slice(-64);
 if(next.battle.ballot.votes.length===next.battle.ballot.eligiblePlayerIds.length){
  finishBallot(next,now);
 }
 next.version++;return next;
}
export function expireVote(state,now){
 checkRoom(state);if(!validNow(now))fail('invalid_clock');
 if(state.phase!=='battle'||!state.battle?.ballot||now<state.battle.ballot.deadlineAt)return state;
 const next=clone(state);finishBallot(next,now);next.version++;return next;
}
// Deprecated per-player combat entrypoints are intentionally fail-closed: clients
// must not accidentally bypass collective voting through the old turn API.
export function submitTurn(){fail('use_submitVote');}
export function expireTurn(){fail('use_expireVote');}
export function roomView(state){
 checkRoom(state);
 const b=state.battle;
 return {id:state.id,partyId:state.partyId,leaderId:state.leaderId,phase:state.phase,
  version:state.version,maxPlayers:MAX_PLAYERS,
  world:{position:{...state.world.position},
   destination:state.world.destination?{...state.world.destination}:null,
   isMoving:state.world.route.length>0,nextStepAt:state.world.nextStepAt,
   lastInteraction:state.world.lastInteraction},
  players:state.players.map(({id,displayName,connected})=>({id,displayName,connected,
   isLeader:id===state.leaderId})),
  battle:b?{status:b.status,round:b.round,deadlineAt:b.deadlineAt,morale:b.morale,
   focus:b.focus,fog:b.fog,seals:[...b.seals],caseResolved:b.caseResolved,
   foe:scenario.foe,prompt:scenario.prompt,choices:[...scenario.choices],
   availableActions:voteChoices(b),
   ballot:b.ballot?{id:b.ballot.id,deadlineAt:b.ballot.deadlineAt,
    eligiblePlayerIds:[...b.ballot.eligiblePlayerIds],
    votedPlayerIds:b.ballot.votes.map(v=>v.actorId),
    votesReceived:b.ballot.votes.length,votesRequired:b.ballot.eligiblePlayerIds.length}:null,
   lastResult:b.lastResult?structuredClone(b.lastResult):null,log:[...b.log]}:null};
}
