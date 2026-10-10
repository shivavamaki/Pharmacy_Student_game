import { AuthError } from './auth.mjs';
// Identity and role must come from authenticate(), never query parameters or client fields.
export async function listParties(profile, db) {
  const query = profile.role === 'admin'
    ? `SELECT p.id, p.name, p.rotation, gm.display_name AS gm_name
       FROM parties p LEFT JOIN profiles gm ON gm.id = p.gm_profile_id
       WHERE p.status = 'active' ORDER BY p.name, p.id LIMIT 101`
    : `SELECT p.id, p.name, p.rotation, gm.display_name AS gm_name
       FROM parties p LEFT JOIN profiles gm ON gm.id = p.gm_profile_id
       WHERE p.status = 'active' AND (
         EXISTS (SELECT 1 FROM party_members m WHERE m.party_id = p.id AND m.profile_id = ?)
         OR (? IN ('gm','preceptor') AND p.gm_profile_id = ?)
       ) ORDER BY p.name, p.id LIMIT 101`;
  try {
    const statement = db.prepare(query);
    const { results } = await (profile.role === 'admin'
      ? statement : statement.bind(profile.id, profile.role, profile.id)).all();
    if (!Array.isArray(results)) throw new Error('invalid query result');
    return {
      parties: results.slice(0, 100).map(row => ({
        id: row.id, name: row.name, rotation: row.rotation, gmName: row.gm_name
      })),
      hasMore: results.length > 100
    };
  } catch { throw new AuthError('data_unavailable', 503, 'd1_party_list'); }
}
