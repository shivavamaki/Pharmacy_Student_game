# Pharmacy Guild JRPG — Six-Player Live Turn-Based Co-op

**Confirmed requirement:** 1–6 real students in one shared cooperative party, led by a designated **Party Leader**. Only the leader chooses destinations and moves the entire party together on the world map. The leader starts the shared battle; **all connected eligible students vote on the team's next combat action each round**, and the most-selected action resolves as one team turn. Everyone retains their independent permissions to submit assignments, evidence, and other individual activities. This is a game-design and tested domain-rule target; the current walkable Guild is still an isolated offline-logic demo, not real online multiplayer.

## Rules

- Every room belongs to an authorized existing D1 party. Up to six student seats; joining a full room is denied atomically by the server.
- An authorized GM/preceptor may observe without consuming a student seat; spectators cannot select actions or bypass instructor approval.
- **Party Leader:** a student authorized by the instructor's party administration. They alone select world-map destinations for the party, initiate shared dialogue/encounters, and can hand off leadership. One party position and path are authoritative; member avatars appear as a following formation, not independent travelers.
- **Battle voting:** the leader starts the fight. Every eligible player (up to six, including the leader) gets **one equally weighted action vote per ballot**. Votes stay private until counted. Wait for all eligible votes or the 45-second deadline. The action with the most votes is performed **once for the whole party**. An enemy turn follows if the fight continues. There are no separate character attack turns.
- **Ties:** if multiple actions receive the most votes, the leader's choice wins only if it is one of the tied choices; otherwise the team auto-selects Guard/Consult. A leader cannot veto a non-tied winning action. If nobody votes by the deadline, Guard/Consult is selected. 
- **Disconnected players:** the electorate freezes at ballot start (connected seats only). A disconnected voter cannot send a vote until reconnected; an absent vote is an abstention at deadline. The next ballot snapshots who is connected then. No one can cast on behalf of another identity.
- **Individual permissions:** all students, including followers, may independently open menus, submit their own assignment evidence, upload their own work, write reflections, view character progress, and use any other personally permitted features. The game movement lock must never block the separate Worker APIs for those tasks.
- 45-second **team voting window** by default, not 45 seconds per student. A complete ballot resolves immediately once everyone has voted. A deadline settles from votes received, or safely Guards if nobody participated. Reconnect preserves the seat.
- Server validates room membership, ballot ID, one vote per actor, allowed action, case-answer index, deadline and correct answers. Retries with the same action ID do not execute twice. A ballot ID avoids rejecting valid concurrent student votes merely because another student voted first.
- Players share party morale, focus, S/O/A/P seals, and enemy fog. Battles use fictional cases. They do not grant official XP, Gold, badges or grades.
- **Exploration is leader-controlled destination selection:** ONLY the party leader's map tap/click can submit an authoritative destination intent. A validated server route carries the entire party in formation, using one shared world position. Followers may inspect the map but cannot move the party or initiate travel. Combat remains turn-based, and movement is disabled during combat.
- Room capacity does not alter or delete historical party_members rows in D1; if an educational party has more than six members, rooms require scheduling or approved splitting.

## Server architecture

1. Client: Phaser + TypeScript + Vite, existing Firebase Google Authentication.
2. Cloudflare Worker: verifies Firebase ID token, checks D1 party membership and active status, issues short-lived single-use connection tickets.
3. Cloudflare Durable Object: one per room; owns six-seat capacity, validated leader ID, shared map position, step-by-step routing, WebSocket connections, collective combat ballots, vote deadlines, server-side outcome resolution, snapshots, and persistent recovery. The Worker must look up the real leader from an authorized party roster, not trust arbitrary client-provided host/leader IDs.
4. D1: authoritative player/party records and instructor-controlled quest/evidence/XP/Gold. No unofficial client victory can modify those records.

Browser WebSockets do not allow an arbitrary Authorization header. Acquire a short-lived, single-use ticket over authenticated HTTPS, and validate it during WebSocket upgrade. Never pass Firebase ID tokens in URLs. Use strict origin checks, room scope checks, rate limits and revocation checks.

## First code milestone

The pure domain module at backend/src/jrpg-room-rules.mjs specifies max 6, a designated leader, leader-only validated destinations, shared party movement, leadership transfer, one-vote-per-member combat ballots, winner/tie/deadline rules, reconnect slots, duplicate prevention, and safe room snapshots. The old per-player `submitTurn` and `expireTurn` methods are now fail-closed. Its Node tests run with the existing backend suite. THIS IS NOT YET A LIVE NETWORKED GAME: no Durable Object or WebSocket route has been registered. It intentionally leaves production Worker, D1, Firebase and deployment configuration unchanged.

