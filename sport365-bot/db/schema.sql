-- SPORT 365 canonical football data schema (SQLite / Cloudflare D1 compatible)
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  terms_url TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_success_at TEXT,
  last_error_at TEXT,
  last_error TEXT
);

CREATE TABLE IF NOT EXISTS competitions (
  id TEXT PRIMARY KEY,
  name_ar TEXT NOT NULL,
  country_ar TEXT,
  season TEXT,
  source_id TEXT,
  source_competition_id TEXT,
  FOREIGN KEY(source_id) REFERENCES sources(id)
);

CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  name_ar TEXT NOT NULL,
  country_ar TEXT,
  source_id TEXT,
  source_team_id TEXT,
  FOREIGN KEY(source_id) REFERENCES sources(id)
);

CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  competition_id TEXT,
  season TEXT,
  home_team_id TEXT,
  away_team_id TEXT,
  kickoff_utc TEXT,
  status TEXT NOT NULL DEFAULT 'unknown',
  status_confidence TEXT NOT NULL DEFAULT 'unknown',
  home_score INTEGER,
  away_score INTEGER,
  venue TEXT,
  source_updated_at TEXT,
  observed_at TEXT NOT NULL,
  data_freshness TEXT NOT NULL DEFAULT 'unknown',
  FOREIGN KEY(competition_id) REFERENCES competitions(id),
  FOREIGN KEY(home_team_id) REFERENCES teams(id),
  FOREIGN KEY(away_team_id) REFERENCES teams(id)
);

CREATE TABLE IF NOT EXISTS match_events (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  minute INTEGER,
  added_minute INTEGER,
  team_id TEXT,
  player_name_ar TEXT,
  assist_name_ar TEXT,
  detail TEXT,
  source_id TEXT NOT NULL,
  source_event_id TEXT,
  observed_at TEXT NOT NULL,
  confidence TEXT NOT NULL DEFAULT 'source_recorded',
  FOREIGN KEY(match_id) REFERENCES matches(id) ON DELETE CASCADE,
  FOREIGN KEY(team_id) REFERENCES teams(id),
  FOREIGN KEY(source_id) REFERENCES sources(id),
  UNIQUE(source_id, source_event_id)
);

CREATE TABLE IF NOT EXISTS match_statistics (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL,
  team_id TEXT,
  metric TEXT NOT NULL,
  value REAL NOT NULL,
  unit TEXT,
  source_id TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  confidence TEXT NOT NULL DEFAULT 'source_recorded',
  FOREIGN KEY(match_id) REFERENCES matches(id) ON DELETE CASCADE,
  FOREIGN KEY(team_id) REFERENCES teams(id),
  FOREIGN KEY(source_id) REFERENCES sources(id)
);

CREATE TABLE IF NOT EXISTS source_observations (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  source_updated_at TEXT,
  payload_hash TEXT NOT NULL,
  accepted INTEGER NOT NULL DEFAULT 0,
  rejection_reason TEXT,
  FOREIGN KEY(source_id) REFERENCES sources(id)
);

CREATE INDEX IF NOT EXISTS idx_matches_kickoff ON matches(kickoff_utc);
CREATE INDEX IF NOT EXISTS idx_matches_competition ON matches(competition_id, season);
CREATE INDEX IF NOT EXISTS idx_events_match_minute ON match_events(match_id, minute);
CREATE INDEX IF NOT EXISTS idx_stats_match_metric ON match_statistics(match_id, metric);
CREATE INDEX IF NOT EXISTS idx_observations_entity ON source_observations(entity_type, entity_id, observed_at);
