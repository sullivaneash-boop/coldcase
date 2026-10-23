// Builds a tiny, fully synthetic archive in a temp directory for pipeline tests.
// Fixture records are clearly fake (TEST-prefixed text); they never touch the real archive.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { csvLine, type Row } from "../src/lib/csv";

export const ID = {
  src: "SRC-00000000-0000-4000-8000-000000000001",
  src2: "SRC-00000000-0000-4000-8000-000000000002",
  clm: "CLM-00000000-0000-4000-8000-000000000001",
  csl: "CSL-00000000-0000-4000-8000-000000000001",
  per: "PER-00000000-0000-4000-8000-000000000001",
  per2: "PER-00000000-0000-4000-8000-000000000002",
  evt: "EVT-00000000-0000-4000-8000-000000000001",
  etm: "ETM-00000000-0000-4000-8000-000000000001",
  rel: "REL-00000000-0000-4000-8000-000000000001",
  rel2: "REL-00000000-0000-4000-8000-000000000002",
  fil: "FIL-00000000-0000-4000-8000-000000000001",
  ast: "AST-00000000-0000-4000-8000-000000000001",
};

export type Tables = Partial<Record<string, Row[]>>;

export function baseTables(): Tables {
  return {
    "sources.csv": [{ source_id: ID.src, title: "TEST source", source_type: "WEB_PAGE", original_url: "https://example.org/test", reliability_class: "E", created_at: "2026-01-01T00:00:00Z" }],
    "claims.csv": [{ claim_id: ID.clm, claim: "TEST claim text", status: "REPORTED", confidence: "MEDIUM", source_ids: ID.src, people_ids: ID.per, event_ids: ID.evt, created_at: "2026-01-02T00:00:00Z" }],
    "claim_sources.csv": [{ claim_source_id: ID.csl, claim_id: ID.clm, source_id: ID.src, relationship: "SUPPORTS", source_locator: "para 1" }],
    "people.csv": [
      { person_id: ID.per, display_name: "Test Person One", identity_status: "PROVISIONAL" },
      { person_id: ID.per2, display_name: "Another Fixture", identity_status: "PROVISIONAL" },
    ],
    "events.csv": [{ event_id: ID.evt, title: "TEST event", time_status: "APPROXIMATE", start_at: "1990-05-01", local_start_time: "18:30", source_ids: ID.src }],
    "event_times.csv": [{ event_time_id: ID.etm, event_id: ID.evt, source_id: ID.src, source_locator: "para 2", time_status: "APPROXIMATE", start_at: "1990-05-01", local_start_time: "18:30" }],
    // The source mentions both people. Co-mention must NOT create a person–person link.
    "relationships.csv": [
      { relationship_id: ID.rel, from_record_id: ID.src, relationship_type: "MENTIONS", to_record_id: ID.per, source_id: ID.src, source_locator: "para 1" },
      { relationship_id: ID.rel2, from_record_id: ID.src, relationship_type: "MENTIONS", to_record_id: ID.per2, source_id: ID.src, source_locator: "para 3" },
    ],
  };
}

export function makeArchive(tables: Tables, files: Record<string, string | Buffer> = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "case-fixture-"));
  const reg = path.join(root, "00_ADMIN", "data_registers");
  fs.mkdirSync(reg, { recursive: true });
  for (const [file, rows] of Object.entries(tables)) {
    if (!rows) continue;
    const headers = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    fs.writeFileSync(path.join(reg, file), headers.join(",") + "\n" + rows.map((r) => csvLine(headers, r)).join(""));
  }
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), content);
  }
  return root;
}
