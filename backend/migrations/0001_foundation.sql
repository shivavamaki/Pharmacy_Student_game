-- Initial schema only; no users, passwords, sessions or live data are seeded.
-- Preserve existing sheet IDs; Firebase UID is attached separately during enrollment.
PRAGMA foreign_keys = ON;
CREATE TABLE profiles (
  id TEXT PRIMARY KEY,
  firebase_uid TEXT UNIQUE,
  email TEXT UNIQUE,
  display_name TEXT NOT NULL,
  university TEXT,
  rotation TEXT,
  character_class TEXT,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student','gm','preceptor','admin')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','inactive')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE parties (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  rotation TEXT,
  gm_profile_id TEXT REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived'))
);
CREATE TABLE party_members (
  party_id TEXT NOT NULL REFERENCES parties(id),
  profile_id TEXT NOT NULL REFERENCES profiles(id),
  PRIMARY KEY (party_id, profile_id)
);
CREATE INDEX party_members_profile ON party_members(profile_id);
CREATE TABLE quests (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  objective TEXT,
  quest_type TEXT,
  xp_reward INTEGER NOT NULL DEFAULT 0 CHECK (xp_reward >= 0),
  status TEXT NOT NULL DEFAULT 'locked' CHECK (status IN ('available','locked','archived')),
  metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json))
);
CREATE TABLE assignments (
  id TEXT PRIMARY KEY,
  quest_id TEXT NOT NULL REFERENCES quests(id),
  party_id TEXT NOT NULL REFERENCES parties(id),
  assigned_gm_profile_id TEXT REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'waiting_gm_approval' CHECK (status IN
    ('waiting_gm_approval','in_progress','waiting_gm_review','revision_required','completed','archived')),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  risk TEXT NOT NULL DEFAULT 'green' CHECK (risk IN ('green','yellow','red')),
  deadline TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX assignments_party ON assignments(party_id);
CREATE TABLE recap_responses (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id),
  idempotency_key TEXT NOT NULL,
  answers_json TEXT NOT NULL CHECK (json_valid(answers_json)),
  submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (profile_id, idempotency_key)
);
-- answers_json is an allowlisted answer object, never the entire HTTP request.
CREATE TABLE xp_awards (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL REFERENCES assignments(id),
  profile_id TEXT NOT NULL REFERENCES profiles(id),
  xp INTEGER NOT NULL CHECK (xp >= 0),
  approved_by TEXT NOT NULL REFERENCES profiles(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (assignment_id, profile_id)
);
CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  actor_profile_id TEXT REFERENCES profiles(id),
  action TEXT NOT NULL,
  entity_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
