import test from 'node:test';
import assert from 'node:assert/strict';
import {createJrpgOnlineWorker,isAuthorizedPartyMember} from '../worker.mjs';

const makeDB=()=>({
  prepare(query){
    if(query.includes('firebase_uid = ?')){
      return {bind(uid){return {first:async()=>uid==='uid-one'?{
        id:'p1',display_name:'Student One',role:'student',status:'active'
      }:uid==='uid-gm'?{
        id:'gm1',display_name:'GM',role:'gm',status:'active'
      }:null};}};
    }
    if(query.includes('JOIN parties p ON p.id=m.party_id')){
      return {bind(party,id){return {first:async()=>
        party==='party1'&&id==='p1'?{profile_id:'p1'}:null};}};
    }
    throw new Error('unknown mock query');
  }
});
function mockEnvironment(){
 const calls=[];
 const stub={async fetch(input,options){
   calls.push({input,options});
   return new Response(JSON.stringify({ok:true}),{status:201});
 }};
 const env={DB:makeDB(),FIREBASE_PROJECT_ID:'pharmacy-student-game',
  BRIDGE_SECRET:'test-secret',ALLOWED_ORIGIN:'https://preview.test',
  JRPG_ROOMS:{idFromName:v=>v,get:()=>stub}};
 return {env,calls,stub};
}
const verifier=async token=>{
 if(token==='valid-student')return 'uid-one';
 if(token==='valid-gm')return 'uid-gm';
 throw new Error('forged');
};
const worker=createJrpgOnlineWorker(verifier);
function request(method,path,token,origin='https://preview.test'){
 return new Request('https://rooms.test'+path,{method,headers:{
  Origin:origin,...(token?{Authorization:'Bearer '+token}:{})
 }});
}
test('authorized student obtains a cryptographically random single-use room ticket',async()=>{
 const {env,calls}=mockEnvironment();
 const url='/api/jrpg/parties/party1/ticket';
 const response=await worker.fetch(request('POST',url,'valid-student'),env);
 assert.equal(response.status,200);
 const body=await response.json();
 assert.match(body.ticket,/^[a-f0-9]{64}$/);
 assert.equal(body.websocketUrl,'wss://rooms.test/api/jrpg/parties/party1/connect');
 assert.equal(body.expiresInSeconds,60);
 assert.equal(calls.length,1);
 assert.equal(calls[0].options.method,'POST');
 const forwarded=JSON.parse(calls[0].options.body);
 assert.equal(forwarded.profileId,'p1');
 assert.equal(forwarded.partyId,'party1');
 assert.equal(forwarded.ticket,body.ticket);
 assert.equal(calls[0].options.headers['X-JRPG-Bridge-Secret'],'test-secret');
});
test('missing, invalid, inactive or privileged identities cannot mint',async()=>{
 const {env,calls}=mockEnvironment();const path='/api/jrpg/parties/party1/ticket';
 assert.equal((await worker.fetch(request('POST',path),env)).status,401);
 assert.equal((await worker.fetch(request('POST',path,'forged'),env)).status,503);
 assert.equal((await worker.fetch(request('POST',path,'valid-gm'),env)).status,403);
 assert.equal(calls.length,0);
 assert.equal(await isAuthorizedPartyMember(env.DB,'party1','p1'),true);
 assert.equal(await isAuthorizedPartyMember(env.DB,'other','p1'),false);
});
test('strict origin, no wildcard CORS, no unauthenticated WebSocket upgrades',async()=>{
 const {env}=mockEnvironment(),path='/api/jrpg/parties/party1/ticket';
 assert.equal((await worker.fetch(request('POST',path,'valid-student','https://evil.test'),env)).status,403);
 const preflight=await worker.fetch(new Request('https://rooms.test'+path,{
  method:'OPTIONS',headers:{Origin:'https://preview.test'}
 }),env);
 assert.equal(preflight.status,204);
 assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),'https://preview.test');
 assert.equal((await worker.fetch(new Request('https://rooms.test'+path,{
  method:'OPTIONS'}),env)).status,403);
 const socketPath='/api/jrpg/parties/party1/connect';
 assert.equal((await worker.fetch(request('GET',socketPath),env)).status,426);
 assert.equal((await worker.fetch(new Request('https://rooms.test'+socketPath,{
  headers:{Origin:'https://preview.test',Upgrade:'websocket',
   'Sec-WebSocket-Protocol':'guild-jrpg-v1'}
 }),env)).status,401);
});
test('health fails closed when runtime bindings or bridge secret missing',async()=>{
 const {env}=mockEnvironment();
 const response=await worker.fetch(request('GET','/health'),env);
 assert.equal((await response.json()).ready,true);
 const denied=await worker.fetch(request('POST','/api/jrpg/parties/party1/ticket','valid-student'),
  {...env,BRIDGE_SECRET:undefined});
 assert.equal(denied.status,503);
});
