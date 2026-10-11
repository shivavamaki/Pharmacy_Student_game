import { AuthError, authenticate, createTokenVerifier } from './auth.mjs';
import { enrollmentAPI } from './enrollment.mjs';
import { gameAPI } from './game.mjs';
import { listAssignments } from './assignments.mjs';
import { listParties } from './parties.mjs';
import { authTestHtml } from './auth-test.mjs';
function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers
  } });
}
export function createWorker(verifyToken = createTokenVerifier(undefined, { includeIdentity: true })) {
return {
  async fetch(request, env = {}) {
    const path = new URL(request.url).pathname;
    const origin = request.headers.get('Origin');
    const cors = origin && origin === env.ALLOWED_ORIGIN
      ? { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin' } : {};
    if (origin && origin !== env.ALLOWED_ORIGIN)
      return json({ error: 'origin_not_allowed' }, 403);
    if (request.method === 'OPTIONS') {
      if (!origin) return json({ error: 'origin_required' }, 400);
      return new Response(null, { status: 204, headers: {
        ...cors, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type, Idempotency-Key'
      } });
    }
    if (path === '/auth-test' && env.APP_ENV === 'development') {
      if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, 405, { ...cors, Allow: 'GET' });
      return new Response(authTestHtml, { headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
        'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline' https://www.gstatic.com https://apis.google.com; style-src 'unsafe-inline'; connect-src 'self' https://apis.google.com https://*.googleapis.com https://*.firebaseapp.com https://*.gstatic.com; frame-src https://*.firebaseapp.com; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
      } });
    }
    if (path === '/health') {
      if (request.method !== 'GET')
        return json({ error: 'method_not_allowed' }, 405, { ...cors, Allow: 'GET' });
      return json({ ok: true, stage: 'authentication', authenticationReady: Boolean(env.FIREBASE_PROJECT_ID && env.DB) }, 200, cors);
    }
    if (path === '/api/enrollment') {
      try { return json(await enrollmentAPI(request,env,verifyToken),200,cors); }
      catch(error) {
        if(error instanceof AuthError)return json({error:error.code},error.status,cors);
        return json({error:'data_unavailable'},503,cors);
      }
    }
    const assignmentRoute = /^\/api\/parties\/([^/]+)\/assignments$/.exec(path);
    if (path === '/api/me' || path === '/api/parties' || assignmentRoute) {
      if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, 405, { ...cors, Allow: 'GET' });
      try {
        const profile = await authenticate(request, env, verifyToken);
        if (assignmentRoute) {
          let partyId;
          try { partyId = decodeURIComponent(assignmentRoute[1]); }
          catch { throw new AuthError('invalid_request', 400); }
          if (!partyId || partyId.length > 256) throw new AuthError('invalid_request', 400);
          return json(await listAssignments(profile, env.DB, partyId), 200, cors);
        }
        return json(path === '/api/me' ? { profile } : await listParties(profile, env.DB), 200, cors);
      } catch (error) {
        if (error instanceof AuthError) return json({ error: error.code,
          ...(env.APP_ENV === 'development' && error.stage ? { stage: error.stage } : {})
        }, error.status, cors);
        return json({ error: 'authentication_unavailable' }, 503, cors);
      }
    }
    if (/^\/api\/(summary|quests|parties\/[^/]+\/(dashboard|accept)|assignments\/[^/]+(?:\/(approve|complete|daily|evidence))?|daily\/[^/]+\/review|evidence\/[^/]+\/review|gm-queue|assessments|recap(?:\/(draft|submit|analytics))?|admin\/(profiles|quests|parties|settings|audit|recaps))$/.test(path)) {
      try {
        const profile = await authenticate(request, env, verifyToken);
        const version = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='api_operations'").first();
        if (!version) throw new AuthError('migration_required', 503);
        return json(await gameAPI(request, env.DB, profile, path), 200, cors);
      } catch (error) {
        if (error instanceof AuthError) return json({ error: error.code }, error.status, cors);
        return json({ error: 'data_unavailable' }, 503, cors);
      }
    }
    return json({ error: 'not_found' }, 404, cors);
  }
};
}
export default createWorker();

