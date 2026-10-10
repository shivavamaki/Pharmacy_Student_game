# Cloudflare game migration

The repository's game operations now use Firebase Auth → Worker → D1, with game screens in the development Pages frontend. Original Apps Script files remain for comparison/recovery. This implements the GitHub source: the owner's actual live Apps Script deployment has not been exported and reconciled yet.

## Feature mapping

| Apps Script | Replacement |
| --- | --- |
| login/loginUser, current user/session validation, logout, changePassword | Firebase Google sign-in/sign-out + GET /api/me; local password/session code retired |
| setupDatabase, ensureDatabase, seedDemoData | SQL migrations + original quest-only templates; no demo accounts/passwords |
| getAppBootstrap, getPartyDashboard | GET /api/summary, /api/parties, /api/parties/:id/dashboard, /api/assignments/:id |
| listAvailableQuests, acceptQuest | GET /api/quests; POST /api/parties/:id/accept, including member roles |
| approveQuestAcceptance | POST /api/assignments/:id/approve |
| saveDailyProgress, reviewDailyProgress | POST /api/assignments/:id/daily; POST /api/daily/:id/review |
| submitEvidence, reviewEvidence | POST /api/assignments/:id/evidence; POST /api/evidence/:id/review |
| completeQuest | POST /api/assignments/:id/complete; atomic status, XP and Badge awards |
| getGMQueue | GET /api/gm-queue |
| saveAssessment | GET/POST /api/assessments |
| saveQuestResponse, getAdventureRecapStatus | POST /api/recap/submit; GET /api/recap, scoped history/count |
| Recap stages, character, score, ending | Original questions/options/result formula in shared recap-model.mjs; responsive details-based UI |
| Recap save/export/reset/music/analytics | D1 draft endpoint, browser JSON export/reset/optional music, admin /api/recap/analytics |
| Sheet management | Admin forms + /api/admin/profiles, /quests, /parties, /settings, /audit, /recaps |
| Sheets helpers | Bound D1 queries + offline sanitized export/import tools |

No new frontend calls google.script.run or connects directly to D1. Google login still requires Google network access; the owner's managed PC restriction is unchanged. Use mobile on an allowed network for live tests.

## Authorization and persistence

Every request verifies Firebase identity and reads current active D1 status/role. Admins have explicit cross-party access. Students write only their own active party memberships. GMs/preceptors read managed parties or memberships; review additionally requires both party manager and assigned task reviewer. Membership alone never grants review. Academic assessments are written only for students in the reviewer's managed party; students read their own results. Recap drafts/history are per account; all-response and aggregate access are admin-only. Recap is account-linked, not anonymous.

Assignment flow: waiting_gm_approval → in_progress → waiting_gm_review → completed. Rejected evidence moves the task to revision_required. Resubmission supersedes rejected evidence and restores waiting_gm_review. Completion requires approved evidence and no pending/rejected evidence. Completed/archived tasks cannot receive new progress/evidence.

Participant IDs and rewards are captured on acceptance. Later roster/reward edits do not change existing awards. Admin party reassignment changes open task reviewer IDs and versions. Historical completed records keep their history.

Writes require JSON, a maximum 64 KiB body and Idempotency-Key. Same-key/body successful retries return the original result; changed bodies with reused keys return 409. A D1 batch checks current identity, party scope, state/version and prerequisites inside the transaction, then writes data, result and audit together. Constraint failures roll back all changes. Award uniqueness prevents duplicate XP/Badge grants. Party roster validation/insertion uses JSON set queries, keeping even 100-member edits below Free plan per-invocation query/bind limits. Audit contains no raw request bodies or tokens. Firebase refresh/access/ID tokens and old passwords are not saved to D1.

## Development rollout

1. Record a backup/export of pharmacy-guild-dev before altering its schema.
2. D1 Console: run **backend/migrations/0002_game.sql exactly once**. Foundation was created manually: do not rerun 0001 and do not blindly use migrations apply --remote. Reconcile/baseline migration history separately before automated migrations.
3. Run **backend/migrations/0003_quest_templates.sql** to add the original five quest templates. This seed is repeat-safe and does not overwrite existing quests.
4. Wait for Worker and Pages Git builds on migration/cloudflare-foundation. The exact Pages ALLOWED_ORIGIN is retained; no new secret or paid resource is needed.
5. Sign in at https://pharmacy-guild-web-dev.pages.dev. Before 0002 exists, game requests return migration_required; /api/me continues working.
6. Test a team accepting a quest → GM approval → daily progress → HTTPS evidence → review → completion. Verify one award per captured member and no extra awards on retry. Also test rejection/resubmission, other-party denial, pending/inactive users and reassigned GM.
7. Test Recap draft restore after reloading/signing in, submission/history isolation, server score/ending, admin analytics and academic assessments.

The owner still needs to apply remote SQL and verify these live flows. Local checks do not prove the public build/database are ready.

## Original data import

The importer is an offline tool, never run automatically during deployment.

1. Export the actual deployed source and compare its fields/functions first.
2. Add migration/export-legacy.gs to the original bound editor; run exportGuildForCloudflare manually as owner. It creates a sanitized JSON file in the owner's Drive and changes no sheets. Download privately; never commit student exports to GitHub.
3. Prepare a **separate empty rehearsal database** with 0001 and 0002. Skip 0003 before importing source quests. Reconcile existing dev admin/test IDs rather than overwriting them.
4. Run `node backend/scripts/import-legacy.mjs sanitized-export.json import.sql`. Review the .report.json counts and warnings. XP discrepancies between Users.XP and XPLog require owner reconciliation; the new app uses imported XPLog totals and does not guess opening balances.
5. Apply SQL locally/rehearsal first. Plain INSERT intentionally fails on conflicts; do not rerun into a populated database. Check row counts and samples before a reviewed remote import.
6. legacy_records retains allowlisted original business columns for reconciliation: old profile Level/XP, confirmations, party metrics and timestamps. Credential/session fields are excluded. Recap Raw JSON is normalized; scores are recalculated and request identity/tokens are stripped.
7. Imported profiles start pending with no Firebase UID/email, including old admins. A trusted administrator explicitly enrolls each Firebase UID and activates the intended role. Never infer identity from display names. Preserve the existing Firebase-backed dev admin unless a reviewed mapping replaces it.
8. Reconcile balances, assessment party mapping, historic membership snapshots, timestamps and deployed-source differences; rehearse backup/rollback and owner acceptance before cutover.

Evidence remains HTTPS links; no files are uploaded and Drive sharing is unchanged. Lists show the first 100 records and flag truncation; pagination is future work. Recap's UI is reorganized and original animated credits are replaced with a saved score/ending summary.

## Validation

Node 24+: npm ci at root, then npm test --workspace backend. Tests cover signed tokens, schema-backed multi-account scope, state transitions, race guards, rollback, idempotency, award deduplication, enrollment/reassignment, recap validation/isolation and imports. A test also runs local Cloudflare workerd/Miniflare D1 with cf:false, including quest lifecycle and D1 batch rollback. This avoids external request.cf metadata fetches.

79 tests pass. Frontend module syntax/bundling and Wrangler bundle dry-run are checked. Headless browser execution is incomplete because Chromium is unavailable in this workspace; owner mobile validation is still required.

References:
- https://developers.cloudflare.com/d1/worker-api/d1-database/
- https://developers.cloudflare.com/d1/reference/migrations/
- https://developers.cloudflare.com/d1/best-practices/import-export-data/
- https://firebase.google.com/docs/auth/admin/verify-id-tokens
