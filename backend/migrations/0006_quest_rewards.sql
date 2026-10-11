-- Safe to run again. Existing completed quests receive no retroactive Gold.
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS assignment_gold_rewards (
 assignment_id TEXT PRIMARY KEY REFERENCES assignments(id),
 gold INTEGER NOT NULL CHECK (gold BETWEEN 0 AND 100000)
);
CREATE TABLE IF NOT EXISTS gold_awards (
 id TEXT PRIMARY KEY,
 assignment_id TEXT NOT NULL REFERENCES assignments(id),
 profile_id TEXT NOT NULL REFERENCES profiles(id),
 gold INTEGER NOT NULL CHECK (gold BETWEEN 0 AND 100000),
 approved_by TEXT NOT NULL REFERENCES profiles(id),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE (assignment_id, profile_id)
);
CREATE INDEX IF NOT EXISTS gold_awards_profile ON gold_awards(profile_id);
