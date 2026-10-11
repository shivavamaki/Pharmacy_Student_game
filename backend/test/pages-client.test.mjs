import test from 'node:test';
import assert from 'node:assert/strict';
import { API_ORIGIN, getMyProfile } from '../../frontend/api-client.mjs';
test('Pages API client sends the Firebase ID token only to the configured API', async () => {
  const user = { getIdToken: async () => 'test-id-token' };
  let calls = 0;
  const profile = await getMyProfile(user, { fetcher: async (url, options) => {
    calls++;
    assert.equal(url, API_ORIGIN + '/api/me');
    assert.equal(options.headers.Authorization, 'Bearer test-id-token');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.redirect, 'error');
    return Response.json({ profile: { id: 'one', displayName: 'Student', role: 'student' } });
  } });
  assert.deepEqual(profile, { id: 'one', displayName: 'Student', role: 'student' });
  assert.equal(calls, 1);
});
test('Pages API client makes no request while signed out', async () => {
  await assert.rejects(() => getMyProfile(null, { fetcher: () => { throw new Error('should not fetch'); } }),
    { code: 'authentication_required', status: 401 });
});
test('Pages API client preserves enrollment and status denials', async () => {
  for (const code of ['enrollment_required', 'account_not_active']) {
    await assert.rejects(() => getMyProfile({ getIdToken: async () => 'token' },
      { fetcher: async () => Response.json({ error: code }, { status: 403 }) }),
      { code, status: 403 });
  }
});
test('Pages API client rejects malformed successful responses', async () => {
  for (const body of [{}, { profile: { id: 'one', displayName: 'Name', role: 'superadmin' } }]) {
    await assert.rejects(() => getMyProfile({ getIdToken: async () => 'token' },
      { fetcher: async () => Response.json(body) }), { code: 'invalid_response' });
  }
});
test('Pages API client handles non-JSON errors without exposing server text', async () => {
  await assert.rejects(() => getMyProfile({ getIdToken: async () => 'token' },
    { fetcher: async () => new Response('private upstream error', { status: 502 }) }),
    { code: 'invalid_response', status: 502, message: 'invalid_response' });
});
