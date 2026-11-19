// One Durable Object = one student party. Never import this module into
// the shipped browser bundle: correct answers and votes stay on the server.
import {createRoom,joinRoom,setConnection,startEncounter,selectPartyDestination,
 advancePartyMovement,transferLeadership,submitVote,expireVote,roomView} from
 '../backend/src/jrpg-room-rules.mjs';
import {isAuthorizedPartyMember} from './worker.mjs';

const ROOM_KEY='room';
const validTicket=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const hash=async token=>{
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
 return Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
};
const fail=(code,status=400)=>{const e=new Error(code);e.code=code;e.status=status;throw e;};
const resp=(body,status)=>new Response(JSON.stringify(body),{
 status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}
});
function safeCode(error){return typeof error?.code==='string'&&/^[a-z_]+$/.test(error.code)?error.code:'invalid_action';}
export class JrpgRoom{
 constructor(ctx,env){
  this.ctx=ctx;this.env=env;this.queue=Promise.resolve();
 }
 // Serializes every connect, vote, move, disconnect and timer across awaits.
 serial(task){
  const work=this.queue.then(task,task);
  this.queue=work.catch(()=>{});
  return work;
 }
 async fetch(request){
  return this.serial(async()=>{
   const path=new URL(request.url).pathname;
   if(!this.env.BRIDGE_SECRET||request.headers.get('X-JRPG-Bridge-Secret')!==this.env.BRIDGE_SECRET)
    return resp({error:'forbidden'},403);
   try{
    if(path==='/mint'&&request.method==='POST')return this.mint(request);
    if(path==='/connect'&&request.headers.get('Upgrade')?.toLowerCase()==='websocket')
     return this.connect(request);
    return resp({error:'not_found'},404);
   }catch(e){return resp({error:safeCode(e)},Number.isInteger(e.status)?e.status:400);}
  });
 }
 async mint(request){
  const body=await request.json().catch(()=>null);
  if(!body||!validTicket(body.ticket)||
    typeof body.partyId!=='string'||!/^[A-Za-z0-9_-]{1,90}$/.test(body.partyId)||
    typeof body.profileId!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(body.profileId)||
    typeof body.displayName!=='string'||body.displayName.length>100||
    !Number.isSafeInteger(body.expiresAt)||body.expiresAt<=Date.now()||
    body.expiresAt>Date.now()+65_000)fail('invalid_ticket',400);
  const current=await this.ctx.storage.get(ROOM_KEY);
  if(current&&current.partyId!==body.partyId)fail('wrong_party',403);
  const records=await this.ctx.storage.list({prefix:'ticket:'});
  let active=0;
  for(const [key,ticket] of records){
   if(ticket.expiresAt<=Date.now())await this.ctx.storage.delete(key);
   else active++;
  }
  if(active>=24)fail('ticket_capacity',429);
  const key='ticket:'+await hash(body.ticket);
  if(await this.ctx.storage.get(key))fail('duplicate_ticket');
  await this.ctx.storage.put(key,{
   partyId:body.partyId,profileId:body.profileId,
   displayName:body.displayName,expiresAt:body.expiresAt
  });
  await this.setNextAlarm(current);
  return resp({ok:true},201);
 }
 async connect(request){
  const protocols=(request.headers.get('Sec-WebSocket-Protocol')||'')
   .split(',').map(v=>v.trim());
  const presented=protocols.find(v=>/^ticket\.[a-f0-9]{64}$/.test(v));
  if(!protocols.includes('guild-jrpg-v1')||!presented)
   fail('connection_ticket_required',401);
  const ticketKey='ticket:'+await hash(presented.slice(7));
  const ticket=await this.ctx.storage.get(ticketKey);
  if(!ticket||ticket.expiresAt<=Date.now())fail('ticket_expired',401);
  // Consume immediately, including failed attempts. This prevents replay.
  await this.ctx.storage.delete(ticketKey);
  if(!await isAuthorizedPartyMember(this.env.DB,ticket.partyId,ticket.profileId))
   fail('party_access_denied',403);
  const previous=await this.ctx.storage.get(ROOM_KEY);
  if(previous&&previous.partyId!==ticket.partyId)fail('wrong_party',403);
  // First *verified* student to CONNECT is temporary leader; GM designation
  // is a future feature. The browser cannot send the identity/leaderId.
  let state=previous??createRoom({id:ticket.partyId,partyId:ticket.partyId,
   hostId:ticket.profileId,now:Date.now()});
  state=joinRoom(state,{id:ticket.profileId,displayName:ticket.displayName},Date.now());
  const pair=new WebSocketPair();
  const [client,server]=Object.values(pair);
  // Only one live connection per member. Reconnect replaces the old socket.
  for(const old of this.ctx.getWebSockets()){
   if(old.deserializeAttachment()?.profileId===ticket.profileId)
    old.close(4001,'Connected from another session');
  }
  this.ctx.acceptWebSocket(server);
  server.serializeAttachment({profileId:ticket.profileId,partyId:ticket.partyId});
  await this.ctx.storage.put(ROOM_KEY,state);
  this.broadcast(state);
  await this.setNextAlarm(state);
  return new Response(null,{status:101,webSocket:client,
   headers:{'Sec-WebSocket-Protocol':'guild-jrpg-v1'}});
 }
 broadcast(state){
  const payload=JSON.stringify({type:'snapshot',room:roomView(state)});
  for(const socket of this.ctx.getWebSockets()){
   try{if(socket.readyState===1)socket.send(payload);}catch{/* socket disconnect */}
  }
 }
 sendError(socket,code){
  try{socket.send(JSON.stringify({type:'error',code}));}catch{/* disconnected */}
 }
 async webSocketMessage(socket,message){
  return this.serial(async()=>{
   try{
    if(typeof message!=='string'||message.length>1200)fail('invalid_message');
    const payload=JSON.parse(message);
    if(!payload||typeof payload!=='object'||Array.isArray(payload))fail('invalid_message');
    const identity=socket.deserializeAttachment();
    if(!identity?.profileId)fail('unauthorized',403);
    const state=await this.ctx.storage.get(ROOM_KEY);
    if(!state||!state.players.some(p=>p.id===identity.profileId))fail('not_in_room',403);
    if(!await isAuthorizedPartyMember(this.env.DB,state.partyId,identity.profileId))
     fail('party_access_denied',403);
    const actorId=identity.profileId,now=Date.now();
    let next;
    switch(payload.type){
     case 'start':
      next=startEncounter(state,{actorId,now});break;
     case 'destination':
      next=selectPartyDestination(state,{
       actorId,target:payload.target,expectedVersion:payload.expectedVersion,now});break;
     case 'transfer':
      next=transferLeadership(state,{
       actorId,newLeaderId:payload.newLeaderId,expectedVersion:payload.expectedVersion});break;
     case 'vote':
      next=submitVote(state,{
       actorId,actionId:payload.actionId,kind:payload.kind,choiceIndex:payload.choiceIndex,
       ballotId:payload.ballotId,now});break;
     default:fail('unknown_message');
    }
    if(next!==state){
     await this.ctx.storage.put(ROOM_KEY,next);
     await this.setNextAlarm(next);
     this.broadcast(next);
    }else this.sendError(socket,'duplicate_action');
   }catch(error){this.sendError(socket,safeCode(error));}
  });
 }
 async webSocketClose(socket,code,reason,wasClean){
  return this.serial(async()=>{
   const identity=socket.deserializeAttachment();
   if(!identity?.profileId)return;
   const state=await this.ctx.storage.get(ROOM_KEY);
   if(!state)return;
   const stillConnected=this.ctx.getWebSockets().some(other=>
    other!==socket&&other.readyState===1&&
    other.deserializeAttachment()?.profileId===identity.profileId);
   if(stillConnected)return;
   try{
    const next=setConnection(state,identity.profileId,false);
    await this.ctx.storage.put(ROOM_KEY,next);
    this.broadcast(next);await this.setNextAlarm(next);
   }catch{/* invalid state cannot leave a stale public exception */}
  });
 }
 async webSocketError(socket){try{socket.close(1011,'Connection error');}catch{}}
 async setNextAlarm(state){
  const times=[];
  if(state?.phase==='battle'&&state.battle?.ballot)
   times.push(state.battle.ballot.deadlineAt);
  if(state?.phase==='lobby'&&state.world?.route?.length&&state.world.nextStepAt)
   times.push(state.world.nextStepAt);
  const tickets=await this.ctx.storage.list({prefix:'ticket:'});
  for(const row of tickets.values())times.push(row.expiresAt);
  if(times.length)await this.ctx.storage.setAlarm(Math.max(Date.now()+1,Math.min(...times)));
  else await this.ctx.storage.deleteAlarm();
 }
 async alarm(){
  return this.serial(async()=>{
   const now=Date.now();
   const tickets=await this.ctx.storage.list({prefix:'ticket:'});
   for(const [key,t] of tickets)if(t.expiresAt<=now)await this.ctx.storage.delete(key);
   const current=await this.ctx.storage.get(ROOM_KEY);
   let next=current;
   if(current?.phase==='lobby')next=advancePartyMovement(current,now);
   else if(current?.phase==='battle')next=expireVote(current,now);
   if(next&&next!==current){
    await this.ctx.storage.put(ROOM_KEY,next);this.broadcast(next);
   }
   await this.setNextAlarm(next);
  });
 }
}
