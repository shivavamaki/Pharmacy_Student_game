# Pharmacy Guild: Chronicles of the Four Seals — JRPG Game Design v0.1

**Status:** new experimental version, distinct from the saved DOS Edition. **Implementation:** prototype first, no production deploy or D1 writes. **Genre:** original 16-bit-inspired story JRPG, turn-based encounters, party exploration, tactical choices, story/dialogue, on web and mobile. References to classic Japanese RPGs describe a genre, **not** a request to copy licensed graphics, characters, music, or dialogue.

## Multiplayer requirement (updated 2026-11-19)

The completed JRPG must provide **live synchronous online cooperative play for 1–6 real players per room**, with an instructor-approved **Party Leader**. Only the leader selects map destinations and moves the entire team together. The leader initiates shared story encounters and combat, while **each member still plays their own battle turn**. Students independently submit assignments and evidence. Battles remain strictly turn-based, with server-owned turn order, answers, timers, room capacity and outcome. Current Phaser walkable demo remains solo; online room transport is not implemented yet. See [jrpg-online-coop.md](jrpg-online-coop.md).

## Vision and audience

A five-week pharmacy clerkship becomes an adventure across the city of **Arogea (อาโรเกีย)**. The threat is not a patient or a disease: it is the **Fog of Fragmentation**, misinformation, incomplete histories, communication failures, and unsafe processes. The students are apprentice pharmacists; NPC patients are people the guild protects. Under the guidance of a real GM/preceptor, their party restores the four seals: **S — Subjective (listen), O — Objective (verify), A — Assessment (reason), P — Plan (act, counsel and follow up)**.

**Promise:** a legitimate teaching workflow wrapped in RPG exploration, not a replacement for clinical supervision. Real student assessment and awards remain server-authoritative. Fictional sample cases only; never put real patient identifiers in game dialogue or logs.

## Player loop

1. **At the Guild:** sign in through existing Firebase Auth, load D1 character and party, read the currently revealed story and GM-approved quest board.
2. **Explore:** navigate a low-resolution tile world (planned Phaser + TypeScript), speak to NPCs, discover clues and collect **story-only** objects. On touch devices: virtual D-pad/tap-to-move; desktop: arrows/WASD.
3. **Encounter:** a problem-spirit (e.g. Unclear Order, Broken Handoff), **not a patient**, interrupts progress. Enter a classic turn-based battle panel, ideally 320x180 internal rendering with readable responsive HTML text.
4. **Investigate → decide:** the party uses S/O/A/P skills, inspects a fictional case card, makes one or more evidence-based choices and can always **Consult Preceptor / Guard** rather than guess. Right choices overcome uncertainty; wrong choices trigger immediate explanations without rewarding guessing.
5. **Reflect and submit:** combat victories unlock narrative and **practice-only** loot; official quest completion still requires participation, case notes, presentations and GM review, followed by trusted Worker/D1 XP/Gold/badge awards.
6. **Return to town:** upgrade only cosmetics and approved training assets; reflect in the existing Adventure Journeys journal. Never sell real medications or teach unsupervised actions.

## Canonical chapters (keep real five-week curriculum)

