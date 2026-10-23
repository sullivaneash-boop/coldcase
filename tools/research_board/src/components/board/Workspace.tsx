"use client";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Search, Maximize, LocateOff, Inbox as InboxIcon, Network, TriangleAlert, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Asset, CaseBundle, InboxDecision, InboxItem } from "@/lib/types";
import { REL_LABEL, TERMINAL_DECISIONS } from "./constants";
import { BoardContext, type BoardApi, type SourceViewRequest } from "./context";
import { buildIndex, type CaseIndex } from "./graph";
import { CaseBoard } from "./CaseBoard";
import { Inspector } from "./Inspector";
import { Timeline } from "./Timeline";
import { SearchDialog } from "./SearchDialog";
import { SourceViewer } from "./SourceViewer";
import { Inbox } from "./Inbox";
import { ResearcherLinkDialog } from "./ResearcherLinkDialog";
import { ImageViewer } from "./ImageViewer";
import { FilterControls } from "./FilterControls";
import { MobileShell } from "./MobileShell";
import { useBoardFilters, useBoardView } from "./useBoardView";

// Below this width the app switches to the phone/tablet layout (bottom tabs + detail stack).
const MOBILE_QUERY = "(max-width: 1023px)";

function useIsMobile(): boolean | null {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(MOBILE_QUERY);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(MOBILE_QUERY).matches,
    () => null,
  );
}

