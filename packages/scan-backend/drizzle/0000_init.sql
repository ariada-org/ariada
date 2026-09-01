-- @ariada-org/scan-backend — Postgres schema (v0.2.0, salvage migration 2026-04-27).
-- Apply identically to ariada-web-db and draculascan-db (or single shared DB
-- per ADR-003 single-backend topology).
--
-- Ported from the original D1 SQLite schema. Differences:
--  - INTEGER timestamps in milliseconds → BIGINT (preserved for app symmetry)
--  - INTEGER booleans → SMALLINT (1/0) for the same reason
--  - JSON columns → JSONB
--  - Adds gen_random_uuid()-friendly fallbacks where IDs are app-generated.

CREATE TABLE IF NOT EXISTS scans (
  id TEXT PRIMARY KEY,                     -- ulid
  url TEXT NOT NULL,
  url_host TEXT NOT NULL,
  requested_at BIGINT NOT NULL,
  completed_at BIGINT,
  status TEXT NOT NULL,                    -- queued|running|complete|failed|timeout
  ip_hash TEXT NOT NULL,
  turnstile_ok SMALLINT NOT NULL DEFAULT 0,
  error TEXT
);
CREATE INDEX IF NOT EXISTS idx_scans_host ON scans(url_host);
CREATE INDEX IF NOT EXISTS idx_scans_req ON scans(requested_at);

CREATE TABLE IF NOT EXISTS scorecards (
  slug TEXT PRIMARY KEY,                   -- nanoid(12)
  scan_id TEXT NOT NULL REFERENCES scans(id),
  url TEXT NOT NULL,
  score INTEGER NOT NULL,
  critical_count INTEGER NOT NULL,
  serious_count  INTEGER NOT NULL,
  moderate_count INTEGER NOT NULL,
  minor_count    INTEGER NOT NULL,
  top_categories JSONB NOT NULL,
  screenshot_key TEXT,                     -- BlobStore key
  og_image_key TEXT,
  created_at BIGINT NOT NULL,
  public SMALLINT NOT NULL DEFAULT 1,
  view_count INTEGER NOT NULL DEFAULT 0,
  share_count INTEGER NOT NULL DEFAULT 0,
  expires_at BIGINT
);
CREATE INDEX IF NOT EXISTS idx_scorecards_created ON scorecards(created_at);
CREATE INDEX IF NOT EXISTS idx_scorecards_expires ON scorecards(expires_at);

CREATE TABLE IF NOT EXISTS scan_events (
  scan_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  ts BIGINT NOT NULL,
  kind TEXT NOT NULL,
  payload JSONB NOT NULL,
  PRIMARY KEY (scan_id, seq)
);

CREATE TABLE IF NOT EXISTS scorecard_cross_sells (
  scorecard_slug TEXT NOT NULL REFERENCES scorecards(slug) ON DELETE CASCADE,
  target TEXT NOT NULL,                    -- ariada|blamer|clamper|reverter
  clicks INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (scorecard_slug, target)
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  cookie_id TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  path TEXT,
  ref TEXT,
  at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_cookie ON events(cookie_id);
CREATE INDEX IF NOT EXISTS idx_events_at ON events(at);
