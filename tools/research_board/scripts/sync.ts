/**
 * npm run case — rebuild the research-board index from the canonical archive.
 *
 * Reads registers, review queues, lead lists, Markdown sources and local files.
 * Never edits, renames or deletes archive files. The only archive write is an
 * append of newly discovered rows to the app-owned 00_ADMIN/data_registers/assets.csv
 * (existing rows, including human edits, are never rewritten). Pass --dry-run to skip it.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import Database from "better-sqlite3";
import { v5 as uuidv5 } from "uuid";
import { DDL, REBUILT_TABLES } from "../src/db/ddl";
import {
  ARCHIVE_ROOT, REGISTER_DIR, DB_PATH, ASSETS_CSV, ASSET_HEADERS,
  RESEARCHER_LINKS_CSV, REVIEW_DECISIONS_CSV, resolveArchivePath,
} from "../src/lib/archive";
import { readCsv, appendCsv, splitIds, type Row } from "../src/lib/csv";

const DRY_RUN = process.argv.includes("--dry-run");
// Fixed namespace so derived IDs (AST-, INB-, edge IDs) are stable across rebuilds.
const NS = "6b0c6f3e-6a1f-4d0e-9a59-3f6f1d1c2a77";
const stableId = (prefix: string, key: string) => `${prefix}-${uuidv5(key, NS)}`;
const sha256 = (buf: Buffer | string) => crypto.createHash("sha256").update(buf).digest("hex");
const now = new Date().toISOString();

const warnings: string[] = [];
const warn = (w: string) => warnings.push(w);

// ---------------------------------------------------------------- registers
const REGISTERS: Record<string, { file: string; pk: string; prefix: string }> = {
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
};

const data: Record<string, Row[]> = {};
const fileHashes: Record<string, string> = {};
for (const [name, def] of Object.entries(REGISTERS)) {
  const file = path.join(REGISTER_DIR, def.file);
  if (!fs.existsSync(file)) {
    data[name] = [];
    continue;
  }
  fileHashes[name] = sha256(fs.readFileSync(file));
  const rows = readCsv(file);
  const seen = new Set<string>();
  data[name] = [];
  for (const r of rows) {
    const id = r[def.pk];
    if (!id) { warn(`${def.file}: row without ${def.pk} skipped`); continue; }
    if (seen.has(id)) { warn(`${def.file}: duplicate ID ${id} — later row ignored`); continue; }
    if (!id.startsWith(def.prefix + "-")) warn(`${def.file}: ${id} lacks expected ${def.prefix}- prefix`);
    seen.add(id);
    data[name].push(r);
  }
}

const byId = new Map<string, { register: string; row: Row }>();
for (const name of ["sources", "claims", "contradictions", "people", "organizations", "locations", "events", "evidence", "witness_statements"]) {
  for (const r of data[name]) byId.set(r[REGISTERS[name].pk], { register: name, row: r });
}
const exists = (id: string) => byId.has(id);
const checkRef = (ctx: string, id: string) => {
  if (id && !exists(id)) warn(`${ctx}: unresolved reference ${id}`);
};

// ---------------------------------------------------------------- change detection
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);
db.exec(DDL);
const prevSnapshots = new Map<string, { sha256: string; rows: Record<string, string> }>();
for (const s of db.prepare("SELECT register, sha256, row_hashes_json FROM register_snapshots").all() as {
  register: string; sha256: string; row_hashes_json: string;
}[]) prevSnapshots.set(s.register, { sha256: s.sha256, rows: JSON.parse(s.row_hashes_json) });

const changes: Record<string, { added: string[]; changed: string[]; removed: string[] }> = {};
const newSnapshots: Record<string, Record<string, string>> = {};
for (const [name, def] of Object.entries(REGISTERS)) {
  const rowHashes: Record<string, string> = {};
  for (const r of data[name]) rowHashes[r[def.pk]] = sha256(JSON.stringify(r));
  newSnapshots[name] = rowHashes;
  const prev = prevSnapshots.get(name)?.rows ?? {};
  const added = Object.keys(rowHashes).filter((k) => !(k in prev));
  const changed = Object.keys(rowHashes).filter((k) => k in prev && prev[k] !== rowHashes[k]);
  const removed = Object.keys(prev).filter((k) => !(k in rowHashes));
  if (added.length || changed.length || removed.length) changes[name] = { added, changed, removed };
}

// ---------------------------------------------------------------- entities
type Entity = {
  id: string; type: string; subtype?: string; label: string; subtitle?: string; status?: string;
  confidence?: string; sortKey?: string; register: string; row: Row; search: string[];
};
const entities: Entity[] = [];
const personName = (id: string) => byId.get(id)?.row.display_name ?? id;

const articleBySource = new Map(data.newspaper_articles.map((a) => [a.source_id, a]));
const pageSourceIds = new Set(
  data.relationships.filter((r) => r.relationship_type === "APPEARS_ON_PAGE").map((r) => r.to_record_id),
);

for (const s of data.sources) {
  const art = articleBySource.get(s.source_id);
  const subtype = art ? "NEWS_ARTICLE" : pageSourceIds.has(s.source_id) ? "NEWSPAPER_PAGE" : s.source_type || "UNKNOWN";
  entities.push({
    id: s.source_id, type: "SOURCE", subtype, label: s.title || s.source_id,
    subtitle: [s.publisher || art?.publication, s.publication_date, s.reliability_class ? `class ${s.reliability_class}` : "class pending"]
      .filter(Boolean).join(" · "),
    status: s.reliability_class || undefined, sortKey: s.publication_date || "9999", register: "sources", row: s,
    search: [s.title, s.author, s.publisher, s.notes, art?.headline, art?.summary, art?.author].filter(Boolean) as string[],
  });
}
for (const c of data.claims) {
  entities.push({
    id: c.claim_id, type: "CLAIM", label: c.claim, subtitle: `${c.status || "UNKNOWN"} · ${c.confidence || "UNKNOWN"} confidence`,
    status: c.status || "UNKNOWN", confidence: c.confidence, register: "claims", row: c,
    sortKey: splitIds(c.event_ids).map((e) => byId.get(e)?.row.start_at).filter(Boolean).sort()[0] ?? "9999",
    search: [c.claim, c.assessment_rationale, c.notes].filter(Boolean),
  });
}
for (const p of data.people) {
  entities.push({
    id: p.person_id, type: "PERSON", label: p.display_name || p.person_id,
    subtitle: `identity ${p.identity_status || "UNKNOWN"}`, status: p.identity_status, register: "people", row: p,
    search: [p.display_name, p.aliases.replace(/;/g, " "), p.notes].filter(Boolean),
  });
}
for (const o of data.organizations) {
  entities.push({
    id: o.organization_id, type: "ORGANIZATION", label: o.name, subtitle: o.organization_type, register: "organizations", row: o,
    search: [o.name, o.jurisdiction_description, o.notes].filter(Boolean),
  });
  checkRef(o.organization_id, o.parent_organization_id);
}
for (const l of data.locations) {
  entities.push({
    id: l.location_id, type: "LOCATION", label: l.name, subtitle: l.location_type, register: "locations", row: l,
    search: [l.name, l.address, l.notes].filter(Boolean),
  });
  checkRef(l.location_id, l.parent_location_id);
}
for (const e of data.events) {
  const when = e.start_at
    ? `${e.start_at}${e.local_start_time ? " " + e.local_start_time : ""}${e.end_at && e.end_at !== e.start_at ? " → " + e.end_at : ""}${e.local_end_time ? " " + e.local_end_time : ""}`
    : "date unknown";
  entities.push({
    id: e.event_id, type: "EVENT", label: e.title, subtitle: `${when} · ${e.time_status || "UNKNOWN"}`,
    status: e.time_status, confidence: e.confidence, sortKey: e.start_at || "9999", register: "events", row: e,
    search: [e.title, e.neutral_description, e.original_time_text, e.notes].filter(Boolean),
  });
}
for (const v of data.evidence) {
  entities.push({
    id: v.evidence_id, type: "EVIDENCE", label: v.title, subtitle: `${v.evidence_type} · custody ${v.custody_status || "UNKNOWN"}`,
    status: v.custody_status, register: "evidence", row: v,
    search: [v.title, v.description, v.notes].filter(Boolean),
  });
}
for (const w of data.witness_statements) {
  entities.push({
    id: w.statement_id, type: "WITNESS_STATEMENT",
    label: `Statement — ${personName(w.witness_person_id)}`,
    subtitle: `${w.statement_date || "date unknown"} · ${w.representation_type || "UNKNOWN"} · ${w.knowledge_basis || "UNKNOWN"}`,
    status: w.representation_type, confidence: w.confidence, sortKey: w.statement_date || "9999", register: "witness_statements", row: w,
    search: [w.statement_text, w.limitations, w.notes, personName(w.witness_person_id)].filter(Boolean),
  });
}
for (const c of data.contradictions) {
  entities.push({
    id: c.contradiction_id, type: "CONTRADICTION", label: c.subject, subtitle: c.status, status: c.status,
    register: "contradictions", row: c, search: [c.subject, c.description, c.notes, c.resolution_notes].filter(Boolean),
  });
}

// ---------------------------------------------------------------- edges
type Edge = { id: string; from: string; to: string; rel: string; category: string; sourceId?: string; locator?: string; notes?: string; origin: string };
const edges: Edge[] = [];
const edgeKeys = new Set<string>();
function addEdge(e: Omit<Edge, "id">) {
  if (!exists(e.from) || !exists(e.to)) {
    warn(`${e.origin}: ${e.rel} ${e.from} → ${e.to} has unresolved endpoint; edge skipped`);
    return;
  }
  const key = `${e.from}|${e.rel}|${e.to}|${e.sourceId ?? ""}|${e.locator ?? ""}`;
  if (edgeKeys.has(key)) return;
  edgeKeys.add(key);
  edges.push({ id: stableId("EDG", key), ...e });
}

// claim_sources: authoritative claim/source support.
for (const cs of data.claim_sources) {
  const rel = cs.relationship === "CONTRADICTS" ? "CONTRADICTED_BY" : cs.relationship === "SUPPORTS" ? "SUPPORTED_BY" : "CONTEXT_FROM";
  addEdge({ from: cs.claim_id, to: cs.source_id, rel, category: "SOURCED", sourceId: cs.source_id, locator: cs.source_locator, notes: cs.notes, origin: "claim_sources.csv" });
  if (cs.speaker_person_id) checkRef(cs.claim_source_id, cs.speaker_person_id);
}
// claims ID lists (register associations).
for (const c of data.claims) {
  for (const id of splitIds(c.people_ids)) addEdge({ from: c.claim_id, to: id, rel: "CLAIM_CONCERNS_PERSON", category: "REGISTER", origin: "claims.csv people_ids" });
  for (const id of splitIds(c.event_ids)) addEdge({ from: c.claim_id, to: id, rel: "CLAIM_CONCERNS_EVENT", category: "REGISTER", origin: "claims.csv event_ids" });
  for (const id of splitIds(c.location_ids)) addEdge({ from: c.claim_id, to: id, rel: "CLAIM_CONCERNS_LOCATION", category: "REGISTER", origin: "claims.csv location_ids" });
  for (const id of splitIds(c.evidence_ids)) addEdge({ from: c.claim_id, to: id, rel: "CLAIM_CONCERNS_EVIDENCE", category: "REGISTER", origin: "claims.csv evidence_ids" });
  // source_ids summaries must match claim_sources.
  const authoritative = new Set(data.claim_sources.filter((x) => x.claim_id === c.claim_id).map((x) => x.source_id));
  for (const s of [...splitIds(c.source_ids), ...splitIds(c.contradicting_source_ids)]) {
    if (!authoritative.has(s)) warn(`claims.csv ${c.claim_id}: ${s} listed in summary but absent from claim_sources.csv`);
  }
}
for (const e of data.events) {
  for (const id of splitIds(e.location_ids)) addEdge({ from: e.event_id, to: id, rel: "EVENT_REPORTED_AT", category: "REGISTER", origin: "events.csv location_ids" });
  for (const id of splitIds(e.people_ids)) addEdge({ from: e.event_id, to: id, rel: "EVENT_INVOLVES_PERSON", category: "REGISTER", origin: "events.csv people_ids" });
  for (const id of splitIds(e.organization_ids)) addEdge({ from: e.event_id, to: id, rel: "EVENT_INVOLVES_ORGANIZATION", category: "REGISTER", origin: "events.csv organization_ids" });
  for (const id of splitIds(e.source_ids)) addEdge({ from: e.event_id, to: id, rel: "EVENT_REPORTED_IN", category: "SOURCED", sourceId: id, origin: "events.csv source_ids" });
}
for (const v of data.evidence) {
  for (const id of splitIds(v.source_ids)) addEdge({ from: v.evidence_id, to: id, rel: "EVIDENCE_REPORTED_IN", category: "SOURCED", sourceId: id, origin: "evidence.csv source_ids" });
  for (const id of splitIds(v.location_ids)) addEdge({ from: v.evidence_id, to: id, rel: "EVIDENCE_REPORTED_AT", category: "REGISTER", origin: "evidence.csv location_ids" });
  for (const id of splitIds(v.event_ids)) addEdge({ from: v.evidence_id, to: id, rel: "EVIDENCE_RELATED_EVENT", category: "REGISTER", origin: "evidence.csv event_ids" });
  for (const id of splitIds(v.people_ids)) addEdge({ from: v.evidence_id, to: id, rel: "EVIDENCE_RELATED_PERSON", category: "REGISTER", origin: "evidence.csv people_ids" });
  if (v.custodian_organization_id) addEdge({ from: v.evidence_id, to: v.custodian_organization_id, rel: "REPORTED_CUSTODIAN", category: "REGISTER", origin: "evidence.csv" });
}
for (const w of data.witness_statements) {
  if (w.witness_person_id) addEdge({ from: w.witness_person_id, to: w.statement_id, rel: "MADE_STATEMENT", category: "SOURCED", sourceId: w.source_id, locator: w.source_locator, origin: "witness_statements.csv" });
  if (w.source_id) addEdge({ from: w.statement_id, to: w.source_id, rel: "STATEMENT_RECORDED_IN", category: "SOURCED", sourceId: w.source_id, locator: w.source_locator, origin: "witness_statements.csv" });
  if (w.recorded_by_person_id) addEdge({ from: w.statement_id, to: w.recorded_by_person_id, rel: "RECORDED_BY", category: "SOURCED", sourceId: w.source_id, origin: "witness_statements.csv" });
  if (w.recorded_by_organization_id) addEdge({ from: w.statement_id, to: w.recorded_by_organization_id, rel: "RECORDED_BY", category: "SOURCED", sourceId: w.source_id, origin: "witness_statements.csv" });
  for (const id of splitIds(w.underlying_event_ids)) addEdge({ from: w.statement_id, to: id, rel: "STATEMENT_ABOUT_EVENT", category: "SOURCED", sourceId: w.source_id, origin: "witness_statements.csv" });
  if (w.supersedes_statement_id) addEdge({ from: w.statement_id, to: w.supersedes_statement_id, rel: "SUPERSEDES", category: "REGISTER", origin: "witness_statements.csv" });
}
for (const c of data.contradictions) {
  for (const id of splitIds(c.claim_ids)) addEdge({ from: c.contradiction_id, to: id, rel: "CONTRADICTION_INVOLVES_CLAIM", category: "REGISTER", origin: "contradictions.csv" });
  for (const id of splitIds(c.event_ids)) addEdge({ from: c.contradiction_id, to: id, rel: "CONTRADICTION_CONCERNS_EVENT", category: "REGISTER", origin: "contradictions.csv" });
}
for (const v of data.contradiction_versions) {
  checkRef(v.contradiction_version_id, v.contradiction_id);
  if (v.source_id) addEdge({ from: v.contradiction_id, to: v.source_id, rel: "VERSION_ASSERTED_BY", category: "SOURCED", sourceId: v.source_id, locator: v.source_locator, notes: v.version_text, origin: "contradiction_versions.csv" });
}
for (const o of data.organizations) if (o.parent_organization_id) addEdge({ from: o.organization_id, to: o.parent_organization_id, rel: "PART_OF", category: "REGISTER", origin: "organizations.csv" });
for (const l of data.locations) if (l.parent_location_id) addEdge({ from: l.location_id, to: l.parent_location_id, rel: "WITHIN", category: "REGISTER", origin: "locations.csv" });
// relationships.csv — verbatim relationship types.
const LEAD_TYPES = new Set(["POSSIBLE_SAME_IDENTITY"]);
for (const r of data.relationships) {
  const category = LEAD_TYPES.has(r.relationship_type) ? "LEAD" : r.source_id ? "SOURCED" : "REGISTER";
  if (!r.source_id && !LEAD_TYPES.has(r.relationship_type)) warn(`relationships.csv ${r.relationship_id}: no source_id`);
  addEdge({ from: r.from_record_id, to: r.to_record_id, rel: r.relationship_type, category, sourceId: r.source_id || undefined, locator: r.source_locator, notes: r.notes, origin: `relationships.csv ${r.relationship_id}` });
}
// Researcher links: always category RESEARCHER, never evidence.
const researcherLinks = data.researcher_links.filter((r) => (r.status || "ACTIVE") === "ACTIVE");
for (const r of researcherLinks) {
  checkRef(r.researcher_link_id, r.from_record_id);
  checkRef(r.researcher_link_id, r.to_record_id);
}

// Reference checks for remaining ID lists.
for (const c of data.claims) for (const f of ["source_ids", "contradicting_source_ids"]) for (const id of splitIds(c[f])) checkRef(c.claim_id, id);
for (const s of data.sources) for (const f of ["people_mentioned", "locations_mentioned"]) for (const id of splitIds(s[f])) checkRef(s.source_id, id);
for (const t of data.event_times) { checkRef(t.event_time_id, t.event_id); checkRef(t.event_time_id, t.source_id); }

// ---------------------------------------------------------------- files
const presentFiles = new Set<string>();
for (const f of data.source_files) {
  const abs = resolveArchivePath(f.local_file);
  if (!abs || !fs.existsSync(abs)) warn(`source_files.csv ${f.source_file_id}: file missing ${f.local_file}`);
  else {
    presentFiles.add(f.source_file_id);
    if (f.sha256 && sha256(fs.readFileSync(abs)) !== f.sha256) warn(`source_files.csv ${f.source_file_id}: SHA-256 mismatch for ${f.local_file}`);
  }
  checkRef(f.source_file_id, f.source_id);
}
const fileRows = data.source_files;
const isPresent = (f: Row) => presentFiles.has(f.source_file_id);
const knownHashes = new Map(fileRows.filter((f) => f.sha256).map((f) => [f.sha256, f]));

// ---------------------------------------------------------------- assets
type Asset = Row & { asset_id: string };
const existingAssets = new Map(data.assets.map((a) => [a.asset_id, a as Asset]));
const discovered: Asset[] = [];
const peopleNames = data.people.flatMap((p) =>
  [p.display_name, ...splitIds(p.aliases)].filter(Boolean).map((n) => ({ id: p.person_id, name: n })),
);
// Identity comes only from explicit labeling metadata (title/alt/caption), never from image content.
// A caption that merely mentions a name ("poster ... in the Levi Frady case") is NOT an identification:
// only labels that are the name itself, or "photo/picture/portrait/mugshot of NAME", qualify.
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function depictedPeople(text: string): string[] {
  const t = text.replace(/\s+/g, " ").trim();
  const hits = new Set<string>();
  for (const { id, name } of peopleNames) {
    if (name.length < 5) continue;
    const n = esc(name);
    const labelOnly = new RegExp(`^(?:pic|picture|photo|portrait|image|mugshot)?\\s*(?:of\\s+)?${n}(?:\\s*[—–-]?\\s*(?:supplied\\s+)?(?:portrait|photo|picture|mugshot))?\\.?$`, "i");
    const photoOf = new RegExp(`\\b(?:photo|picture|portrait|mugshot)\\s+of\\s+(?:\\d+-year-old\\s+)?${n}\\b`, "i");
    const nameMugshot = new RegExp(`^${n}\\s+mugshot$`, "i");
    if (labelOnly.test(t) || photoOf.test(t) || nameMugshot.test(t)) hits.add(id);
  }
  return [...hits];
}
function mentionedPeople(text: string): string[] {
  return [...new Set(peopleNames.filter(({ name }) => name.length >= 5 && new RegExp(`\\b${esc(name)}\\b`, "i").test(text)).map((p) => p.id))];
}
const namedPeople = depictedPeople;
const mentionNote = (text: string, depicted: string[]) => {
  const m = mentionedPeople(text).filter((id) => !depicted.includes(id));
  return m.length ? `Caption/alt text mentions ${m.join(";")} without establishing who is depicted.` : "";
};
function pushAsset(key: string, a: Omit<Asset, "asset_id">) {
  const asset_id = stableId("AST", key);
  if (discovered.some((d) => d.asset_id === asset_id)) return;
  discovered.push({ asset_id, ...a } as Asset);
}

// a) Photo sources (originals).
for (const s of data.sources.filter((s) => s.source_type === "PHOTO")) {
  const ids = namedPeople(s.title);
  pushAsset(`${s.source_id}|${s.local_file}`, {
    type: "IMAGE", local_path: s.local_file, original_url: s.original_url, caption: s.title, alt_text: "",
    source_id: s.source_id, related_entity_ids: ids.join(";"),
    status: ids.length ? "SOURCE_LABELED" : "UNASSIGNED", availability: "LOCAL",
    identity_basis: ids.length ? "Source title metadata names the person; not visual identification." : "",
    discovered_in: "sources.csv", notes: mentionNote(s.title, ids), created_at: now, updated_at: now,
  });
}
// b) Image derivatives (e.g. newspaper page previews).
for (const f of fileRows.filter((f) => f.mime_type.startsWith("image/") && f.file_role !== "ORIGINAL")) {
  pushAsset(`${f.source_id}|${f.local_file}`, {
    type: "PAGE_PREVIEW", local_path: f.local_file, original_url: "", caption: byId.get(f.source_id)?.row.title ?? "",
    alt_text: "", source_id: f.source_id, related_entity_ids: "", status: "DERIVATIVE_INDEXED", availability: isPresent(f) ? "LOCAL" : "MISSING",
    identity_basis: "", discovered_in: `source_files.csv ${f.source_file_id}`, notes: f.transformation_description, created_at: now, updated_at: now,
  });
}
// c) Image references inside registered Markdown sources.
const mdFiles = new Map<string, Set<string>>(); // source_id -> markdown paths
for (const f of fileRows.filter((f) => f.mime_type === "text/markdown" && isPresent(f))) {
  if (!mdFiles.has(f.source_id)) mdFiles.set(f.source_id, new Set());
  mdFiles.get(f.source_id)!.add(f.local_file);
}
for (const a of data.newspaper_articles) if (a.reading_file) {
  if (!mdFiles.has(a.source_id)) mdFiles.set(a.source_id, new Set());
  mdFiles.get(a.source_id)!.add(a.reading_file);
}
const AD_HOSTS = /gravatar\.com|imasdk\.googleapis|revcontent\.com|doubleclick\.net|googlesyndication|taboola|outbrain|facebook\.com\/tr|pixel\.|scorecardresearch|quantserve/i;
const IMG_MD = /!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+"([^"]*)")?\s*\)/g;
const IMG_HTML = /<img\b[^>]*>/gi;
const attr = (tag: string, name: string) => tag.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`, "i"))?.[1] ?? "";
for (const [sourceId, files] of mdFiles) {
  const src = byId.get(sourceId)?.row;
  for (const rel of files) {
    const abs = resolveArchivePath(rel);
    if (!abs || !fs.existsSync(abs)) continue;
    const text = fs.readFileSync(abs, "utf8");
    const refs: { url: string; alt: string; title: string }[] = [];
    for (const m of text.matchAll(IMG_MD)) refs.push({ url: m[2], alt: m[1], title: m[3] ?? "" });
    // Reference-style images: ![alt][ref] with [ref]: <url>
    const defs = new Map([...text.matchAll(/^\[([^\]]+)\]:\s*<?(\S+?)>?\s*$/gm)].map((d) => [d[1].toLowerCase(), d[2]]));
    for (const m of text.matchAll(/!\[([^\]]*)\]\[([^\]]+)\]/g)) {
      const url = defs.get(m[2].toLowerCase());
      if (url) refs.push({ url: url.startsWith("data:") ? `data:#${m[2]}` : url, alt: m[1], title: "" });
    }
    for (const m of text.matchAll(IMG_HTML)) refs.push({ url: attr(m[0], "src"), alt: attr(m[0], "alt"), title: attr(m[0], "title") });
    for (const r of refs) {
      if (!r.url || AD_HOSTS.test(r.url)) continue; // comment avatars, ad/recommendation widgets, trackers
      let originalUrl = "";
      let localPath = "";
      if (r.url.startsWith("data:")) {
        const key = `${sourceId}|embedded|${r.url}`;
        const ids = namedPeople(r.alt);
        pushAsset(key, {
          type: "IMAGE", local_path: rel, original_url: "", caption: "", alt_text: r.alt, source_id: sourceId,
          related_entity_ids: ids.join(";"), status: ids.length ? "SOURCE_LABELED" : "UNASSIGNED", availability: "EMBEDDED_IN_SOURCE",
          identity_basis: ids.length ? "Alt text in source names the person; not visual identification." : "",
          discovered_in: rel, notes: ["Embedded data URI inside the archived Markdown capture.", mentionNote(r.alt, ids)].filter(Boolean).join(" "), created_at: now, updated_at: now,
        });
        continue;
      }
      if (/^https?:\/\//i.test(r.url)) originalUrl = r.url;
      else if (r.url.startsWith("/") && src?.original_url) originalUrl = new URL(r.url, src.original_url).toString();
      else {
        const candidate = path.posix.normalize(path.posix.join(path.posix.dirname(rel), r.url));
        if (resolveArchivePath(candidate) && fs.existsSync(resolveArchivePath(candidate)!)) localPath = candidate;
        else warn(`${rel}: local image reference not found: ${r.url}`);
      }
      const key = `${sourceId}|${(originalUrl || localPath).replace(/[?#].*$/, "")}`;
      const ids = namedPeople(`${r.alt} ${r.title}`);
      pushAsset(key, {
        type: "IMAGE", local_path: localPath, original_url: originalUrl, caption: r.title, alt_text: r.alt,
        source_id: sourceId, related_entity_ids: ids.join(";"),
        status: ids.length ? "SOURCE_LABELED" : "UNASSIGNED", availability: localPath ? "LOCAL" : "REMOTE_ONLY",
        identity_basis: ids.length ? "Alt text/caption in source names the person; not visual identification." : "",
        discovered_in: rel, notes: [localPath ? "" : "Referenced remotely; image bytes are not archived.", mentionNote(`${r.alt} ${r.title}`, ids)].filter(Boolean).join(" "), created_at: now, updated_at: now,
      });
    }
  }
}
// Merge: existing assets.csv rows win (they may hold human review decisions); append new ones.
const newAssets = discovered.filter((a) => !existingAssets.has(a.asset_id));
const allAssets: Asset[] = [...existingAssets.values(), ...newAssets];
if (newAssets.length && !DRY_RUN) appendCsv(ASSETS_CSV, ASSET_HEADERS, newAssets);

// ---------------------------------------------------------------- event times
const etmByEvent = new Map<string, Row[]>();
for (const t of data.event_times) {
  if (!etmByEvent.has(t.event_id)) etmByEvent.set(t.event_id, []);
  etmByEvent.get(t.event_id)!.push(t);
}

// ---------------------------------------------------------------- discovery inbox
type Inbox = {
  id: string; kind: string; title: string; description: string; priority: string; entityIds: string[];
  sourceIds: string[]; origin: string; originRef?: string; originalIssueType?: string; status: string;
};
const inbox: Inbox[] = [];
const ISSUE_KIND: Record<string, string> = {
  IDENTITY: "POSSIBLE_DUPLICATE_PERSON",
  DATE_CONFLICT: "POSSIBLE_CONTRADICTION",
  DATE_OCR: "AMBIGUOUS_DATE",
  DERIVED_CALENDAR_DATES: "AMBIGUOUS_DATE",
  OCR_CORRECTION: "AMBIGUOUS_TEXT",
  TRANSCRIPTION_BOUNDARIES: "AMBIGUOUS_TEXT",
  QUOTE_PRONOUN: "AMBIGUOUS_TEXT",
  AGE_VARIATION: "POSSIBLE_CONTRADICTION",
  BICYCLE_VARIATION: "POSSIBLE_CONTRADICTION",
  MISSING_CONTINUATION: "SOURCE_TO_ACQUIRE",
  SOURCE_URLS: "SOURCE_TO_ACQUIRE",
  PHOTOS_CAPTIONS: "UNASSIGNED_IMAGE",
  WITNESS_ROLES: "POSSIBLE_RELATIONSHIP",
  UNCONFIRMED_MEDIA_REPORT: "AMBIGUOUS_TEXT",
};
function kindFromDescription(d: string): string {
  if (/scrambl|ocr|transcri|quotation|wording|quote/i.test(d)) return "AMBIGUOUS_TEXT";
  if (/\bdate|time|timecode|chronolog/i.test(d)) return "AMBIGUOUS_DATE";
  if (/identity|same person|merge|spelling/i.test(d)) return "POSSIBLE_DUPLICATE_PERSON";
  if (/contradict|conflict|denial|versus/i.test(d)) return "POSSIBLE_CONTRADICTION";
  if (/obtain|acquire|original/i.test(d)) return "SOURCE_TO_ACQUIRE";
  return "BATCH_REVIEW";
}
const wanted = new Map<string, Row>();
const sourceChain: Row[] = [];
// 1) Existing batch human-review queues, wanted sources and source chains.
const batchDir = path.join(ARCHIVE_ROOT, "00_ADMIN", "ingestion_batches");
const batches = fs.existsSync(batchDir) ? fs.readdirSync(batchDir).filter((d) => fs.statSync(path.join(batchDir, d)).isDirectory()) : [];
for (const b of batches) {
  const q = path.join(batchDir, b, "human_review_queue.csv");
  for (const r of readCsv(q)) {
    if (!r.review_id) continue;
    // Queues differ by batch: some carry issue_type, others only a description.
    const kind = r.issue_type ? ISSUE_KIND[r.issue_type] ?? "BATCH_REVIEW" : kindFromDescription(r.description ?? "");
    inbox.push({
      id: r.review_id, kind,
      title: r.issue_type ? r.issue_type.replace(/_/g, " ") : (r.description ?? "").split(/[.;:]/)[0].slice(0, 90),
      description: r.description ?? "", priority: r.priority || "MEDIUM", entityIds: [],
      sourceIds: splitIds(r.source_ids ?? r.source_id),
      origin: `00_ADMIN/ingestion_batches/${b}/human_review_queue.csv`, originRef: r.review_id,
      originalIssueType: r.issue_type || "(no issue_type; kind inferred from description keywords)",
      status: r.status === "OPEN" || !r.status ? "OPEN" : r.status,
    });
  }
  // Wanted (not yet acquired) underlying sources.
  for (const w of readCsv(path.join(batchDir, b, "wanted_sources.csv"))) {
    if (!w.wanted_id) continue;
    wanted.set(w.wanted_id, w);
    inbox.push({
      id: w.wanted_id, kind: "SOURCE_TO_ACQUIRE", title: w.title,
      description: `${w.source_type || "Source"} referenced by held sources but not acquired (${w.status || "status blank"}).${w.url ? " Referenced URL: " + w.url : ""}${w.notes ? " " + w.notes : ""}`,
      priority: /IMAGE|SCAN/.test(w.source_type) ? "LOW" : "MEDIUM", entityIds: [], sourceIds: splitIds(w.requested_by_source_ids),
      origin: `00_ADMIN/ingestion_batches/${b}/wanted_sources.csv`, originRef: w.wanted_id, originalIssueType: w.source_type,
      status: w.status === "ACQUIRED" ? "ACCEPTED" : "OPEN",
    });
  }
  for (const c of readCsv(path.join(batchDir, b, "source_chain.csv"))) sourceChain.push({ ...c, batch: b });
  // 2) Lead lists (open questions / sources to acquire).
  const leadsFile = path.join(batchDir, b, "NEW_LEADS_FROM_BATCH.md");
  if (fs.existsSync(leadsFile)) {
    const text = fs.readFileSync(leadsFile, "utf8");
    for (const sec of text.split(/^## /m).slice(1)) {
      const [heading, ...body] = sec.split("\n");
      const m = heading.match(/^(LEAD-[A-Z0-9-]+)\s+—\s+(.*)$/);
      if (!m) continue;
      const bodyText = body.join("\n");
      const desc = bodyText.split(/\n\s*Sources:/)[0].trim();
      inbox.push({
        id: m[1], kind: "SOURCE_TO_ACQUIRE", title: m[2], description: desc, priority: "MEDIUM", entityIds: [],
        sourceIds: [...new Set([...bodyText.matchAll(/`(SRC-[0-9a-f-]{36})`/g)].map((x) => x[1]))],
        origin: `00_ADMIN/ingestion_batches/${b}/NEW_LEADS_FROM_BATCH.md`, originRef: m[1], originalIssueType: "LEAD", status: "OPEN",
      });
    }
  }
}
// 3) Register relationships explicitly flagged as leads.
for (const r of data.relationships.filter((r) => LEAD_TYPES.has(r.relationship_type))) {
  inbox.push({
    id: stableId("INB", `lead-rel|${r.relationship_id}`), kind: "POSSIBLE_DUPLICATE_PERSON",
    title: `${personName(r.from_record_id)} / ${personName(r.to_record_id)} — possible same identity`,
    description: r.notes, priority: "HIGH", entityIds: [r.from_record_id, r.to_record_id], sourceIds: splitIds(r.source_id),
    origin: "relationships.csv", originRef: r.relationship_id, status: "OPEN",
  });
}
// 4) Machine-suggested similar names not already linked (string similarity only).
const linkedPairs = new Set(data.relationships.filter((r) => LEAD_TYPES.has(r.relationship_type)).map((r) => [r.from_record_id, r.to_record_id].sort().join("|")));
const norm = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();
function lev(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
for (let i = 0; i < data.people.length; i++) for (let j = i + 1; j < data.people.length; j++) {
  const a = data.people[i], b = data.people[j];
  const pair = [a.person_id, b.person_id].sort().join("|");
  if (linkedPairs.has(pair)) continue;
  const na = norm(a.display_name), nb = norm(b.display_name);
  if (na && nb && lev(na, nb) <= 2) {
    inbox.push({
      id: stableId("INB", `similar-name|${pair}`), kind: "POSSIBLE_DUPLICATE_PERSON",
      title: `${a.display_name} / ${b.display_name} — similar spelling`,
      description: "Machine-suggested by name-string similarity only. Not evidence of shared identity; no merge performed.",
      priority: "LOW", entityIds: [a.person_id, b.person_id], sourceIds: [], origin: "sync: name similarity", status: "OPEN",
    });
  }
}
// 5) Images without an explicitly sourced identity/assignment.
for (const a of allAssets.filter((a) => a.status === "UNASSIGNED")) {
  inbox.push({
    id: stableId("INB", `asset|${a.asset_id}`), kind: "UNASSIGNED_IMAGE",
    title: a.alt_text || a.caption || path.basename(a.local_path || a.original_url),
    description: `Image ${a.availability === "LOCAL" ? "archived locally" : a.availability === "EMBEDDED_IN_SOURCE" ? "embedded in an archived capture" : "referenced remotely, not archived"}. No source label establishes who or what is depicted. Assign only from source metadata — no facial recognition.${a.notes ? " " + a.notes : ""}`,
    priority: "MEDIUM", entityIds: [a.asset_id], sourceIds: splitIds(a.source_id), origin: "assets.csv", originRef: a.asset_id, status: "OPEN",
  });
}
// 6) Events with unknown dates; conflicting event-time assertions not yet tied to a contradiction.
const conEvents = new Set(data.contradictions.flatMap((c) => splitIds(c.event_ids)));
for (const e of data.events) {
  const times = etmByEvent.get(e.event_id) ?? [];
  const distinct = new Set(times.map((t) => `${t.start_at}|${t.local_start_time}|${t.end_at}|${t.local_end_time}`));
  if (e.time_status === "UNKNOWN" || e.date_precision === "UNKNOWN" || !e.start_at) {
    inbox.push({
      id: stableId("INB", `ambiguous-date|${e.event_id}`), kind: "AMBIGUOUS_DATE", title: `${e.title} — date not established`,
      description: `Register time_status ${e.time_status || "blank"}; original wording: “${e.original_time_text}”.${conEvents.has(e.event_id) ? " Linked to an open contradiction record." : ""}`,
      priority: "MEDIUM", entityIds: [e.event_id], sourceIds: splitIds(e.source_ids), origin: "events.csv", originRef: e.event_id, status: "OPEN",
    });
  }
  if (distinct.size > 1 && !conEvents.has(e.event_id)) {
    inbox.push({
      id: stableId("INB", `time-conflict|${e.event_id}`), kind: "POSSIBLE_CONTRADICTION", title: `${e.title} — differing time assertions`,
      description: `${distinct.size} distinct attributed times in event_times.csv and no contradiction record links this event.`,
      priority: "MEDIUM", entityIds: [e.event_id], sourceIds: [...new Set(times.map((t) => t.source_id))], origin: "event_times.csv", status: "OPEN",
    });
  }
}
// 7) Unregistered files waiting in _INGEST.
const ingestDir = path.join(ARCHIVE_ROOT, "_INGEST");
function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.name.startsWith(".") ? [] : d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]);
}
const ingestFiles = walk(ingestDir);
let ingestArchived = 0;
const ingestSeen = new Map<string, string>();
for (const abs of ingestFiles) {
  const rel = path.relative(ARCHIVE_ROOT, abs).split(path.sep).join("/");
  if (/(^|\/)README\.md$/i.test(rel)) continue; // inbox instructions, not material
  const hash = sha256(fs.readFileSync(abs));
  const twin = ingestSeen.get(hash);
  if (!twin) ingestSeen.set(hash, rel);
  const match = knownHashes.get(hash);
  if (match) { ingestArchived++; continue; } // byte-identical to an archived file: already preserved
  let title = rel;
  let detail = "";
  if (rel.endsWith(".md")) {
    const text = fs.readFileSync(abs, "utf8");
    title = (text.match(/^#\s+(.+)$/m)?.[1] ?? rel).replace(/\*\*/g, "").trim();
    const imgs = [...text.matchAll(IMG_MD)].length + [...text.matchAll(IMG_HTML)].length;
    detail = ` Contains ${imgs} image reference(s). Contents are NOT indexed as case data until registered with a SRC ID per the intake protocol.`;
  }
  inbox.push({
    id: stableId("INB", `ingest|${rel}|${hash}`), kind: "UNKNOWN_SOURCE", title,
    description: `Unregistered file at ${rel} (sha256 ${hash.slice(0, 12)}…). No SRC record, provenance or reliability class.${twin ? ` Byte-identical to ${twin}.` : ""}${detail}`,
    priority: "MEDIUM", entityIds: [], sourceIds: [], origin: "_INGEST", originRef: rel, status: "OPEN",
  });
}
// 8) Unresolved references surface as integrity review items.
for (const w of warnings.filter((w) => w.includes("unresolved"))) {
  inbox.push({
    id: stableId("INB", `integrity|${w}`), kind: "DATA_INTEGRITY", title: "Unresolved register reference", description: w,
    priority: "HIGH", entityIds: [], sourceIds: [], origin: "sync validation", status: "OPEN",
  });
}
// Apply recorded decisions (latest per item wins). Decisions never edit registers.
const decisions = [...data.review_decisions].sort((a, b) => (a.decided_at ?? "").localeCompare(b.decided_at ?? ""));
const latest = new Map(decisions.map((d) => [d.item_id, d]));
const inboxIds = new Set<string>();
for (const item of inbox) {
  if (inboxIds.has(item.id)) warn(`inbox: duplicate item ${item.id}`);
  inboxIds.add(item.id);
}