## Next implementation order

1. Review provider permissions and add isolated development-only Durable Object binding with a tested migration.
2. Implement authenticated Worker ticket endpoint and DO WebSocket room with persistent state.
3. Build six-seat lobby UI, ready/start, player presence and reconnect.
4. Only the verified leader may submit party destination intents (never arbitrary teleport coordinates). The Durable Object validates reachability, route, movement speed and leader permissions, and broadcasts the one shared world position and follower formation to all students. All other students have view-only world-map controls.
5. Connect the four-seal combat interface to authoritative `submitVote` messages and `roomView` snapshots. Display eligible voters, who has submitted (not what they chose), time remaining, and the aggregate winner after resolution.
6. Test seven-player join race, late votes, tied votes, disconnect/reconnect mid-ballot, stale ballot IDs, vote replay and spoofing, secret-answer privacy, Android/mobile, GM spectator and one enemy turn **per resolved team ballot**.
7. Ship to a separate JRPG branch preview only after all these checks pass.

## Updated exploration input design

- The **leader** taps/clicks a free map tile to send the whole party along one shortest-path route. Touch and mouse behave identically; non-leaders may observe and use their own menus.
- The leader may select Guild Master or the Training Portal to navigate the whole group to a walkable neighboring tile, then trigger a **shared** dialogue/encounter. Followers cannot start group travel.
- Accessible location buttons provide the same target selection for players who cannot accurately tap small tiles.
- Blocked or unreachable destinations produce clear feedback; tapping elsewhere while the hero is walking requests rerouting after the current tile animation.
- Battles use collective server-owned **voting rounds**, not individual character turns. Exploration does not consume combat votes.
- **Current code is still an isolated solo preview,** using sample follower sprites to demonstrate the team marching behind the leader; network movement synchronization is a future WebSocket/Durable Object step.

## Leadership / permissions matrix

| Feature | Party Leader | Party Member | GM / Preceptor |
| --- | --- | --- | --- |
| Set shared map destination | Yes | No, view map only | May observe; authorized override later |
| Start shared story scene / combat | Yes | No | Observe or manage releases under authorization |
| Vote on next shared combat action | **One vote, same weight as everyone** | **One vote, same weight as leader** | Observe only; no student votes |
| Submit own assignment / evidence / reflection | Yes | Yes | Review under normal existing privileges |
| View personal character / record | Yes | Yes | Based on existing permissions |
| Transfer leader role | Yes, to connected eligible member | No | Emergency override proposed, not implemented |

Leader identity must be derived from instructor-approved party membership and persisted by the future secure backend. Initial `hostId` in the pure model is a staging placeholder, not proof of authorization. If the leader disconnects, everyone retains assignment access; world travel pauses until rejoin or an authorized leadership transfer. The pure rules currently implement voluntary transfer; GM recovery and leader-election safeguards are future work.

The current server domain model's `selectPartyDestination` and `advancePartyMovement` functions validate and advance a shared route. They are **not network endpoints**. Never accept `actorId`, `leaderId` or `partyId` from a browser as trusted authority. The Durable Object must serialize both movement and combat, and resolve trusted identities via the authenticated Worker.

## Current voting prototype versus real-time multiplayer

The prototype at `/jrpg/walk/` now offers a **six-seat local ballot demonstration**: one person cycles through P1–P6 in a single browser, votes on each action, and sees the highest-voted choice applied to the existing fictional combat engine. This is **not six online users**, contains no WebSocket synchronization, and does not claim student votes, grading or verified identities. The real production design will use the Durable Object's authoritative `submitVote` and `expireVote` functions. Never import server answer keys or trusted vote state into the production client.

**Server ballot response contract:** `roomView().battle.ballot` includes ballot ID, deadline, eligible seat IDs, and which members have voted, **not their choices**. `lastResult` discloses the aggregate vote counts and winning action only after the ballot is counted. The client gets accepted/unaccepted feedback, while the server owns the action outcome.

**Voting election rule:** for this prototype, "majority" means the action receiving the **most votes** (plurality). A strict more-than-50% threshold and optional runoff are possible later if requested. The leader's vote is not weighted more heavily; it is only the tie-break among equally highest-voted choices.

**Integration boundary:** Party Leader still uniquely controls shared map destinations, but students can independently submit assignments/evidence/reflections via the existing authenticated Guild Worker endpoints regardless of combat voting or leadership.