function DesktopWorkspace({ idx, onDecide, onAddLink }: {
  idx: CaseIndex;
  onDecide: (item: InboxItem, d: InboxDecision, note: string) => Promise<void>;
  onAddLink: (fromId: string) => void;
}) {
  const bundle = idx.bundle;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [view, setView] = useState<"board" | "inbox">("board");
  const filters = useBoardFilters();
  const [fitSignal, setFitSignal] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [sourceReq, setSourceReq] = useState<SourceViewRequest | null>(null);
  const [image, setImage] = useState<{ assets: Asset[]; index: number } | null>(null);
  const [warningsOpen, setWarningsOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const select = useCallback((id: string | null, opts?: { focus?: boolean }) => {
    setSelectedId(id);
    setImage(null);
    if (opts?.focus && id) {
      setFocusId(id);
      setView("board");
    }
  }, []);

  const api: BoardApi = useMemo(() => ({
    idx, selectedId, select, isMobile: false,
    openSource: (req) => setSourceReq(req),
    addResearcherLink: onAddLink,
    openImage: (assets, index) => setImage({ assets, index }),
    focusRelationships: (id) => select(id, { focus: true }),
  }), [idx, selectedId, select, onAddLink]);

  const { boardEntities, boardEdges, highlight } = useBoardView(idx, filters, focusId, selectedId);

  const typeCount = (t: string) => bundle.entities.filter((e) => e.type === t).length;
  const awaiting = bundle.inbox.filter((i) => !TERMINAL_DECISIONS.has(i.status)).length;
  const openLeads = bundle.inbox.filter((i) => i.originalIssueType === "LEAD" && !TERMINAL_DECISIONS.has(i.status)).length;
  const openContradictions = bundle.entities.filter((e) => e.type === "CONTRADICTION" && e.status !== "RESOLVED").length;
  const statusSummary = (() => {
    const m = new Map<string, number>();
    for (const e of bundle.entities) if (e.type === "CLAIM") m.set(e.status ?? "UNKNOWN", (m.get(e.status ?? "UNKNOWN") ?? 0) + 1);
    return [...m.entries()].map(([k, v]) => `${k} ${v}`).join(" · ");
  })();
  const sourceBreakdown = (() => {
    const m = new Map<string, number>();
    for (const e of bundle.entities) if (e.type === "SOURCE") m.set(e.subtype ?? "?", (m.get(e.subtype ?? "?") ?? 0) + 1);
    return [...m.entries()].map(([k, v]) => `${v} ${k.toLowerCase().replace(/_/g, " ")}`).join(", ");
  })();

  const stats: { label: string; value: number; title: string; onClick?: () => void }[] = [
    { label: "Sources", value: typeCount("SOURCE"), title: sourceBreakdown },
    { label: "People", value: typeCount("PERSON"), title: "Provisional PER records. Inclusion implies no role or culpability." },
    { label: "Events", value: typeCount("EVENT"), title: "EVT records" },
    { label: "Evidence", value: typeCount("EVIDENCE"), title: "Catalog of reported items — not possession" },
    { label: "Claims", value: typeCount("CLAIM"), title: statusSummary },
    { label: "Contradictions", value: typeCount("CONTRADICTION"), title: `${openContradictions} not resolved` },
    { label: "Open questions", value: openLeads, title: `Undecided LEAD- items from batch lead lists. 01_MASTER_CASE/research_questions holds ${bundle.meta.openQuestionFiles} file(s).`, onClick: () => setView("inbox") },
    { label: "Awaiting review", value: awaiting, title: "Discovery Inbox items without an accept/merge/ignore decision", onClick: () => setView("inbox") },
  ];

  return (
    <BoardContext.Provider value={api}>
      <div className="flex h-screen flex-col bg-zinc-950 text-zinc-200">
        <header className="flex items-center gap-3 border-b border-zinc-800 px-3 py-1.5">
          <div className="shrink-0">
            <div className="text-[13px] font-semibold tracking-tight text-zinc-100">Levi Frady case — research board</div>
            <div className="text-[10px] text-zinc-500">Index of the canonical archive · synced {bundle.meta.syncedAt?.replace("T", " ").slice(0, 16)} UTC</div>
          </div>
          <div className="flex min-w-0 flex-1 items-stretch gap-1 overflow-x-auto">
            {stats.map((s) => (
              <button key={s.label} type="button" title={s.title} onClick={s.onClick} className={cn("shrink-0 rounded border border-zinc-800 px-2 py-0.5 text-left", s.onClick && "hover:border-zinc-600")}>
                <div className="font-mono text-[14px] leading-tight text-zinc-100">{s.value}</div>
                <div className="text-[9px] uppercase tracking-wider text-zinc-500">{s.label}</div>
              </button>
            ))}
          </div>
          {bundle.meta.warnings.length > 0 && (
            <button type="button" onClick={() => setWarningsOpen(!warningsOpen)} className="flex shrink-0 items-center gap-1 rounded border border-amber-800 px-2 py-1 text-[11px] text-amber-300">
              <TriangleAlert className="size-3" /> {bundle.meta.warnings.length} sync warning{bundle.meta.warnings.length > 1 && "s"}
            </button>
          )}
          <div className="flex shrink-0 rounded border border-zinc-800 p-0.5">
            <button type="button" onClick={() => setView("board")} className={cn("flex items-center gap-1 rounded px-2 py-1 text-[12px]", view === "board" ? "bg-zinc-800 text-zinc-100" : "text-zinc-400")}><Network className="size-3.5" />Board</button>
            <button type="button" onClick={() => setView("inbox")} className={cn("flex items-center gap-1 rounded px-2 py-1 text-[12px]", view === "inbox" ? "bg-zinc-800 text-zinc-100" : "text-zinc-400")}><InboxIcon className="size-3.5" />Inbox <span className="font-mono text-[10px] text-zinc-500">{awaiting}</span></button>
          </div>
          <button type="button" onClick={() => setSearchOpen(true)} className="flex shrink-0 items-center gap-2 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[12px] text-zinc-400 hover:text-zinc-200">
            <Search className="size-3.5" /> Search <kbd className="rounded bg-zinc-800 px-1 font-mono text-[10px]">⌘K</kbd>
          </button>
        </header>
        {warningsOpen && (
          <div className="max-h-40 overflow-y-auto border-b border-amber-900/60 bg-amber-950/20 px-4 py-2 font-mono text-[11px] text-amber-200">
            {bundle.meta.warnings.map((w) => <div key={w}>! {w}</div>)}
          </div>
        )}

        <div className="flex min-h-0 flex-1">
          <nav className="w-56 shrink-0 overflow-y-auto border-r border-zinc-800 p-2">
            <FilterControls idx={idx} f={filters} />
            <div className="mt-2 flex flex-col gap-1">
              <button type="button" onClick={() => setFitSignal((n) => n + 1)} className="flex items-center gap-1.5 rounded border border-zinc-800 px-2 py-1 text-[12px] text-zinc-300 hover:bg-zinc-900"><Maximize className="size-3.5" />Fit to view</button>
              <button type="button" disabled={!focusId} onClick={() => setFocusId(null)} className="flex items-center gap-1.5 rounded border border-zinc-800 px-2 py-1 text-[12px] text-zinc-300 hover:bg-zinc-900 disabled:opacity-40"><LocateOff className="size-3.5" />Clear focus</button>
            </div>
            <p className="mt-3 px-1.5 text-[10px] leading-snug text-zinc-600">
              Links come only from register rows. Appearing in the same article never creates a link. No relationship implies guilt.
            </p>
          </nav>

          <main className="flex min-w-0 flex-1 flex-col">
            <div className="relative min-h-0 flex-1">
              {view === "board" ? (
                <>
                  {boardEntities.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-[12px] text-zinc-500">No records match the current filters.</div>
                  ) : (
                    <CaseBoard entities={boardEntities} edges={boardEdges} selectedId={selectedId} focusId={focusId} highlight={highlight} fitSignal={fitSignal} onSelect={(id) => select(id)} />
                  )}
                  <div className="pointer-events-none absolute left-2 top-2 flex flex-col gap-1">
                    {focusId && idx.byId.get(focusId) && (
                      <div className="pointer-events-auto flex items-center gap-2 rounded border border-amber-700/60 bg-zinc-950/90 px-2 py-1 text-[11px] text-amber-200">
                        Focus: {idx.byId.get(focusId)!.label.slice(0, 70)} · {boardEntities.length - 1} linked record(s)
                        <button type="button" onClick={() => setFocusId(null)} className="text-zinc-400 underline">clear</button>
                      </div>
                    )}
                    <div className="rounded bg-zinc-950/80 px-2 py-0.5 text-[10px] text-zinc-500">
                      {boardEntities.length} records · {boardEdges.length} links shown {filters.hiddenRels.size > 0 && <>· hidden: {[...filters.hiddenRels].map((r) => REL_LABEL[r] ?? r).join(", ")}</>}
                    </div>
                  </div>
                  {selectedId && !focusId && (
                    <button type="button" onClick={() => select(selectedId, { focus: true })} className="absolute right-2 top-2 flex items-center gap-1 rounded border border-zinc-700 bg-zinc-900/90 px-2 py-1 text-[11px] text-zinc-300 hover:bg-zinc-800">
                      {highlight ? <Eye className="size-3" /> : <EyeOff className="size-3" />} Focus on selection
                    </button>
                  )}
                </>
              ) : (
                <Inbox items={bundle.inbox} onDecide={onDecide} />
              )}
            </div>
            <div className="h-[200px] shrink-0 border-t border-zinc-800">
              <Timeline />
            </div>
          </main>

          <aside className="w-[400px] shrink-0 overflow-y-auto border-l border-zinc-800 bg-zinc-950">
            <Inspector />
          </aside>
        </div>
      </div>

      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} entities={bundle.entities} onPick={(id) => select(id, { focus: true })} />
      <SourceViewer req={sourceReq} onClose={() => setSourceReq(null)} />
      {image && <ImageViewer assets={image.assets} index={image.index} onIndex={(i) => setImage({ ...image, index: i })} onClose={() => setImage(null)} />}
    </BoardContext.Provider>
  );
}

