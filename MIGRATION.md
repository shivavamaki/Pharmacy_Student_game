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

Run npm ci from the repository root first to install pinned dependencies. The tests themselves need no credentials or external network access. They check worker responses and SQLite constraints; they do not test the Cloudflare D1 runtime or Firebase sign-in.

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

The owner has now created the development schema manually and authorized a foundation Worker deployment through dashboard Git integration (see the setup record below). Token verification and enrollment tests remain required before connecting any game data or cutting over production.

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

## Development dashboard setup — 2026-10-10
The owner enabled Firebase Google sign-in and created pharmacy-guild-dev. A D1 Console screenshot confirms all eight foundation table names; column definitions and indexes have not yet been independently checked remotely. The schema was applied manually, so Wrangler migration history has not been recorded. Do not rerun 0001 against this database blindly; reconcile and baseline its migration history before automated remote migrations.

The development Worker pharmacy-guild-api-dev is connected to this repository:
- Production branch (for this development Worker): migration/cloudflare-foundation.
- Root directory: /.
- Build command: empty.
- Deploy command: npx wrangler deploy --cwd backend.
- Version command: npx wrangler versions upload --cwd backend.

A commit starts the first build. After a successful deployment, check GET /health and confirm the DB binding in Settings. The foundation deployment was confirmed with GET /health. Step 2 adds Firebase ID-token verification and GET /api/me. It does not yet provide a frontend login or game endpoints. This development deployment leaves the existing Apps Script application in place.

## Step 2 — verified identity and current authorization
The backend uses pinned jose to verify RS256 signatures using Google's fixed Secure Token X.509 endpoint. Keys follow the response Cache-Control max-age (capped at 24 hours) and are imported once per key/cache interval. Unknown keys can trigger a refresh after a 30-second cooldown. Key fetch/import failures deny access.

Tokens must match project pharmacy-student-game, the exact securetoken issuer, expiry, issued-at time, authentication time, nonempty UID (at most 128 characters), Google sign-in provider, and verified email. GET /api/me reads profiles by verified firebase_uid using a bound SQL parameter on every request. Unregistered, pending and inactive profiles are denied. Role comes from D1, not the JWT's custom role or client fields. No token, password, refresh token or Google access token is saved to D1 or logged by this code.

This verifies signatures/claims, not Firebase server-side revocation. Disabling the D1 profile denies this backend immediately on subsequent requests; Firebase-only disabling/revocation may leave already issued ID tokens valid until expiry. Use D1 status=inactive when disabling game access. Firebase client SDK will manage token refresh in the future login UI; do not send refresh tokens to this API.

Root package.json declares the backend workspace so Cloudflare's root build installs the pinned dependencies from package-lock.json. Existing dashboard deploy command with --cwd backend remains valid. The Worker configuration already supplies the DB binding and Firebase project ID.
- GET /health: stage=authentication, authenticationReady=true when project ID and DB binding exist. This is a configuration check, not proof of successful live Google login.
- GET /api/me without Authorization: 401 authentication_required.
- Verified token without an enrolled active profile: 403 enrollment_required or account_not_active.
- POST /api/me: 405; other unimplemented API paths: 404.
- CORS currently permits only http://localhost:5173. Set the exact Pages origin when the frontend is created.

Validation: 33 local tests pass, including generated RS256 tokens and two-account authorization checks; Wrangler bundle dry-run passes. Live Google sign-in, Google's live key retrieval and live D1 profile reads remain to be tested. Next: frontend login and administrator-controlled UID enrollment. Do not import old passwords or grant everyone an admin role.
