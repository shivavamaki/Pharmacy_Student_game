// Safe browser-side transport for the isolated JRPG multiplayer Worker.
// Firebase ID tokens and single-use WebSocket tickets remain in memory only.
export const ROOM_PROTOCOL='guild-jrpg-v1';
const PARTY_ID=/^[A-Za-z0-9_-]{1,90}$/;
const TICKET=/^[a-f0-9]{64}$/;
const retryable=new Set(['network_unavailable','socket_closed','socket_error','ticket_unavailable','room_busy']);
export class LobbyError extends Error{
 constructor(code){super(code);this.code=code;}
}
const fail=code=>{throw new LobbyError(code);};
export function roomApiOrigin(value){
 if(typeof value!=='string'||!value.trim())fail('server_not_configured');
 let url;try{url=new URL(value);}catch{fail('invalid_server_origin');}
 if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||
    url.search||url.hash)fail('invalid_server_origin');
 return url.origin;
}
export function validPartyId(partyId){return typeof partyId==='string'&&PARTY_ID.test(partyId);}
export function validateRoom(room,partyId,profileId){
 if(!room||typeof room!=='object'||Array.isArray(room)||room.partyId!==partyId||
   !['lobby','battle','finished'].includes(room.phase)||
   !Number.isSafeInteger(room.version)||room.version<1||
   room.maxPlayers!==6||!Array.isArray(room.players)||room.players.length>6||
   !room.players.some(p=>p?.id===profileId))fail('invalid_room_snapshot');
 if(!room.world||!room.world.position||
  !Number.isInteger(room.world.position.x)||!Number.isInteger(room.world.position.y)||
  !Array.isArray(room.players)||room.players.some(p=>typeof p?.id!=='string'||
  typeof p?.displayName!=='string'||typeof p?.connected!=='boolean'))fail('invalid_room_snapshot');
 if(room.battle&&!Array.isArray(room.battle.availableActions))fail('invalid_room_snapshot');
 return room;
}
export async function requestRoomTicket({user,partyId,apiOrigin,fetcher=fetch,signal}){
 if(!validPartyId(partyId))fail('invalid_party');
 const origin=roomApiOrigin(apiOrigin);
 if(!user||typeof user.getIdToken!=='function')fail('authentication_required');
 const token=await user.getIdToken();
 if(typeof token!=='string'||!token||token.length>16384)fail('authentication_required');
 let response;
 try{
  response=await fetcher(origin+'/api/jrpg/parties/'+partyId+'/ticket',{
   method:'POST',headers:{Authorization:'Bearer '+token},
   cache:'no-store',credentials:'omit',redirect:'error',signal
  });
 }catch(e){if(signal?.aborted)fail('cancelled');fail('network_unavailable');}
 let data;try{data=await response.json();}catch{fail('invalid_server_response');}
 if(!response.ok){
  const code=typeof data?.error==='string'&&/^[a-z_]{1,60}$/.test(data.error)?
    data.error:'request_failed';
  fail(code);
 }
 let ws;
 try{ws=new URL(data?.websocketUrl);}catch{fail('invalid_server_response');}
 if(!TICKET.test(data?.ticket)||data.protocol!==ROOM_PROTOCOL||
  data.expiresInSeconds!==60||ws.protocol!=='wss:'||ws.host!==new URL(origin).host||
  ws.pathname!=='/api/jrpg/parties/'+partyId+'/connect'||ws.username||
  ws.password||ws.search||ws.hash)fail('invalid_server_response');
 return {url:ws.href,protocols:[ROOM_PROTOCOL,'ticket.'+data.ticket]};
}
export class RoomConnection{
 constructor({user,partyId,apiOrigin,fetcher=fetch,socketFactory=(url,protocols)=>new WebSocket(url,protocols),
  onState=()=>{},onRoom=()=>{},onError=()=>{},maxRetries=4,retryDelay=1000}){
  if(!validPartyId(partyId))fail('invalid_party');
  this.user=user;this.partyId=partyId;this.apiOrigin=apiOrigin;this.fetcher=fetcher;
  this.socketFactory=socketFactory;this.onState=onState;this.onRoom=onRoom;
  this.onError=onError;this.maxRetries=maxRetries;this.retryDelay=retryDelay;
  this.socket=null;this.abort=null;this.timer=null;this.attempts=0;
  this.epoch=0;this.stopped=true;this.state='idle';this.room=null;
 }
 emitState(state){this.state=state;this.onState(state);}
 async start(){
  this.stop();this.stopped=false;this.attempts=0;
  return this.connect();
 }
 async connect(){
  if(this.stopped)return;
  const epoch=++this.epoch;
  this.abort?.abort();this.abort=new AbortController();
  const signal=this.abort.signal;this.emitState('connecting');
  try{
   const {url,protocols}=await requestRoomTicket({
    user:this.user,partyId:this.partyId,apiOrigin:this.apiOrigin,
    fetcher:this.fetcher,signal
   });
   if(this.stopped||this.epoch!==epoch)return;
   const socket=this.socketFactory(url,protocols);
   this.socket=socket;
   socket.addEventListener('open',()=>{
    if(this.stopped||this.epoch!==epoch){socket.close();return;}
    this.attempts=0;this.emitState('connected');
   });
   socket.addEventListener('message',event=>{
    if(this.stopped||this.epoch!==epoch||typeof event.data!=='string'||event.data.length>20000)return;
    let message;try{message=JSON.parse(event.data);}catch{return this.onError('invalid_server_response');}
    if(message?.type==='error'){
     if(typeof message.code==='string'&&/^[a-z_]{1,60}$/.test(message.code))
      this.onError(message.code);
     else this.onError('invalid_server_response');
    }else if(message?.type==='snapshot'){
     try{this.room=validateRoom(message.room,this.partyId,this.profileId);
      this.onRoom(this.room);
     }catch(error){this.onError(error.code||'invalid_room_snapshot');}
    }
   });
   socket.addEventListener('close',()=>{
    if(this.stopped||this.epoch!==epoch)return;
    this.socket=null;this.room=null;this.emitState('disconnected');
    this.scheduleReconnect('socket_closed',epoch);
   });
   socket.addEventListener('error',()=>{
    if(!this.stopped&&this.epoch===epoch)this.onError('socket_error');
   });
  }catch(error){
   if(this.stopped||this.epoch!==epoch)return;
   const code=error.code||'network_unavailable';this.emitState('disconnected');this.onError(code);
   if(retryable.has(code))this.scheduleReconnect(code,epoch);
  }
 }
 scheduleReconnect(code,epoch){
  if(this.stopped||this.epoch!==epoch)return;
  if(this.attempts>=this.maxRetries){this.onError('reconnect_limit');return;}
  const delay=Math.min(12000,this.retryDelay*2**this.attempts++);
  this.timer=setTimeout(()=>{this.timer=null;void this.connect();},delay);
  this.emitState('retrying');
 }
 setProfileId(profileId){if(typeof profileId!=='string'||!profileId)fail('invalid_profile');this.profileId=profileId;}
 send(command){
  if(this.stopped||this.state!=='connected'||this.socket?.readyState!==1)
   fail('not_connected');
  if(!command||typeof command!=='object'||!['destination','start','transfer','vote'].includes(command.type))
   fail('invalid_action');
  const text=JSON.stringify(command);
  if(text.length>1200)fail('invalid_action');
  this.socket.send(text);
 }
 stop(){
  this.stopped=true;this.epoch++;this.abort?.abort();this.abort=null;
  if(this.timer!==null)clearTimeout(this.timer);this.timer=null;
  if(this.socket){try{this.socket.close(1000,'Leaving room');}catch{}this.socket=null;}
  this.room=null;this.emitState('idle');
 }
}
export function actionCommand(room,actorId,type,extra={}){
 if(!room||!room.players?.some(p=>p.id===actorId))fail('not_in_room');
 if(type==='start'&&room.leaderId===actorId&&room.phase==='lobby')
  return {type};
 if(type==='destination'&&room.leaderId===actorId&&room.phase==='lobby'&&
  Number.isInteger(extra.x)&&Number.isInteger(extra.y))
  return {type,target:{x:extra.x,y:extra.y},expectedVersion:room.version};
 if(type==='transfer'&&room.leaderId===actorId&&room.phase==='lobby'&&
  room.players.some(p=>p.id===extra.newLeaderId&&p.connected))
  return {type,newLeaderId:extra.newLeaderId,expectedVersion:room.version};
 if(type==='vote'&&room.phase==='battle'&&room.battle?.ballot){
  const b=room.battle.ballot;
  if(!b.eligiblePlayerIds.includes(actorId)||b.votedPlayerIds.includes(actorId)||
    !room.battle.availableActions.includes(extra.kind==='case-choice'?'case-choice:'+extra.choiceIndex:extra.kind))
   fail('vote_not_allowed');
  if(typeof extra.actionId!=='string'||!extra.actionId)fail('invalid_action');
  return {type,ballotId:b.id,actionId:extra.actionId,kind:extra.kind,
   ...(extra.kind==='case-choice'?{choiceIndex:extra.choiceIndex}:{})};
 }
 fail('not_authorized_for_action');
}
