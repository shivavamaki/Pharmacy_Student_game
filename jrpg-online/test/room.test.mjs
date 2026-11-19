import test from 'node:test';
import assert from 'node:assert/strict';
import {JrpgRoom} from '../room.mjs';
import {createRoom,joinRoom} from '../../backend/src/jrpg-room-rules.mjs';

function fakeState(){
 const records=new Map();const sockets=[];
 const storage={
  async get(k){return records.get(k);},
  async put(k,v){records.set(k,structuredClone(v));},
  async delete(k){return records.delete(k);},
  async list({prefix}){return new Map([...records].filter(([k])=>k.startsWith(prefix)));},
  async setAlarm(at){storage.nextAlarm=at;},
  async deleteAlarm(){storage.nextAlarm=null;},
  nextAlarm:null
 };
 const ctx={storage,getWebSockets:()=>sockets,
  acceptWebSocket:ws=>sockets.push(ws)};
 const DB={
  prepare(_sql){
   return {bind(party,actor){
    return {first:async()=>party==='party1'&&['p1','p2'].includes(actor)?{profile_id:actor}:null};
   }};
  }
 };
 const env={DB,BRIDGE_SECRET:'isolated-test-secret'};
 return {ctx,env,sockets,records};
}
function socket(profileId){
 const messages=[];
 return {readyState:1,messages,
  deserializeAttachment:()=>({profileId,partyId:'party1'}),
  send:value=>messages.push(JSON.parse(value)),close(){this.readyState=3;}};
}
test('private ticket mint requires internal bridge secret and is bounded',async()=>{
 const {ctx,env,records}=fakeState(),obj=new JrpgRoom(ctx,env);
 const url='https://room.internal/mint';
 const payload={ticket:'a'.repeat(64),partyId:'party1',profileId:'p1',
  displayName:'Player One',expiresAt:Date.now()+60_000};
 const request=secret=>new Request(url,{method:'POST',
  headers:{'Content-Type':'application/json','X-JRPG-Bridge-Secret':secret},
  body:JSON.stringify(payload)});
 assert.equal((await obj.fetch(request('wrong'))).status,403);
 assert.equal((await obj.fetch(request('isolated-test-secret'))).status,201);
 assert.equal((await obj.fetch(request('isolated-test-secret'))).status,400);
 assert.ok([...records.keys()].some(k=>k.startsWith('ticket:')));
 assert.ok(ctx.storage.nextAlarm>0);
});
test('two independently identified sockets cast votes; server resolves exactly once',async()=>{
 const {ctx,env,sockets}=fakeState();
 let state=createRoom({id:'party1',partyId:'party1',hostId:'p1',now:100});
 state=joinRoom(state,{id:'p1',displayName:'Player One'},101);
 state=joinRoom(state,{id:'p2',displayName:'Player Two'},102);
 await ctx.storage.put('room',state);
 const first=socket('p1'),second=socket('p2');sockets.push(first,second);
 const room=new JrpgRoom(ctx,env);
 await room.webSocketMessage(second,JSON.stringify({type:'start'}));
 assert.equal(second.messages.at(-1).code,'leader_only');
 await room.webSocketMessage(first,JSON.stringify({type:'start'}));
 state=await ctx.storage.get('room');assert.equal(state.phase,'battle');
 assert.ok(first.messages.at(-1).room.battle.ballot);
 await room.webSocketMessage(second,JSON.stringify({type:'vote',actionId:'v2',ballotId:1,kind:'listen'}));
 assert.equal(first.messages.at(-1).room.battle.ballot.votesReceived,1);
 assert.equal(JSON.stringify(first.messages.at(-1)).includes('"kind":"listen"'),false);
 await room.webSocketMessage(first,JSON.stringify({type:'vote',actionId:'v1',ballotId:1,kind:'listen'}));
 state=await ctx.storage.get('room');
 assert.equal(state.battle.round,2);
 assert.deepEqual(state.battle.seals,['S']);
 assert.equal(state.battle.lastResult.choice,'listen');
 assert.equal(state.battle.log.filter(x=>x.kind==='enemy-turn').length,1);
 assert.ok(ctx.storage.nextAlarm>0);
});
test('follower cannot set party destination, but leader can; action identity is socket-owned',async()=>{
 const {ctx,env,sockets}=fakeState();
 let s=createRoom({id:'party1',partyId:'party1',hostId:'p1'});
 s=joinRoom(s,{id:'p1',displayName:'One'});
 s=joinRoom(s,{id:'p2',displayName:'Two'});
 await ctx.storage.put('room',s);
 const leader=socket('p1'),member=socket('p2');sockets.push(leader,member);
 const room=new JrpgRoom(ctx,env);
 const forged={type:'destination',actorId:'p1',
  target:{x:10,y:9},expectedVersion:s.version};
 await room.webSocketMessage(member,JSON.stringify(forged));
 assert.equal(member.messages.at(-1).code,'leader_only');
 await room.webSocketMessage(leader,JSON.stringify(forged));
 s=await ctx.storage.get('room');
 assert.deepEqual(s.world.destination,{x:10,y:9});
 assert.deepEqual(s.world.position,{x:9,y:9});
 await room.alarm();
 assert.equal((await ctx.storage.get('room')).world.position.x,9);
});
test('stale or foreign party member is rejected even when socket claims valid identity',async()=>{
 const {ctx,env,sockets}=fakeState();
 let s=createRoom({id:'party1',partyId:'party1',hostId:'p1'});
 s=joinRoom(s,{id:'p1',displayName:'One'});
 await ctx.storage.put('room',s);
 const intruder=socket('p3');sockets.push(intruder);
 const room=new JrpgRoom(ctx,env);
 await room.webSocketMessage(intruder,JSON.stringify({type:'start'}));
 assert.equal(intruder.messages.at(-1).code,'not_in_room');
});