// ---------------------------------------------------------------- write cache
const tx = db.transaction(() => {
  for (const t of REBUILT_TABLES) db.prepare(`DELETE FROM ${t}`).run();
  const insRecord = db.prepare("INSERT INTO records VALUES (?,?,?,?)");
  for (const [name, def] of Object.entries(REGISTERS)) {
    if (name === "newspaper_articles") continue; // shares source_id PK with sources; stored under a suffixed key
    for (const r of data[name]) insRecord.run(r[def.pk], name, JSON.stringify(r), newSnapshots[name][r[def.pk]]);
  }
  for (const a of data.newspaper_articles) insRecord.run(`${a.source_id}#article`, "newspaper_articles", JSON.stringify(a), newSnapshots.newspaper_articles[a.source_id]);

  const insEntity = db.prepare("INSERT INTO entities VALUES (?,?,?,?,?,?,?,?,?,?,?)");
  for (const e of entities) {
    const rowJson = e.type === "SOURCE" && articleBySource.has(e.id) ? { ...e.row, _article: articleBySource.get(e.id) } : e.row;
    insEntity.run(e.id, e.type, e.subtype ?? null, e.label, e.subtitle ?? null, e.status ?? null, e.confidence ?? null,
      e.sortKey ?? null, e.register, JSON.stringify(rowJson), [e.id, e.label, ...e.search].join(" \n "));
  }
  const insEdge = db.prepare("INSERT INTO edges VALUES (?,?,?,?,?,?,?,?,?)");
  for (const e of edges) insEdge.run(e.id, e.from, e.to, e.rel, e.category, e.sourceId ?? null, e.locator ?? null, e.notes ?? null, e.origin);

  const insCs = db.prepare("INSERT INTO claim_sources VALUES (?,?,?,?,?,?,?,?,?,?)");
  for (const c of data.claim_sources) insCs.run(c.claim_source_id, c.claim_id, c.source_id, c.relationship, c.source_locator, c.excerpt, c.knowledge_basis, c.speaker_person_id || null, c.assertion_type || null, c.notes);

  const insEtm = db.prepare("INSERT INTO event_times VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
  for (const t of data.event_times) insEtm.run(t.event_time_id, t.event_id, t.source_id, t.source_locator, t.time_status, t.start_at, t.end_at, t.local_start_time, t.local_end_time, t.time_precision, t.date_precision, t.timezone, t.original_time_text, t.confidence, t.notes, 0);
  for (const e of data.events) if (!etmByEvent.has(e.event_id)) {
    insEtm.run(`${e.event_id}#summary`, e.event_id, splitIds(e.source_ids)[0] ?? null, null, e.time_status, e.start_at, e.end_at, e.local_start_time, e.local_end_time, e.time_precision, e.date_precision, e.timezone, e.original_time_text, e.confidence, "Event summary time (no event_times row).", 1);
  }
  const insCvr = db.prepare("INSERT INTO contradiction_versions VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)");
  for (const v of data.contradiction_versions) insCvr.run(v.contradiction_version_id, v.contradiction_id, v.version_text, v.source_id, v.source_locator, v.claim_id || null, v.event_id || null, v.statement_id || null, v.asserted_start_at, v.asserted_end_at, v.time_precision, v.original_time_text, v.notes);

  const insFile = db.prepare(`INSERT INTO source_files VALUES (?,?,?,?,?,?,?,?,?,?)`);
  for (const f of fileRows) insFile.run(f.source_file_id, f.source_id, f.file_role, f.local_file, f.sha256, f.mime_type, Number(f.byte_size) || null, f.derived_from_file_id || null, f.transformation_description, isPresent(f) ? 1 : 0);

  const insAsset = db.prepare("INSERT INTO assets VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)");
  for (const a of allAssets) insAsset.run(a.asset_id, a.type, a.local_path, a.original_url, a.caption, a.alt_text, a.source_id, a.related_entity_ids, a.status, a.availability, a.identity_basis, a.discovered_in, a.notes);

  const insInbox = db.prepare("INSERT OR REPLACE INTO inbox_items VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
  for (const i of inbox) {
    const d = latest.get(i.id);
    insInbox.run(i.id, i.kind, i.title, i.description, i.priority, i.entityIds.join(";"), i.sourceIds.join(";"), i.origin, i.originRef ?? null,
      i.originalIssueType ?? null, d?.decision ?? i.status, d?.note ?? null, d?.decided_at ?? null, d?.decided_by ?? null);
  }
  const insLink = db.prepare("INSERT INTO researcher_links VALUES (?,?,?,?,?,?,?,?)");
  for (const r of researcherLinks) insLink.run(r.researcher_link_id, r.from_record_id, r.to_record_id, r.label, r.note, r.created_by, r.created_at, r.status || "ACTIVE");

  const insChain = db.prepare("INSERT OR IGNORE INTO source_chain VALUES (?,?,?,?,?,?,?,?,?,?,?)");
  for (const c of sourceChain) for (const sid of splitIds(c.source_ids)) {
    if (!exists(sid)) warn(`source_chain.csv (${c.batch}): unresolved source ${sid}`);
    if (c.held_source_id && !exists(c.held_source_id)) warn(`source_chain.csv (${c.batch}): unresolved held source ${c.held_source_id}`);
    if (c.wanted_id && !wanted.has(c.wanted_id)) warn(`source_chain.csv (${c.batch}): wanted_id ${c.wanted_id} not in wanted_sources.csv`);
    insChain.run(stableId("SCH", `${sid}|${c.underlying_source}|${c.held_source_id}|${c.wanted_id}|${c.url}`), sid, c.underlying_source, c.source_type,
      c.url, c.held_source_id || null, c.wanted_id || null, c.holding_status, c.independence, c.notes, c.batch);
  }
  const insWanted = db.prepare("INSERT OR IGNORE INTO wanted_sources VALUES (?,?,?,?,?,?,?,?)");
  for (const w of wanted.values()) insWanted.run(w.wanted_id, w.title, w.source_type, w.url, w.requested_by_source_ids, w.status, w.notes, "");

  const insMeta = db.prepare("INSERT INTO meta VALUES (?,?)");
  insMeta.run("archive_root", ARCHIVE_ROOT);
  insMeta.run("synced_at", now);
  insMeta.run("open_questions_files", String(walk(path.join(ARCHIVE_ROOT, "01_MASTER_CASE", "research_questions")).length));
  insMeta.run("warnings", JSON.stringify(warnings));

  const insSnap = db.prepare("INSERT OR REPLACE INTO register_snapshots VALUES (?,?,?,?)");
  for (const [name] of Object.entries(REGISTERS)) if (fileHashes[name]) insSnap.run(name, fileHashes[name], JSON.stringify(newSnapshots[name]), now);
});
tx();

const summary = {
  archive: ARCHIVE_ROOT,
  registers: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length])),
  entities: entities.length,
  edges: edges.length,
  assets: { total: allAssets.length, newlyAppended: DRY_RUN ? 0 : newAssets.length, discoveredNotYetRegistered: DRY_RUN ? newAssets.length : 0 },
  inbox: inbox.length,
  ingestFiles: { total: ingestFiles.length, alreadyArchived: ingestArchived, unregistered: ingestFiles.length - ingestArchived },
  sourceChain: sourceChain.length,
  wantedSources: wanted.size,
  changes,
};
db.prepare("INSERT INTO sync_runs (started_at, finished_at, summary_json, warnings_json) VALUES (?,?,?,?)")
  .run(now, new Date().toISOString(), JSON.stringify(summary), JSON.stringify(warnings));
