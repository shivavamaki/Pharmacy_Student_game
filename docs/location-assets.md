# Uploaded location artwork

All 17 locations supplied by the user on 2026-10-11 are integrated. Files are stored as lossless WebP at their original dimensions; decoded RGBA pixels were compared with every uploaded PNG. Source checksums and dimensions are recorded in `location-assets.json`. No generation, retouching or resampling was performed.

Guild Hall is 192 × 128. The other images are 192 × 192 with centered landscape scenes and gray upper/lower padding. The UI uses a centered 3:2 viewport with `object-fit: cover` to hide that padding without modifying source files. CSS `image-rendering: pixelated` preserves the pixel-art appearance.

| Asset | Placement |
|---|---|
| guild-hall | Sign-in/landing page and existing member-header background |
| training-ground | Initial campaign chapter |
| opd-outpost | OPD chapter after GM completion of Training |
| ipd-portals | IPD chapter after GM completion of OPD |
| time-chamber | Week-four IV practice location |
| brave-library | Week-four stock management location |
| ward-pilgrimage | Week-four ward pilgrimage location |
| forgekeeper | Project mini-boss chapter |
| knowledge-keeper | Academic mini-boss chapter |
| soap-sovereign | Final SOAP chapter |
| guild-homecoming | Epilogue, only after valid preceding stages and SOAP completion |
| character-creation-room | Create/edit character page |
| quest-board-room | Party quest board |
| department-project-workshop | Department side-project brief and assignment page |
| clinical-project-laboratory | Clinical side-project brief and assignment page |
| journey-record-room | Adventure Journeys character record |
| guild-map | Collapsible map in Madeaw's admin page |

Campaign art remains in the server-filtered chapter response, so the normal adventure UI does not show future artwork. The overview map is rendered only in the admin page. Static image files remain public website assets; chapter progression does not restrict direct access to a guessed image URL.

Deploy Worker and Pages from the same migration-branch commit. This artwork change needs no new SQL migration. If the previous quest-rewards release has not yet been applied, its existing `0006_quest_rewards.sql` prerequisite still applies.

Character customization continues using the existing code-native avatar. The supplied Curious portrait is a style reference and will be integrated after aligned customization layers are ready.

Validation: lossless roundtrip for all 17 images; backend/frontend regression tests; local workerd/D1 browser checks at 390px and 1440px, including character room, journal room, quest board, initial-chapter spoiler gate, SOAP/homecoming reveal and admin map. Browser fixtures use simulated accounts and do not change remote D1.
