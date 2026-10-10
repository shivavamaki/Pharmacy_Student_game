ALTER TABLE assignments ADD COLUMN version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE assignments ADD COLUMN accepted_at TEXT;
ALTER TABLE assignments ADD COLUMN gm_comment TEXT NOT NULL DEFAULT '';
ALTER TABLE assignments ADD COLUMN party_roles_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(party_roles_json));
ALTER TABLE assignments ADD COLUMN reward_xp INTEGER NOT NULL DEFAULT 0 CHECK(reward_xp >= 0);
ALTER TABLE assignments ADD COLUMN reward_badge TEXT;
UPDATE assignments SET reward_xp=(SELECT xp_reward FROM quests WHERE id=quest_id), reward_badge=json_extract((SELECT metadata_json FROM quests WHERE id=quest_id),'$.badgeReward');
CREATE TABLE assignment_participants (
 assignment_id TEXT NOT NULL REFERENCES assignments(id), profile_id TEXT NOT NULL REFERENCES profiles(id), PRIMARY KEY(assignment_id,profile_id)
);
INSERT INTO assignment_participants SELECT a.id,m.profile_id FROM assignments a JOIN party_members m ON m.party_id=a.party_id;
CREATE TABLE daily_progress (
 id TEXT PRIMARY KEY, assignment_id TEXT NOT NULL REFERENCES assignments(id), submitted_by TEXT NOT NULL REFERENCES profiles(id),
 progress_date TEXT NOT NULL, previous_turn TEXT NOT NULL DEFAULT '', current_turn TEXT NOT NULL, obstacle TEXT NOT NULL DEFAULT '', need_gm_support TEXT NOT NULL DEFAULT '',
 risk TEXT NOT NULL CHECK(risk IN ('green','yellow','red')), progress_percent INTEGER NOT NULL CHECK(progress_percent BETWEEN 0 AND 100),
 gm_comment TEXT NOT NULL DEFAULT '', reviewed_by TEXT REFERENCES profiles(id), reviewed_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX daily_assignment ON daily_progress(assignment_id,created_at);
CREATE TABLE evidence (
 id TEXT PRIMARY KEY, assignment_id TEXT NOT NULL REFERENCES assignments(id), submitted_by TEXT NOT NULL REFERENCES profiles(id), evidence_type TEXT NOT NULL,
 title TEXT NOT NULL, url TEXT NOT NULL, reflection_note TEXT NOT NULL DEFAULT '',
 review_status TEXT NOT NULL DEFAULT 'waiting_review' CHECK(review_status IN ('waiting_review','approved','revision_required','superseded')),
 gm_feedback TEXT NOT NULL DEFAULT '', competency_result TEXT NOT NULL DEFAULT '', reviewed_by TEXT REFERENCES profiles(id),
 submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, reviewed_at TEXT
);
CREATE INDEX evidence_assignment ON evidence(assignment_id,submitted_at);
CREATE TABLE badge_awards (
 id TEXT PRIMARY KEY, assignment_id TEXT NOT NULL REFERENCES assignments(id), profile_id TEXT NOT NULL REFERENCES profiles(id), badge_name TEXT NOT NULL,
 approved_by TEXT NOT NULL REFERENCES profiles(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(assignment_id,profile_id,badge_name)
);
CREATE TABLE assessments (
 id TEXT PRIMARY KEY, profile_id TEXT NOT NULL REFERENCES profiles(id), party_id TEXT NOT NULL REFERENCES parties(id), rotation TEXT,
 assessment_type TEXT NOT NULL, score REAL NOT NULL, max_score REAL NOT NULL CHECK(max_score > 0), rubric_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(rubric_json)),
 feedback TEXT NOT NULL DEFAULT '', preceptor_profile_id TEXT NOT NULL REFERENCES profiles(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK(score >= 0 AND score <= max_score)
);
CREATE INDEX assessments_profile ON assessments(profile_id,created_at);
CREATE TABLE settings (key TEXT PRIMARY KEY, value_json TEXT NOT NULL CHECK(json_valid(value_json)), updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE recap_drafts (profile_id TEXT PRIMARY KEY REFERENCES profiles(id), answers_json TEXT NOT NULL CHECK(json_valid(answers_json)), updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE historical_xp (id TEXT PRIMARY KEY, profile_id TEXT NOT NULL REFERENCES profiles(id), party_id TEXT REFERENCES parties(id), quest_id TEXT REFERENCES quests(id), xp INTEGER NOT NULL CHECK(xp >= 0), reason TEXT, approved_by TEXT REFERENCES profiles(id), created_at TEXT NOT NULL);
CREATE TABLE historical_badges (id TEXT PRIMARY KEY, profile_id TEXT NOT NULL REFERENCES profiles(id), party_id TEXT REFERENCES parties(id), quest_id TEXT REFERENCES quests(id), badge_name TEXT NOT NULL, approved_by TEXT REFERENCES profiles(id), created_at TEXT NOT NULL);
CREATE TABLE api_operations (
 id TEXT PRIMARY KEY, actor_profile_id TEXT NOT NULL REFERENCES profiles(id), idempotency_key TEXT NOT NULL, request_hash TEXT NOT NULL,
 result_json TEXT NOT NULL CHECK(json_valid(result_json)), allowed INTEGER NOT NULL CHECK(allowed=1), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(actor_profile_id,idempotency_key)
);
INSERT INTO settings(key,value_json) VALUES('app_title','"The Pharmacy Guild"');
CREATE TABLE legacy_records (
 source_table TEXT NOT NULL, source_id TEXT NOT NULL, data_json TEXT NOT NULL CHECK(json_valid(data_json)), PRIMARY KEY(source_table,source_id)
);
