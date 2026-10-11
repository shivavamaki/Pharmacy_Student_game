# Pharmacy Guild adventure artwork and progression

Original pixel fantasy art uses apothecary castles, navy stone, teal magic, warm gold, and readable three-to-two compositions. Images contain no UI text; Thai titles remain HTML. These are still illustrations, not animated sprite sheets. Nine WebP assets live in `frontend/assets/campaign/` at 1024 × 683. Files are loaded only for unlocked story chapters; collapsed earlier chapters remain available for reading.

| Asset | Art direction | Unlock |
| --- | --- | --- |
| training-ground | Sunlit guild courtyard, lecture books, potion practice, closed adventure gate | Start |
| opd-outpost | Nearby outpost dungeon, medicine supplies, traveller counselling | GM completes Training |
| ipd-portals | Magical portal machine, topic dimensions, four SOAP artifacts | GM completes OPD |
| time-chamber | Giant hourglass, supervised IV simulation stations | GM completes IPD |
| brave-library | Library and organized apothecary stockroom | Same week-four stage |
| ward-pilgrimage | Mentor and adventurers visiting a compassionate hospital ward | Same week-four stage |
| forgekeeper | Dwarven examiner, two project models, golden forge | Week four complete; both projects needed to accept encounter |
| knowledge-keeper | Owl librarian mage, lecture hall, academic presentation | GM completes Forgekeeper |
| soap-sovereign | Violet mist sovereign, angular crown, four protective artifacts | GM completes Knowledge Keeper |

Sovereign of All Plagues (SOAP) represents confusion and fragmented information. The four artifacts stand for listening (Subjective), facts (Objective), analysis (Assessment), and a care map (Plan). Patients are people the party helps; the villain is an original fantasy figure.

Images were generated for this repository with the ImageGen skill. Shared brief: original 16-bit RPG pixel landscape, 3:2 composition, navy/teal/gold apothecary fantasy, no letters, logos or licensed characters. Each row above describes the scene-specific brief. WebP optimization preserves the generated original composition.

The story endpoint is `/api/campaign/:partyId`; it requires an active scoped account. The server-owned dependency map in `backend/src/campaign.mjs` controls reveal and mutation guards, independent of editable quest metadata. Transitive prerequisites prevent historical out-of-order completions opening later chapters. Acceptance and assignment mutations recheck prerequisites inside the existing atomic write guard. Student catalog and assignment endpoints also filter future campaign quests. GM/admin catalog access is retained for planning and review; the adventure journal follows the party's progress for every viewer.

A stage is passed only when its assignment is completed by an authorized reviewer. GM starting approval, a submitted link, or 100% progress alone does not pass it. Attendance and required submissions remain human reviewed. Current stage auto-opens; previous unlocked stages collapse; hidden stages show only a remaining-door count.

Deploy Worker before Pages, then use the admin campaign installer to update/add all ten templates. No SQL migration. Existing legacy records and historical rewards are retained. Existing campaign assignments keep their reward snapshot; their quest brief may reflect the newly updated template.

Validation: backend tests cover party scope, hidden future story/catalog/assignment content, approved completion reveal, transitive dependencies and atomic rechecking. Local browser QA uses simulated students in local Miniflare/D1; screenshots contain no real student records.