export function Workspace({ initial }: { initial: CaseBundle }) {
  const [bundle, setBundle] = useState(initial);
  const idx = useMemo(() => buildIndex(bundle), [bundle]);
  const [linkFrom, setLinkFrom] = useState<string | null>(null);
  const isMobile = useIsMobile();

  // Touch-sized styling also reaches dialogs portalled to <body>.
  useEffect(() => {
    if (isMobile) document.documentElement.setAttribute("data-touch", "");
    else document.documentElement.removeAttribute("data-touch");
  }, [isMobile]);

  const decide = useCallback(async (item: InboxItem, decision: InboxDecision, note: string) => {
    const res = await fetch("/api/inbox", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ itemId: item.id, decision, note }) });
    if (!res.ok) return alert((await res.json()).error ?? "Failed to record decision");
    const r = await res.json();
    setBundle((b) => ({ ...b, inbox: b.inbox.map((i) => (i.id === item.id ? { ...i, status: r.status, decisionNote: r.decisionNote, decidedAt: r.decidedAt, decidedBy: r.decidedBy } : i)) }));
  }, []);
  const addLink = useCallback((fromId: string) => setLinkFrom(fromId), []);

  if (isMobile === null) return <div className="h-[100dvh] bg-zinc-950" />;

  const linkApi: BoardApi = {
    idx, selectedId: null, isMobile, select: () => {}, openSource: () => {}, addResearcherLink: addLink,
    openImage: () => {}, focusRelationships: () => {},
  };

  return (
    <>
      {isMobile
        ? <MobileShell idx={idx} onDecide={decide} onAddLink={addLink} />
        : <DesktopWorkspace idx={idx} onDecide={decide} onAddLink={addLink} />}
      <BoardContext.Provider value={linkApi}>
        <ResearcherLinkDialog
          key={linkFrom ?? "none"}
          fromId={linkFrom}
          onClose={() => setLinkFrom(null)}
          onCreated={(l) => setBundle((b) => ({ ...b, researcherLinks: [...b.researcherLinks, l] }))}
        />
      </BoardContext.Provider>
    </>
  );
}
