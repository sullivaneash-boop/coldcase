// SQLite index/cache schema. Every table here is rebuilt from the canonical
// archive by `npm run case`; nothing in this database is authoritative.
// Only `register_snapshots` and `sync_runs` survive a rebuild (they hold
// change-detection history, not case data).
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// Lossless copy of every register row, keyed by its primary ID.
export const records = sqliteTable("records", {
  id: text("id").primaryKey(),
  register: text("register").notNull(),
  rowJson: text("row_json").notNull(),
  rowHash: text("row_hash").notNull(),
});

// Board-facing projection of case records.
export const entities = sqliteTable("entities", {
  id: text("id").primaryKey(),
  type: text("type").notNull(), // PERSON | ORGANIZATION | EVENT | EVIDENCE | LOCATION | CLAIM | WITNESS_STATEMENT | SOURCE | CONTRADICTION
  subtype: text("subtype"),
  label: text("label").notNull(),
  subtitle: text("subtitle"),
  status: text("status"),
  confidence: text("confidence"),
  sortKey: text("sort_key"),
  register: text("register").notNull(),
  rowJson: text("row_json").notNull(),
  searchText: text("search_text").notNull(),
});

// Directed relationships. category:
//  SOURCED    – a source-attributed relationship (claim_sources, relationships.csv with source_id)
//  REGISTER   – an explicit association stored in a register ID list (e.g. claims.people_ids)
//  LEAD       – a register relationship explicitly marked as a research lead (e.g. POSSIBLE_SAME_IDENTITY)
//  RESEARCHER – researcher_links.csv: researcher connection, not evidence
export const edges = sqliteTable("edges", {
  id: text("id").primaryKey(),
  fromId: text("from_id").notNull(),
  toId: text("to_id").notNull(),
  relType: text("rel_type").notNull(),
  category: text("category").notNull(),
  sourceId: text("source_id"),
  locator: text("locator"),
  notes: text("notes"),
  origin: text("origin").notNull(), // register/file the edge was read from
});

export const claimSources = sqliteTable("claim_sources", {
  id: text("id").primaryKey(),
  claimId: text("claim_id").notNull(),
  sourceId: text("source_id").notNull(),
  relationship: text("relationship"),
  locator: text("locator"),
  excerpt: text("excerpt"),
  knowledgeBasis: text("knowledge_basis"),
  speakerPersonId: text("speaker_person_id"),
  assertionType: text("assertion_type"),
  notes: text("notes"),
});

export const eventTimes = sqliteTable("event_times", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull(),
  sourceId: text("source_id"),
  locator: text("locator"),
  timeStatus: text("time_status"),
  startAt: text("start_at"),
  endAt: text("end_at"),
  localStartTime: text("local_start_time"),
  localEndTime: text("local_end_time"),
  timePrecision: text("time_precision"),
  datePrecision: text("date_precision"),
  timezone: text("timezone"),
  originalTimeText: text("original_time_text"),
  confidence: text("confidence"),
  notes: text("notes"),
  synthetic: integer("synthetic").notNull().default(0), // 1 = taken from events.csv because no ETM row exists
});

export const contradictionVersions = sqliteTable("contradiction_versions", {
  id: text("id").primaryKey(),
  contradictionId: text("contradiction_id").notNull(),
  versionText: text("version_text"),
  sourceId: text("source_id"),
  locator: text("locator"),
  claimId: text("claim_id"),
  eventId: text("event_id"),
  statementId: text("statement_id"),
  assertedStartAt: text("asserted_start_at"),
  assertedEndAt: text("asserted_end_at"),
  timePrecision: text("time_precision"),
  originalTimeText: text("original_time_text"),
  notes: text("notes"),
});

export const sourceFiles = sqliteTable("source_files", {
  id: text("id").primaryKey(),
  sourceId: text("source_id").notNull(),
  fileRole: text("file_role"),
  localFile: text("local_file"),
  sha256: text("sha256"),
  mimeType: text("mime_type"),
  byteSize: integer("byte_size"),
  derivedFromFileId: text("derived_from_file_id"),
  transformation: text("transformation"),
  exists: integer("exists").notNull().default(0),
});

export const assets = sqliteTable("assets", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  localPath: text("local_path"),
  originalUrl: text("original_url"),
  caption: text("caption"),
  altText: text("alt_text"),
  sourceId: text("source_id"),
  relatedEntityIds: text("related_entity_ids"),
  status: text("status").notNull(),
  availability: text("availability").notNull(),
  identityBasis: text("identity_basis"),
  discoveredIn: text("discovered_in"),
  notes: text("notes"),
});

export const inboxItems = sqliteTable("inbox_items", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  priority: text("priority"),
  entityIds: text("entity_ids"),
  sourceIds: text("source_ids"),
  origin: text("origin").notNull(),
  originRef: text("origin_ref"),
  originalIssueType: text("original_issue_type"),
  status: text("status").notNull(), // OPEN | IN_REVIEW | ACCEPTED | MERGE_REQUESTED | IGNORED | UNRESOLVED
  decisionNote: text("decision_note"),
  decidedAt: text("decided_at"),
  decidedBy: text("decided_by"),
});

export const researcherLinks = sqliteTable("researcher_links", {
  id: text("id").primaryKey(),
  fromId: text("from_id").notNull(),
  toId: text("to_id").notNull(),
  label: text("label"),
  note: text("note"),
  createdBy: text("created_by"),
  createdAt: text("created_at"),
  status: text("status").notNull(),
});

// Batch source_chain.csv rows, one per (secondary source, underlying source).
export const sourceChain = sqliteTable("source_chain", {
  id: text("id").primaryKey(),
  sourceId: text("source_id").notNull(),
  underlyingSource: text("underlying_source"),
  sourceType: text("source_type"),
  url: text("url"),
  heldSourceId: text("held_source_id"),
  wantedId: text("wanted_id"),
  holdingStatus: text("holding_status"),
  independence: text("independence"),
  notes: text("notes"),
  batch: text("batch"),
});

export const wantedSources = sqliteTable("wanted_sources", {
  id: text("id").primaryKey(),
  title: text("title"),
  sourceType: text("source_type"),
  url: text("url"),
  requestedBySourceIds: text("requested_by_source_ids"),
  status: text("status"),
  notes: text("notes"),
  batch: text("batch"),
});

export const meta = sqliteTable("meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

// Persisted across rebuilds for change detection.
export const registerSnapshots = sqliteTable("register_snapshots", {
  register: text("register").primaryKey(),
  sha256: text("sha256").notNull(),
  rowHashesJson: text("row_hashes_json").notNull(),
  syncedAt: text("synced_at").notNull(),
});

export const syncRuns = sqliteTable("sync_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"),
  summaryJson: text("summary_json"),
  warningsJson: text("warnings_json"),
});
