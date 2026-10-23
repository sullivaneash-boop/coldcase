// Archive validation. ERROR blocks automated deployment; WARNING is recorded but allows it.
// Validation only reports — it never edits registers or invents missing data.
import fs from "node:fs";
import path from "node:path";
import { splitIds, type Row } from "../src/lib/csv";
import { isValidClock, isValidDateOrTimestamp, isValidIsoDate } from "../src/lib/time";
import type { Issue } from "../src/lib/types";
import { CLAIM_STATUSES } from "../src/lib/types";
import { REGISTERS, sha256, type RegisterName, type Registers } from "./registers";

/** Which record prefixes each reference field may point at. "*" = any case record. */
const REFERENCE_FIELDS: Partial<Record<RegisterName, Record<string, { prefixes: string[]; required?: boolean; list?: boolean }>>> = {
  claims: {
    source_ids: { prefixes: ["SRC"], list: true }, contradicting_source_ids: { prefixes: ["SRC"], list: true },
    people_ids: { prefixes: ["PER"], list: true }, event_ids: { prefixes: ["EVT"], list: true },
    location_ids: { prefixes: ["LOC"], list: true }, evidence_ids: { prefixes: ["EVD"], list: true },
  },
  claim_sources: {
    claim_id: { prefixes: ["CLM"], required: true }, source_id: { prefixes: ["SRC"], required: true },
    speaker_person_id: { prefixes: ["PER"] },
  },
  contradictions: { event_ids: { prefixes: ["EVT"], list: true }, claim_ids: { prefixes: ["CLM"], list: true } },
  contradiction_versions: {
    contradiction_id: { prefixes: ["CON"], required: true }, source_id: { prefixes: ["SRC"], required: true },
    claim_id: { prefixes: ["CLM"] }, event_id: { prefixes: ["EVT"] }, statement_id: { prefixes: ["WIT"] },
  },
  organizations: { parent_organization_id: { prefixes: ["ORG"] }, jurisdiction_source_ids: { prefixes: ["SRC"], list: true } },
  locations: { parent_location_id: { prefixes: ["LOC"] }, coordinate_source_ids: { prefixes: ["SRC"], list: true } },
  events: {
    source_ids: { prefixes: ["SRC"], list: true }, people_ids: { prefixes: ["PER"], list: true },
    organization_ids: { prefixes: ["ORG"], list: true }, location_ids: { prefixes: ["LOC"], list: true },
  },
  event_times: { event_id: { prefixes: ["EVT"], required: true }, source_id: { prefixes: ["SRC"] } },
  evidence: {
    source_ids: { prefixes: ["SRC"], list: true }, event_ids: { prefixes: ["EVT"], list: true },
    people_ids: { prefixes: ["PER"], list: true }, location_ids: { prefixes: ["LOC"], list: true },
    custodian_organization_id: { prefixes: ["ORG"] },
  },
  witness_statements: {
    witness_person_id: { prefixes: ["PER"] }, recorded_by_person_id: { prefixes: ["PER"] },
    recorded_by_organization_id: { prefixes: ["ORG"] }, underlying_event_ids: { prefixes: ["EVT"], list: true },
    source_id: { prefixes: ["SRC"], required: true }, supersedes_statement_id: { prefixes: ["WIT"] },
  },
  relationships: {
    from_record_id: { prefixes: ["*"], required: true }, to_record_id: { prefixes: ["*"], required: true },
    source_id: { prefixes: ["SRC"] },
  },
  source_files: { source_id: { prefixes: ["SRC"], required: true }, derived_from_file_id: { prefixes: ["FIL"] } },
  sources: { people_mentioned: { prefixes: ["PER"], list: true }, locations_mentioned: { prefixes: ["LOC"], list: true } },
  newspaper_articles: {
    page_source_ids: { prefixes: ["SRC"], list: true }, people_ids: { prefixes: ["PER"], list: true },
    location_ids: { prefixes: ["LOC"], list: true }, agency_ids: { prefixes: ["ORG"], list: true },
  },
  assets: { source_id: { prefixes: ["SRC"] }, related_entity_ids: { prefixes: ["*"], list: true } },
  researcher_links: { from_record_id: { prefixes: ["*"], required: true }, to_record_id: { prefixes: ["*"], required: true } },
};