db.close();

// ---------------------------------------------------------------- report
const pad = (s: string, n: number) => s.padEnd(n);
console.log(`\nCase index rebuilt from ${ARCHIVE_ROOT}`);
console.log(`Database: ${DB_PATH}${DRY_RUN ? "  (dry run: assets.csv not written)" : ""}\n`);
for (const [k, v] of Object.entries(summary.registers)) console.log(`  ${pad(k, 24)} ${v}`);
console.log(`\n  entities ${entities.length} · edges ${edges.length} · assets ${allAssets.length} (${newAssets.length} new${DRY_RUN ? ", not written" : ", appended to assets.csv"}) · inbox ${inbox.length}`);
if (Object.keys(changes).length) {
  console.log("\nChanges since last sync:");
  for (const [k, c] of Object.entries(changes)) console.log(`  ${pad(k, 24)} +${c.added.length} ~${c.changed.length} -${c.removed.length}`);
} else console.log("\nNo register changes since last sync.");
console.log(`\nWarnings (${warnings.length}):`);
for (const w of warnings) console.log(`  ! ${w}`);
if (!fs.existsSync(RESEARCHER_LINKS_CSV)) console.log(`\nNote: ${path.relative(ARCHIVE_ROOT, RESEARCHER_LINKS_CSV)} does not exist yet; it is created on first researcher link.`);
if (!fs.existsSync(REVIEW_DECISIONS_CSV)) console.log(`Note: ${path.relative(ARCHIVE_ROOT, REVIEW_DECISIONS_CSV)} does not exist yet; it is created on first inbox decision.`);
