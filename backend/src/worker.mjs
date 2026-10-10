// Phase 1: public health endpoint only. Authentication is intentionally unfinished.
function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers
  } });
}
export default {
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
    if (path === '/health') {
      if (request.method !== 'GET')
        return json({ error: 'method_not_allowed' }, 405, { ...cors, Allow: 'GET' });
      return json({ ok: true, stage: 'foundation', authenticationReady: false }, 200, cors);
    }
    if (path.startsWith('/api/'))
      return json({ error: 'authentication_not_configured' }, 503, cors);
    return json({ error: 'not_found' }, 404, cors);
  }
};
