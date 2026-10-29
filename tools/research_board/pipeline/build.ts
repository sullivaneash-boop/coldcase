// Builds the read-only board data from the canonical archive. Pure: reads files, returns data.
// Never writes to the archive; outputs.ts decides what (if anything) is written.
import fs from "node:fs";
import path from "node:path";
import { v5 as uuidv5 } from "uuid";
import { readCsv, splitIds, type Row } from "../src/lib/csv";
import type {
  Asset, BoardConfig, CaseBundle, CaseEdge, CaseReview, Entity, EntityType, EventTime, InboxItem, Issue, ResearchStatus,
  ReviewNote, SourceDoc, SourceRendition,
} from "../src/lib/types";
import { loadRegisters, sha256, ENTITY_REGISTERS, REGISTERS, type Registers, type RegisterName } from "./registers";
import { validateArchive, summarize, isSafeArchivePath, PUBLISHABLE_IMAGE } from "./validate";

// Fixed namespace so derived IDs (AST-, INB-, edge IDs) are stable across rebuilds.
const NS = "6b0c6f3e-6a1f-4d0e-9a59-3f6f1d1c2a77";
export const stableId = (prefix: string, key: string) => `${prefix}-${uuidv5(key, NS)}`;

const MAX_TEXT = 2_000_000;
const PUBLISHABLE_DOC = /\.(pdf)$/i;
export const ASSET_COLUMNS = [
  "asset_id", "type", "local_path", "original_url", "caption", "alt_text", "source_id", "related_entity_ids", "status",
  "availability", "identity_basis", "discovered_in", "notes", "created_at", "updated_at",
];

const DEFAULT_CONFIG: BoardConfig = { title: "Case research board", timelineWindows: [] };

export interface BuildOptions {
  archiveRoot: string;
  now?: string;
  readOnly?: boolean;
}

export interface BuildResult {
  bundle: CaseBundle;
  sourceDocs: Map<string, SourceDoc>;
  /** Archive-relative files the deployment should serve under /archive/. */
  publish: Set<string>;
  newAssetRows: Row[];
  issues: Issue[];
  rowHashes: Record<string, Record<string, string>>;
  stats: Record<string, unknown>;
}

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.name.startsWith(".") ? [] : d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]);
}

