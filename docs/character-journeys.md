# Characters and Adventure Journeys

Every adventurer creates a saved pixel avatar before starting adventure activities. The character editor reuses the six established Recap identities: Curious Apprentice, Quiet Observer, Brave Counselor, Order Detective, Survival Intern, Future Pharmacist. Latest valid personal reflection supplies suggested class, reason and development goal, but never silently creates the avatar.

An avatar has a name, class, four skin tones, four hair colors, four hairstyles, six cloak colors, personal reason and learning goal. Portraits are original code-native SVG pixel illustrations, with a book, glasses, healing potion, magnifier, camp mug or white coat identifying the class. No remote avatar service or uploaded portrait is required. Custom text enters HTML through textContent; only fixed validated palettes enter SVG.

Characters persist in D1 under the authenticated profile ID. `POST /api/character` validates class/appearance and writes only personal character fields. Existing edits require the current version and use atomic guards. Role, XP, rewards and another profile ID cannot be changed through this endpoint. Cosmetic or class changes preserve earned rewards and earlier reflection snapshots. `profiles.character_class` is synchronized for compatibility.

Students cannot access adventure catalog, campaign, dashboard, assignment detail or submit adventure work until their own avatar exists. New quest acceptance additionally requires avatars for every active student in the current party. The checks run again inside the acceptance transaction. GM review and admin setup remain accessible without an avatar so staff can manage enrollment. Their own adventuring/quest acceptance requires an avatar; the UI offers creation first for every role.

Adventure Recap becomes **Adventure Journeys** in the UI. The existing `/recap` routes and records remain as the reflection journal within Journeys. New submissions derive the class from the saved character; clients cannot substitute another class or stored score. Older submissions remain unchanged.

## Character record

| Panel | Source and meaning |
| --- | --- |
| XP / Level | All personal current XP awards plus historical XP; level = floor(XP / 150) + 1 |
| Badge collection | Current plus historical badge awards, grouped by name, with award count and dates |
| Achievements | Derived from character creation, recorded quest rewards, XP thresholds and reflection submissions; only earned titles are shown |
| GM assessments | All personal assessment totals; aggregate percentage = sum(score) / sum(max score), with each assessment and feedback listed |
| Reflection journal | Latest recomputed reflection score /100, personal experience rating /10, rank, ending title and submitted-score history |
| Skills | Latest reflection's self-reported skills, explicitly separated from GM assessment |

Totals use all database rows. Display histories and badge groups are bounded to 100 entries with an additional-items notice. Completed quest count refers to the new assignment/reward system; the historical XP entry count is shown separately because old records may lack a quest/assignment identity. The aggregate assessment percentage is a weighted overview, not a replacement for any institution's final grading rubric. Reflection scores are neither clinical competency certification nor additional XP.

Achievements: Guild Adventurer, completed weekly stages, defeated mini/final bosses, both completed projects, 150/450/900 XP thresholds, and Journey Chronicler. Historical quest achievements use the existing trusted historical award ledger. No unreached boss or ending is listed in the achievement collection.

## Deployment

1. In Cloudflare **D1 → pharmacy-guild-dev → Console**, paste and execute the SQL contents of `backend/migrations/0005_characters.sql`. Paste SQL, not the filename. The CREATE TABLE IF NOT EXISTS script is safe to rerun and preserves all existing data.
2. Deploy Worker from `migration/cloudflare-foundation` after this migration.
3. Deploy/check Pages from the same commit, output `frontend`.
4. Sign in: create an avatar → Adventure Journeys → continue the adventure. Every active student in a party must do this before the party accepts a new quest.

No new curriculum installation is required for this character feature. Existing campaign progression and legacy quest templates remain intact. Existing users also choose and save their avatar once; historical XP and badges then appear on their character record.

Validation includes class palette validation, SVG injection resistance, mandatory avatars, account ownership, stale edits, atomic acceptance guards, historical reward aggregation, personal-score isolation, and missing-migration errors. Local Miniflare/D1 browser checks cover creation, preview, class-linked reflection submission, persisted appearance edits, ongoing campaign gates, admin curriculum update, and 390px/1440px layouts. Screenshots under docs/ui-preview use simulated data.
