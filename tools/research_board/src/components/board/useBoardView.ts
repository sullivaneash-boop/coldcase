"use client";
import { useCallback, useMemo, useState } from "react";
import type { CaseEdge, EntityType } from "@/lib/types";
import { CLAIM_STATUSES } from "@/lib/types";
import { DEFAULT_HIDDEN_RELS, TYPE_ORDER } from "./constants";
import { neighbors, type CaseIndex } from "./graph";

export type BoardFilters = ReturnType<typeof useBoardFilters>;

/** Filter state shared by the desktop left panel and the mobile filter sheet. */
export function useBoardFilters() {
  // Opens on "The story" (people, events, places, evidence); other views are one click away.
  const [types, setTypes] = useState<Set<EntityType>>(new Set<EntityType>(["PERSON", "EVENT", "LOCATION", "EVIDENCE", "WITNESS_STATEMENT", "CONTRADICTION"]));
  const [showPages, setShowPages] = useState(false);
  const [statuses, setStatuses] = useState<Set<string>>(new Set(CLAIM_STATUSES));
  const [hiddenRels, setHiddenRels] = useState<Set<string>>(new Set(DEFAULT_HIDDEN_RELS));
  const [showResearcher, setShowResearcher] = useState(true);
  const [hideIsolated, setHideIsolated] = useState(false);
  return {
    types, setTypes, showPages, setShowPages, statuses, setStatuses, hiddenRels, setHiddenRels,
    showResearcher, setShowResearcher, hideIsolated, setHideIsolated,
  };
}

/**
 * Records and links to draw. With a focus record, only that record and its immediate
 * relationships are returned — the default on phones, so the full graph is never built there.
 */
export function useBoardView(idx: CaseIndex, f: BoardFilters, focusId: string | null, selectedId: string | null) {
  const edgeVisible = useCallback(
    (e: CaseEdge) => (e.category === "RESEARCHER" ? f.showResearcher : !f.hiddenRels.has(e.rel)),
    [f.showResearcher, f.hiddenRels],
  );
  const entities = idx.bundle.entities;
  const allowed = useCallback(
    (e: (typeof entities)[number]) =>
      f.types.has(e.type) && (e.subtype !== "NEWSPAPER_PAGE" || f.showPages) && (e.type !== "CLAIM" || f.statuses.has(e.status ?? "UNKNOWN")),
    [f.types, f.showPages, f.statuses],
  );

  // When claims are hidden, records named together in a claim are joined by a labelled "via claims" link,
  // so the story stays connected. This uses only explicit claim register lists, never co-mention in a source.
  const viaClaims = useMemo(() => {
    if (f.types.has("CLAIM")) return [] as CaseEdge[];
    const pairs = new Map<string, { a: string; b: string; claims: string[] }>();
    for (const c of entities) {
      if (c.type !== "CLAIM" || !f.statuses.has(c.status ?? "UNKNOWN")) continue;
      const named = (idx.out.get(c.id) ?? []).filter((e) => e.rel.startsWith("CLAIM_CONCERNS_")).map((e) => e.to);
      for (let i = 0; i < named.length; i++) for (let j = i + 1; j < named.length; j++) {
        const [a, b] = [named[i], named[j]].sort();
        const k = `${a}|${b}`;
        const p = pairs.get(k) ?? { a, b, claims: [] };
        p.claims.push(c.id);
        pairs.set(k, p);
      }
    }
    return [...pairs.values()].map((p) => ({
      id: `via|${p.a}|${p.b}`, from: p.a, to: p.b, rel: "VIA_CLAIM", category: "VIA_CLAIM" as const, sourceId: null, locator: null,
      notes: `${p.claims.length} claim${p.claims.length > 1 ? "s" : ""}`, origin: "claims.csv (derived for display)",
    }));
  }, [entities, idx, f.types, f.statuses]);

  const { boardEntities, boardEdges } = useMemo(() => {
    if (focusId && idx.byId.has(focusId)) {
      const nb = neighbors(idx, focusId, edgeVisible);
      for (const v of viaClaims) {
        const other = v.from === focusId ? v.to : v.to === focusId ? v.from : null;
        if (other) nb.set(other, [...(nb.get(other) ?? []), v]);
      }
      const keep = new Set([focusId, ...[...nb.keys()].filter((id) => allowed(idx.byId.get(id)!))]);
      const ents = [...keep].map((id) => idx.byId.get(id)!);
      const edges = [...nb.entries()].filter(([id]) => keep.has(id)).flatMap(([, es]) => es);
      return { boardEntities: ents, boardEdges: edges };
    }
    let ents = entities.filter(allowed);
    const ids = new Set(ents.map((e) => e.id));
    const edges = [...idx.allEdges, ...viaClaims].filter((e) => ids.has(e.from) && ids.has(e.to) && (e.category === "VIA_CLAIM" || edgeVisible(e)));
    if (f.hideIsolated) {
      const linked = new Set(edges.flatMap((e) => [e.from, e.to]));
      ents = ents.filter((e) => linked.has(e.id));
    }
    return { boardEntities: ents, boardEdges: edges };
  }, [entities, allowed, focusId, idx, edgeVisible, f.hideIsolated, viaClaims]);

  const highlight = useMemo(() => {
    if (focusId || !selectedId) return null;
    return new Set([selectedId, ...neighbors(idx, selectedId, edgeVisible).keys()]);
  }, [focusId, selectedId, idx, edgeVisible]);

  return { boardEntities, boardEdges, highlight, edgeVisible };
}

/** Ready-made board views. Each sets record types and relationship visibility in one click. */
export const VIEW_PRESETS: { id: string; name: string; description: string; types: EntityType[]; hiddenRels: string[] }[] = [
  {
    id: "story", name: "The story", description: "People, what happened, where, and physical evidence",
    types: ["PERSON", "EVENT", "LOCATION", "EVIDENCE", "WITNESS_STATEMENT", "CONTRADICTION"],
    hiddenRels: [...DEFAULT_HIDDEN_RELS],
  },
  {
    id: "evidence", name: "Claims & sources", description: "What is claimed and which source says it",
    types: ["CLAIM", "SOURCE", "CONTRADICTION", "EVIDENCE"],
    hiddenRels: [...DEFAULT_HIDDEN_RELS],
  },
  {
    id: "witnesses", name: "Witnesses", description: "Who said what, where it was recorded, and about which event",
    types: ["PERSON", "WITNESS_STATEMENT", "EVENT", "SOURCE"],
    hiddenRels: [...DEFAULT_HIDDEN_RELS, "EVENT_REPORTED_IN"],
  },
  {
    id: "everything", name: "Everything", description: "All record types and relationships except page/mention links",
    types: [...TYPE_ORDER], hiddenRels: [...DEFAULT_HIDDEN_RELS],
  },
];

export function applyView(f: BoardFilters, v: { types: EntityType[]; hiddenRels: string[]; statuses?: string[]; showPages?: boolean }) {
  f.setTypes(new Set(v.types));
  f.setHiddenRels(new Set(v.hiddenRels));
  f.setStatuses(new Set(v.statuses ?? CLAIM_STATUSES));
  f.setShowPages(!!v.showPages);
}

/** Which preset or saved view (if any) the current filters match exactly. */
export function matchingView(f: BoardFilters, saved: { id: string; types: EntityType[]; hiddenRels: string[] }[]) {
  const same = (a: Set<string>, b: string[]) => a.size === b.length && b.every((x) => a.has(x));
  return [...VIEW_PRESETS, ...saved].find((v) => same(f.types, v.types) && same(f.hiddenRels, v.hiddenRels))?.id ?? null;
}
