# Quest editing, completed history and repeatable rewards

## Deploy in order

1. Open D1 `pharmacy-guild-dev` → Console. Copy **the SQL contents**, not the file URL, from `backend/migrations/0006_quest_rewards.sql` and execute. The migration is safe to repeat: it creates two tables and an index with `IF NOT EXISTS`. It does not change existing assignment statuses or award any historical Gold.
2. Deploy Worker from the latest `migration/cloudflare-foundation` commit.
3. Redeploy Pages from the same branch with output directory `frontend`.

Worker returns `reward_migration_required` if these two tables are absent. Existing authentication and enrollment endpoints remain usable during this migration.

## Edit the curriculum as Madeaw

Open **จัดการ → แม่แบบภารกิจ**, then select a quest name in the list under the form. Keep its **Quest ID** to edit the same template. Change its name, objective, type, competencies, required evidence, XP, Gold, badge, deadline, repeatability or availability and select **บันทึกภารกิจ**. Use one line per competency/evidence item.

**ติดตั้งเควสต์หลักสูตรที่ยังขาด** now creates missing campaign templates only. It preserves every existing template field and all legacy quests; it cannot reset customized curriculum text. Installation does not modify accepted missions.

Chapter and type are display metadata. Campaign IDs, prerequisite relationships, weekly area artwork and story text are defined separately in `backend/src/campaign.mjs`; editing Chapter does not reorder gates. Keep campaign IDs when editing existing Main/Side quests. Creating a different ID creates an independent quest rather than replacing a weekly campaign stage.

## Current tasks and done log

The party dashboard opens **ภารกิจปัจจุบัน** by default and has a **ประวัติสำเร็จ** tab. Completed ADR Hunter remains completed and readable there; no duplicate completion or XP award is needed. Active and completed lists are each bounded to 100 records independently, so completed history cannot crowd out current tasks. The current template may be archived without hiding a completed assignment's history.

The board first selects a party, then requests `/api/parties/:id/quest-board`. It omits active quests and once-only quests completed by that party. Other parties may still take them. Filters run in SQL before the 100-row bound. Completed assignments or a recorded XP award prevent accepting a once-only template again, even if an awarded assignment is later archived. Campaign gates and party permissions still apply.

## Repeatability and rewards

Old templates default to **ทำครั้งเดียวต่อทีม** and **0 Gold**. Madeaw must explicitly choose **ทำซ้ำได้หลัง GM อนุมัติจบรอบก่อน** for repeatable quests. Only one active round per quest and party is allowed. Every new round starts with GM approval and ends after evidence review, awarding that round's trusted XP/Gold snapshot to the participants captured at acceptance.

XP, Gold, badges, completion status, audit and idempotency records are written in one D1 transaction. Retrying completion cannot pay again. Template reward edits affect future acceptance only. Missions accepted before this migration keep their existing XP/badge snapshot and have 0 Gold; no retroactive currency is invented.

Gold totals appear beside XP and on Adventure Journeys with a personal Gold log. Gold is currently earned currency; spending is not implemented. Gold values are integers 0–100000 and repeatability must be an actual boolean at the API.

Validation: backend tests cover once-only scope, multiple rounds, trusted snapshots, repeatability races, rollback on award failure, idempotency, missing migration and history beyond 100 records. A local workerd/D1 browser check verifies completed ADR Hunter in the done log, absent from selection, repeatable quest rewards, multiline curriculum editing and preserved customization at mobile/desktop widths. Tests use local fixtures and do not alter remote D1.

### Acceptance feedback on mobile
The party dashboard now includes an acceptance preflight: whether the requester needs a character, and the names of active student members who still need avatars. The quest form shows these blockers before submission. Each save form also displays progress or API errors beside its submit button, so mobile users do not need to scroll to the global notice. These checks supplement the existing server authorization, avatar and transactional guards. No new database migration is needed.
