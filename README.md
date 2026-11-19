# Pharmacy Guild — Chronicles of the Four Seals (JRPG Edition)

This branch is a separate, experimental classic JRPG version of the current Pharmacy Guild, not a replacement for the deployed app.

## Entrypoints

- Authenticated Guild dashboard and new JRPG landing: /
- Playable standalone fictional learning simulation: /jrpg/
- **Sprint 1 walkable Guild built with Phaser + TypeScript + Vite**: /jrpg/walk/ (built output required; see docs/jrpg-sprint1.md)
- Existing DOS version frozen on checkpoint/pharmacy-guild-dos-20261119 (commit 30baa211)
- Design document: docs/jrpg-game-design.md

## Architecture

Firebase Google Auth, Cloudflare Workers, D1, existing parties/quests/GM approval and character records are preserved for the main dashboard. The new /jrpg/ path currently runs isolated, session-only fiction with no authentication, API writes, real XP, Gold, grades or claims of official quest completion. It uses the original campaign pixel artwork and a simple browser-based turn system. Phaser is installed as an isolated jrpg-walk/ project for the walkable Guild Hall vertical slice; a complete interactive world remains future work.

## Validation

Node.js 24+ required. Run npm ci and npm test. Deploy the branch to a separate Cloudflare Pages preview with frontend/ as static output root, then validate the Google login domain and CORS before allowing real sign-in. No production D1 migrations are part of this branch.

**Important:** The story demo allows chapter progression for testing. Real curriculum stages and GM authorizations remain server-controlled; the current worker still fixes OPD before IPD rather than using individual team rotation schedules.

## Next steps

See docs/jrpg-game-design.md for teaching objectives, acts, class mapping, encounter mechanics, safety criteria and rollout phases.
