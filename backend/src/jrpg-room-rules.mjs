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
export function startEncounter(state,{actorId,now=0}){
  checkRoom(state);
  if(!validNow(now))fail('invalid_clock');
  if(actorId!==state.leaderId)fail('leader_only');
  if(state.phase!=='lobby')fail('room_started');
  if(!state.players.some(p=>p.id===actorId))fail('host_not_seated');
  if(state.players.length<1||state.players.length>MAX_PLAYERS)fail('invalid_seats');
  const next=clone(state);next.phase='battle';
  next.world.destination=null;next.world.route=[];next.world.nextStepAt=null;
  next.battle={status:'active',round:1,turnIndex:0,deadlineAt:now+TURN_DURATION_MS,
    morale:20,focus:4,fog:scenario.fog,seals:[],caseResolved:false,log:[]};
  next.version++;return next;
}
function resolve(next,{actorId,kind,choiceIndex,now}){
  const b=next.battle;
  if(b.status!=='active')fail('battle_finished');
  if(next.players[b.turnIndex]?.id!==actorId)fail('not_your_turn');
  if(!validNow(now))fail('invalid_clock');
  if(now>=b.deadlineAt)fail('turn_expired');
  const has=key=>b.seals.includes(key);
  let damage=0,note='';
  switch(kind){
    case 'listen':
      if(!has('S'))b.seals.push('S');
      b.focus=Math.min(6,b.focus+1);note='Listen (S)';break;
    case 'verify':
      if(!has('S'))fail('requires_subjective');
      if(b.focus<1)fail('insufficient_focus');
      b.focus--;if(!has('O'))b.seals.push('O');damage=2;note='Verify (O)';break;
    case 'assess':
      if(!has('O')||!b.caseResolved)fail('assessment_not_ready');
      if(b.focus<1)fail('insufficient_focus');
      b.focus--;if(!has('A'))b.seals.push('A');damage=3;note='Assess (A)';break;
    case 'plan':
      if(!has('A'))fail('requires_assessment');
      if(b.focus<2)fail('insufficient_focus');
      b.focus-=2;if(!has('P'))b.seals.push('P');damage=5;note='Plan (P)';break;
    case 'guard':
      b.focus=Math.min(6,b.focus+2);note='Consult / Guard';break;
    case 'case-choice':
      if(!has('O'))fail('case_not_ready');
      if(b.caseResolved)fail('case_already_resolved');
      if(!Number.isInteger(choiceIndex)||choiceIndex<0||choiceIndex>=scenario.choices.length)fail('invalid_choice');
      if(choiceIndex===scenario.correctIndex){
        b.caseResolved=true;b.focus=Math.min(6,b.focus+1);note='Correct case reasoning';
      }else{b.morale=Math.max(0,b.morale-2);note='Remediation required';}
      break;
    default:fail('invalid_action');
  }
  if(damage){
    b.fog=Math.max(0,b.fog-damage);
    if(b.fog===0&&!['S','O','A','P'].every(has))b.fog=1;
  }
  b.log.push({actorId,kind,note,round:b.round});
  if(b.morale<=0){b.status='lost';next.phase='finished';}
  else if(b.fog===0&&['S','O','A','P'].every(has)){b.status='won';next.phase='finished';}
  else if(b.turnIndex+1<next.players.length){b.turnIndex++;}
  else{
    b.turnIndex=0;b.round++;
    b.morale=Math.max(0,b.morale-scenario.enemyImpact);
    b.log.push({actorId:'enemy',kind:'enemy-turn',note:'Fog of confusion',round:b.round-1});
    if(b.morale===0){b.status='lost';next.phase='finished';}
  }
  b.deadlineAt=now+TURN_DURATION_MS;
  b.log=b.log.slice(-32);
  return next;
}
export function submitTurn(state,{actorId,actionId,kind,choiceIndex,expectedVersion,now}){
  checkRoom(state);
  if(!validId(actorId)||!validId(actionId))fail('invalid_action_id');
  if(!state.players.some(p=>p.id===actorId))fail('not_in_room');
  const key=actorId+':'+actionId;
  if(state.recentActionKeys.includes(key))return state;
  if(state.phase!=='battle')fail('no_active_encounter');
  if(!Number.isInteger(expectedVersion)||expectedVersion!==state.version)fail('stale_turn');
  const next=resolve(clone(state),{actorId,kind,choiceIndex,now});
  next.recentActionKeys.push(key);
  next.recentActionKeys=next.recentActionKeys.slice(-64);
  next.version++;return next;
}
export function expireTurn(state,now){
  checkRoom(state);if(!validNow(now))fail('invalid_clock');
  if(state.phase!=='battle'||state.battle.status!=='active'||now<state.battle.deadlineAt)return state;
  const actorId=state.players[state.battle.turnIndex]?.id;
  if(!actorId)fail('invalid_turn_order');
  const next=resolve(clone(state),{actorId,kind:'guard',now:state.battle.deadlineAt-1});
  next.battle.log.push({actorId,kind:'timeout',note:'Auto-guard',round:next.battle.round});
  next.battle.deadlineAt=now+TURN_DURATION_MS;next.version++;
  return next;
}
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
    battle:b?{status:b.status,round:b.round,currentPlayerId:state.players[b.turnIndex]?.id||null,
      deadlineAt:b.deadlineAt,morale:b.morale,focus:b.focus,fog:b.fog,
      seals:[...b.seals],caseResolved:b.caseResolved,foe:scenario.foe,
      prompt:scenario.prompt,choices:[...scenario.choices],log:[...b.log]}:null};
}
