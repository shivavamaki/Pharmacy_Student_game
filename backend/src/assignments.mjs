import {campaignQuestIds,campaignGuard} from './campaign.mjs';
import { AuthError } from './auth.mjs';
export async function listAssignments(profile, db, partyId) {
  try {
    const party = await db.prepare(`SELECT p.id FROM parties p
      WHERE p.id = ? AND p.status = 'active' AND (
        ? = 'admin' OR EXISTS (
          SELECT 1 FROM party_members m WHERE m.party_id = p.id AND m.profile_id = ?
        ) OR (? IN ('gm','preceptor') AND p.gm_profile_id = ?)
      )`).bind(partyId, profile.role, profile.id, profile.role, profile.id).first();
    if (!party) throw new AuthError('not_found', 404);
    const gateArgs=[];const gates=campaignQuestIds.map(id=>{const gate=campaignGuard(id,partyId);gateArgs.push(id,...gate.args);return `(q.id=? AND (${gate.sql}))`;});
    const gate=profile.role==='student'?`AND (q.id NOT IN (${campaignQuestIds.map(()=>'?').join(',')}) OR ${gates.join(' OR ')})`:'';
    const { results } = await db.prepare(`SELECT a.id, q.name AS quest_name, q.objective,
      q.xp_reward, a.status, a.progress, a.risk, a.deadline
      FROM assignments a JOIN quests q ON q.id = a.quest_id
      WHERE a.party_id = ? AND a.status != 'archived' AND q.status != 'archived' ${gate}
      ORDER BY a.created_at, a.id LIMIT 101`).bind(partyId,...(profile.role==='student'?[...campaignQuestIds,...gateArgs]:[])).all();
    if (!Array.isArray(results)) throw new Error('invalid result');
    return { assignments: results.slice(0,100).map(row => ({
      id: row.id, questName: row.quest_name, objective: row.objective,
      xpReward: row.xp_reward, status: row.status, progress: row.progress,
      risk: row.risk, deadline: row.deadline
    })), hasMore: results.length > 100 };
  } catch(error) {
    if(error instanceof AuthError) throw error;
    throw new AuthError('data_unavailable', 503, 'd1_assignment_list');
  }
}
