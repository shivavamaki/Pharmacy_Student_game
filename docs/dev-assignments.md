# Development assignment reads

GET /api/parties/:partyId/assignments verifies the Firebase identity and current active D1 profile. Admins can read active parties; GMs can read parties they manage or belong to; students and preceptors require membership. Unknown, archived and inaccessible parties return the same 404. Query parameters cannot override identity or role. All SQL values are bound.

The response includes assignment ID, quest name/objective/reward, status, progress, risk and deadline. Archived assignments and quests are excluded; quest metadata is not exposed. Results are ordered and capped at 100 with hasMore. This endpoint is read-only and does not grant XP.

The Pages party list now has a view-assignments button. Account changes, sign-out and selection changes prevent stale requests from rendering another account or party's data. All database text is rendered with textContent.

Validation: 58 local tests pass, including SQLite-backed access checks, membership removal, inactive users, missing tokens, unknown parties, denied writes, database failure, bounds and client response validation. Frontend syntax checks and Wrangler bundle dry-run pass. Live authenticated assignment reads still need owner verification after deployment.

Development test rows (D1 Console, pharmacy-guild-dev only; requires party-dev-001):

```sql
INSERT INTO quests (id, name, objective, quest_type, xp_reward, status)
VALUES ('quest-dev-001', 'ภารกิจทดสอบ: ฝึกอธิบายการใช้ยา',
        'ฝึกสื่อสารผ่านกรณีสมมติสำหรับทดสอบระบบ', 'practice', 100, 'available')
ON CONFLICT(id) DO NOTHING;

INSERT INTO assignments (id, quest_id, party_id, status, progress, risk)
VALUES ('assignment-dev-001', 'quest-dev-001', 'party-dev-001', 'in_progress', 0, 'green')
ON CONFLICT(id) DO NOTHING;
```

After the Worker and Pages builds succeed, sign in on the stable Pages URL and select ดูภารกิจ on the test party. Expect one in-progress assignment at 0%, with 100 XP shown as the potential reward on approval. Progress editing and GM review are not implemented by this change.
