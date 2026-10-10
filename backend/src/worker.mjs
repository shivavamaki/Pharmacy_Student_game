import { AuthError, authenticate, createTokenVerifier } from './auth.mjs';
import { authTestHtml } from './auth-test.mjs';
function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers
  } });
}
export function createWorker(verifyToken = createTokenVerifier()) {
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
        ...cors, 'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type'
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
    if (path === '/api/me') {
      if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, 405, { ...cors, Allow: 'GET' });
      try {
        return json({ profile: await authenticate(request, env, verifyToken) }, 200, cors);
      } catch (error) {
        if (error instanceof AuthError) return json({ error: error.code,
          ...(env.APP_ENV === 'development' && error.stage ? { stage: error.stage } : {})
        }, error.status, cors);
        return json({ error: 'authentication_unavailable' }, 503, cors);
      }
    }
    return json({ error: 'not_found' }, 404, cors);
  }
};
}
export default createWorker();