export function buildCase(opts: BuildOptions): BuildResult {
  const root = path.resolve(opts.archiveRoot);
  const now = opts.now ?? new Date().toISOString();
  const issues: Issue[] = [];
  const warn = (code: string, message: string, recordId?: string) => issues.push({ level: "WARNING", code, message, recordId });
  const abs = (rel: string) => (isSafeArchivePath(rel) ? path.join(root, rel) : null);
  const present = (rel: string | undefined) => !!rel && !!abs(rel) && fs.existsSync(abs(rel)!) && fs.statSync(abs(rel)!).isFile();

  const { data, rowHashes } = loadRegisters(root, issues);
  validateArchive(root, data, issues);

  const byId = new Map<string, { register: RegisterName; row: Row }>();
  for (const name of ENTITY_REGISTERS) for (const r of data[name]) byId.set(r[REGISTERS[name].pk], { register: name, row: r });
  const exists = (id: string) => byId.has(id);
  const personName = (id: string) => byId.get(id)?.row.display_name || "unnamed person";

  // ------------------------------------------------------------ files and publishing
  const publish = new Set<string>();
  const publishable = (rel: string) => PUBLISHABLE_IMAGE.test(rel) || PUBLISHABLE_DOC.test(rel);
  const presentFile = new Map<string, boolean>();
  for (const f of data.source_files) {
    const ok = present(f.local_file);
    presentFile.set(f.source_file_id, ok);
    if (ok && publishable(f.local_file)) publish.add(f.local_file);
  }

  // ------------------------------------------------------------ entities
  const articleBySource = new Map(data.newspaper_articles.map((a) => [a.source_id, a]));
  const pageSourceIds = new Set(data.relationships.filter((r) => r.relationship_type === "APPEARS_ON_PAGE").map((r) => r.to_record_id));
  const entities: Entity[] = [];
  const add = (e: Omit<Entity, "searchText" | "subtype" | "subtitle" | "status" | "confidence" | "sortKey"> & Partial<Entity>) =>
    entities.push({ subtype: null, subtitle: null, status: null, confidence: null, sortKey: null, searchText: "", ...e } as Entity);

  for (const s of data.sources) {
    const art = articleBySource.get(s.source_id);
    add({
      id: s.source_id, type: "SOURCE", register: "sources",
      subtype: art ? "NEWS_ARTICLE" : pageSourceIds.has(s.source_id) ? "NEWSPAPER_PAGE" : s.source_type || "UNKNOWN",
      label: s.title?.trim() || `Untitled source ${s.source_id.slice(4, 12)}`,
      subtitle: [s.publisher || art?.publication, s.publication_date, s.reliability_class ? `class ${s.reliability_class}` : "class pending"].filter(Boolean).join(" · "),
      status: s.reliability_class || null, sortKey: s.publication_date || "9999",
      row: art ? { ...s, _article: art } as Entity["row"] : s as Entity["row"],
    });
  }
  for (const c of data.claims) {
    add({
      id: c.claim_id, type: "CLAIM", register: "claims", label: c.claim?.trim() || "(claim text missing)",
      subtitle: `${c.status || "UNKNOWN"} · ${c.confidence || "UNKNOWN"} confidence`, status: c.status || "UNKNOWN", confidence: c.confidence || null,
      sortKey: splitIds(c.event_ids).map((e) => byId.get(e)?.row.start_at).filter(Boolean).sort()[0] ?? "9999", row: c,
    });
  }
  for (const p of data.people) add({ id: p.person_id, type: "PERSON", register: "people", label: p.display_name?.trim() || "Unnamed person", subtitle: `identity ${p.identity_status || "UNKNOWN"}`, status: p.identity_status || null, row: p });
  for (const o of data.organizations) add({ id: o.organization_id, type: "ORGANIZATION", register: "organizations", label: o.name?.trim() || "Unnamed organization", subtitle: o.organization_type || null, row: o });
  for (const l of data.locations) add({ id: l.location_id, type: "LOCATION", register: "locations", label: l.name?.trim() || "Unnamed location", subtitle: l.location_type || null, row: l });
  for (const e of data.events) {
    const when = e.start_at
      ? `${e.start_at}${e.local_start_time ? " " + e.local_start_time : ""}${e.end_at && e.end_at !== e.start_at ? " → " + e.end_at : ""}${e.local_end_time ? " " + e.local_end_time : ""}`
      : "date unknown";
    add({ id: e.event_id, type: "EVENT", register: "events", label: e.title?.trim() || "Untitled event", subtitle: `${when} · ${e.time_status || "UNKNOWN"}`, status: e.time_status || null, confidence: e.confidence || null, sortKey: e.start_at || "9999", row: e });
  }
  for (const v of data.evidence) add({ id: v.evidence_id, type: "EVIDENCE", register: "evidence", label: v.title?.trim() || "Untitled evidence item", subtitle: `${v.evidence_type || "type unknown"} · custody ${v.custody_status || "UNKNOWN"}`, status: v.custody_status || null, row: v });
  for (const w of data.witness_statements) {
    add({
      id: w.statement_id, type: "WITNESS_STATEMENT", register: "witness_statements", label: `Statement — ${personName(w.witness_person_id)}`,
      subtitle: `${w.statement_date || "date unknown"} · ${w.representation_type || "UNKNOWN"} · ${w.knowledge_basis || "UNKNOWN"}`,
      status: w.representation_type || null, confidence: w.confidence || null, sortKey: w.statement_date || "9999", row: w,
    });
  }
  for (const c of data.contradictions) add({ id: c.contradiction_id, type: "CONTRADICTION", register: "contradictions", label: c.subject?.trim() || "Untitled contradiction", subtitle: c.status || null, status: c.status || null, row: c });

  // ------------------------------------------------------------ edges (only from explicit register data)
  const edges: CaseEdge[] = [];
  const edgeKeys = new Set<string>();
  const addEdge = (e: Omit<CaseEdge, "id" | "sourceId" | "locator" | "notes"> & { sourceId?: string; locator?: string; notes?: string }) => {
    if (!exists(e.from) || !exists(e.to)) return; // unresolved endpoints are reported by validation; never drawn
    const key = `${e.from}|${e.rel}|${e.to}|${e.sourceId ?? ""}|${e.locator ?? ""}`;
    if (edgeKeys.has(key)) return;
    edgeKeys.add(key);
    edges.push({ id: stableId("EDG", key), sourceId: e.sourceId || null, locator: e.locator || null, notes: e.notes || null, from: e.from, to: e.to, rel: e.rel, category: e.category, origin: e.origin });
  };
  for (const cs of data.claim_sources) {
    const rel = cs.relationship === "CONTRADICTS" ? "CONTRADICTED_BY" : cs.relationship === "SUPPORTS" ? "SUPPORTED_BY" : "CONTEXT_FROM";
    addEdge({ from: cs.claim_id, to: cs.source_id, rel, category: "SOURCED", sourceId: cs.source_id, locator: cs.source_locator, notes: cs.notes, origin: "claim_sources.csv" });
  }
  const listEdges = (rows: Row[], pk: string, field: string, rel: string, category: CaseEdge["category"], origin: string, sourced = false) => {
    for (const r of rows) for (const id of splitIds(r[field])) addEdge({ from: r[pk], to: id, rel, category, origin, sourceId: sourced ? id : undefined });
  };
  listEdges(data.claims, "claim_id", "people_ids", "CLAIM_CONCERNS_PERSON", "REGISTER", "claims.csv people_ids");
  listEdges(data.claims, "claim_id", "event_ids", "CLAIM_CONCERNS_EVENT", "REGISTER", "claims.csv event_ids");
  listEdges(data.claims, "claim_id", "location_ids", "CLAIM_CONCERNS_LOCATION", "REGISTER", "claims.csv location_ids");
  listEdges(data.claims, "claim_id", "evidence_ids", "CLAIM_CONCERNS_EVIDENCE", "REGISTER", "claims.csv evidence_ids");
  listEdges(data.events, "event_id", "location_ids", "EVENT_REPORTED_AT", "REGISTER", "events.csv location_ids");
  listEdges(data.events, "event_id", "people_ids", "EVENT_INVOLVES_PERSON", "REGISTER", "events.csv people_ids");
  listEdges(data.events, "event_id", "organization_ids", "EVENT_INVOLVES_ORGANIZATION", "REGISTER", "events.csv organization_ids");
  listEdges(data.events, "event_id", "source_ids", "EVENT_REPORTED_IN", "SOURCED", "events.csv source_ids", true);
  listEdges(data.evidence, "evidence_id", "source_ids", "EVIDENCE_REPORTED_IN", "SOURCED", "evidence.csv source_ids", true);
  listEdges(data.evidence, "evidence_id", "location_ids", "EVIDENCE_REPORTED_AT", "REGISTER", "evidence.csv location_ids");
  listEdges(data.evidence, "evidence_id", "event_ids", "EVIDENCE_RELATED_EVENT", "REGISTER", "evidence.csv event_ids");
  listEdges(data.evidence, "evidence_id", "people_ids", "EVIDENCE_RELATED_PERSON", "REGISTER", "evidence.csv people_ids");
  listEdges(data.evidence, "evidence_id", "custodian_organization_id", "REPORTED_CUSTODIAN", "REGISTER", "evidence.csv");
  for (const w of data.witness_statements) {
    if (w.witness_person_id) addEdge({ from: w.witness_person_id, to: w.statement_id, rel: "MADE_STATEMENT", category: "SOURCED", sourceId: w.source_id, locator: w.source_locator, origin: "witness_statements.csv" });
    if (w.source_id) addEdge({ from: w.statement_id, to: w.source_id, rel: "STATEMENT_RECORDED_IN", category: "SOURCED", sourceId: w.source_id, locator: w.source_locator, origin: "witness_statements.csv" });
    if (w.recorded_by_person_id) addEdge({ from: w.statement_id, to: w.recorded_by_person_id, rel: "RECORDED_BY", category: "SOURCED", sourceId: w.source_id, origin: "witness_statements.csv" });
    if (w.recorded_by_organization_id) addEdge({ from: w.statement_id, to: w.recorded_by_organization_id, rel: "RECORDED_BY", category: "SOURCED", sourceId: w.source_id, origin: "witness_statements.csv" });
    for (const id of splitIds(w.underlying_event_ids)) addEdge({ from: w.statement_id, to: id, rel: "STATEMENT_ABOUT_EVENT", category: "SOURCED", sourceId: w.source_id, origin: "witness_statements.csv" });
    if (w.supersedes_statement_id) addEdge({ from: w.statement_id, to: w.supersedes_statement_id, rel: "SUPERSEDES", category: "REGISTER", origin: "witness_statements.csv" });
  }
  listEdges(data.contradictions, "contradiction_id", "claim_ids", "CONTRADICTION_INVOLVES_CLAIM", "REGISTER", "contradictions.csv");
  listEdges(data.contradictions, "contradiction_id", "event_ids", "CONTRADICTION_CONCERNS_EVENT", "REGISTER", "contradictions.csv");
  for (const v of data.contradiction_versions) {
    if (v.source_id) addEdge({ from: v.contradiction_id, to: v.source_id, rel: "VERSION_ASSERTED_BY", category: "SOURCED", sourceId: v.source_id, locator: v.source_locator, notes: v.version_text, origin: "contradiction_versions.csv" });
  }
  listEdges(data.organizations, "organization_id", "parent_organization_id", "PART_OF", "REGISTER", "organizations.csv");
  listEdges(data.locations, "location_id", "parent_location_id", "WITHIN", "REGISTER", "locations.csv");
  const LEAD_TYPES = new Set(["POSSIBLE_SAME_IDENTITY"]);
  for (const r of data.relationships) {
    const category = LEAD_TYPES.has(r.relationship_type) ? "LEAD" : r.source_id ? "SOURCED" : "REGISTER";
    addEdge({ from: r.from_record_id, to: r.to_record_id, rel: r.relationship_type, category, sourceId: r.source_id, locator: r.source_locator, notes: r.notes, origin: `relationships.csv ${r.relationship_id}` });
  }

  // ------------------------------------------------------------ assets
  const existingAssets = new Map(data.assets.map((a) => [a.asset_id, a]));
  const discovered: Row[] = [];
  const peopleNames = data.people.flatMap((p) => [p.display_name, ...splitIds(p.aliases)].filter(Boolean).map((n) => ({ id: p.person_id, name: n })));
  // Identity only from explicit labeling ("Picture of NAME", "NAME mugshot"); a caption mention is not identification.
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const depicted = (text: string) => {
    const t = text.replace(/\s+/g, " ").trim();
    const hits = new Set<string>();
    for (const { id, name } of peopleNames) {
      if (name.length < 5) continue;
      const n = esc(name);
      if (
        new RegExp(`^(?:pic|picture|photo|portrait|image|mugshot)?\\s*(?:of\\s+)?${n}(?:\\s*[—–-]?\\s*(?:supplied\\s+)?(?:portrait|photo|picture|mugshot))?\\.?$`, "i").test(t) ||
        new RegExp(`\\b(?:photo|picture|portrait|mugshot)\\s+of\\s+(?:\\d+-year-old\\s+)?${n}\\b`, "i").test(t) ||
        new RegExp(`^${n}\\s+mugshot$`, "i").test(t)
      ) hits.add(id);
    }
    return [...hits];
  };
  const mentionNote = (text: string, dep: string[]) => {
    const m = [...new Set(peopleNames.filter(({ name }) => name.length >= 5 && new RegExp(`\\b${esc(name)}\\b`, "i").test(text)).map((p) => p.id))].filter((id) => !dep.includes(id));
    return m.length ? `Caption/alt text mentions ${m.join(";")} without establishing who is depicted.` : "";
  };
  const pushAsset = (key: string, a: Row) => {
    const asset_id = stableId("AST", key);
    if (!discovered.some((d) => d.asset_id === asset_id)) discovered.push({ asset_id, ...a });
  };
  for (const s of data.sources.filter((s) => s.source_type === "PHOTO")) {
    const ids = depicted(s.title ?? "");
    pushAsset(`${s.source_id}|${s.local_file}`, {
      type: "IMAGE", local_path: s.local_file, original_url: s.original_url ?? "", caption: s.title ?? "", alt_text: "", source_id: s.source_id,
      related_entity_ids: ids.join(";"), status: ids.length ? "SOURCE_LABELED" : "UNASSIGNED", availability: present(s.local_file) ? "LOCAL" : "MISSING",
      identity_basis: ids.length ? "Source title metadata names the person; not visual identification." : "", discovered_in: "sources.csv",
      notes: mentionNote(s.title ?? "", ids), created_at: now, updated_at: now,
    });
  }
  for (const f of data.source_files.filter((f) => (f.mime_type ?? "").startsWith("image/") && f.file_role !== "ORIGINAL")) {
    pushAsset(`${f.source_id}|${f.local_file}`, {
      type: "PAGE_PREVIEW", local_path: f.local_file, original_url: "", caption: byId.get(f.source_id)?.row.title ?? "", alt_text: "", source_id: f.source_id,
      related_entity_ids: "", status: "DERIVATIVE_INDEXED", availability: presentFile.get(f.source_file_id) ? "LOCAL" : "MISSING", identity_basis: "",
      discovered_in: `source_files.csv ${f.source_file_id}`, notes: f.transformation_description ?? "", created_at: now, updated_at: now,
    });
  }
  const mdFiles = new Map<string, Set<string>>();
  const addMd = (sid: string, rel: string) => { if (!mdFiles.has(sid)) mdFiles.set(sid, new Set()); mdFiles.get(sid)!.add(rel); };
  for (const f of data.source_files) if (f.mime_type === "text/markdown" && presentFile.get(f.source_file_id)) addMd(f.source_id, f.local_file);
  for (const a of data.newspaper_articles) if (a.reading_file && present(a.reading_file)) addMd(a.source_id, a.reading_file);
  const AD_HOSTS = /gravatar\.com|imasdk\.googleapis|revcontent\.com|doubleclick\.net|googlesyndication|taboola|outbrain|facebook\.com\/tr|pixel\.|scorecardresearch|quantserve/i;
  const IMG_MD = /!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+"([^"]*)")?\s*\)/g;
  const IMG_HTML = /<img\b[^>]*>/gi;
  const attr = (tag: string, name: string) => tag.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`, "i"))?.[1] ?? "";
  const mdText = new Map<string, string>();
  for (const [sourceId, files] of mdFiles) {
    const src = byId.get(sourceId)?.row;
    for (const rel of files) {
      const text = fs.readFileSync(abs(rel)!, "utf8");
      mdText.set(rel, text);
      const refs: { url: string; alt: string; title: string }[] = [];
      for (const m of text.matchAll(IMG_MD)) refs.push({ url: m[2], alt: m[1], title: m[3] ?? "" });
      const defs = new Map([...text.matchAll(/^\[([^\]]+)\]:\s*<?(\S+?)>?\s*$/gm)].map((d) => [d[1].toLowerCase(), d[2]]));
      for (const m of text.matchAll(/!\[([^\]]*)\]\[([^\]]+)\]/g)) {
        const url = defs.get(m[2].toLowerCase());
        if (url) refs.push({ url: url.startsWith("data:") ? `data:#${m[2]}` : url, alt: m[1], title: "" });
      }
      for (const m of text.matchAll(IMG_HTML)) refs.push({ url: attr(m[0], "src"), alt: attr(m[0], "alt"), title: attr(m[0], "title") });
      for (const r of refs) {
        if (!r.url || AD_HOSTS.test(r.url)) continue;
        const ids = depicted(`${r.alt} ${r.title}`.trim());
        if (r.url.startsWith("data:")) {
          pushAsset(`${sourceId}|embedded|${r.url}`, {
            type: "IMAGE", local_path: rel, original_url: "", caption: "", alt_text: r.alt, source_id: sourceId, related_entity_ids: ids.join(";"),
            status: ids.length ? "SOURCE_LABELED" : "UNASSIGNED", availability: "EMBEDDED_IN_SOURCE",
            identity_basis: ids.length ? "Alt text in source names the person; not visual identification." : "", discovered_in: rel,
            notes: ["Embedded data URI inside the archived Markdown capture.", mentionNote(r.alt, ids)].filter(Boolean).join(" "), created_at: now, updated_at: now,
          });
          continue;
        }
        let originalUrl = "";
        let localPath = "";
        if (/^https?:\/\//i.test(r.url)) originalUrl = r.url;
        else if (r.url.startsWith("/") && src?.original_url) {
          try { originalUrl = new URL(r.url, src.original_url).toString(); } catch { warn("MALFORMED_URL", `${rel}: image reference ${r.url} cannot be resolved against ${src.original_url}`, sourceId); }
        } else {
          const candidate = path.posix.normalize(path.posix.join(path.posix.dirname(rel), r.url));
          if (present(candidate)) localPath = candidate;
          else warn("MISSING_ASSET", `${rel}: local image reference not found: ${r.url}`, sourceId);
        }
        if (!originalUrl && !localPath) continue;
        pushAsset(`${sourceId}|${(originalUrl || localPath).replace(/[?#].*$/, "")}`, {
          type: "IMAGE", local_path: localPath, original_url: originalUrl, caption: r.title, alt_text: r.alt, source_id: sourceId,
          related_entity_ids: ids.join(";"), status: ids.length ? "SOURCE_LABELED" : "UNASSIGNED", availability: localPath ? "LOCAL" : "REMOTE_ONLY",
          identity_basis: ids.length ? "Alt text/caption in source names the person; not visual identification." : "", discovered_in: rel,
          notes: [localPath ? "" : "Referenced remotely; image bytes are not archived.", mentionNote(`${r.alt} ${r.title}`, ids)].filter(Boolean).join(" "),
          created_at: now, updated_at: now,
        });
      }
    }
  }
  const newAssetRows = discovered.filter((a) => !existingAssets.has(a.asset_id));
  const assetRows = [...existingAssets.values(), ...newAssetRows];
  // A local archived copy is preferred: if one exists for the same source and file name, never hotlink.
  const assets: Asset[] = assetRows.map((a) => {
    const local = a.local_path && a.availability !== "EMBEDDED_IN_SOURCE" && present(a.local_path) ? a.local_path : "";
    const webImage = !!local && PUBLISHABLE_IMAGE.test(local);
    if (webImage) publish.add(local);
    return {
      id: a.asset_id, type: a.type, localPath: a.local_path || null, originalUrl: a.original_url || null, caption: a.caption || null,
      altText: a.alt_text || null, sourceId: a.source_id || null, relatedEntityIds: splitIds(a.related_entity_ids).filter(exists),
      status: a.status || "UNASSIGNED", availability: a.availability === "LOCAL" && !local ? "MISSING" : a.availability || "UNKNOWN",
      identityBasis: a.identity_basis || null, discoveredIn: a.discovered_in || null, notes: a.notes || null, published: webImage,
    };
  });

  // ------------------------------------------------------------ event times
  const eventTimes: EventTime[] = data.event_times.map((t) => ({
    id: t.event_time_id, eventId: t.event_id, sourceId: t.source_id || null, locator: t.source_locator || null, timeStatus: t.time_status || null,
    startAt: t.start_at || null, endAt: t.end_at || null, localStartTime: t.local_start_time || null, localEndTime: t.local_end_time || null,
    timePrecision: t.time_precision || null, datePrecision: t.date_precision || null, timezone: t.timezone || null,
    originalTimeText: t.original_time_text || null, confidence: t.confidence || null, notes: t.notes || null, synthetic: 0,
  }));
  const etmEvents = new Set(eventTimes.map((t) => t.eventId));
  for (const e of data.events) if (!etmEvents.has(e.event_id)) {
    eventTimes.push({
      id: `${e.event_id}#summary`, eventId: e.event_id, sourceId: splitIds(e.source_ids)[0] ?? null, locator: null, timeStatus: e.time_status || null,
      startAt: e.start_at || null, endAt: e.end_at || null, localStartTime: e.local_start_time || null, localEndTime: e.local_end_time || null,
      timePrecision: e.time_precision || null, datePrecision: e.date_precision || null, timezone: e.timezone || null,
      originalTimeText: e.original_time_text || null, confidence: e.confidence || null, notes: "Event summary time (no event_times row).", synthetic: 1,
    });
  }

  // ------------------------------------------------------------ batches: review queues, leads, wanted sources, source chains
  const inbox: Omit<InboxItem, "status" | "decisionNote" | "decidedAt" | "decidedBy">[] = [];
  const initialStatus = new Map<string, string>();
  const pushInbox = (i: (typeof inbox)[number], status = "OPEN") => { inbox.push(i); initialStatus.set(i.id, status); };
  const ISSUE_KIND: Record<string, string> = {
    IDENTITY: "POSSIBLE_DUPLICATE_PERSON", DATE_CONFLICT: "POSSIBLE_CONTRADICTION", DATE_OCR: "AMBIGUOUS_DATE", DERIVED_CALENDAR_DATES: "AMBIGUOUS_DATE",
    OCR_CORRECTION: "AMBIGUOUS_TEXT", TRANSCRIPTION_BOUNDARIES: "AMBIGUOUS_TEXT", QUOTE_PRONOUN: "AMBIGUOUS_TEXT", AGE_VARIATION: "POSSIBLE_CONTRADICTION",
    BICYCLE_VARIATION: "POSSIBLE_CONTRADICTION", MISSING_CONTINUATION: "SOURCE_TO_ACQUIRE", SOURCE_URLS: "SOURCE_TO_ACQUIRE", PHOTOS_CAPTIONS: "UNASSIGNED_IMAGE",
    WITNESS_ROLES: "POSSIBLE_RELATIONSHIP", UNCONFIRMED_MEDIA_REPORT: "AMBIGUOUS_TEXT",
  };
  const kindFromDescription = (d: string) =>
    /scrambl|ocr|transcri|quotation|wording|quote/i.test(d) ? "AMBIGUOUS_TEXT"
      : /\bdate|time|timecode|chronolog/i.test(d) ? "AMBIGUOUS_DATE"
      : /identity|same person|merge|spelling/i.test(d) ? "POSSIBLE_DUPLICATE_PERSON"
      : /contradict|conflict|denial|versus/i.test(d) ? "POSSIBLE_CONTRADICTION"
      : /obtain|acquire|original/i.test(d) ? "SOURCE_TO_ACQUIRE" : "BATCH_REVIEW";
  const wanted = new Map<string, Row>();
  const chainRows: Row[] = [];
  const batchDir = path.join(root, "00_ADMIN", "ingestion_batches");
  const batches = fs.existsSync(batchDir) ? fs.readdirSync(batchDir).filter((d) => fs.statSync(path.join(batchDir, d)).isDirectory()).sort() : [];
  const seenInbox = new Set<string>();
  for (const b of batches) {
    const rel = (f: string) => `00_ADMIN/ingestion_batches/${b}/${f}`;
    for (const r of readCsv(path.join(batchDir, b, "human_review_queue.csv"))) {
      if (!r.review_id) { warn("MALFORMED_RECORD", `${rel("human_review_queue.csv")}: row without review_id ignored`); continue; }
      if (seenInbox.has(r.review_id)) { warn("DUPLICATE_ID", `${rel("human_review_queue.csv")}: review ${r.review_id} appears more than once`, r.review_id); continue; }
      seenInbox.add(r.review_id);
      pushInbox({
        id: r.review_id, kind: r.issue_type ? ISSUE_KIND[r.issue_type] ?? "BATCH_REVIEW" : kindFromDescription(r.description ?? ""),
        title: r.issue_type ? r.issue_type.replace(/_/g, " ") : (r.description ?? "").split(/[.;:]/)[0].slice(0, 90) || "Review item",
        description: r.description ?? "", priority: r.priority || "MEDIUM", entityIds: [], sourceIds: splitIds(r.source_ids ?? r.source_id),
        origin: rel("human_review_queue.csv"), originRef: r.review_id,
        originalIssueType: r.issue_type || "(no issue_type; kind inferred from description keywords)",
      }, r.status && r.status !== "OPEN" ? r.status : "OPEN");
    }
    for (const w of readCsv(path.join(batchDir, b, "wanted_sources.csv"))) {
      if (!w.wanted_id) continue;
      if (wanted.has(w.wanted_id)) continue;
      wanted.set(w.wanted_id, { ...w, batch: b });
      pushInbox({
        id: w.wanted_id, kind: "SOURCE_TO_ACQUIRE", title: w.title || "Untitled wanted source",
        description: `${w.source_type || "Source"} referenced by held sources but not acquired (${w.status || "status blank"}).${w.url ? " Referenced URL: " + w.url : ""}${w.notes ? " " + w.notes : ""}`,
        priority: /IMAGE|SCAN/.test(w.source_type ?? "") ? "LOW" : "MEDIUM", entityIds: [], sourceIds: splitIds(w.requested_by_source_ids).filter(exists),
        origin: rel("wanted_sources.csv"), originRef: w.wanted_id, originalIssueType: w.source_type || null,
      }, w.status === "ACQUIRED" ? "ACCEPTED" : "OPEN");
    }
    for (const c of readCsv(path.join(batchDir, b, "source_chain.csv"))) chainRows.push({ ...c, batch: b });
    const leadsFile = path.join(batchDir, b, "NEW_LEADS_FROM_BATCH.md");
    if (fs.existsSync(leadsFile)) {
      for (const sec of fs.readFileSync(leadsFile, "utf8").split(/^## /m).slice(1)) {
        const [heading, ...body] = sec.split("\n");
        const m = heading.match(/^(LEAD-[A-Z0-9-]+)\s+—\s+(.*)$/);
        if (!m || seenInbox.has(m[1])) continue;
        seenInbox.add(m[1]);
        const bodyText = body.join("\n");
        pushInbox({
          id: m[1], kind: "SOURCE_TO_ACQUIRE", title: m[2], description: bodyText.split(/\n\s*Sources:/)[0].trim(), priority: "MEDIUM", entityIds: [],
          sourceIds: [...new Set([...bodyText.matchAll(/`(SRC-[0-9a-f-]{36})`/g)].map((x) => x[1]))].filter(exists),
          origin: rel("NEW_LEADS_FROM_BATCH.md"), originRef: m[1], originalIssueType: "LEAD",
        });
      }
    }
  }
  for (const r of data.relationships.filter((r) => LEAD_TYPES.has(r.relationship_type))) {
    pushInbox({
      id: stableId("INB", `lead-rel|${r.relationship_id}`), kind: "POSSIBLE_DUPLICATE_PERSON",
      title: `${personName(r.from_record_id)} / ${personName(r.to_record_id)} — possible same identity`, description: r.notes ?? "", priority: "HIGH",
      entityIds: [r.from_record_id, r.to_record_id].filter(exists), sourceIds: splitIds(r.source_id).filter(exists), origin: "relationships.csv", originRef: r.relationship_id,
      originalIssueType: null,
    });
  }
  const linkedPairs = new Set(data.relationships.filter((r) => LEAD_TYPES.has(r.relationship_type)).map((r) => [r.from_record_id, r.to_record_id].sort().join("|")));
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();
  const lev = (a: string, b: string) => {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  };
  for (let i = 0; i < data.people.length; i++) for (let j = i + 1; j < data.people.length; j++) {
    const a = data.people[i], b = data.people[j];
    const pair = [a.person_id, b.person_id].sort().join("|");
    const na = norm(a.display_name ?? ""), nb = norm(b.display_name ?? "");
    if (linkedPairs.has(pair) || !na || !nb || lev(na, nb) > 2) continue;
    pushInbox({
      id: stableId("INB", `similar-name|${pair}`), kind: "POSSIBLE_DUPLICATE_PERSON", title: `${a.display_name} / ${b.display_name} — similar spelling`,
      description: "Machine-suggested by name-string similarity only. Not evidence of shared identity; no merge performed.", priority: "LOW",
      entityIds: [a.person_id, b.person_id], sourceIds: [], origin: "sync: name similarity", originRef: null, originalIssueType: null,
    });
  }
  for (const a of assets.filter((a) => a.status === "UNASSIGNED")) {
    pushInbox({
      id: stableId("INB", `asset|${a.id}`), kind: "UNASSIGNED_IMAGE", title: a.altText || a.caption || path.basename(a.localPath || a.originalUrl || a.id),
      description: `Image ${a.availability === "LOCAL" ? "archived locally" : a.availability === "EMBEDDED_IN_SOURCE" ? "embedded in an archived capture" : a.availability === "MISSING" ? "registered but the file is missing" : "referenced remotely, not archived"}. No source label establishes who or what is depicted. Assign only from source metadata — no facial recognition.${a.notes ? " " + a.notes : ""}`,
      priority: "MEDIUM", entityIds: [a.id], sourceIds: a.sourceId && exists(a.sourceId) ? [a.sourceId] : [], origin: "assets.csv", originRef: a.id, originalIssueType: null,
    });
  }
  const conEvents = new Set(data.contradictions.flatMap((c) => splitIds(c.event_ids)));
  for (const e of data.events) {
    const times = eventTimes.filter((t) => t.eventId === e.event_id && !t.synthetic);
    const distinct = new Set(times.map((t) => `${t.startAt}|${t.localStartTime}|${t.endAt}|${t.localEndTime}`));
    if (e.time_status === "UNKNOWN" || e.date_precision === "UNKNOWN" || !e.start_at) {
      pushInbox({
        id: stableId("INB", `ambiguous-date|${e.event_id}`), kind: "AMBIGUOUS_DATE", title: `${e.title || "Untitled event"} — date not established`,
        description: `Register time_status ${e.time_status || "blank"}; original wording: “${e.original_time_text || "not recorded"}”.${conEvents.has(e.event_id) ? " Linked to an open contradiction record." : ""}`,
        priority: "MEDIUM", entityIds: [e.event_id], sourceIds: splitIds(e.source_ids).filter(exists), origin: "events.csv", originRef: e.event_id, originalIssueType: null,
      });
    }
    if (distinct.size > 1 && !conEvents.has(e.event_id)) {
      pushInbox({
        id: stableId("INB", `time-conflict|${e.event_id}`), kind: "POSSIBLE_CONTRADICTION", title: `${e.title || "Untitled event"} — differing time assertions`,
        description: `${distinct.size} distinct attributed times in event_times.csv and no contradiction record links this event.`, priority: "MEDIUM",
        entityIds: [e.event_id], sourceIds: [...new Set(times.map((t) => t.sourceId).filter((s): s is string => !!s && exists(s)))], origin: "event_times.csv", originRef: null, originalIssueType: null,
      });
    }
  }
  const knownHashes = new Map(data.source_files.filter((f) => f.sha256).map((f) => [f.sha256, f]));
  const ingestFiles = walk(path.join(root, "_INGEST"));
  let ingestArchived = 0;
  const ingestSeen = new Map<string, string>();
  for (const fileAbs of ingestFiles) {
    const rel = path.relative(root, fileAbs).split(path.sep).join("/");
    if (/(^|\/)README\.md$/i.test(rel)) continue;
    const hash = sha256(fs.readFileSync(fileAbs));
    const twin = ingestSeen.get(hash);
    if (!twin) ingestSeen.set(hash, rel);
    if (knownHashes.has(hash)) { ingestArchived++; continue; }
    let title = rel;
    let detail = "";
    if (rel.endsWith(".md")) {
      const text = fs.readFileSync(fileAbs, "utf8");
      title = (text.match(/^#\s+(.+)$/m)?.[1] ?? rel).replace(/\*\*/g, "").trim();
      detail = ` Contains ${[...text.matchAll(IMG_MD)].length + [...text.matchAll(IMG_HTML)].length} image reference(s). Contents are NOT indexed as case data until registered with a SRC ID per the intake protocol.`;
    }
    pushInbox({
      id: stableId("INB", `ingest|${rel}|${hash}`), kind: "UNKNOWN_SOURCE", title,
      description: `Unregistered file at ${rel} (sha256 ${hash.slice(0, 12)}…). No SRC record, provenance or reliability class.${twin ? ` Byte-identical to ${twin}.` : ""}${detail}`,
      priority: "MEDIUM", entityIds: [], sourceIds: [], origin: "_INGEST", originRef: rel, originalIssueType: null,
    });
  }
  for (const i of issues.filter((i) => i.level === "ERROR" && ["BROKEN_REFERENCE", "UNRESOLVED_SOURCE", "IMPOSSIBLE_REFERENCE"].includes(i.code))) {
    pushInbox({ id: stableId("INB", `integrity|${i.message}`), kind: "DATA_INTEGRITY", title: "Unresolved register reference", description: i.message, priority: "HIGH", entityIds: [], sourceIds: [], origin: "validation", originRef: i.recordId ?? null, originalIssueType: i.code });
  }
  const latest = new Map([...data.review_decisions].sort((a, b) => (a.decided_at ?? "").localeCompare(b.decided_at ?? "")).map((d) => [d.item_id, d]));
  const inboxItems: InboxItem[] = inbox.map((i) => {
    const d = latest.get(i.id);
    return { ...i, status: d?.decision || initialStatus.get(i.id) || "OPEN", decisionNote: d?.note || null, decidedAt: d?.decided_at || null, decidedBy: d?.decided_by || null };
  });

  // Source chains reference held sources and wanted acquisitions. Unresolved rows are reported, not drawn.
  const sourceChain = chainRows.flatMap((c) => splitIds(c.source_ids).map((sid) => {
    if (!exists(sid)) warn("BROKEN_REFERENCE", `source_chain.csv (${c.batch}): unknown source ${sid}`, sid);
    if (c.held_source_id && !exists(c.held_source_id)) warn("BROKEN_REFERENCE", `source_chain.csv (${c.batch}): unknown held source ${c.held_source_id}`, c.held_source_id);
    if (c.wanted_id && !wanted.has(c.wanted_id)) warn("BROKEN_REFERENCE", `source_chain.csv (${c.batch}): wanted_id ${c.wanted_id} not in any wanted_sources.csv`, c.wanted_id);
    return {
      id: stableId("SCH", `${sid}|${c.underlying_source}|${c.held_source_id}|${c.wanted_id}|${c.url}`), sourceId: sid, underlyingSource: c.underlying_source || null,
      sourceType: c.source_type || null, url: c.url || null, heldSourceId: c.held_source_id && exists(c.held_source_id) ? c.held_source_id : null,
      wantedId: c.wanted_id || null, holdingStatus: c.holding_status || null, independence: c.independence || null, notes: c.notes || null, batch: c.batch,
    };
  })).filter((c) => exists(c.sourceId));

  // ------------------------------------------------------------ source reading payloads
  const sourceDocs = new Map<string, SourceDoc>();
  const filesBySource = new Map<string, Row[]>();
  for (const f of data.source_files) filesBySource.set(f.source_id, [...(filesBySource.get(f.source_id) ?? []), f]);
  for (const s of data.sources) {
    const renditions: SourceRendition[] = [];
    const contents: Record<string, string> = {};
    const truncated: Record<string, boolean> = {};
    const addR = (r: Omit<SourceRendition, "published">) => {
      if (!r.path || renditions.some((x) => x.path === r.path) || !present(r.path)) return;
      const isText = r.kind === "markdown" || r.kind === "text";
      const published = isText || publish.has(r.path) || ((r.kind === "image" || r.kind === "pdf") && publishable(r.path) && (publish.add(r.path), true));
      if (isText) {
        const text = mdText.get(r.path) ?? fs.readFileSync(abs(r.path)!, "utf8");
        truncated[r.key] = text.length > MAX_TEXT;
        contents[r.key] = text.slice(0, MAX_TEXT);
      }
      renditions.push({ ...r, published });
    };
    const art = articleBySource.get(s.source_id);
    if (art?.reading_file) addR({ key: "reading", label: "Reading transcription", path: art.reading_file, kind: "markdown", role: "READING_DERIVATIVE" });
    const files = [...(filesBySource.get(s.source_id) ?? [])].sort((a, b) => Number(/reading/i.test(b.local_file)) - Number(/reading/i.test(a.local_file)) || a.local_file.localeCompare(b.local_file));
    for (const f of files) {
      const p = f.local_file, mime = f.mime_type ?? "", role = f.file_role ?? "";
      if (mime === "text/markdown") addR({ key: f.source_file_id, label: /reading/i.test(p) ? "Reading copy" : role === "ORIGINAL" ? "Original capture (Markdown)" : "Markdown derivative", path: p, kind: "markdown", role });
      else if (mime === "text/plain") addR({ key: f.source_file_id, label: /raw_text|ocr/i.test(p) ? "Raw embedded OCR text (uncorrected)" : "Text derivative", path: p, kind: "text", role });
      else if (mime.startsWith("image/")) addR({ key: f.source_file_id, label: role === "ORIGINAL" ? "Original image" : "Page preview image", path: p, kind: "image", role });
      else if (mime === "application/pdf") addR({ key: f.source_file_id, label: "Original PDF", path: p, kind: "pdf", role });
    }
    if (art?.raw_article_file) addR({ key: "raw", label: "Raw article OCR extraction", path: art.raw_article_file, kind: "text", role: "OCR" });
    if (s.local_file) {
      const kind = /\.pdf$/i.test(s.local_file) ? "pdf" : PUBLISHABLE_IMAGE.test(s.local_file) ? "image" : /\.md$/i.test(s.local_file) ? "markdown" : /\.txt$/i.test(s.local_file) ? "text" : null;
      if (kind) addR({ key: "local", label: "Principal original", path: s.local_file, kind, role: "ORIGINAL" });
    }
    sourceDocs.set(s.source_id, { renditions, contents, truncated });
  }

  // ------------------------------------------------------------ board config and research status
  let config = DEFAULT_CONFIG;
  const cfgFile = path.join(root, "00_ADMIN", "board_config.json");
  if (fs.existsSync(cfgFile)) {
    try {
      const raw = JSON.parse(fs.readFileSync(cfgFile, "utf8"));
      config = {
        title: typeof raw.title === "string" ? raw.title : DEFAULT_CONFIG.title,
        subtitle: typeof raw.subtitle === "string" ? raw.subtitle : undefined,
        timelineWindows: Array.isArray(raw.timelineWindows) ? raw.timelineWindows.filter((w: Record<string, unknown>) => typeof w.label === "string" && typeof w.start === "string" && typeof w.end === "string") : [],
      };
    } catch (e) {
      warn("MALFORMED_CONFIG", `00_ADMIN/board_config.json could not be parsed (${(e as Error).message}); defaults used`);
    }
  }
  const research = researchStatus(root, data, exists);
  const review = loadReview(root, exists, warn);

  const bundle: CaseBundle = {
    entities, edges,
    claimSources: data.claim_sources.map((c) => ({
      id: c.claim_source_id, claimId: c.claim_id, sourceId: c.source_id, relationship: c.relationship || null, locator: c.source_locator || null,
      excerpt: c.excerpt || null, knowledgeBasis: c.knowledge_basis || null, speakerPersonId: c.speaker_person_id && exists(c.speaker_person_id) ? c.speaker_person_id : null,
      assertionType: c.assertion_type || null, notes: c.notes || null,
    })).filter((c) => exists(c.claimId) && exists(c.sourceId)),
    eventTimes: eventTimes.filter((t) => exists(t.eventId)).map((t) => ({ ...t, sourceId: t.sourceId && exists(t.sourceId) ? t.sourceId : null })),
    contradictionVersions: data.contradiction_versions.filter((v) => exists(v.contradiction_id)).map((v) => ({
      id: v.contradiction_version_id, contradictionId: v.contradiction_id, versionText: v.version_text || null, sourceId: v.source_id && exists(v.source_id) ? v.source_id : null,
      locator: v.source_locator || null, claimId: v.claim_id && exists(v.claim_id) ? v.claim_id : null, eventId: v.event_id && exists(v.event_id) ? v.event_id : null,
      statementId: v.statement_id && exists(v.statement_id) ? v.statement_id : null, assertedStartAt: v.asserted_start_at || null, assertedEndAt: v.asserted_end_at || null,
      timePrecision: v.time_precision || null, originalTimeText: v.original_time_text || null, notes: v.notes || null,
    })),
    sourceFiles: data.source_files.filter((f) => exists(f.source_id)).map((f) => ({
      id: f.source_file_id, sourceId: f.source_id, fileRole: f.file_role || null, localFile: f.local_file || null, sha256: f.sha256 || null, mimeType: f.mime_type || null,
      byteSize: Number(f.byte_size) || null, derivedFromFileId: f.derived_from_file_id || null, transformation: f.transformation_description || null,
      exists: presentFile.get(f.source_file_id) ? 1 : 0, published: publish.has(f.local_file),
    })),
    assets,
    inbox: inboxItems,
    researcherLinks: data.researcher_links.filter((r) => (r.status || "ACTIVE") === "ACTIVE" && exists(r.from_record_id) && exists(r.to_record_id)).map((r) => ({
      id: r.researcher_link_id, fromId: r.from_record_id, toId: r.to_record_id, label: r.label || null, note: r.note || null, createdBy: r.created_by || null,
      createdAt: r.created_at || null, status: r.status || "ACTIVE",
    })),
    sourceChain,
    wanted: [...wanted.values()].map((w) => ({ id: w.wanted_id, title: w.title || null, sourceType: w.source_type || null, url: w.url || null, requestedBySourceIds: w.requested_by_source_ids || null, status: w.status || null, notes: w.notes || null })),
    review,
    reviewNotes: reviewNotes(data, review),
    meta: {
      syncedAt: now, dataVersion: "", readOnly: !!opts.readOnly, config, research,
      validation: summarize(issues), warnings: [],
      openQuestionFiles: walk(path.join(root, "01_MASTER_CASE", "research_questions")).length,
    },
  };
  bundle.meta.warnings = issues.map((i) => `${i.level}: ${i.message}`);
  // Content hash excludes the sync timestamp so identical archives yield identical versions.
  bundle.meta.dataVersion = sha256(JSON.stringify({ ...bundle, meta: { ...bundle.meta, syncedAt: null, dataVersion: "" } })).slice(0, 16);

  return {
    bundle, sourceDocs, publish, newAssetRows, issues, rowHashes,
    stats: {
      registers: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length])),
      entities: entities.length, edges: edges.length, assets: assets.length, newAssets: newAssetRows.length, inbox: inboxItems.length,
      ingest: { total: ingestFiles.length, alreadyArchived: ingestArchived }, sourceChain: sourceChain.length, wanted: wanted.size, publishFiles: publish.size,
      types: entities.reduce<Record<string, number>>((m, e) => ((m[e.type as EntityType] = (m[e.type] ?? 0) + 1), m), {}),
    },
  };
}

