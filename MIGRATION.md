# Migration: Cloudflare + D1 + Firebase Auth
## Step 1 — foundation
The backend scaffold and initial SQL schema live in backend/. Existing Apps Script files remain in place. This branch is not a working replacement and must not receive live student data yet.

Chosen target:
- Cloudflare Pages for the game frontend, Workers for server logic, D1 for SQL.
- Firebase Authentication with Google sign-in on the Spark plan.
- Evidence remains Google Drive links; Drive sharing is managed separately.
- No paid services, SMS login, Firebase Cloud Functions or Firebase Storage in the initial scope. Free quotas still apply.

## Current source discrepancy
GitHub main presents The Pharmacy Guild / Connected MVP; the supplied live deployment presents Pharmacy Clerkship Quest with a different login screen. Before feature migration, export the actual deployed Apps Script source into a separate branch and compare it. Do not assume all live answers or features are represented here.

## Local checks
Use Node.js 24 or later (tests use node:sqlite).
Run from backend:
    npm test

No dependencies, credentials or network access are needed for these tests. They check worker responses and SQLite constraints; they do not test the Cloudflare D1 runtime or Firebase sign-in.

## Next step — development accounts only
1. Create or use a Cloudflare account on the Free plan.
2. Create a Firebase project on Spark; enable Google sign-in in Authentication. Add localhost and, later, the exact frontend hostname to authorized domains.
3. Share only the Firebase Project ID and whether Cloudflare setup is complete. Do not share passwords, Firebase service-account JSON, access tokens or private keys.
4. Install Wrangler from the official npm package in the development checkout:
    cd backend
    npm install --save-dev --save-exact wrangler
    npx wrangler login
    npx wrangler d1 create pharmacy-guild-dev
5. Replace REPLACE_WITH_DEV_DATABASE_ID in backend/wrangler.jsonc with the returned development database ID. Set FIREBASE_PROJECT_ID. Commit package.json and the generated package-lock.json.
6. Run local migration and start development:
    npm run db:local
    npm run dev

Remote migration and deployment come after token verification and enrollment tests; this guide intentionally does not deploy or connect production.

## Implementation milestones
- Step 2: Firebase ID-token signature, issuer, audience, expiry and subject verification. Reject unregistered, inactive or pending profiles using D1 state on every request. Add /api/me and two-account permission tests.
- Step 3: Pages login UI and shared API client; preserve the current game design. Admin-managed enrollment binds a Firebase UID to an existing profile; never match users solely by display name or grant roles from client metadata.
- Step 4: Party dashboard, quests, daily progress and evidence. Enforce ownership and assigned GM scope server-side on reads and writes.
- Step 5: Recap save and transactional quest completion/XP awards. Server generates identity, score and trusted reward values; use idempotency keys.
- Step 6: Reconcile live schema, implement a sanitized importer, dry-run on dev, compare record counts, test, back up and cut over.

## Sheet mapping
| Existing sheet | Initial target | Status |
| --- | --- | --- |
| Users | profiles | No passwords or default credentials; identity enrollment required |
| Parties | parties + party_members | MemberUserIDs becomes membership rows |
| Quests | quests | Extra fields retained in validated metadata |
| QuestAssignments | assignments | Further columns added before importing |
| AdventureRecapResponses | recap_responses | Import answers only; strip sessionToken and request wrappers |
| XPLog | xp_awards | Completion awards deduplicated; historical adjustments need separate design |
| DailyProgress, Evidence, Badges, AcademicAssessment, Settings | Later migrations | Not implemented in Step 1 |

Schema constraints prevent dangling references and duplicate awards/retries. They do not implement authorization: D1 has no Supabase-style RLS, so all access must go through verified Worker endpoints. No browser connects directly to D1.

## Release and recovery
Use separate dev/production projects and databases. Keep schema changes in migrations. Test on pull requests; manual release initially. Record Git commit and Worker deployment version. Database changes need a backup/recovery plan; rolling back code does not undo a data migration.

## Official references
- https://developers.cloudflare.com/d1/get-started/
- https://developers.cloudflare.com/d1/reference/migrations/
- https://firebase.google.com/docs/auth/admin/verify-id-tokens
- https://firebase.google.com/docs/projects/billing/firebase-pricing-plans
