# JRPG Multiplayer — Isolated Cloudflare Worker

This is the first **network transport implementation** of the 1–6-player
team room. It is **not deployed automatically**. Do not modify
\`backend/wrangler.jsonc\`, the current Guild API, Cloudflare Pages live
configuration, production D1 migrations, or existing student records.

## Features

- Short-lived, **single-use** 60-second opaque connection tickets, issued
  after verifying Firebase Google ID tokens and **active student D1 party membership**.
- Separate Worker \`pharmacy-guild-jrpg-rooms-dev\`, isolated Durable Object namespace
  \`JRPG_ROOMS\` (SQLite storage, 1 instance per party).
- Six seats maximum, reconnect replaces a player's prior socket.
- Shared leader-only destination selection, authoritative path steps and
  broadcasts; party members do not move separately.
- Collective **one vote per student per combat ballot**, aggregate majority
  (plurality) and safe tie rules, 45-second deadline, one enemy response per round.
- Server-owned case answer key, hidden individual choices until resolution.
- Persistent room state and Durable Object alarms survive hibernation.
- The existing personal assignment/evidence APIs remain unaffected.

## HTTPS / WebSocket protocol

\`POST /api/jrpg/parties/{partyId}/ticket\`
with \`Authorization: Bearer <firebase_id_token>\` from Firebase Auth.
Body must be empty. Returns \`ticket\`, \`websocketUrl\`, \`expiresInSeconds\`,
\`protocol\`. A token is **not** stored in localStorage or URL. Connect via:

\`\`\`js
const ws = new WebSocket(websocketUrl, [
  "guild-jrpg-v1",
  "ticket." + ticket
]);
\`\`\`

\`GET /api/jrpg/parties/{partyId}/connect\` is WebSocket-only and
requires the exact allowed Pages branch Origin. Tickets are one use and
expire in 60 seconds. Worker-to-DO ticket issuance and socket upgrades
require the secret \`BRIDGE_SECRET\`. Never commit this secret.

From socket (JSON, max 1200 characters):
- \`{"type":"destination","target":{"x":9,"y":7},"expectedVersion":4}\`
  -- only leader, verified path and movement.
- \`{"type":"start"}\` -- leader starts combat, no other player can.
- \`{"type":"vote","actionId":"unique-uuid","ballotId":1,"kind":"listen"}\`
  -- any eligible connected player, one vote per round.
- \`{"type":"vote","actionId":"unique-uuid","ballotId":3,"kind":"case-choice","choiceIndex":1}\`
  -- the server evaluates the chosen answer.
- \`{"type":"transfer","newLeaderId":"verified_profile_id","expectedVersion":7}\`
  -- leader-only, while in lobby; new leader must be connected.

Each member receives \`{"type":"snapshot","room":{...}}\`, with vote
progress (who voted), aggregate counts only after resolution, validated
shared path position and leader ID. The answer key and individual
votes are never broadcast. Error frames are \`{"type":"error","code":"..."}\`.

## Deployment gates / security notes

1. **Do not deploy yet:** run the new CI dry-run, unit and local integration
   tests, then review Cloudflare Durable Objects bindings and account plan.
2. From repository root, using installed Wrangler v4:
   \`npx wrangler secret put BRIDGE_SECRET --config jrpg-online/wrangler.jsonc\`
   -- provide a randomly generated strong secret through an approved
   secret-management workflow, not a committed string.
3. **Explicit deployment approval required** before using
   \`npx wrangler deploy --config jrpg-online/wrangler.jsonc\`.
   The repo does NOT contain a deploy job for this new Worker.
4. Before connecting the Pages browser client, add exactly
   \`https://pharmacy-guild-jrpg-rooms-dev.<account>.workers.dev\` to
   the **JRPG branch's** CSP connect-src, not production's policy;
   confirm the actual hostname after deployment.
5. Run two-to-six real-account, real-device tests on separate browsers,
   seven-player rejection, permission-revocation tests, and reconnect tests.
6. Teacher-approved leader selection remains a **future stage**. At present
   the first **verified** student to establish a room connection becomes
   the temporary leader. The client cannot assert that role.
7. No credential, token, or clinical/patient data may appear in room
   snapshots or logs. Use fictional training scenarios only.
8. Secure chat, GM spectator/recovery, and formal per-student assessment
   are separate future features.

**Read-only shared D1 access:** this Worker only calls SELECT on existing
parties, party_members, and profiles. This uses the existing development D1
binding, without schema migrations. Durable Objects have their own
separate SQLite storage, so no official XP or Gold is written.

**Important:** This stage implements the server protocol but does not make
the current six-seat browser simulator a real multiplayer game. A separate
authenticated online lobby/client integration and deployed Worker are
required before multiplayer gameplay is publicly available.


## Multiplayer Lobby Client (implemented on JRPG branch; safely disabled)

Static page: \`frontend/jrpg/lobby/index.html\` → \`/jrpg/lobby/\` on the
branch preview. It uses the current Firebase Google popup login with
**in-memory persistence**, and the existing authenticated \`/api/me\`
and \`/api/parties\` endpoints to show only the student's Guild parties.

- Six live-seat placeholders, presence, leader, shared map, leader-only
  destination selection and leadership transfer.
- Combat voting: one vote per student device per server ballot, vote status,
  permitted actions, totals after resolution and a safe tie display.
- WebSocket client: single-use tickets via bearer HTTPS request; credentials
  never go into URLs, cookies, localStorage, or sessionStorage.
- Bounded automatic reconnect after socket closure, new ticket on each retry,
  full party state refresh after reconnect, logout aborts/cleans sockets.
- Individual assignment/evidence links remain in the existing Guild Portal.
- The static map is a **lobby control overview** rather than an embedded Phaser
  multiplayer scene. The latter needs a follow-up scene synchronization step.
- No social chat, GM observer privileges, official rewards or student data writes.

\`frontend/jrpg/lobby/runtime-config.mjs\` intentionally exports an EMPTY
\`JRPG_ROOM_API_ORIGIN\`. **Join is disabled until a separate Cloudflare Worker
is deployed, the exact origin is verified, and a branch-specific CSP
connect-src (both \`https://\` and \`wss://\`) has been reviewed.** Do not
switch on by guessing a workers.dev domain or reusing the existing API.
The login itself additionally requires Firebase to authorize the branch
preview domain.

To test: \`node --test frontend/jrpg/lobby/test/*.test.mjs\`;
GitHub Actions also checks it. Playwright runs desktop and Android-size
offline-lobby layout checks as part of the isolated JRPG suite.
