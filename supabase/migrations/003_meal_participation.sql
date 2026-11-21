-- Group membership and explicit per-meal opt-in are separate.
CREATE TABLE IF NOT EXISTS meal_settings (
 session_id uuid PRIMARY KEY REFERENCES sessions ON DELETE CASCADE,
 phase text NOT NULL CHECK(phase IN ('setup','collecting'))
);
CREATE TABLE IF NOT EXISTS meal_participants (
 session_id uuid NOT NULL REFERENCES sessions ON DELETE CASCADE,
 member_id uuid NOT NULL REFERENCES members ON DELETE CASCADE,
 joined boolean NOT NULL,
 PRIMARY KEY(session_id,member_id)
);
DO $$ BEGIN ALTER TABLE meal_settings ENABLE ROW LEVEL SECURITY; ALTER TABLE meal_participants ENABLE ROW LEVEL SECURITY; END $$;