const DATE_FIELDS: Partial<Record<RegisterName, string[]>> = {
  sources: ["publication_date", "underlying_event_start", "underlying_event_end", "date_accessed"],
  events: ["start_at", "end_at"],
  event_times: ["start_at", "end_at"],
  contradiction_versions: ["asserted_start_at", "asserted_end_at"],
  witness_statements: ["statement_date", "underlying_event_start", "underlying_event_end"],
  newspaper_articles: ["publication_date"],
};
const RANGE_FIELDS: Partial<Record<RegisterName, [string, string][]>> = {
  sources: [["underlying_event_start", "underlying_event_end"]],
  events: [["start_at", "end_at"]],
  event_times: [["start_at", "end_at"]],
  contradiction_versions: [["asserted_start_at", "asserted_end_at"]],
  witness_statements: [["underlying_event_start", "underlying_event_end"]],
};
const ENUMS: { register: RegisterName; field: string; values: readonly string[]; level: Issue["level"] }[] = [
  { register: "claims", field: "status", values: CLAIM_STATUSES, level: "ERROR" },
  { register: "claim_sources", field: "relationship", values: ["SUPPORTS", "CONTRADICTS", "CONTEXT_ONLY"], level: "ERROR" },
  { register: "claims", field: "confidence", values: ["HIGH", "MEDIUM", "LOW", "UNKNOWN"], level: "WARNING" },
  { register: "events", field: "time_status", values: ["EXACT", "APPROXIMATE", "RANGE", "UNKNOWN"], level: "WARNING" },
  { register: "event_times", field: "time_status", values: ["EXACT", "APPROXIMATE", "RANGE", "UNKNOWN"], level: "WARNING" },
  { register: "sources", field: "reliability_class", values: ["A", "B", "C", "D", "E", "F", "G"], level: "WARNING" },
  { register: "contradictions", field: "status", values: ["UNRESOLVED", "OPEN", "UNDER_REVIEW", "RESOLVED", "UNRESOLVABLE"], level: "WARNING" },
];
const PATH_FIELDS: Partial<Record<RegisterName, string[]>> = {
  sources: ["local_file"], source_files: ["local_file"], assets: ["local_path"],
  newspaper_articles: ["reading_file", "raw_article_file"], witness_statements: ["transcript_file"],
  people: ["profile_file"], locations: ["profile_file"], organizations: ["profile_file"],
};

export const PUBLISHABLE_IMAGE = /\.(png|jpe?g|gif|webp)$/i;
const normUrl = (u: string) => u.trim().replace(/^https?:\/\/(www\.)?/i, "").replace(/\/+$/, "").toLowerCase();

export function isSafeArchivePath(p: string) {
  return !!p && !path.isAbsolute(p) && !p.includes("\\") && !p.split("/").includes("..") && !/^[a-z]:/i.test(p) && !p.startsWith("~");
}

