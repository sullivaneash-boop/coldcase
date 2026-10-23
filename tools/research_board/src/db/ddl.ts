// Raw DDL mirroring schema.ts. The cache is rebuilt wholesale on every sync,
// so a migration system would add ceremony without benefit.
export const REBUILT_TABLES = [
  "records",
  "entities",
  "edges",
  "claim_sources",
  "event_times",
  "contradiction_versions",
  "source_files",
  "assets",
  "inbox_items",
  "researcher_links",
  "meta",
  "source_chain",
  "wanted_sources",
];

export const DDL = `
CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY, register TEXT NOT NULL, row_json TEXT NOT NULL, row_hash TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS entities (id TEXT PRIMARY KEY, type TEXT NOT NULL, subtype TEXT, label TEXT NOT NULL, subtitle TEXT, status TEXT, confidence TEXT, sort_key TEXT, register TEXT NOT NULL, row_json TEXT NOT NULL, search_text TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS edges (id TEXT PRIMARY KEY, from_id TEXT NOT NULL, to_id TEXT NOT NULL, rel_type TEXT NOT NULL, category TEXT NOT NULL, source_id TEXT, locator TEXT, notes TEXT, origin TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS edges_from ON edges(from_id);
CREATE INDEX IF NOT EXISTS edges_to ON edges(to_id);
CREATE TABLE IF NOT EXISTS claim_sources (id TEXT PRIMARY KEY, claim_id TEXT NOT NULL, source_id TEXT NOT NULL, relationship TEXT, locator TEXT, excerpt TEXT, knowledge_basis TEXT, speaker_person_id TEXT, assertion_type TEXT, notes TEXT);
CREATE TABLE IF NOT EXISTS event_times (id TEXT PRIMARY KEY, event_id TEXT NOT NULL, source_id TEXT, locator TEXT, time_status TEXT, start_at TEXT, end_at TEXT, local_start_time TEXT, local_end_time TEXT, time_precision TEXT, date_precision TEXT, timezone TEXT, original_time_text TEXT, confidence TEXT, notes TEXT, synthetic INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS contradiction_versions (id TEXT PRIMARY KEY, contradiction_id TEXT NOT NULL, version_text TEXT, source_id TEXT, locator TEXT, claim_id TEXT, event_id TEXT, statement_id TEXT, asserted_start_at TEXT, asserted_end_at TEXT, time_precision TEXT, original_time_text TEXT, notes TEXT);
CREATE TABLE IF NOT EXISTS source_files (id TEXT PRIMARY KEY, source_id TEXT NOT NULL, file_role TEXT, local_file TEXT, sha256 TEXT, mime_type TEXT, byte_size INTEGER, derived_from_file_id TEXT, transformation TEXT, "exists" INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS assets (id TEXT PRIMARY KEY, type TEXT NOT NULL, local_path TEXT, original_url TEXT, caption TEXT, alt_text TEXT, source_id TEXT, related_entity_ids TEXT, status TEXT NOT NULL, availability TEXT NOT NULL, identity_basis TEXT, discovered_in TEXT, notes TEXT);
CREATE TABLE IF NOT EXISTS inbox_items (id TEXT PRIMARY KEY, kind TEXT NOT NULL, title TEXT NOT NULL, description TEXT, priority TEXT, entity_ids TEXT, source_ids TEXT, origin TEXT NOT NULL, origin_ref TEXT, original_issue_type TEXT, status TEXT NOT NULL, decision_note TEXT, decided_at TEXT, decided_by TEXT);
CREATE TABLE IF NOT EXISTS researcher_links (id TEXT PRIMARY KEY, from_id TEXT NOT NULL, to_id TEXT NOT NULL, label TEXT, note TEXT, created_by TEXT, created_at TEXT, status TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS source_chain (id TEXT PRIMARY KEY, source_id TEXT NOT NULL, underlying_source TEXT, source_type TEXT, url TEXT, held_source_id TEXT, wanted_id TEXT, holding_status TEXT, independence TEXT, notes TEXT, batch TEXT);
CREATE TABLE IF NOT EXISTS wanted_sources (id TEXT PRIMARY KEY, title TEXT, source_type TEXT, url TEXT, requested_by_source_ids TEXT, status TEXT, notes TEXT, batch TEXT);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS register_snapshots (register TEXT PRIMARY KEY, sha256 TEXT NOT NULL, row_hashes_json TEXT NOT NULL, synced_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sync_runs (id INTEGER PRIMARY KEY AUTOINCREMENT, started_at TEXT NOT NULL, finished_at TEXT, summary_json TEXT, warnings_json TEXT);
`;
