import test from 'node:test';
import assert from 'node:assert/strict';
import {LobbyError,roomApiOrigin,requestRoomTicket,RoomConnection,actionCommand,validateRoom} from '../client.mjs';
const partyId='party1',origin='https://rooms.example.test';
const ticket='a'.repeat(64);
const response={ticket,websocketUrl:origin.replace('https:','wss:')+'/api/jrpg/parties/party1/connect',
 expiresInSeconds:60,protocol:'guild-jrpg-v1'};
const user={getIdToken:async()=> 'signed-firebase-token'};
const sample={
 partyId,phase:'lobby',version:5,leaderId:'p1',maxPlayers:6,
 players:[{id:'p1',displayName:'Leader',connected:true},{id:'p2',displayName:'Member',connected:true}],
 world:{position:{x:9,y:9},destination:null,isMoving:false,lastInteraction:null},battle:null
};
test('offline / insecure / malformed server configuration is rejected',()=>{
 for(const v of ['', 'http://rooms.example.test','https://rooms.example.test:443/x','https://u:p@rooms.example.test/']){
  assert.throws(()=>roomApiOrigin(v));
 }
 assert.equal(roomApiOrigin(origin),origin);
 assert.throws(()=>validateRoom({...sample,partyId:'other'},partyId,'p1'),/invalid_room_snapshot/);
 assert.throws(()=>validateRoom({...sample,players:[]},partyId,'p1'),/invalid_room_snapshot/);
});
test('Firebase ID token is sent only in HTTPS POST, never WebSocket URL',async()=>{
 let req;
 const out=await requestRoomTicket({user,partyId,apiOrigin:origin,fetcher:async (url,options)=>{
  req={url,options};return new Response(JSON.stringify(response),{status:200});
 }});
 assert.equal(req.options.headers.Authorization,'Bearer signed-firebase-token');
 assert.equal(req.options.credentials,'omit');assert.equal(req.options.redirect,'error');
 assert.equal(req.options.method,'POST');
 assert.deepEqual(out.protocols,['guild-jrpg-v1','ticket.'+ticket]);
 assert.equal(out.url.includes('signed-firebase-token'),false);
 assert.equal(out.url.includes(ticket),false);
});
test('ticket URL is restricted to the configured Worker origin and requested party',async()=>{
 const fetcher=async()=>new Response(JSON.stringify({...response,websocketUrl:'wss://evil.test/steal'}));
 await assert.rejects(()=>requestRoomTicket({user,partyId,apiOrigin:origin,fetcher}),/invalid_server_response/);
 const fake=async()=>new Response(JSON.stringify({...response,ticket:'wrong'}));
 await assert.rejects(()=>requestRoomTicket({user,partyId,apiOrigin:origin,fetcher:fake}),/invalid_server_response/);
});
test('leader controls map and encounter while members can vote but cannot impersonate',()=>{
 assert.deepEqual(actionCommand(sample,'p1','destination',{x:10,y:9}),{
  type:'destination',target:{x:10,y:9},expectedVersion:5});
 assert.throws(()=>actionCommand(sample,'p2','destination',{x:10,y:9}),/not_authorized_for_action/);
 assert.deepEqual(actionCommand(sample,'p1','start'),{type:'start'});
 const battle={...sample,phase:'battle',battle:{
  availableActions:['listen','guard','case-choice:1'],
  ballot:{id:3,eligiblePlayerIds:['p1','p2'],votedPlayerIds:['p1']}
 }};
 assert.deepEqual(actionCommand(battle,'p2','vote',{kind:'listen',actionId:'cmd-one'}),{
  type:'vote',ballotId:3,actionId:'cmd-one',kind:'listen'});
 assert.throws(()=>actionCommand(battle,'p1','vote',{kind:'listen',actionId:'cmd-one'}),/vote_not_allowed/);
 assert.throws(()=>actionCommand(battle,'p2','vote',{kind:'plan',actionId:'cmd-two'}),/vote_not_allowed/);
 assert.throws(()=>actionCommand(battle,'p2','start'),/not_authorized_for_action/);
});
class FakeSocket{
 constructor(){this.readyState=0;this.events={};this.sent=[];this.closed=false;}
 addEventListener(type,cb){(this.events[type]??=[]).push(cb);}
 dispatch(type,event={}){for(const cb of this.events[type]||[])cb(event);}
 send(payload){this.sent.push(JSON.parse(payload));}
 close(){this.readyState=3;this.closed=true;this.dispatch('close');}
 open(){this.readyState=1;this.dispatch('open');}
}
test('room connection receives sanitized snapshots and stops on logout',async()=>{
 const statuses=[],seen=[],errors=[],sockets=[];
 const client=new RoomConnection({user,partyId,apiOrigin:origin,
  fetcher:async()=>new Response(JSON.stringify(response)),
  socketFactory:(url,protocols)=>{const s=new FakeSocket();sockets.push(s);return s;},
  onState:s=>statuses.push(s),onRoom:r=>seen.push(r),onError:e=>errors.push(e)});
 client.setProfileId('p1');await client.start();
 assert.equal(sockets.length,1);
 sockets[0].open();
 sockets[0].dispatch('message',{data:JSON.stringify({type:'snapshot',room:sample})});
 assert.equal(seen.length,1);assert.equal(client.state,'connected');
 client.send(actionCommand(sample,'p1','start'));
 assert.deepEqual(sockets[0].sent,[{type:'start'}]);
 client.stop();
 assert.equal(client.state,'idle');assert.equal(sockets[0].closed,true);
 assert.deepEqual(errors,[]);
});
test('reconnect uses a fresh ticket; exhausted retries stop',async()=>{
 const sockets=[];let tickets=0,states=[];
 const client=new RoomConnection({user,partyId,apiOrigin:origin,
  maxRetries:1,retryDelay:1,
  fetcher:async()=>{tickets++;return new Response(JSON.stringify({...response,ticket:(tickets%2?'b':'c').repeat(64)}));},
  socketFactory:(url,protocols)=>{const s=new FakeSocket();sockets.push(s);return s;},
  onState:s=>states.push(s)});
 client.setProfileId('p1');await client.start();
 sockets[0].open();sockets[0].close();
 await new Promise(resolve=>setTimeout(resolve,20));
 assert.equal(tickets,2);
 assert.equal(sockets.length,2);
 client.stop();assert.equal(client.state,'idle');
});
