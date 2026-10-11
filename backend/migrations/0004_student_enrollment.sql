-- Apply once after 0002. Existing accounts and recap records are preserved.
ALTER TABLE profiles ADD COLUMN cohort TEXT;
ALTER TABLE profiles ADD COLUMN training_start TEXT;
ALTER TABLE profiles ADD COLUMN training_end TEXT;
CREATE INDEX profiles_enrollment_queue ON profiles(status,created_at);
