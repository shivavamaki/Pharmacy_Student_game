import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, SignJWT } from 'jose';
import { createTokenVerifier, googleKeyResolver } from '../src/auth.mjs';
import { createWorker } from '../src/worker.mjs';
const project = 'pharmacy-student-game';
const keys = await generateKeyPair('RS256');
const verify = createTokenVerifier(async (header) => {
  if (header.kid !== 'test-key') throw new Error('unknown key');
  return keys.publicKey;
});
async function token(overrides = {}, key = keys.privateKey, header = {}) {
  const now = Math.floor(Date.now()/1000);
  return new SignJWT({ iss: `https://securetoken.google.com/${project}`, aud: project,
    sub: 'uid-one', iat: now-5, auth_time: now-10, exp: now+600,
    email_verified: true, firebase: { sign_in_provider: 'google.com' }, ...overrides })
    .setProtectedHeader({alg:'RS256',kid:'test-key',...header}).sign(key);
}
test('accepts a correctly signed Google Firebase ID token', async()=>assert.equal(await verify(await token(),project),'uid-one'));
for (const [name, changes] of Object.entries({
  expired:{exp:1}, audience:{aud:'other'}, issuer:{iss:'https://evil.test'},
  futureIssued:{iat:Math.floor(Date.now()/1000)+600},
  futureAuth:{auth_time:Math.floor(Date.now()/1000)+600},
  missingAuth:{auth_time:undefined}, emptySubject:{sub:''}, longSubject:{sub:'a'.repeat(129)},
  provider:{firebase:{sign_in_provider:'anonymous'}}, unverified:{email_verified:false}
})) test(`rejects ${name}`,async()=>assert.rejects(()=>verifyTokenChanges(changes),{code:'invalid_token',status:401}));
async function verifyTokenChanges(changes) { return verify(await token(changes),project); }
test('rejects another private key',async()=>{
  const other=await generateKeyPair('RS256');
  await assert.rejects(()=>token({},other.privateKey).then(t=>verify(t,project)),{code:'invalid_token'});
});
test('rejects unknown kid and malformed tokens',async()=>{
  await assert.rejects(()=>token({},keys.privateKey,{kid:'unknown'}).then(t=>verify(t,project)),{code:'invalid_token'});
  await assert.rejects(()=>verify('forged',project),{code:'invalid_token'});
});
test('rejects unsigned algorithm',async()=>{
  const t=await token();const parts=t.split('.');parts[0]=Buffer.from(JSON.stringify({alg:'none',kid:'test-key'})).toString('base64url');
  await assert.rejects(()=>verify(parts.join('.'),project),{code:'invalid_token'});
});
test('key network failure fails closed without exposing details',async()=>{
  const resolver=googleKeyResolver(async()=>{throw new Error('internal error');});
  await assert.rejects(()=>resolver({alg:'RS256',kid:'key'}),{code:'authentication_unavailable',status:503});
});
const profiles = new Map([['uid-one',{id:'one',display_name:'Student One',role:'student',status:'active'}],['uid-two',{id:'two',display_name:'GM Two',role:'gm',status:'active'}]]);
const env={FIREBASE_PROJECT_ID:project,ALLOWED_ORIGIN:'https://app.test',DB:{prepare(sql){
  assert.equal(sql,'SELECT id, display_name, role, status FROM profiles WHERE firebase_uid = ?');
  return {bind(uid){return {async first(){return profiles.get(uid);}}}};
}}};
const worker=createWorker(verify);
async function run(t, extra={}) { return worker.fetch(new Request('https://api.test/api/me',{headers:{Authorization:`Bearer ${t}`,...extra}}),env); }
test('two accounts receive their own profile and D1 roles',async()=>{
  const first=await run(await token({role:'admin'}));
  assert.equal(first.status,200);assert.deepEqual(await first.json(),{profile:{id:'one',displayName:'Student One',role:'student'}});
  const second=await run(await token({sub:'uid-two'}));
  assert.deepEqual(await second.json(),{profile:{id:'two',displayName:'GM Two',role:'gm'}});
});
test('inactive, pending and unregistered profiles are denied',async()=>{
  for(const status of ['pending','inactive']) {
    profiles.set('uid-blocked',{id:'blocked',display_name:'Blocked',role:'student',status});
    assert.equal((await run(await token({sub:'uid-blocked'}))).status,403);
  }
  assert.equal((await run(await token({sub:'unknown'}))).status,403);
});
test('status and role changes apply to the same existing token',async()=>{
  const t=await token({sub:'uid-live'});const row={id:'live',display_name:'Live',role:'gm',status:'active'};profiles.set('uid-live',row);
  assert.equal((await (await run(t)).json()).profile.role,'gm');row.role='student';
  assert.equal((await (await run(t)).json()).profile.role,'student');row.status='inactive';
  assert.equal((await run(t)).status,403);
});
test('missing or forged bearer cannot query the database',async()=>{
  assert.equal((await worker.fetch(new Request('https://api.test/api/me'),env)).status,401);
  assert.equal((await run('forged')).status,401);
});
test('database failure returns 503',async()=>{
  const bad={...env,DB:{prepare(){throw new Error('database details');}}};
  const r=await worker.fetch(new Request('https://api.test/api/me',{headers:{Authorization:`Bearer ${await token()}`}}),bad);
  assert.equal(r.status,503);assert.deepEqual(await r.json(),{error:'authentication_unavailable'});
});
test('health reflects auth configuration and unknown API stays closed',async()=>{
  assert.equal((await (await worker.fetch(new Request('https://api.test/health'),env)).json()).authenticationReady,true);
  assert.equal((await worker.fetch(new Request('https://api.test/api/unimplemented'),env)).status,404);
});

test('enrollment identity comes from signed verified Google claims, never request input',async()=>{
 const identityVerifier=createTokenVerifier(async()=>keys.publicKey,{includeIdentity:true});
 const identity=await identityVerifier(await token({email:'student@example.test',name:'Student'}),project);
 assert.deepEqual(identity,{uid:'uid-one',email:'student@example.test',displayName:'Student'});
 await assert.rejects(()=>identityVerifier(token,project),{code:'invalid_token'});
 await assert.rejects(async()=>identityVerifier(await token({email:'student@example.test',email_verified:false}),project),{code:'invalid_token'});
 await assert.rejects(async()=>identityVerifier(await token(),project),{code:'invalid_token'});
});