| Game act / place | Week | Story beat | Player gameplay | Official server quest |
| --- | --- | --- | --- | --- |
| Prologue: Sunlit Training Ground | 1 | The Guild recruits apprentices as the Fog spreads; discover first Seal | Tutorial dialogue, patient safety quiz, S/O/A/P battle controls | main-week-01 |
| Act I: Outpost Dungeon / OPD | 2 or 3 per *actual team rotation* | Help travellers with conflicting prescriptions and uncertain instructions | Prescription puzzle, counseling/teach-back dialogue and Order-Wisp combat | main-week-02 |
| Act II: Infinite Portal Device / IPD | 2 or 3 per *actual team rotation* | Reassemble scattered histories through portal worlds | Medication reconciliation, ward-round clues, ADR review, evidence grid | main-week-03 |
| Act III: Time Chamber | 4 | The Hourglass Guardian teaches deliberate high-risk checks | **Supervised simulation only**: IV checklist, compatibility/source verification | main-week-04 (sub-area) |
| Act III: Library of the Brave | 4 | Restore a damaged medicine inventory | FEFO sorting and expired-stock isolation puzzle | main-week-04 (sub-area) |
| Act III: Pilgrimage of the Healing Ward | 4 | Listen to many voices on a ward journey | Interprofessional dialogue, patient-centered care and handoff choices | main-week-04 (sub-area) |
| Side Quest: Workshop of Improvements | Weeks 2–5 | Forge a departmental improvement | Problem statement, baseline, design/test/evidence milestones | side-project-department |
| Side Quest: Clinical Research Path | Weeks 2–5 | Prepare a clinical improvement | Literature appraisal, plan and outcome indicators | side-project-clinical |
| Mini-Boss: The Forgekeeper | 5 | Challenge the merit of two projects | Defend baseline/method/results, with GM presentation and feedback | boss-mini-projects |
| Mini-Boss: Keeper of Knowledge | 5 | Present a trustworthy explanation to the library | Academic in-service, citations and questions, GM review | boss-mini-academic |
| Final Boss: Sovereign of All Plagues (SOAP) | 5 | Confront the Fog with the four complete seals | Multi-phase S/O/A/P case synthesis, GM-led case presentation | boss-soap-presentation |
| Epilogue: Guild Homecoming | 5 | Restore clear communication and pass knowledge onward | Final report, peer review, reflection and personalized epilogue | main-week-05 |

**Rotation issue to resolve:** the existing Worker gates OPD before IPD for everyone. The educational timetable swaps student teams between OPD and IPD in weeks 2–3. **Do not silently change the gates**; Phase 2 needs a vetted party-specific route model and tests before production rollout.

### Act structure and reveal

- **Act I — First Light:** recruit at the Guild, find the S and O seals, earn trust in the Outpost.
- **Act II — Worlds Between Wards:** connect fragmented history across IPD portals, discover A, meet the clues to P.
- **Act III — The Three Sanctuaries:** apply skills in simulation, inventory and ward care; hone plan P, collect project materials.
- **Act IV — The Twin Trials:** Forgekeeper (two projects), Keeper of Knowledge (academic presentation).
- **Finale — The Four Seals:** SOAP's first three phases try to separate subjective, objective and assessment; fourth phase forces the team to build a safe, teachable plan. Restored Arogea represents transparent patient care, not a miraculous cure.
- The server remains the source of truth for **which chapters a student may see**. The isolated proof-of-concept demo may show fictional sample locations but must be labelled clearly and never treated as clearance.

## Six current character identities as JRPG jobs

Keep the saved avatar classes and all earned profile rewards. Introduce **cosmetic combat specialties only**; classes must not decide whether a learner can perform an assessed competency.

| Existing class | JRPG job title | Fictional specialty |
| --- | --- | --- |
| Curious Apprentice | Rune Seeker | Easier environmental clue discovery |
| Quiet Observer | Sage Witness | Enhanced inspection and puzzle hints |
| Brave Counselor | Heart Herald | Trust/morale bonus in NPC dialogue |
| Order Detective | Script Ranger | Additional prescription-clue cues |
| Survival Intern | Ward Guardian | Guard/consultation support |
| Future Pharmacist | Seal Weaver | Combines known S/O/A/P seals in finale |

All jobs can use **Listen, Verify, Assess, Plan, Counsel, Consult/Guard**. Cosmetic class abilities never bypass prerequisite evidence, GM approval, or competency validation. Do not award extra official XP simply for the job selected.

## JRPG battle redesign

