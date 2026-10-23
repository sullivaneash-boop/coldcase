"use client";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { CLAIM_STATUSES } from "@/lib/types";
import { CATEGORY_META, REL_LABEL, TYPE_META, TYPE_ORDER } from "./constants";
import { StatusBadge } from "./bits";
import type { CaseIndex } from "./graph";
import type { BoardFilters } from "./useBoardView";

export function Toggle({ on, onClick, children, color, count, title }: { on: boolean; onClick: () => void; children: React.ReactNode; color?: string; count?: number; title?: string }) {
  return (
    <button type="button" onClick={onClick} title={title} aria-pressed={on}
      className={cn("flex w-full items-center gap-1.5 rounded px-1.5 py-[3px] text-left text-[12px] touchui:min-h-11 touchui:gap-3 touchui:px-2 touchui:text-[15px]", on ? "text-zinc-200 hover:bg-zinc-800/70" : "text-zinc-600 hover:bg-zinc-900")}>
      <span className="size-2.5 shrink-0 rounded-sm border touchui:size-4" style={{ background: on ? color ?? "#a1a1aa" : "transparent", borderColor: color ?? "#71717a" }} />
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {count !== undefined && <span className="font-mono text-[10px] text-zinc-500 touchui:text-[12px]">{count}</span>}
    </button>
  );
}

export function PanelTitle({ children }: { children: React.ReactNode }) {
  return <div className="mb-1 mt-3 px-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 first:mt-0 touchui:mt-5 touchui:text-[12px]">{children}</div>;
}

function toggleIn<T>(set: Set<T>, v: T, setter: (s: Set<T>) => void) {
  const n = new Set(set);
  if (n.has(v)) n.delete(v);
  else n.add(v);
  setter(n);
}

/** Record-type, claim-status and relationship filters (desktop left panel / mobile filter sheet). */
export function FilterControls({ idx, f, showBoardOptions = true }: { idx: CaseIndex; f: BoardFilters; showBoardOptions?: boolean }) {
  const entities = idx.bundle.entities;
  const typeCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of entities) m.set(e.type, (m.get(e.type) ?? 0) + 1);
    return m;
  }, [entities]);
  const statusCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of entities) if (e.type === "CLAIM") m.set(e.status ?? "UNKNOWN", (m.get(e.status ?? "UNKNOWN") ?? 0) + 1);
    return m;
  }, [entities]);
  const relGroups = useMemo(() => {
    const m = new Map<string, Map<string, number>>();
    for (const e of idx.allEdges) {
      if (e.category === "RESEARCHER") continue;
      if (!m.has(e.category)) m.set(e.category, new Map());
      m.get(e.category)!.set(e.rel, (m.get(e.category)!.get(e.rel) ?? 0) + 1);
    }
    return m;
  }, [idx.allEdges]);
  const pageCount = entities.filter((e) => e.subtype === "NEWSPAPER_PAGE").length;

  return (
    <>
      <PanelTitle>Record types</PanelTitle>
      {TYPE_ORDER.map((t) => (
        <Toggle key={t} on={f.types.has(t)} color={TYPE_META[t].color} count={typeCounts.get(t) ?? 0} onClick={() => toggleIn(f.types, t, f.setTypes)}>{TYPE_META[t].plural}</Toggle>
      ))}
      <Toggle on={f.showPages} onClick={() => f.setShowPages(!f.showPages)} count={pageCount} color="#a16207" title="Newspaper page-level SRC records (article containers)">incl. newspaper page scans</Toggle>
      <div className="mt-1 flex gap-3 px-1.5 text-[10px] touchui:text-[14px]">
        <button type="button" className="text-zinc-500 underline touchui:min-h-11" onClick={() => f.setTypes(new Set(TYPE_ORDER))}>all</button>
        <button type="button" className="text-zinc-500 underline touchui:min-h-11" onClick={() => f.setTypes(new Set())}>none</button>
      </div>

      <PanelTitle>Claim status</PanelTitle>
      {CLAIM_STATUSES.map((s) => (
        <button key={s} type="button" aria-pressed={f.statuses.has(s)} onClick={() => toggleIn(f.statuses, s, f.setStatuses)} className={cn("flex w-full items-center gap-1.5 rounded px-1.5 py-[3px] touchui:min-h-11", !f.statuses.has(s) && "opacity-35")}>
          <StatusBadge status={s} className="touchui:text-[12px]" /><span className="ml-auto font-mono text-[10px] text-zinc-500 touchui:text-[12px]">{statusCounts.get(s) ?? 0}</span>
        </button>
      ))}

      <PanelTitle>Relationships</PanelTitle>
      {(["SOURCED", "REGISTER", "LEAD"] as const).map((cat) => relGroups.get(cat) && (
        <div key={cat} className="mb-1.5">
          <div className="flex items-center gap-1.5 px-1.5 text-[10px] text-zinc-500 touchui:py-1 touchui:text-[13px]">
            <svg width="18" height="6" aria-hidden><line x1="0" y1="3" x2="18" y2="3" stroke={CATEGORY_META[cat].stroke} strokeWidth={CATEGORY_META[cat].width + 0.4} strokeDasharray={CATEGORY_META[cat].dash} /></svg>
            {CATEGORY_META[cat].label} <span className="text-zinc-600">— {CATEGORY_META[cat].description}</span>
          </div>
          {[...relGroups.get(cat)!.entries()].sort((a, b) => b[1] - a[1]).map(([rel, n]) => (
            <Toggle key={rel} on={!f.hiddenRels.has(rel)} count={n} color={CATEGORY_META[cat].stroke} onClick={() => toggleIn(f.hiddenRels, rel, f.setHiddenRels)}>{REL_LABEL[rel] ?? rel}</Toggle>
          ))}
        </div>
      ))}
      <div className="flex items-center gap-1.5 px-1.5 text-[10px] text-amber-400 touchui:text-[13px]">
        <svg width="18" height="6" aria-hidden><line x1="0" y1="3" x2="18" y2="3" stroke="#f59e0b" strokeWidth="2" strokeDasharray="5 3" /></svg>
        Researcher links
      </div>
      <Toggle on={f.showResearcher} color="#f59e0b" count={idx.bundle.researcherLinks.length} onClick={() => f.setShowResearcher(!f.showResearcher)}>Researcher connection — not evidence</Toggle>

      {showBoardOptions && (
        <>
          <PanelTitle>Board</PanelTitle>
          <Toggle on={f.hideIsolated} onClick={() => f.setHideIsolated(!f.hideIsolated)}>Hide records with no visible links</Toggle>
        </>
      )}
    </>
  );
}
