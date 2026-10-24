"use client";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Search, Maximize, Inbox as InboxIcon, Network, TriangleAlert, LayoutDashboard, CalendarClock, FileText, GitCompareArrows, PanelLeftClose, PanelLeftOpen, PanelBottom } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Asset, CaseBundle, InboxDecision, InboxItem } from "@/lib/types";
import { TERMINAL_DECISIONS } from "./constants";
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
import { Overview, type OverviewTarget } from "./Overview";
import { ContradictionsList, SourcesList } from "./Lists";
import { MobileTimeline } from "./MobileTimeline";
import { ViewPicker } from "./ViewPicker";
import { PrefsProvider, usePrefs } from "./prefs";

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

type DesktopView = "overview" | "board" | "timeline" | "sources" | "contradictions" | "inbox";
const DESKTOP_TABS: { key: DesktopView; label: string; icon: typeof Network }[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "board", label: "Board", icon: Network },
  { key: "timeline", label: "Timeline", icon: CalendarClock },
  { key: "sources", label: "Sources", icon: FileText },
  { key: "contradictions", label: "Conflicts", icon: GitCompareArrows },
  { key: "inbox", label: "Inbox", icon: InboxIcon },
];

function DesktopWorkspace({ idx, onDecide, onAddLink }: {
  idx: CaseIndex;
  onDecide: (item: InboxItem, d: InboxDecision, note: string) => Promise<void>;
  onAddLink: (fromId: string) => void;
}) {
  const bundle = idx.bundle;
  const prefs = usePrefs();
  // Inspector history: back/forward through the records you opened.
  const [hist, setHist] = useState<{ stack: string[]; pos: number }>({ stack: [], pos: -1 });
  const selectedId = hist.pos >= 0 ? hist.stack[hist.pos] : null;
  const defaultFocus = useMemo(() => {
    let best: string | null = null, n = -1;
    for (const e of bundle.entities) if (e.type === "PERSON") {
      const c = (idx.out.get(e.id)?.length ?? 0) + (idx.inc.get(e.id)?.length ?? 0);
      if (c > n) { n = c; best = e.id; }
    }
    return best;
  }, [bundle, idx]);
  const [focusId, setFocusId] = useState<string | null>(defaultFocus);
  const [wholeBoard, setWholeBoard] = useState(false);
  const [view, setView] = useState<DesktopView>("overview");
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
    setImage(null);
    if (id) setHist((h) => (h.stack[h.pos] === id ? h : { stack: [...h.stack.slice(0, h.pos + 1), id], pos: h.pos + 1 }));
    if (opts?.focus && id) {
      setFocusId(id);
      setWholeBoard(false);
    }
  }, []);

  const api: BoardApi = useMemo(() => ({
    idx, selectedId, select, isMobile: false,
    openSource: (req) => setSourceReq(req),
    addResearcherLink: onAddLink,
    openImage: (assets, index) => setImage({ assets, index }),
    focusRelationships: (id) => { select(id, { focus: true }); setView("board"); },
    history: {
      canBack: hist.pos > 0, canForward: hist.pos < hist.stack.length - 1,
      back: () => setHist((h) => ({ ...h, pos: Math.max(0, h.pos - 1) })),
      forward: () => setHist((h) => ({ ...h, pos: Math.min(h.stack.length - 1, h.pos + 1) })),
    },
  }), [idx, selectedId, select, onAddLink, hist]);

  const { boardEntities, boardEdges, highlight } = useBoardView(idx, filters, wholeBoard ? null : focusId, selectedId);
  const awaiting = bundle.inbox.filter((i) => !TERMINAL_DECISIONS.has(i.status)).length;
  const focusEntity = focusId ? idx.byId.get(focusId) : null;
  const go = (t: OverviewTarget) => setView(t);

  return (
    <BoardContext.Provider value={api}>
      <div className="flex h-screen flex-col bg-zinc-950 text-zinc-200">
        <header className="flex items-center gap-4 border-b border-zinc-800 px-4 py-2">
          <button type="button" onClick={() => setView("overview")} className="shrink-0 text-left">
            <div className="text-[14px] font-semibold tracking-tight text-zinc-100">{bundle.meta.config.title}</div>
            <div className="text-[10px] text-zinc-500">Research board{bundle.meta.readOnly && " · read-only"}</div>
          </button>
          <nav className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto" aria-label="Main">
            {DESKTOP_TABS.map((t) => (
              <button key={t.key} type="button" onClick={() => setView(t.key)} aria-current={view === t.key ? "page" : undefined}
                className={cn("flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px]", view === t.key ? "bg-zinc-800 text-zinc-50" : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200")}>
                <t.icon className="size-4" /> {t.label}
                {t.key === "inbox" && awaiting > 0 && <span className="rounded-full bg-zinc-700 px-1.5 font-mono text-[10px] text-zinc-200">{awaiting}</span>}
              </button>
            ))}
          </nav>
          {(bundle.meta.validation.errors > 0 || bundle.meta.validation.warnings > 0) && (
            <button type="button" onClick={() => setWarningsOpen(!warningsOpen)} className="flex shrink-0 items-center gap-1 rounded border border-amber-800 px-2 py-1 text-[11px] text-amber-300">
              <TriangleAlert className="size-3" /> {bundle.meta.validation.errors} error(s) · {bundle.meta.validation.warnings} warning(s)
            </button>
          )}
          <button type="button" onClick={() => setSearchOpen(true)} className="flex w-56 shrink-0 items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-[12px] text-zinc-500 hover:text-zinc-300">
            <Search className="size-3.5" /> Search the case… <kbd className="ml-auto rounded bg-zinc-800 px-1 font-mono text-[10px]">⌘K</kbd>
          </button>
        </header>
        {warningsOpen && (
          <div className="max-h-40 overflow-y-auto border-b border-amber-900/60 bg-amber-950/20 px-4 py-2 font-mono text-[11px] text-amber-200">
            {bundle.meta.warnings.map((w) => <div key={w}>! {w}</div>)}
          </div>
        )}

        <div className="flex min-h-0 flex-1">
          {view === "board" && prefs.showFilters && (
            <nav className="w-60 shrink-0 overflow-y-auto border-r border-zinc-800 p-2">
              <div className="mb-2 flex items-center justify-between px-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Customize view</span>
                <button type="button" onClick={() => prefs.setLayout({ showFilters: false })} className="rounded p-1 text-zinc-500 hover:text-zinc-200" aria-label="Hide filters"><PanelLeftClose className="size-4" /></button>
              </div>
              <FilterControls idx={idx} f={filters} />
              <p className="mt-3 px-1.5 text-[10px] leading-snug text-zinc-600">
                Links come only from register rows. Appearing in the same article never creates a link. No relationship implies guilt.
              </p>
            </nav>
          )}

          <main className="flex min-w-0 flex-1 flex-col">
            {view === "board" && (
              <>
                <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 px-3 py-2">
                  <ViewPicker f={filters} customizing={prefs.showFilters} onCustomize={() => prefs.setLayout({ showFilters: !prefs.showFilters })} />
                  <div className="ml-auto flex items-center gap-1">
                    <div className="flex rounded-md border border-zinc-800 p-0.5 text-[12px]">
                      <button type="button" onClick={() => setWholeBoard(false)} disabled={!focusEntity} className={cn("rounded px-2 py-0.5", !wholeBoard ? "bg-zinc-800 text-zinc-50" : "text-zinc-400")}>Focused</button>
                      <button type="button" onClick={() => setWholeBoard(true)} className={cn("rounded px-2 py-0.5", wholeBoard ? "bg-zinc-800 text-zinc-50" : "text-zinc-400")}>Whole board</button>
                    </div>
                    <button type="button" title="Fit to view" onClick={() => setFitSignal((n) => n + 1)} className="rounded p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"><Maximize className="size-4" /></button>
                    <button type="button" title={prefs.showTimelineStrip ? "Hide timeline strip" : "Show timeline strip"} onClick={() => prefs.setLayout({ showTimelineStrip: !prefs.showTimelineStrip })}
                      className={cn("rounded p-1.5 hover:bg-zinc-800", prefs.showTimelineStrip ? "text-zinc-100" : "text-zinc-500")}><PanelBottom className="size-4" /></button>
                  </div>
                </div>
                <div className="relative min-h-0 flex-1">
                  {boardEntities.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-[13px] text-zinc-500">No records match this view. Try another view above.</div>
                  ) : (
                    <CaseBoard entities={boardEntities} edges={boardEdges} selectedId={selectedId} focusId={wholeBoard ? null : focusId} highlight={highlight} fitSignal={fitSignal} onSelect={(id) => (id ? select(id) : undefined)} />
                  )}
                  <div className="pointer-events-none absolute left-3 top-3 max-w-md">
                    {!wholeBoard && focusEntity ? (
                      <div className="pointer-events-auto rounded-lg border border-zinc-700 bg-zinc-950/90 px-3 py-2 text-[12px] text-zinc-300 shadow">
                        Showing <b className="text-zinc-50">{focusEntity.label}</b> and the {boardEntities.length - 1} records directly connected to it.
                        <div className="mt-1 text-[11px] text-zinc-500">Click a record to inspect it · “Focus relationships” in the inspector re-centres the board.</div>
                      </div>
                    ) : (
                      <div className="pointer-events-auto rounded-lg border border-zinc-800 bg-zinc-950/90 px-3 py-1.5 text-[11px] text-zinc-400">
                        Whole board: {boardEntities.length} records, {boardEdges.length} links. Scroll to zoom, drag to pan, click a record to inspect it.
                      </div>
                    )}
                  </div>
                  {!prefs.showFilters && (
                    <button type="button" onClick={() => prefs.setLayout({ showFilters: true })} className="absolute bottom-3 left-3 flex items-center gap-1 rounded border border-zinc-700 bg-zinc-900/90 px-2 py-1 text-[11px] text-zinc-300"><PanelLeftOpen className="size-3.5" /> Filters</button>
                  )}
                </div>
                {prefs.showTimelineStrip && <div className="h-[190px] shrink-0 border-t border-zinc-800"><Timeline /></div>}
              </>
            )}
            {view === "overview" && <div className="min-h-0 flex-1 overflow-y-auto"><Overview go={go} /></div>}
            {view === "timeline" && <div className="min-h-0 flex-1 overflow-y-auto"><div className="mx-auto max-w-3xl"><MobileTimeline /></div></div>}
            {view === "sources" && <div className="min-h-0 flex-1"><SourcesList onOpen={(id) => { select(id); setSourceReq({ sourceId: id }); }} /></div>}
            {view === "contradictions" && <div className="min-h-0 flex-1 overflow-y-auto"><ContradictionsList /></div>}
            {view === "inbox" && <div className="min-h-0 flex-1"><Inbox items={bundle.inbox} onDecide={onDecide} /></div>}
          </main>

          <aside className="w-[400px] shrink-0 overflow-y-auto border-l border-zinc-800 bg-zinc-950">
            <Inspector />
          </aside>
        </div>
      </div>

      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} entities={bundle.entities} onPick={(id) => select(id, { focus: view === "board" })} />
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
    <PrefsProvider>
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
    </PrefsProvider>
  );
}