- **Encounter identity:** destroy the *Fog of Confusion* rather than a human, illness, or substance. Battle outcomes are **practice simulations**.
- **Stats:** Party HP = morale (not patient health); MP = focus; foe HP = uncertainty/fog. Numbers exist only for game feel.
- **Turn order:** choose party action → read fictional clue/card → resolve question → enemy's confusion counterattack. Guard/Consult restores focus and lowers incoming damage.
- **Action chain:** **Listen (S) → Verify (O) → Assess (A) → Plan (P)**; other tools include Counsel and Guard. A correct case decision is required before Assess in the prototype.
- **Win state:** reduce uncertainty to zero with all four seals assembled. SOAP's final encounter adds a **Four-Seal Synthesis** finisher.
- **Failure state:** morale depleted means return to camp and retry with a hint; no loss of real XP, no record of poor clinical competency based on a demo.
- **Evaluation:** each scenario has a learning objective, canonical references curated by a supervising pharmacist, answer rationale, remediation and feedback. Never use generative AI to auto-grade patient safety decisions without expert validation.
- **Accessible:** keyboard shortcuts plus touch buttons; reduced-motion mode; readable Thai copy outside low-resolution sprite canvas; no twitch mechanics or timed clinical decision pressure.

## Quest and rewards model

- **GM remains authoritative:** student submits evidence through existing Worker endpoints; only authorized GM/preceptor completion earns real XP/Gold/badges. Server-level audit and repeatability guards stay unchanged.
- **JRPG-only economy:** clues, camp supplies, costume pieces and symbolic story artifacts are cosmetic/provisional. Keep separate from D1 Gold until a vetted inventory/spend model exists.
- **Project side quests:** both are required curriculum projects, although shown as optional-style JRPG branches. Forgekeeper cannot open until both are approved and main-week-04 is complete.
- **Party roles:** player is authenticated as student/GM/preceptor/admin; GM controls official gates, review and chapter release. Never trust client-issued victory events for real awards.
- **Reconciliation:** keep progress, ADR Hunter history, achievements, avatars and Adventure Journeys from the current Cloudflare backend; no reset or duplicate XP.

## Technical separation

| Layer | Plan |
| --- | --- |
| Hosting | Independent Pages branch preview; never change current DOS/production build |
| Phase 0 playable concept | Static ESM under frontend/jrpg/, no new packages or API calls, fake case decisions, session-only progress |
| Phase 1 rendering | Phaser + TypeScript + Vite build *after* story/prototype approval; pixel-art maps and sprites |
| Responsive UI | HTML/CSS overlay for readable dialogue, question choices, menus, accessibility and soft keys |
| Auth | Reuse existing Firebase Google login, then Cloudflare Worker scope checks for party access |
| Backend | Existing Workers + D1 profiles, parties, campaign, quest/evidence/reward records |
| New data later | Versioned chapter/dialogue tables, scenario content version/review metadata, story-only exploration save; separate migrations after review |
| Security | Server checks party, gate, evidence and XP; only test fixtures used in preview; no PHI stored |
| Offline | No personal/protected gameplay offline until service worker cache/data/privacy review |

## Suggested milestones

1. **Story bible and paper prototype**: test the eight core chapters, 6 jobs and teaching scenarios with 2–3 instructors.
2. **Vertical slice**: town → OPD map → dialogue → 1 evidence puzzle → turn-based encounter → camp. Test on Android and desktop.
3. **Backend bridge**: authenticated party chapter availability; official GM gates and evidence submission; clearly separate demo victory from reviewed work.
4. **Complete modules**: IPD, week-four three sanctuaries, projects, Keeper, SOAP and epilogue.
5. **QA and rollout**: pharmacist validation, 390px and desktop layout, screen readers, Thai text, role permission tests, network failures, idempotency, Firebase preview domains and Worker CORS, then deploy to isolated preview.

## Vertical slice acceptance criteria

- Demo loads at /jrpg/ on a branch preview without requiring a database.
- Player can select fictional dialogue, solve a case decision, and finish a keyboard/touch turn-based S/O/A/P battle; log messages explain a failed turn.
- Demo never calls real APIs, never saves official progress, never implies clinical approval.
- Original Firebase login, DOS branch, existing D1 schema and live Pages hostname remain unchanged.
- Node tests cover battle flow, invalid actions, safety locks, quest mapping, and all required chapter IDs.