/** Research status derived from run logs and registers — never hard-coded. */
export const REVIEW_FILE = "11_ANALYSIS/independent_review/case_review.json";
const REVIEW_LISTS = [
  "observations", "timeline", "evidence", "people", "locations", "contradictions", "hypotheses", "priorities",
  "openQuestions", "biasAudit", "provenance", "humanReview", "offenderDimensions", "secondaryReview",
] as const;

/** Loads the analysis layer. It is never evidence: unknown record references are dropped and reported, not drawn. */
function loadReview(root: string, exists: (id: string) => boolean, warn: (code: string, message: string, recordId?: string) => void): CaseReview | null {
  const file = path.join(root, REVIEW_FILE);
  if (!fs.existsSync(file)) return null;
  let raw: CaseReview;
  try {
    raw = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    warn("MALFORMED_REVIEW", `${REVIEW_FILE} could not be parsed (${(e as Error).message}); command center hidden`);
    return null;
  }
  const seen = new Set<string>();
  for (const list of REVIEW_LISTS) {
    const items = Array.isArray(raw[list]) ? raw[list] : [];
    raw[list] = items.filter((it) => {
      if (!it || typeof it.id !== "string" || !it.id) { warn("MALFORMED_REVIEW", `${REVIEW_FILE}: ${list} item without id ignored`); return false; }
      if (seen.has(it.id)) { warn("DUPLICATE_ID", `${REVIEW_FILE}: review item ${it.id} appears more than once`); return false; }
      seen.add(it.id);
      return true;
    });
    for (const it of raw[list]) {
      const refs = Array.isArray(it.recordIds) ? it.recordIds : [];
      const missing = refs.filter((r) => !exists(r));
      for (const r of missing) warn("UNKNOWN_REVIEW_REF", `${REVIEW_FILE}: ${it.id} cites ${r}, which is not in the registers`, it.id);
      it.recordIds = refs.filter(exists);
    }
  }
  return { ...raw, file: REVIEW_FILE };
}

