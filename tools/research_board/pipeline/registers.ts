// Register definitions and loading. Registers live in <archive>/00_ADMIN/data_registers and are canonical.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { readCsv, type Row } from "../src/lib/csv";
import type { Issue } from "../src/lib/types";

export const REGISTERS = {
  sources: { file: "sources.csv", pk: "source_id", prefix: "SRC" },
  claims: { file: "claims.csv", pk: "claim_id", prefix: "CLM" },
  claim_sources: { file: "claim_sources.csv", pk: "claim_source_id", prefix: "CSL" },
  contradictions: { file: "contradictions.csv", pk: "contradiction_id", prefix: "CON" },
  contradiction_versions: { file: "contradiction_versions.csv", pk: "contradiction_version_id", prefix: "CVR" },
  people: { file: "people.csv", pk: "person_id", prefix: "PER" },
  organizations: { file: "organizations.csv", pk: "organization_id", prefix: "ORG" },
  locations: { file: "locations.csv", pk: "location_id", prefix: "LOC" },
  events: { file: "events.csv", pk: "event_id", prefix: "EVT" },
  event_times: { file: "event_times.csv", pk: "event_time_id", prefix: "ETM" },
  evidence: { file: "evidence.csv", pk: "evidence_id", prefix: "EVD" },
  witness_statements: { file: "witness_statements.csv", pk: "statement_id", prefix: "WIT" },
  relationships: { file: "relationships.csv", pk: "relationship_id", prefix: "REL" },
  source_files: { file: "source_files.csv", pk: "source_file_id", prefix: "FIL" },
  records_requests: { file: "records_requests.csv", pk: "request_id", prefix: "REQ" },
  interviews: { file: "interviews.csv", pk: "interview_id", prefix: "INT" },
  newspaper_articles: { file: "newspaper_articles.csv", pk: "source_id", prefix: "SRC" },
  assets: { file: "assets.csv", pk: "asset_id", prefix: "AST" },
  researcher_links: { file: "researcher_links.csv", pk: "researcher_link_id", prefix: "RLK" },
  review_decisions: { file: "review_decisions.csv", pk: "decision_id", prefix: "DEC" },
} as const;
export type RegisterName = keyof typeof REGISTERS;
export type Registers = Record<RegisterName, Row[]>;

/** Registers whose primary keys are addressable case records. */
export const ENTITY_REGISTERS: RegisterName[] = [
  "sources", "claims", "contradictions", "people", "organizations", "locations", "events", "evidence", "witness_statements",
];

export const sha256 = (buf: Buffer | string) => crypto.createHash("sha256").update(buf).digest("hex");

export function loadRegisters(archiveRoot: string, issues: Issue[]) {
  const dir = path.join(archiveRoot, "00_ADMIN", "data_registers");
  const data = {} as Registers;
  const rowHashes = {} as Record<RegisterName, Record<string, string>>;
  for (const [name, def] of Object.entries(REGISTERS) as [RegisterName, (typeof REGISTERS)[RegisterName]][]) {
    const file = path.join(dir, def.file);
    data[name] = [];
    rowHashes[name] = {};
    if (!fs.existsSync(file)) continue;
    let rows: Row[];
    try {
      rows = readCsv(file);
    } catch (e) {
      issues.push({ level: "ERROR", code: "MALFORMED_CSV", file: def.file, message: `${def.file} could not be parsed: ${(e as Error).message}` });
      continue;
    }
    const seen = new Set<string>();
    rows.forEach((r, i) => {
      const id = (r[def.pk] ?? "").trim();
      if (!id) {
        issues.push({ level: "ERROR", code: "MALFORMED_RECORD", file: def.file, message: `${def.file} row ${i + 2} has no ${def.pk}; row ignored` });
        return;
      }
      if (seen.has(id)) {
        issues.push({ level: "ERROR", code: "DUPLICATE_ID", file: def.file, recordId: id, message: `${def.file}: duplicate ID ${id} (row ${i + 2}); later row ignored` });
        return;
      }
      if (!new RegExp(`^${def.prefix}-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`, "i").test(id)) {
        issues.push({ level: "ERROR", code: "MALFORMED_ID", file: def.file, recordId: id, message: `${def.file}: ${id} is not ${def.prefix}-<UUID>` });
      }
      seen.add(id);
      data[name].push(r);
      rowHashes[name][id] = sha256(JSON.stringify(r));
    });
  }
  return { data, rowHashes };
}
