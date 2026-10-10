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

export async function getMyParties(user, { fetcher = fetch, signal } = {}) {
  if (!user) throw new ApiError('authentication_required', 401);
  const token = await user.getIdToken();
  const response = await fetcher(API_ORIGIN + '/api/parties', {
    method: 'GET', headers: { Authorization: 'Bearer ' + token },
    cache: 'no-store', credentials: 'omit', redirect: 'error', signal
  });
  let data;
  try { data = await response.json(); }
  catch { throw new ApiError('invalid_response', response.status); }
  if (!response.ok) throw new ApiError(data.error || 'request_failed', response.status);
  if (!Array.isArray(data.parties) || typeof data.hasMore !== 'boolean' ||
      data.parties.some(p => !p || typeof p.id !== 'string' || typeof p.name !== 'string' ||
        !(p.rotation === null || typeof p.rotation === 'string') ||
        !(p.gmName === null || typeof p.gmName === 'string')))
    throw new ApiError('invalid_response', response.status);
  return data;
}

export async function getPartyAssignments(user, partyId, { fetcher = fetch, signal } = {}) {
  if (!user) throw new ApiError('authentication_required',401);
  const token = await user.getIdToken();
  const response = await fetcher(API_ORIGIN + '/api/parties/' + encodeURIComponent(partyId) + '/assignments', {
    headers: { Authorization: 'Bearer ' + token }, cache: 'no-store', credentials: 'omit', redirect: 'error', signal
  });
  let data;
  try { data = await response.json(); } catch { throw new ApiError('invalid_response', response.status); }
  if(!response.ok) throw new ApiError(data.error || 'request_failed', response.status);
  if(!Array.isArray(data.assignments) || typeof data.hasMore !== 'boolean' ||
    data.assignments.some(a => !a || typeof a.id !== 'string' || typeof a.questName !== 'string' ||
      !(a.objective === null || typeof a.objective === 'string') ||
      !Number.isInteger(a.progress) || a.progress < 0 || a.progress > 100 ||
      !Number.isInteger(a.xpReward) || a.xpReward < 0 ||
      !['waiting_gm_approval','in_progress','waiting_gm_review','revision_required','completed'].includes(a.status) ||
      !['green','yellow','red'].includes(a.risk) || !(a.deadline === null || typeof a.deadline === 'string')))
    throw new ApiError('invalid_response',response.status);
  return data;
}
