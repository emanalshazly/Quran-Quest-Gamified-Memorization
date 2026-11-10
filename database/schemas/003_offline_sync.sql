-- Quran Quest: offline sync support
-- Run after 001_initial_schema.sql. Safe to run more than once.

-- Operations sent by the app carry a client-generated id. Recording it here
-- lets the API recognise a retry of a request that already succeeded (for
-- example when the response was lost on a bad connection) and not apply it
-- twice — a review must not award points or advance the schedule twice.
CREATE TABLE IF NOT EXISTS processed_operations (
    op_id TEXT PRIMARY KEY,
    kid_id UUID NOT NULL REFERENCES kids(id) ON DELETE CASCADE,
    operation VARCHAR(50) NOT NULL,
    processed_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_processed_operations_processed_at
    ON processed_operations(processed_at);

-- Only the backend (service role) reads or writes this table; with RLS on
-- and no policies, other clients have no access.
ALTER TABLE processed_operations ENABLE ROW LEVEL SECURITY;
