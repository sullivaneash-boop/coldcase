"use client";
import { useCallback, useMemo, useState } from "react";
import type { CaseEdge, EntityType } from "@/lib/types";
import { CLAIM_STATUSES } from "@/lib/types";
import { DEFAULT_HIDDEN_RELS, TYPE_ORDER } from "./constants";
import { neighbors, type CaseIndex } from "./graph";

export type BoardFilters = ReturnType<typeof useBoardFilters>;

/** Filter state shared by the desktop left panel and the mobile filter sheet. */
export function useBoardFilters() {
  const [types, setTypes] = useState<Set<EntityType>>(new Set(TYPE_ORDER));
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

  const { boardEntities, boardEdges } = useMemo(() => {
    if (focusId && idx.byId.has(focusId)) {
      const nb = neighbors(idx, focusId, edgeVisible);
      const keep = new Set([focusId, ...[...nb.keys()].filter((id) => allowed(idx.byId.get(id)!))]);
      const ents = [...keep].map((id) => idx.byId.get(id)!);
      const edges = [...nb.entries()].filter(([id]) => keep.has(id)).flatMap(([, es]) => es);
      return { boardEntities: ents, boardEdges: edges };
    }
    let ents = entities.filter(allowed);
    const ids = new Set(ents.map((e) => e.id));
    const edges = idx.allEdges.filter((e) => ids.has(e.from) && ids.has(e.to) && edgeVisible(e));
    if (f.hideIsolated) {
      const linked = new Set(edges.flatMap((e) => [e.from, e.to]));
      ents = ents.filter((e) => linked.has(e.id));
    }
    return { boardEntities: ents, boardEdges: edges };
  }, [entities, allowed, focusId, idx, edgeVisible, f.hideIsolated]);

  const highlight = useMemo(() => {
    if (focusId || !selectedId) return null;
    return new Set([selectedId, ...neighbors(idx, selectedId, edgeVisible).keys()]);
  }, [focusId, selectedId, idx, edgeVisible]);

  return { boardEntities, boardEdges, highlight, edgeVisible };
}
