// Archive location and the app-owned register files. The archive is canonical;
// the app only ever appends to the three app-owned registers listed below.
import path from "node:path";
import fs from "node:fs";

export const ARCHIVE_ROOT = path.resolve(
  process.env.CASE_ARCHIVE_ROOT ?? path.join(process.cwd(), "..", ".."),
);
export const REGISTER_DIR = path.join(ARCHIVE_ROOT, "00_ADMIN", "data_registers");
export const DB_PATH = path.resolve(
  process.env.CASE_DB_PATH ?? path.join(process.cwd(), "data", "case-index.sqlite"),
);

// App-owned, append-only registers (schema additions; see DATA_DICTIONARY.md).
export const ASSETS_CSV = path.join(REGISTER_DIR, "assets.csv");
export const RESEARCHER_LINKS_CSV = path.join(REGISTER_DIR, "researcher_links.csv");
export const REVIEW_DECISIONS_CSV = path.join(REGISTER_DIR, "review_decisions.csv");

export const ASSET_HEADERS = [
  "asset_id", "type", "local_path", "original_url", "caption", "alt_text", "source_id",
  "related_entity_ids", "status", "availability", "identity_basis", "discovered_in", "notes",
  "created_at", "updated_at",
];
export const RESEARCHER_LINK_HEADERS = [
  "researcher_link_id", "from_record_id", "to_record_id", "label", "note", "created_by",
  "created_at", "status",
];
export const REVIEW_DECISION_HEADERS = [
  "decision_id", "item_id", "item_kind", "decision", "note", "decided_by", "decided_at",
  "entity_ids", "source_ids",
];

/** Resolve an archive-relative POSIX path, refusing anything that escapes the archive. */
export function resolveArchivePath(rel: string): string | null {
  if (!rel || rel.includes("\0") || path.isAbsolute(rel)) return null;
  const abs = path.resolve(ARCHIVE_ROOT, rel);
  if (abs !== ARCHIVE_ROOT && !abs.startsWith(ARCHIVE_ROOT + path.sep)) return null;
  return abs;
}

export function archiveFileExists(rel: string): boolean {
  const abs = resolveArchivePath(rel);
  return !!abs && fs.existsSync(abs) && fs.statSync(abs).isFile();
}
