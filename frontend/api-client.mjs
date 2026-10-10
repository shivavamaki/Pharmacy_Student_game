export const API_ORIGIN = 'https://pharmacy-guild-api-dev.shivavamaki.workers.dev';
export class ApiError extends Error {
  constructor(code, status) { super(code); this.code = code; this.status = status; }
}
export async function getMyProfile(user, { fetcher = fetch, signal } = {}) {
  if (!user) throw new ApiError('authentication_required', 401);
  const token = await user.getIdToken();
  const response = await fetcher(API_ORIGIN + '/api/me', {
    method: 'GET', headers: { Authorization: 'Bearer ' + token },
    cache: 'no-store', credentials: 'omit', redirect: 'error', signal
  });
  let data;
  try { data = await response.json(); }
  catch { throw new ApiError('invalid_response', response.status); }
  if (!response.ok) throw new ApiError(data.error || 'request_failed', response.status);
  const profile = data.profile;
  if (!profile || typeof profile.id !== 'string' || typeof profile.displayName !== 'string' ||
      !['admin', 'gm', 'preceptor', 'student'].includes(profile.role))
    throw new ApiError('invalid_response', response.status);
  return profile;
}
