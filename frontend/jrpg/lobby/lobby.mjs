import {firebaseConfig} from '../../firebase-config.mjs';
import {getMyProfile,getMyParties} from '../../api-client.mjs';
import {RoomConnection,roomApiOrigin,actionCommand} from './client.mjs';
import {JRPG_ROOM_API_ORIGIN} from './runtime-config.mjs';
import {SIZE,terrain,pointFromMapEvent,landmarks} from './map.mjs';

const $=id=>document.getElementById(id);
const node=(tag,text,className)=>{
 const el=document.createElement(tag);
 if(text!==undefined)el.textContent=String(text);
 if(className)el.className=className;
 return el;
};
const svgNode=(tag,attrs={})=>{
 const el=document.createElementNS('http://www.w3.org/2000/svg',tag);
 for(const [name,value] of Object.entries(attrs))el.setAttribute(name,String(value));
 return el;
};
const errors={
 server_not_configured:'ยังไม่เปิด Multiplayer Server กรุณารอให้ผู้ดูแลเชื่อมต่อระบบ',
 invalid_server_origin:'Multiplayer Server URL ยังไม่ได้รับการยืนยัน',
 authentication_required:'กรุณาเข้าสู่ระบบด้วยบัญชีนักศึกษา',
 party_access_denied:'บัญชีนี้ไม่ใช่สมาชิกของปาร์ตี้',
 student_only:'เฉพาะบัญชีนักศึกษาสำหรับการเข้าร่วมทีม',
 room_full:'ห้องนี้มีสมาชิกครบ 6 คนแล้ว',
 room_started:'เริ่มการต่อสู้แล้ว ไม่สามารถเข้าห้องครั้งแรกกลางเกม',
 leader_only:'เฉพาะหัวหน้าปาร์ตี้ควบคุมการเคลื่อนที่และเริ่มการต่อสู้',
 not_authorized_for_action:'คุณไม่มีสิทธิ์ทำคำสั่งนี้ในตอนนี้',
 vote_not_allowed:'คุณโหวตรอบนี้แล้ว หรือคำสั่งยังไม่พร้อม',
 invalid_vote_choice:'คำสั่งโหวตไม่ถูกต้อง',
 already_voted:'ส่งโหวตรอบนี้ไปแล้ว',
 stale_ballot:'การโหวตรอบเก่าหมดเวลาแล้ว',
 stale_destination:'แผนที่เปลี่ยนแล้ว กรุณาเลือกจุดหมายอีกครั้ง',
 socket_closed:'ขาดการเชื่อมต่อ กำลังเชื่อมต่อใหม่',
 reconnect_limit:'เชื่อมต่อใหม่หลายครั้งไม่สำเร็จ กรุณากด Reconnect',
 invalid_room_snapshot:'ข้อมูลห้องไม่ถูกต้อง โปรดลองเชื่อมต่อใหม่',
 authentication_unavailable:'ระบบตรวจสอบบัญชียังไม่พร้อม',
 origin_not_allowed:'โดเมนนี้ยังไม่ได้รับอนุญาตให้เชื่อมต่อเกม',
 network_unavailable:'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้'
};
let auth=null,sdk=null,currentUser=null,profile=null,session=null,room=null;
let generation=0,selectedParty='';
let serviceAvailable=false;
try{roomApiOrigin(JRPG_ROOM_API_ORIGIN);serviceAvailable=true;}catch{/* intentionally disabled */}

