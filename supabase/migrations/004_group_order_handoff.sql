-- Simulation receipts only. No external order or payment identifier exists.
-- Authoritative session.document and this projection commit in one transaction.
CREATE TABLE IF NOT EXISTS cart_handoffs (
 session_id uuid PRIMARY KEY REFERENCES sessions ON DELETE CASCADE,
 id uuid NOT NULL UNIQUE,
 ranking_id uuid NOT NULL,
 status text NOT NULL CHECK(status IN ('cart','checkout_summary','invalidated')),
 preference_version integer NOT NULL,
 roster_version integer NOT NULL,
 total_satang integer NOT NULL CHECK(total_satang >= 0),
 document jsonb NOT NULL,
 created_at timestamptz NOT NULL
);
DO $$ BEGIN ALTER TABLE cart_handoffs ENABLE ROW LEVEL SECURITY; END $$;
