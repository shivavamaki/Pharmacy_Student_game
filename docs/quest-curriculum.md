# Weekly main quests, SOAP boss, and two project quests

The quest board separates Main Quest, Boss Fight, Side Quest, and existing templates. Existing D1 quest rows, assignments, XP, and evidence are preserved. Nothing is deleted or archived automatically. The existing-template filter shows quests whose IDs are outside the supplied ten-template curriculum, including other custom templates.

## Curriculum

| Type | Template | Required work for GM review |
| --- | --- | --- |
| Main, week 1 | Training Ground | Lecture/workshop/discussion participation record, reflection journal, short quiz |
| Main, week 2 | Outpost Dungeon | Practice participation record, case presentation, SOAP note |
| Main, week 3 | Infinite Portal Device | Ward-round/case-discussion participation record, clinical case report |
| Main, week 4 | Time Chamber / Library of the Brave / Pilgrimage Wanderer | IV simulation, stock management, ward-round participation records, project development work |
| Main, week 5 | Integration & Final Presentation | Final-presentation/peer-review participation record, both completed project reports |
| Boss | Sovereign of All Plagues (SOAP) | S/O/A/P case presentation, presentation materials, presentation record and GM feedback |
| Mini boss | The Forgekeeper | Both project presentations and GM feedback |
| Mini boss | The Keeper of Knowledge | Academic in-service presentation and GM feedback |
| Side, project 1 | Department improvement | Project report and presentation |
| Side, project 2 | Clinical improvement | Project report, clinical implementation plan, and presentation |

Both Side Quests are required projects for the rotation, despite their game label. Each has its own quest template. Main Quests focus on participation in the supplied weekly activities, plus that week's assignments.

## Install and review

1. Deploy **Worker** from `migration/cloudflare-foundation` first, then deploy **Pages** with output `frontend`. No new D1 schema migration is needed.
2. Madeaw opens **จัดการ → ติดตั้ง / อัปเดตแคมเปญ 5 สัปดาห์**.
3. The installer adds missing campaign IDs and updates the ten known curriculum briefs, preserving existing XP, status, badge and deadline settings. It never touches other IDs. Partial installs can be retried. More than 100 templates stops installation for review.
4. Review each template in **แม่แบบภารกิจ**. Existing assignments retain their accepted reward snapshots.

Progression is enforced by the Worker per party. A GM must review evidence and mark the current assignment completed to open the next stage. Approval to start and progress percentage alone do not unlock it. The default path is Training → OPD → IPD → the three week-four practice areas → project mini boss → academic mini boss → SOAP → final integration. Both side projects open after Training and must be completed before accepting the project mini boss. All three week-four locations open together and are reviewed under the same weekly Main Quest. Future narrative is omitted from the campaign response, and future campaign quests/assignments are hidden from students. Legacy quest IDs remain independent. See [campaign-artwork.md](campaign-artwork.md).

Defaults are configurable: Main 100 XP, each boss 200 XP, each project 250 XP; 7-day main/boss and 35-day project deadlines measured from acceptance, not cohort dates. Only SOAP has the default SOAP Champion badge.

Attendance is reviewed by the GM from participation evidence. The requirements list describes what the GM must check; it is not an automatic per-student attendance register or a machine-enforced checklist. The existing Worker continues to require at least one approved evidence record and no outstanding evidence before awarding XP. Rewards still use the participants and rewards captured when the team accepts the quest.

## UI

Quest cards lead to a detail page with objectives, competencies, evidence requirements, rewards, and team selection. Team membership is loaded only for the selected quest, rather than for every card. Existing active assignments for the selected team are linked and cannot be accepted again from the detail page. Server validation remains authoritative, including for paginated lists and concurrent changes.

Mission pages show status, progress, deadline, risk, participant roles, the current available template's requirements, and the next action for the viewer. Archived/locked templates are not returned by the public quest API, so their current brief may be absent from the mission page. Evidence and progress history remain readable. GM queues group requests, evidence reviews, and follow-up tasks.

## Validation

`node --test frontend/test/quest-model.test.mjs` checks curriculum shape, legacy metadata tolerance, search, status guidance, and deadline formatting. A local headless browser harness with simulated API data verified the main/side/boss/legacy filters, search, duplicate acceptance guard, unchanged acceptance payload, safe curriculum installation/retry, and layouts at 1440px and 390px without horizontal overflow or JavaScript errors. These checks do not create real accounts or mutate remote D1.

`docs/ui-preview/` screenshots use simulated student and quest data for UI review; they do not show actual enrollment records.
