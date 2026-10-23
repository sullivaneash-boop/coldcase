// Client-side index over the case bundle: adjacency, lookups and provenance helpers.
import type {
  Asset, CaseBundle, CaseEdge, ClaimSource, ContradictionVersion, Entity, EventTime, SourceChainRow, SourceFile, WantedSource,
} from "@/lib/types";

export const ids = (v: string | undefined | null) => (v ?? "").split(";").map((x) => x.trim()).filter(Boolean);

export interface CaseIndex {
  bundle: CaseBundle;
  byId: Map<string, Entity>;
  allEdges: CaseEdge[]; // includes researcher links as edges
  out: Map<string, CaseEdge[]>;
  inc: Map<string, CaseEdge[]>;
  claimSourcesByClaim: Map<string, ClaimSource[]>;
  claimSourcesBySource: Map<string, ClaimSource[]>;
  eventTimesByEvent: Map<string, EventTime[]>;
  versionsByContradiction: Map<string, ContradictionVersion[]>;
  filesBySource: Map<string, SourceFile[]>;
  assetsBySource: Map<string, Asset[]>;
  assetsByEntity: Map<string, Asset[]>;
  chainBySource: Map<string, SourceChainRow[]>;
  wantedById: Map<string, WantedSource>;
}

function push<K, V>(m: Map<K, V[]>, k: K, v: V) {
  const a = m.get(k);
  if (a) a.push(v);
  else m.set(k, [v]);
}

export function buildIndex(bundle: CaseBundle): CaseIndex {
  const byId = new Map(bundle.entities.map((e) => [e.id, e]));
  const researcherEdges: CaseEdge[] = bundle.researcherLinks
    .filter((l) => l.status === "ACTIVE" && byId.has(l.fromId) && byId.has(l.toId))
    .map((l) => ({
      id: l.id, from: l.fromId, to: l.toId, rel: "RESEARCHER_LINK", category: "RESEARCHER", sourceId: null,
      locator: null, notes: `${l.label ?? ""}${l.note ? " — " + l.note : ""}`, origin: "researcher_links.csv",
    }));
  const allEdges = [...bundle.edges, ...researcherEdges];
  const out = new Map<string, CaseEdge[]>();
  const inc = new Map<string, CaseEdge[]>();
  for (const e of allEdges) {
    push(out, e.from, e);
    push(inc, e.to, e);
  }
  const idx: CaseIndex = {
    bundle, byId, allEdges, out, inc,
    claimSourcesByClaim: new Map(), claimSourcesBySource: new Map(), eventTimesByEvent: new Map(),
    versionsByContradiction: new Map(), filesBySource: new Map(), assetsBySource: new Map(), assetsByEntity: new Map(),
    chainBySource: new Map(), wantedById: new Map(bundle.wanted.map((w) => [w.id, w])),
  };
  for (const c of bundle.claimSources) {
    push(idx.claimSourcesByClaim, c.claimId, c);
    push(idx.claimSourcesBySource, c.sourceId, c);
  }
  for (const t of bundle.eventTimes) push(idx.eventTimesByEvent, t.eventId, t);
  for (const v of bundle.contradictionVersions) push(idx.versionsByContradiction, v.contradictionId, v);
  for (const f of bundle.sourceFiles) push(idx.filesBySource, f.sourceId, f);
  for (const a of bundle.assets) {
    if (a.sourceId) push(idx.assetsBySource, a.sourceId, a);
    for (const id of a.relatedEntityIds) push(idx.assetsByEntity, id, a);
  }
  for (const c of bundle.sourceChain) push(idx.chainBySource, c.sourceId, c);
  return idx;
}

/** Records connected by any edge (optionally filtered), with the connecting edges. */
export function neighbors(idx: CaseIndex, id: string, accept: (e: CaseEdge) => boolean = () => true) {
  const res = new Map<string, CaseEdge[]>();
  for (const e of idx.out.get(id) ?? []) if (accept(e)) push(res, e.to, e);
  for (const e of idx.inc.get(id) ?? []) if (accept(e)) push(res, e.from, e);
  return res;
}

export const outTargets = (idx: CaseIndex, id: string, rel: string) =>
  (idx.out.get(id) ?? []).filter((e) => e.rel === rel).map((e) => e.to);
export const inSources = (idx: CaseIndex, id: string, rel: string) =>
  (idx.inc.get(id) ?? []).filter((e) => e.rel === rel).map((e) => e.from);

export const uniq = <T,>(a: T[]) => [...new Set(a)];

/** Pulls quoted anchor text out of a locator such as `passage beginning “According to …”`. */
export function anchorFromLocator(locator: string | null | undefined, excerpt?: string | null): string | null {
  if (excerpt && excerpt.trim().length > 8) return excerpt.trim().slice(0, 80);
  if (!locator) return null;
  const m = locator.match(/[“"]([^”"]{6,})[”"]/);
  return m ? m[1].trim() : null;
}

/** Event-time assertions grouped by distinct value; >1 group means conflicting timestamps. */
export function timeGroups(times: EventTime[]) {
  const groups = new Map<string, EventTime[]>();
  for (const t of times) push(groups, `${t.startAt}|${t.localStartTime}|${t.endAt}|${t.localEndTime}`, t);
  return [...groups.values()];
}

export interface Origin {
  key: string;
  label: string;
  kind: "HELD_SOURCE" | "WANTED_SOURCE" | "SPEAKER" | "UNLINKED";
  entityId?: string;
  wantedId?: string;
  detail?: string;
  sourceType?: string;
}

/**
 * Underlying origins of one source: held/wanted sources from source_chain.csv and CITES_SOURCE
 * targets, followed recursively. Used to stop repeated reporting from looking like corroboration.
 */
export function sourceOrigins(idx: CaseIndex, sourceId: string, seen = new Set<string>()): Origin[] {
  if (seen.has(sourceId)) return [];
  seen.add(sourceId);
  const res: Origin[] = [];
  for (const c of idx.chainBySource.get(sourceId) ?? []) {
    if (c.heldSourceId) {
      res.push({ key: c.heldSourceId, label: idx.byId.get(c.heldSourceId)?.label ?? c.underlyingSource ?? c.heldSourceId, kind: "HELD_SOURCE", entityId: c.heldSourceId, detail: c.notes ?? undefined, sourceType: c.sourceType ?? undefined });
      res.push(...sourceOrigins(idx, c.heldSourceId, seen));
    } else if (c.wantedId) {
      res.push({ key: c.wantedId, label: c.underlyingSource ?? idx.wantedById.get(c.wantedId)?.title ?? c.wantedId, kind: "WANTED_SOURCE", wantedId: c.wantedId, detail: [c.holdingStatus, c.url].filter(Boolean).join(" · "), sourceType: c.sourceType ?? undefined });
    }
  }
  for (const t of outTargets(idx, sourceId, "CITES_SOURCE")) {
    if (!res.some((r) => r.key === t)) res.push({ key: t, label: idx.byId.get(t)?.label ?? t, kind: "HELD_SOURCE", entityId: t });
    res.push(...sourceOrigins(idx, t, seen));
  }
  const dedup = new Map(res.map((r) => [r.key, r]));
  return [...dedup.values()];
}