export function validateArchive(archiveRoot: string, data: Registers, issues: Issue[]) {
  const push = (level: Issue["level"], code: string, message: string, file?: string, recordId?: string) =>
    issues.push({ level, code, message, file, recordId });

  // Known IDs per prefix.
  const known = new Map<string, Set<string>>();
  for (const [name, def] of Object.entries(REGISTERS) as [RegisterName, (typeof REGISTERS)[RegisterName]][]) {
    if (name === "newspaper_articles") continue;
    const set = known.get(def.prefix) ?? new Set<string>();
    for (const r of data[name]) set.add(r[def.pk]);
    known.set(def.prefix, set);
  }
  const anyKnown = (id: string) => [...known.values()].some((s) => s.has(id));

  // References.
  for (const [name, fields] of Object.entries(REFERENCE_FIELDS) as [RegisterName, NonNullable<(typeof REFERENCE_FIELDS)[RegisterName]>][]) {
    const def = REGISTERS[name];
    for (const r of data[name]) {
      const rid = r[def.pk];
      for (const [field, spec] of Object.entries(fields)) {
        const values = spec.list ? splitIds(r[field]) : r[field]?.trim() ? [r[field].trim()] : [];
        if (!values.length) {
          if (spec.required) push("ERROR", field === "source_id" ? "MISSING_PROVENANCE" : "MALFORMED_RECORD", `${def.file} ${rid}: required ${field} is blank`, def.file, rid);
          continue;
        }
        for (const v of values) {
          const prefix = v.split("-")[0];
          if (!spec.prefixes.includes("*") && !spec.prefixes.includes(prefix)) {
            push("ERROR", "IMPOSSIBLE_REFERENCE", `${def.file} ${rid}: ${field} expects ${spec.prefixes.join("/")} but has ${v}`, def.file, rid);
          } else if (spec.prefixes.includes("*") ? !anyKnown(v) : !known.get(prefix)?.has(v)) {
            push("ERROR", prefix === "SRC" ? "UNRESOLVED_SOURCE" : "BROKEN_REFERENCE", `${def.file} ${rid}: ${field} references unknown ${v}`, def.file, rid);
          }
        }
      }
    }
  }
  for (const r of data.relationships) {
    if (r.from_record_id && r.from_record_id === r.to_record_id) push("ERROR", "IMPOSSIBLE_REFERENCE", `relationships.csv ${r.relationship_id}: record related to itself`, "relationships.csv", r.relationship_id);
    if (!r.source_id && r.relationship_type !== "POSSIBLE_SAME_IDENTITY") push("WARNING", "MISSING_PROVENANCE", `relationships.csv ${r.relationship_id}: ${r.relationship_type} has no source_id`, "relationships.csv", r.relationship_id);
    if (!/^[A-Z][A-Z0-9_]*$/.test(r.relationship_type ?? "")) push("ERROR", "MALFORMED_RECORD", `relationships.csv ${r.relationship_id}: relationship_type must be an uppercase verb`, "relationships.csv", r.relationship_id);
  }

  // Claims must have sources; summary lists must agree with claim_sources.
  const csByClaim = new Map<string, Row[]>();
  for (const cs of data.claim_sources) csByClaim.set(cs.claim_id, [...(csByClaim.get(cs.claim_id) ?? []), cs]);
  for (const c of data.claims) {
    const links = csByClaim.get(c.claim_id) ?? [];
    if (!links.length && !splitIds(c.source_ids).length) push("ERROR", "CLAIM_WITHOUT_SOURCE", `claims.csv ${c.claim_id}: no claim_sources row and no source_ids`, "claims.csv", c.claim_id);
    else if (!links.length) push("WARNING", "MISSING_PROVENANCE", `claims.csv ${c.claim_id}: source_ids listed but no claim_sources row with a locator`, "claims.csv", c.claim_id);
    if (!c.claim?.trim()) push("ERROR", "MALFORMED_RECORD", `claims.csv ${c.claim_id}: claim text is blank`, "claims.csv", c.claim_id);
    const auth = new Set(links.map((l) => l.source_id));
    for (const s of [...splitIds(c.source_ids), ...splitIds(c.contradicting_source_ids)]) {
      if (links.length && !auth.has(s)) push("WARNING", "SUMMARY_MISMATCH", `claims.csv ${c.claim_id}: ${s} listed in summary but absent from claim_sources.csv`, "claims.csv", c.claim_id);
    }
  }
  for (const cs of data.claim_sources) if (!cs.source_locator?.trim()) push("WARNING", "MISSING_LOCATOR", `claim_sources.csv ${cs.claim_source_id}: no source_locator`, "claim_sources.csv", cs.claim_source_id);
  for (const t of data.event_times) {
    if (!t.source_id?.trim()) push("WARNING", "MISSING_PROVENANCE", `event_times.csv ${t.event_time_id}: no source_id`, "event_times.csv", t.event_time_id);
    else if (!t.source_locator?.trim()) push("WARNING", "MISSING_LOCATOR", `event_times.csv ${t.event_time_id}: no source_locator`, "event_times.csv", t.event_time_id);
  }
  for (const v of data.contradiction_versions) if (v.source_id && !v.source_locator?.trim()) push("WARNING", "MISSING_LOCATOR", `contradiction_versions.csv ${v.contradiction_version_id}: no source_locator`, "contradiction_versions.csv", v.contradiction_version_id);
  for (const w of data.witness_statements) if (!w.source_locator?.trim()) push("WARNING", "MISSING_LOCATOR", `witness_statements.csv ${w.statement_id}: no source_locator`, "witness_statements.csv", w.statement_id);
  for (const e of [...data.events, ...data.people, ...data.locations, ...data.evidence]) {
    const label = e.title ?? e.display_name ?? e.name;
    const id = e.event_id ?? e.person_id ?? e.location_id ?? e.evidence_id;
    if (label !== undefined && !label.trim()) push("WARNING", "MALFORMED_RECORD", `${id}: blank title/name`, undefined, id);
  }

  // Enums.
  for (const en of ENUMS) {
    const def = REGISTERS[en.register];
    for (const r of data[en.register]) {
      const v = r[en.field]?.trim();
      if (v && !en.values.includes(v)) push(en.level, "INVALID_VALUE", `${def.file} ${r[def.pk]}: ${en.field} "${v}" is not one of ${en.values.join("/")}`, def.file, r[def.pk]);
      if (!v && en.register === "claims" && en.field === "status") push("WARNING", "MISSING_VALUE", `claims.csv ${r.claim_id}: blank status (shown as UNKNOWN)`, def.file, r[def.pk]);
    }
  }

  // Dates, clock times and ranges.
  for (const [name, fields] of Object.entries(DATE_FIELDS) as [RegisterName, string[]][]) {
    const def = REGISTERS[name];
    for (const r of data[name]) {
      for (const f of fields) {
        const v = r[f]?.trim();
        if (v && !isValidDateOrTimestamp(v)) push("ERROR", "INVALID_DATE", `${def.file} ${r[def.pk]}: ${f} "${v}" is not a valid ISO date`, def.file, r[def.pk]);
      }
      for (const f of ["local_start_time", "local_end_time"]) {
        const v = r[f]?.trim();
        if (v && !isValidClock(v)) push("ERROR", "INVALID_DATE", `${def.file} ${r[def.pk]}: ${f} "${v}" is not HH:MM`, def.file, r[def.pk]);
      }
      for (const [a, b] of RANGE_FIELDS[name] ?? []) {
        const s = r[a]?.trim().slice(0, 10), e = r[b]?.trim().slice(0, 10);
        if (s && e && isValidIsoDate(s) && isValidIsoDate(e) && e.length === s.length && e < s) {
          push("ERROR", "IMPOSSIBLE_RANGE", `${def.file} ${r[def.pk]}: ${b} ${e} is before ${a} ${s}`, def.file, r[def.pk]);
        }
      }
    }
  }
  for (const [name, def] of Object.entries(REGISTERS) as [RegisterName, (typeof REGISTERS)[RegisterName]][]) {
    for (const r of data[name]) for (const f of ["created_at", "updated_at"]) {
      const v = r[f]?.trim();
      if (v && !isValidDateOrTimestamp(v)) push("WARNING", "INVALID_DATE", `${def.file} ${r[def.pk]}: ${f} "${v}" is not RFC 3339`, def.file, r[def.pk]);
    }
  }

  // URLs.
  const urlOwners = new Map<string, string[]>();
  for (const s of data.sources) {
    for (const f of ["original_url", "archive_url"]) {
      const v = s[f]?.trim();
      if (!v) continue;
      let ok = false;
      try { ok = ["http:", "https:"].includes(new URL(v).protocol); } catch { ok = false; }
      if (!ok) push("WARNING", "MALFORMED_URL", `sources.csv ${s.source_id}: ${f} "${v}" is not an http(s) URL`, "sources.csv", s.source_id);
      if (f === "original_url" && ok) urlOwners.set(normUrl(v), [...(urlOwners.get(normUrl(v)) ?? []), s.source_id]);
    }
  }
  for (const [u, owners] of urlOwners) if (owners.length > 1) {
    push("WARNING", "DUPLICATE_SOURCE_URL", `${owners.length} sources share original_url ${u}: ${owners.join(", ")} (separate captures must be linked as revisions/renditions)`, "sources.csv");
  }

  // Paths and files. Missing files are warnings; modified originals are errors.
  for (const [name, fields] of Object.entries(PATH_FIELDS) as [RegisterName, string[]][]) {
    const def = REGISTERS[name];
    for (const r of data[name]) for (const f of fields) {
      for (const p of (r[f] ?? "").split(";").map((x) => x.trim()).filter(Boolean)) {
        if (/^https?:/i.test(p)) continue;
        if (!isSafeArchivePath(p)) push("ERROR", "UNSAFE_PATH", `${def.file} ${r[def.pk]}: ${f} "${p}" must be an archive-relative POSIX path`, def.file, r[def.pk]);
        else if (!fs.existsSync(path.join(archiveRoot, p))) push("WARNING", "MISSING_ASSET", `${def.file} ${r[def.pk]}: ${f} not found: ${p}`, def.file, r[def.pk]);
      }
    }
  }
  for (const f of data.source_files) {
    if (!isSafeArchivePath(f.local_file ?? "")) continue;
    const abs = path.join(archiveRoot, f.local_file);
    if (!f.sha256 || !fs.existsSync(abs)) continue;
    if (sha256(fs.readFileSync(abs)) !== f.sha256) {
      push(f.file_role === "ORIGINAL" ? "ERROR" : "WARNING", f.file_role === "ORIGINAL" ? "ORIGINAL_MODIFIED" : "HASH_MISMATCH",
        `source_files.csv ${f.source_file_id}: SHA-256 of ${f.local_file} does not match the register`, "source_files.csv", f.source_file_id);
    }
  }
  for (const a of data.assets) {
    const p = a.local_path?.trim();
    if (p && a.availability === "LOCAL" && !PUBLISHABLE_IMAGE.test(p) && !/\.md$/i.test(p)) {
      push("WARNING", "UNSUPPORTED_ASSET", `assets.csv ${a.asset_id}: ${p} is not a web image format (png/jpg/gif/webp); not published`, "assets.csv", a.asset_id);
    }
  }
}

export function summarize(issues: Issue[]) {
  return { errors: issues.filter((i) => i.level === "ERROR").length, warnings: issues.filter((i) => i.level === "WARNING").length };
}
