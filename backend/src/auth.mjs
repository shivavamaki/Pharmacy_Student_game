import { jwtVerify, importX509 } from 'jose';

export class AuthError extends Error {
  constructor(code, status, stage) { super(code); this.code = code; this.status = status; this.stage = stage; }
}

// Only Google's fixed Secure Token endpoint can supply verification keys.
export function googleKeyResolver(fetcher = fetch) {
  const endpoint = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
  let certs = {}, expires = 0, lastFetch = 0, pending;
  const imported = new Map();
  return async (header) => {
    if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid)
      throw new AuthError('invalid_token', 401);
    const now = Date.now();
    if (now >= expires || (!certs[header.kid] && now - lastFetch >= 30000)) {
      pending ??= (async () => {
        try {
          const response = await fetcher(endpoint, { signal: AbortSignal.timeout(5000), redirect: 'error' });
          if (!response.ok) throw new Error('key fetch failed');
          const next = await response.json();
          if (!next || typeof next !== 'object' || Array.isArray(next) || !Object.keys(next).length)
            throw new Error('invalid key set');
          const maxAge = /(?:^|[,\s])max-age=(\d+)/i.exec(response.headers.get('Cache-Control') || '');
          certs = next; imported.clear(); lastFetch = Date.now();
          expires = lastFetch + Math.min(Number(maxAge?.[1] ?? 300), 86400) * 1000;
        } catch { throw new AuthError('authentication_unavailable', 503, 'google_key_fetch'); }
      })();
      try { await pending; } finally { pending = undefined; }
    }
    if (!Object.hasOwn(certs, header.kid) || typeof certs[header.kid] !== 'string')
      throw new AuthError('invalid_token', 401);
    if (!imported.has(header.kid)) {
      try { imported.set(header.kid, await importX509(certs[header.kid], 'RS256')); }
      catch { throw new AuthError('authentication_unavailable', 503, 'google_key_import'); }
    }
    return imported.get(header.kid);
  };
}

export function createTokenVerifier(resolveKey = googleKeyResolver()) {
  return async (token, projectId) => {
    if (typeof token !== 'string' || token.length > 16384)
      throw new AuthError('invalid_token', 401);
    try {
      const now = Math.floor(Date.now() / 1000);
      const { payload, protectedHeader } = await jwtVerify(token, resolveKey, {
        algorithms: ['RS256'], issuer: `https://securetoken.google.com/${projectId}`,
        audience: projectId, requiredClaims: ['exp', 'iat', 'sub', 'auth_time'], clockTolerance: 0
      });
      if (!protectedHeader.kid || payload.aud !== projectId ||
          typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 128 ||
          !Number.isInteger(payload.iat) || payload.iat > now ||
          !Number.isInteger(payload.auth_time) || payload.auth_time > now || payload.auth_time > payload.iat ||
          payload.firebase?.sign_in_provider !== 'google.com' || payload.email_verified !== true)
        throw new AuthError('invalid_token', 401);
      return payload.sub;
    } catch (error) {
      if (error instanceof AuthError) throw error;
      throw new AuthError('invalid_token', 401);
    }
  };
}

export async function authenticate(request, env, verifyToken) {
  if (!env.FIREBASE_PROJECT_ID || !env.DB)
    throw new AuthError('authentication_not_configured', 503);
  const match = /^Bearer ([^\s]+)$/i.exec(request.headers.get('Authorization') || '');
  if (!match) throw new AuthError('authentication_required', 401);
  const uid = await verifyToken(match[1], env.FIREBASE_PROJECT_ID);
  let profile;
  try {
    profile = await env.DB.prepare('SELECT id, display_name, role, status FROM profiles WHERE firebase_uid = ?').bind(uid).first();
  } catch { throw new AuthError('authentication_unavailable', 503, 'd1_profile_lookup'); }
  if (!profile) throw new AuthError('enrollment_required', 403);
  if (profile.status !== 'active') throw new AuthError('account_not_active', 403);
  if (!['student', 'gm', 'preceptor', 'admin'].includes(profile.role))
    throw new AuthError('account_not_authorized', 403);
  // Role and status come from the current D1 row, never token/client metadata.
  return { id: profile.id, displayName: profile.display_name, role: profile.role };
}
