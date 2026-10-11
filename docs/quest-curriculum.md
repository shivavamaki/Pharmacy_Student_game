# Weekly main quests, SOAP boss, and two project quests

The quest board separates Main Quest, Boss Fight, Side Quest, and existing templates. Existing D1 quest rows, assignments, XP, and evidence are preserved. Nothing is deleted or archived automatically. The existing-template filter shows quests whose IDs are outside the supplied eight-template curriculum, including other custom templates.

## Curriculum

| Type | Template | Required work for GM review |
| --- | --- | --- |
| Main, week 1 | Lecture & Foundations | Lecture/workshop/discussion participation record, reflection journal, short quiz |
| Main, week 2 | OPD Practice | Practice participation record, case presentation, SOAP note |
| Main, week 3 | Inpatient Ward Training | Ward-round/case-discussion participation record, clinical case report |
| Main, week 4 | IV Admixture & Special Medications | Simulation/supervised-practice participation record, project development work |
| Main, week 5 | Integration & Final Presentation | Final-presentation/peer-review participation record, both completed project reports |
| Boss | SOAP Presentation | S/O/A/P case presentation, presentation materials, presentation record and GM feedback |
| Side, project 1 | Department improvement | Project report and presentation |
| Side, project 2 | Clinical improvement | Project report, clinical implementation plan, and presentation |

Both Side Quests are required projects for the rotation, despite their game label. Each has its own quest template. Main Quests focus on participation in the supplied weekly activities, plus that week's assignments.

## Install and review

1. Deploy Pages from the migration branch, output `frontend`. There is no Worker or D1 schema change.
2. Madeaw opens **จัดการ → เพิ่มชุดเควสต์หลักสูตร 5 สัปดาห์**.
3. The client reads the existing templates and adds only missing curriculum IDs through the existing authenticated admin API. Existing IDs are skipped; partial installations can be retried. If the list exceeds 100 templates, installation stops for review.
4. Review and edit each template in **แม่แบบภารกิจ**. Existing templates, including locked/archived entries, remain listed there. Review them before choosing to change their status.

The templates start available. Weekly unlocking and progression dependencies are not implemented. Accept the appropriate weekly quest when the relevant activities begin. Default XP is a configurable design choice: 100 per main quest, 200 for the boss, and 250 per project. Default deadlines are 7 days after accepting a main/boss quest and 35 days after accepting a project; they are not derived from cohort dates.

Attendance is reviewed by the GM from participation evidence. The requirements list describes what the GM must check; it is not an automatic per-student attendance register or a machine-enforced checklist. The existing Worker continues to require at least one approved evidence record and no outstanding evidence before awarding XP. Rewards still use the participants and rewards captured when the team accepts the quest.

## UI

Quest cards lead to a detail page with objectives, competencies, evidence requirements, rewards, and team selection. Team membership is loaded only for the selected quest, rather than for every card. Existing active assignments for the selected team are linked and cannot be accepted again from the detail page. Server validation remains authoritative, including for paginated lists and concurrent changes.

Mission pages show status, progress, deadline, risk, participant roles, the current available template's requirements, and the next action for the viewer. Archived/locked templates are not returned by the public quest API, so their current brief may be absent from the mission page. Evidence and progress history remain readable. GM queues group requests, evidence reviews, and follow-up tasks.

## Validation

`node --test frontend/test/quest-model.test.mjs` checks curriculum shape, legacy metadata tolerance, search, status guidance, and deadline formatting. A local headless browser harness with simulated API data verified the main/side/boss/legacy filters, search, duplicate acceptance guard, unchanged acceptance payload, safe curriculum installation/retry, and layouts at 1440px and 390px without horizontal overflow or JavaScript errors. These checks do not create real accounts or mutate remote D1.

`docs/ui-preview/` screenshots use simulated student and quest data for UI review; they do not show actual enrollment records.
