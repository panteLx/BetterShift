-- Precomputed public statistics, one row with key = 'public'. The cron handler
-- replaces it wholesale, so there is never a partially updated aggregate.
CREATE TABLE IF NOT EXISTS aggregates (
  key TEXT PRIMARY KEY,
  json TEXT NOT NULL,
  computed_at TEXT NOT NULL
);
