-- Safe to rerun. Existing profiles, quests, rewards and recap records are retained.
CREATE TABLE IF NOT EXISTS characters (
 profile_id TEXT PRIMARY KEY REFERENCES profiles(id),
 name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 80),
 class_key TEXT NOT NULL CHECK(class_key IN ('curious','observer','counselor','detective','survival','future')),
 skin TEXT NOT NULL DEFAULT 'light' CHECK(skin IN ('light','warm','tan','deep')),
 hair TEXT NOT NULL DEFAULT 'black' CHECK(hair IN ('black','brown','gold','silver')),
 hairstyle TEXT NOT NULL DEFAULT 'short' CHECK(hairstyle IN ('short','bob','long','braid')),
 cloak TEXT NOT NULL DEFAULT 'teal' CHECK(cloak IN ('teal','blue','violet','red','gold','sage')),
 why TEXT NOT NULL DEFAULT '', goal TEXT NOT NULL DEFAULT '',
 version INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