/** Human responses to analysis items (review_decisions.csv rows with item_kind ANALYSIS_ITEM). */
function reviewNotes(data: Registers, review: CaseReview | null): ReviewNote[] {
  if (!review) return [];
  return data.review_decisions
    .filter((d) => d.item_kind === "ANALYSIS_ITEM" && d.item_id)
    .sort((a, b) => (a.decided_at ?? "").localeCompare(b.decided_at ?? ""))
    .map((d) => {
      const m = (d.note ?? "").match(/^\[grade:([A-Z_]+)\]\s*/);
      return {
        id: d.decision_id, itemId: d.item_id, decision: d.decision || "NOTE", grade: m ? m[1] : null,
        note: (m ? (d.note ?? "").slice(m[0].length) : d.note) || null, decidedBy: d.decided_by || null, decidedAt: d.decided_at || null,
      };
    });
}

function researchStatus(root: string, data: Registers, exists: (id: string) => boolean): ResearchStatus {
  const runsDir = path.join(root, "15_AI_WORKSPACE", "research_runs");
  const runs = fs.existsSync(runsDir) ? fs.readdirSync(runsDir).filter((f) => /^RUN-.*\.md$/.test(f)).sort() : [];
  let lastRun: ResearchStatus["lastRun"] = null;
  let latestFinding: ResearchStatus["latestFinding"] = null;
  const runAt = (id: string) => {
    const m = id.match(/RUN-(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/);
    return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z` : null;
  };
  // Walk back from the newest run to the newest one that records findings.
  for (const f of [...runs].reverse()) {
    const id = f.replace(/\.md$/, "");
    const text = fs.readFileSync(path.join(runsDir, f), "utf8");
    if (!lastRun) lastRun = { id, at: runAt(id), file: `15_AI_WORKSPACE/research_runs/${f}` };
    const sec = text.split(/^## /m).find((s) => /^FINDINGS\b/.test(s));
    const para = sec?.split("\n").slice(1).join("\n").trim().split(/\n\s*\n/)[0]?.replace(/\s+/g, " ").trim();
    if (para && !/^(none|no meaningful|no new)/i.test(para)) {
      latestFinding = {
        text: para.length > 420 ? para.slice(0, 417) + "…" : para,
        origin: `${id} research log (AI-written summary — not evidence)`,
        recordIds: [...new Set([...para.matchAll(/\b(?:SRC|CLM|EVT|PER|LOC|EVD|WIT|CON|ORG)-[0-9a-f-]{36}\b/g)].map((m) => m[0]))].filter(exists),
      };
      break;
    }
  }
  const stamp = (r: Row) => [r.updated_at, r.created_at].filter(Boolean).sort().pop() ?? "";
  let registersChangedAt: string | null = null;
  for (const rows of Object.values(data)) for (const r of rows) {
    const t = stamp(r);
    if (t && (!registersChangedAt || t > registersChangedAt)) registersChangedAt = t;
  }
  const newestSource = [...data.sources].filter((s) => s.created_at).sort((a, b) => a.created_at.localeCompare(b.created_at)).pop();
  if (!latestFinding) {
    const newestClaim = [...data.claims].filter((c) => c.created_at).sort((a, b) => a.created_at.localeCompare(b.created_at)).pop();
    if (newestClaim) latestFinding = { text: newestClaim.claim, origin: `Newest claim record (${newestClaim.status || "UNKNOWN"})`, recordIds: [newestClaim.claim_id] };
  }
  return {
    lastRun,
    registersChangedAt,
    latestSource: newestSource ? { id: newestSource.source_id, title: newestSource.title || newestSource.source_id, at: newestSource.created_at || null } : null,
    latestFinding,
  };
}
