-- Shared LINE-style simulation transcript; actual LINE integration is not enabled.
-- Canonical preferences/private input images remain outside public chat messages.
CREATE TABLE IF NOT EXISTS chat_messages (
 id uuid PRIMARY KEY,
 session_id uuid NOT NULL REFERENCES sessions ON DELETE CASCADE,
 member_id uuid REFERENCES members ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('system','text','bot')),
 text text NOT NULL,
 created_at timestamptz NOT NULL,
 ranking_id uuid
);
CREATE INDEX IF NOT EXISTS chat_messages_session_time ON chat_messages(session_id,created_at);
DO $$ BEGIN ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY; END $$;
