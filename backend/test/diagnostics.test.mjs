import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthError, googleKeyResolver } from '../src/auth.mjs';
import { createWorker } from '../src/worker.mjs';
test('diagnoses Google key fetch failure without the underlying error', async () => {
  const resolver = googleKeyResolver(async () => { throw new Error('private upstream detail'); });
  await assert.rejects(() => resolver({ alg: 'RS256', kid: 'test' }),
    { code: 'authentication_unavailable', status: 503, stage: 'google_key_fetch', message: 'authentication_unavailable' });
});
test('diagnoses malformed upstream certificate import separately', async () => {
  const resolver = googleKeyResolver(async () => new Response(JSON.stringify({ test: 'invalid certificate' })));
  await assert.rejects(() => resolver({ alg: 'RS256', kid: 'test' }),
    { stage: 'google_key_import', status: 503 });
});
test('diagnoses D1 lookup failure only in development', async () => {
  const worker = createWorker(async () => 'uid');
  const env = { FIREBASE_PROJECT_ID: 'test', DB: { prepare() { throw new Error('private database detail'); } } };
  for (const appEnv of ['development', 'production']) {
    const response = await worker.fetch(new Request('https://test/api/me', { headers: { Authorization: 'Bearer private-token' } }), { ...env, APP_ENV: appEnv });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), appEnv === 'development'
      ? { error: 'authentication_unavailable', stage: 'd1_profile_lookup' }
      : { error: 'authentication_unavailable' });
  }
});
test('key diagnostic stage is hidden in production and token is not echoed', async () => {
  const worker = createWorker(async () => { throw new AuthError('authentication_unavailable', 503, 'google_key_fetch'); });
  const response = await worker.fetch(new Request('https://test/api/me', { headers: { Authorization: 'Bearer private-token' } }),
    { APP_ENV: 'production', FIREBASE_PROJECT_ID: 'test', DB: {} });
  assert.deepEqual(await response.json(), { error: 'authentication_unavailable' });
});
