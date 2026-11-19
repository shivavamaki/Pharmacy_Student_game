# Pharmacy Guild JRPG — Six-Player Live Turn-Based Co-op

**Confirmed requirement:** 1 to 6 real students online in one cooperative game room. Battle combat strictly takes turns. Each student plays their own character. No fake multiplayer. The current walkable Guild is a single-player prototype until network integration is tested.

## Rules

- Every room belongs to an authorized existing D1 party. Up to six student seats; joining a full room is denied atomically by the server.
- An authorized GM/preceptor may observe without consuming a student seat; spectators cannot select actions or bypass instructor approval.
- Battle sequence: player 1, player 2, ..., player 6 (or fewer present), one enemy turn, then next round. One actor per turn.
- 45-second turn timer by default. If absent or disconnected, the game auto-guards and advances; reconnect retains the original seat.
- Server validates room membership, turn, selected action, correct answers, battle state and request version. Retries with the same action ID do not execute twice.
- Players share party morale, focus, S/O/A/P seals, and enemy fog. Battles use fictional cases. They do not grant official XP, Gold, badges or grades.
- Exploration uses **destination selection**: each player taps or clicks a target on the visible map, then their avatar auto-walks along a validated obstacle-avoiding route. All players move independently during exploration; **only combat is turn-based**. The eventual online server must validate target coordinates, path collisions, travel rate and party/world scope rather than trusting the client-rendered position.
- Room capacity does not alter or delete historical party_members rows in D1; if an educational party has more than six members, rooms require scheduling or approved splitting.

## Server architecture

1. Client: Phaser + TypeScript + Vite, existing Firebase Google Authentication.
2. Cloudflare Worker: verifies Firebase ID token, checks D1 party membership and active status, issues short-lived single-use connection tickets.
3. Cloudflare Durable Object: one per room; owns six-seat capacity, WebSocket connections, combat turn order, timers, snapshots and persistent recovery.
4. D1: authoritative player/party records and instructor-controlled quest/evidence/XP/Gold. No unofficial client victory can modify those records.

Browser WebSockets do not allow an arbitrary Authorization header. Acquire a short-lived, single-use ticket over authenticated HTTPS, and validate it during WebSocket upgrade. Never pass Firebase ID tokens in URLs. Use strict origin checks, room scope checks, rate limits and revocation checks.

## First code milestone

The pure domain module at backend/src/jrpg-room-rules.mjs specifies max 6, atomic seat semantics, ordered turns, timeout auto-Guard, reconnect slots, stale/duplicate action handling and safe room views. Its Node tests run with the existing backend suite. THIS IS NOT YET A LIVE NETWORKED GAME: no Durable Object or WebSocket route has been registered. It intentionally leaves production Worker, D1, Firebase and deployment configuration unchanged.

## Next implementation order

1. Review provider permissions and add isolated development-only Durable Object binding with a tested migration.
2. Implement authenticated Worker ticket endpoint and DO WebSocket room with persistent state.
3. Build six-seat lobby UI, ready/start, player presence and reconnect.
4. Synchronize each avatar's selected destination and validated path in the shared Phaser Guild. Clients send destination intents (not arbitrary teleport coordinates); the Durable Object validates reachability, speed, obstacle collisions and state, then broadcasts movement to the other five players.
5. Connect the four-seal combat interface to authoritative room actions and broadcasts.
6. Test seven-player race, disconnect mid-turn, stale turns, dropped messages, replay attacks, privacy, Android/mobile, instructor GM spectator and one enemy turn per round.
7. Ship to a separate JRPG branch preview only after all these checks pass.

## Updated exploration input design

- Tap/click a free map tile to walk there with shortest-path routing. Touch and mouse behave identically.
- Tap Guild Master or the Training Portal to navigate to a walkable neighboring tile, then interact automatically.
- Accessible location buttons provide the same target selection for players who cannot accurately tap small tiles.
- Blocked or unreachable destinations produce clear feedback; tapping elsewhere while the hero is walking requests rerouting after the current tile animation.
- Battle uses shared server-owned rounds, not real-time movement. Exploration does not consume combat turns.
- **Current code is still an isolated solo preview.** Network movement synchronization is a future WebSocket/Durable Object step.
