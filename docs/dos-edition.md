# DOS Edition — plan and rollout

This branch derives from migration/cloudflare-foundation, the working Cloudflare/Firebase/D1 source, not the Google Apps Script main branch.

Implemented:
- Complete entry screen rebrand with command-line motif and VGA terminal palette.
- Mobile responsive quest cards, accessible focus controls, reduced-motion cursor, crisp pixel art.
- Existing login and game mounting DOM IDs preserved; no backend or database modifications.
- Standalone web-app manifest (does not cache sensitive or offline data).
- Removed legacy Code.gs, Index.html, AdventureRecap.html and GAS setup/merge notes from this branch.

Before deployment:
1. Run npm ci and npm test with Node.js 24+; review GitHub checks.
2. Test Firebase login on an authorized preview domain; configure its Worker CORS.
3. Verify character creation, all quest flows, permissions, recap, log out and mobile browsers.
4. Do not point production hostname or D1 at this branch before validation.

Phaser future phase: add actual tile-map exploration and turn-based encounters as opt-in scenes; keep forms and accessible menus in HTML. Server must remain authoritative for XP and rewards. Existing player records must not be replaced.
