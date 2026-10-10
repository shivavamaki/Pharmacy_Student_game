import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.mjs';
const run = (path, options, env) => worker.fetch(new Request('https://example.test'+path, options), env);
test('health reports authentication is unfinished', async () => {
  const r=await run('/health'); assert.equal(r.status,200);
  assert.deepEqual(await r.json(),{ok:true,stage:'authentication',authenticationReady:false});
});
test('protected routes cannot accept an arbitrary bearer token', async () => {
  const r=await run('/api/me',{headers:{Authorization:'Bearer forged'}});
  assert.equal(r.status,503);
});
test('health does not accept writes',async()=>assert.equal((await run('/health',{method:'POST'})).status,405));
test('unknown routes return 404',async()=>assert.equal((await run('/unknown')).status,404));
test('disallowed browser origin returns 403',async()=>assert.equal((await run('/health',{headers:{Origin:'https://untrusted.test'}},{ALLOWED_ORIGIN:'https://app.test'})).status,403));
test('allowed preflight advertises only current methods',async()=>{
  const r=await run('/api/me',{method:'OPTIONS',headers:{Origin:'https://app.test'}},{ALLOWED_ORIGIN:'https://app.test'});
  assert.equal(r.status,204);assert.equal(r.headers.get('Access-Control-Allow-Origin'),'https://app.test');
  assert.equal(r.headers.get('Access-Control-Allow-Methods'),'GET, OPTIONS');
});