function label(code){return errors[code]||'ไม่สามารถดำเนินการได้ ('+String(code||'unknown').slice(0,60)+')';}
function accountStatus(text){$('account-status').textContent=text;}
function connectionError(code){$('connection-error').textContent=code?label(code):'';}
function connectionStatus(status){
 const labels={idle:'ยังไม่เชื่อมต่อ',connecting:'กำลังเข้าห้อง…',connected:'เชื่อมต่อแล้ว',disconnected:'ขาดการเชื่อมต่อ',retrying:'กำลังเชื่อมต่อใหม่…'};
 $('connection-status').textContent='Online status: '+(labels[status]||status);
 $('disconnect').disabled=!session||status==='idle';
 $('retry').disabled=!session||!['disconnected','retrying'].includes(status);
 $('connect').disabled=!serviceAvailable||!profile||!selectedParty||status==='connected'||status==='connecting'||status==='retrying';
}
function rosterSeat(player,index,leaderId){
 const seat=node('div',undefined,'seat'+(player?(player.connected?' online':' offline'):'')+
  (player?.id===leaderId?' leader':''));
 const name=player?.displayName||'Empty seat';
 const title=node('strong',(player?.id===leaderId?'👑 ':'')+'Seat '+(index+1)+' · '+name);
 const detail=node('small',player?(player.connected?'Online':'Disconnected'):'Waiting for player');
 seat.append(title,detail);return seat;
}
function paintRoster(){
 const root=$('roster');root.replaceChildren();
 for(let i=0;i<6;i++)root.append(rosterSeat(room?.players?.[i],i,room?.leaderId));
 const leader=room&&profile&&room.leaderId===profile.id&&room.phase==='lobby';
 const control=$('leader-controls'),transfer=$('leader-transfer');
 control.hidden=!leader;
 transfer.replaceChildren();
 const candidates=leader?room.players.filter(p=>p.connected&&p.id!==profile.id):[];
 for(const p of candidates){const opt=node('option',p.displayName);opt.value=p.id;transfer.add(opt);}
 $('transfer').disabled=candidates.length===0;
}
function paintWorld(){
 const position=room?.world?.position;
 $('world-location').textContent=position?'X:'+position.x+' Y:'+position.y:'X:– Y:–';
 $('travel-status').textContent=room?
  (room.world.isMoving?'Leader destination selected. Party travelling together':
   room.world.lastInteraction?'Arrived at '+room.world.lastInteraction:
    'Team is waiting at Guild position'): 'Waiting for party connection';
 const leader=Boolean(room&&profile&&room.leaderId===profile.id&&room.phase==='lobby'&&session?.state==='connected');
 $('world-map').classList.toggle('is-locked',!leader);
 for(const b of document.querySelectorAll('button.destination'))b.disabled=!leader;
 $('start-battle').disabled=!leader;
 const marker=$('world-map').querySelector('.team-marker');
 if(marker&&position){marker.setAttribute('cx',position.x*16+8);marker.setAttribute('cy',position.y*16+8);marker.style.display='';}
 else if(marker)marker.style.display='none';
}
function paintBattle(){
 const b=room?.battle,root=$('vote-options');
 root.replaceChildren();$('battle-stats').replaceChildren();$('vote-roster').replaceChildren();
 $('battle-round').textContent=b?'ROUND '+b.round:room?.phase==='finished'?'FINISHED':'NOT STARTED';
 if(!b){$('vote-status').textContent='Waiting for party battle';$('vote-results').replaceChildren();return;}
 $('battle-stats').append(node('p','TEAM MORALE '+b.morale+' · FOCUS '+b.focus+' · FOG '+b.fog+
   ' · SEALS '+(b.seals.join(' / ')||'None'),'hint'));
 const ballot=b.ballot;
 $('vote-status').textContent=ballot?
  'Voting '+ballot.votesReceived+'/'+ballot.votesRequired+
   ' · Ends '+new Date(ballot.deadlineAt).toLocaleTimeString('th-TH'):
  'Voting closed · '+b.status;
 if(ballot)for(const id of ballot.eligiblePlayerIds){
  const person=room.players.find(p=>p.id===id);
  const voted=ballot.votedPlayerIds.includes(id);
  $('vote-roster').append(rosterSeat({
   id,displayName:(person?.displayName||'Member')+(voted?' ✓ Voted':' · Awaiting'),
   connected:person?.connected??false
  },ballot.eligiblePlayerIds.indexOf(id),room.leaderId));
 }
 const last=b.lastResult,results=$('vote-results');results.replaceChildren();
 if(last){
  results.append(node('strong','Winning command: '+last.choice+' · Votes: '+last.voteCount+'/'+last.eligibleCount));
  const summary=Object.entries(last.counts||{}).map(([name,count])=>name+' '+count).join(' · ');
  results.append(node('p',summary+(last.tieBreak?' · Tie: '+last.tieBreak:'')));
 }else results.append(node('span','Votes are private until the round finishes.'));
 const canVote=Boolean(ballot&&profile&&session?.state==='connected'&&
  ballot.eligiblePlayerIds.includes(profile.id)&&!ballot.votedPlayerIds.includes(profile.id));
 if(b.status!=='active')return;
 for(const choice of b.availableActions||[]){
  const isCase=choice.startsWith('case-choice:'),index=isCase?Number(choice.slice(12)):-1;
  const display=isCase?String.fromCharCode(65+index)+'. '+(b.choices?.[index]||'Case option'):
   ({listen:'Listen (S)',verify:'Verify (O)',assess:'Assess (A)',
      plan:'Plan (P)',guard:'Consult / Guard'}[choice]||choice);
  const button=node('button',display);
  button.type='button';button.disabled=!canVote;
  button.addEventListener('click',()=>{
   try{session.send(actionCommand(room,profile.id,'vote',{
    kind:isCase?'case-choice':choice,
    choiceIndex:isCase?index:undefined,
    actionId:crypto.randomUUID()
   }));
   $('vote-status').textContent='Vote submitted. Waiting for server acknowledgement…';
   // Actual eligibility only changes after the authenticated server snapshot.
  }catch(error){connectionError(error.code);}
  });
  root.append(button);
 }
}
function paintRoom(){
 $('room-phase').textContent=room?room.phase.toUpperCase():'OFFLINE';
 paintRoster();paintWorld();paintBattle();
}
function leaveRoom(){
 if(session){session.stop();session=null;}
 room=null;paintRoom();connectionStatus('idle');
}
function initMap(){
 const map=$('world-map'),colors=new Map();
 for(let y=0;y<SIZE.height;y++)for(let x=0;x<SIZE.width;x++){
  const type=terrain(x,y);map.append(svgNode('rect',{
    x:x*16,y:y*16,width:16,height:16,class:'tile-'+type
  }));
 }
 for(const [key,point] of Object.entries(landmarks)){
  const circle=svgNode('circle',{cx:point.x*16+8,cy:point.y*16+8,
   r:5,fill:key==='portal'?'#ce9bfa':key==='master'?'#f5dc91':'#b1f5ca'});
  const title=svgNode('title');title.textContent=key;circle.append(title);map.append(circle);
 }
 const marker=svgNode('circle',{cx:0,cy:0,r:6,fill:'#ffffff',
  stroke:'#132d37','stroke-width':3,class:'team-marker'});
 marker.style.display='none';map.append(marker);
 map.addEventListener('click',event=>{
  if(!room||!profile||room.leaderId!==profile.id||room.phase!=='lobby'||session?.state!=='connected')return;
  const bounds=map.getBoundingClientRect(),point=pointFromMapEvent(event.clientX,event.clientY,bounds);
  sendAction('destination',point);
 });
}
function sendAction(type,extra={}){
 try{
  if(!session||!room||!profile)throw {code:'not_connected'};
  session.send(actionCommand(room,profile.id,type,extra));
  connectionError('');
 }catch(error){connectionError(error.code);}
}
async function loadParties(user,stamp){
 accountStatus('กำลังตรวจสิทธิ์และรายการปาร์ตี้…');
 try{
  const p=await getMyProfile(user);
  if(stamp!==generation||user!==currentUser)return;
  profile=p;
  $('account-name').textContent=p.displayName+' · '+p.role;
  $('account-name').hidden=false;
  if(p.role!=='student'){accountStatus('GM / Admin ใช้ Guild Portal ได้ แต่ยังไม่เปิดสิทธิ์ผู้สังเกตการณ์ในห้อง JRPG');return;}
  const result=await getMyParties(user);
  if(stamp!==generation||user!==currentUser)return;
  const select=$('party-select');select.replaceChildren();
  const first=node('option','Select your Guild party');first.value='';select.add(first);
  for(const p of result.parties){const opt=node('option',p.name);opt.value=p.id;select.add(opt);}
  select.disabled=result.parties.length===0;
  accountStatus(result.parties.length?'บัญชีนักศึกษาพร้อมใช้งาน':'ยังไม่มีปาร์ตี้ที่อนุญาต');
  connectionStatus('idle');
 }catch(error){if(stamp===generation){accountStatus(label(error.code||'authentication_unavailable'));}}
}
async function join(){
 connectionError('');if(!currentUser||!profile||!selectedParty)return;
 if(!serviceAvailable){connectionError('server_not_configured');return;}
 leaveRoom();
 const p=selectedParty;
 const connection=new RoomConnection({
  user:currentUser,partyId:p,apiOrigin:JRPG_ROOM_API_ORIGIN,
  onState:state=>{if(session!==connection)return;connectionStatus(state);paintRoom();},
  onRoom:snapshot=>{if(session!==connection)return;room=snapshot;paintRoom();},
  onError:code=>{if(session===connection)connectionError(code)}
 });
 connection.setProfileId(profile.id);session=connection;
 await connection.start();
}
function events(){
 $('party-select').addEventListener('change',event=>{
  leaveRoom();selectedParty=event.target.value;connectionStatus('idle');
 });
 $('connect').addEventListener('click',()=>void join());
 $('retry').addEventListener('click',()=>{if(session)void session.start()});
 $('disconnect').addEventListener('click',leaveRoom);
 $('start-battle').addEventListener('click',()=>sendAction('start'));
 $('transfer').addEventListener('click',()=>sendAction('transfer',{newLeaderId:$('leader-transfer').value}));
 for(const button of document.querySelectorAll('button.destination'))
  button.addEventListener('click',()=>sendAction('destination',{
   x:Number(button.dataset.x),y:Number(button.dataset.y)
  }));
}
async function initAuth(){
 try{
  const [appSDK,authSDK]=await Promise.all([
   import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js'),
   import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js')
  ]);
  sdk=authSDK;
  const app=appSDK.initializeApp(firebaseConfig,'pharmacy-guild-jrpg-lobby');
  auth=sdk.getAuth(app);await sdk.setPersistence(auth,sdk.inMemoryPersistence);
  const provider=new sdk.GoogleAuthProvider();
  provider.setCustomParameters({prompt:'select_account'});
  $('login').disabled=false;
  $('login').addEventListener('click',async()=>{
   $('login').disabled=true;
   try{await sdk.signInWithPopup(auth,provider);}
   catch(error){accountStatus(label(error.code||'authentication_unavailable'));}
   finally{$('login').disabled=false;}
  });
  $('logout').addEventListener('click',async()=>{leaveRoom();await sdk.signOut(auth);});
  sdk.onAuthStateChanged(auth,user=>{
   generation++;leaveRoom();currentUser=user;profile=null;selectedParty='';
   $('account-name').hidden=true;$('party-select').replaceChildren();
   $('party-select').disabled=true;
   $('login').hidden=Boolean(user);$('logout').hidden=!user;
   connectionStatus('idle');
   if(user)void loadParties(user,generation);
   else accountStatus('Sign in with your existing Guild student account.');
  });
 }catch(error){accountStatus('โหลด Firebase Login ไม่สำเร็จ กรุณาตรวจการเชื่อมต่อหรือการอนุญาตโดเมน');}
}
initMap();events();paintRoom();
$('service-warning').textContent=serviceAvailable?
 'Development service configured. Only test with approved student accounts. Official XP and assignments are not modified.':
 'Multiplayer server is not deployed or configured yet. You may view this lobby, but joining an online room is disabled.';
void initAuth();
