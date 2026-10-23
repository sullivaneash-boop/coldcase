"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, X, Network, CalendarClock, Search as SearchIcon, FileText, Menu, SlidersHorizontal, Maximize,
  Inbox as InboxIcon, GitCompareArrows, Gauge, ShieldCheck, ChevronRight, TriangleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Asset, InboxDecision, InboxItem } from "@/lib/types";
import { TERMINAL_DECISIONS, TYPE_META, TYPE_ORDER } from "./constants";
import { BoardContext, useBoard, type BoardApi, type SourceViewRequest } from "./context";
import type { CaseIndex } from "./graph";
import { CaseBoard } from "./CaseBoard";
import { Inspector } from "./Inspector";
import { SourceReader } from "./SourceViewer";
import { ImageViewer } from "./ImageViewer";
import { MobileTimeline } from "./MobileTimeline";
import { Inbox } from "./Inbox";
import { FilterControls } from "./FilterControls";
import { useBoardFilters, useBoardView } from "./useBoardView";
import { useEntitySearch } from "./SearchDialog";
import { StatusBadge, Tag, TypeIcon } from "./bits";
import { ResearchStatus } from "./ResearchStatus";

type Tab = "board" | "timeline" | "search" | "sources" | "more";
type Route =
  | { kind: "entity"; id: string }
  | { kind: "source"; req: SourceViewRequest }
  | { kind: "image"; assets: Asset[]; index: number }
  | { kind: "inbox" }
  | { kind: "contradictions" }
  | { kind: "status" }
  | { kind: "about" };

const TABS: { key: Tab; label: string; icon: typeof Network }[] = [
  { key: "board", label: "Board", icon: Network },
  { key: "timeline", label: "Timeline", icon: CalendarClock },
  { key: "search", label: "Search", icon: SearchIcon },
  { key: "sources", label: "Sources", icon: FileText },
  { key: "more", label: "More", icon: Menu },
];

function routeTitle(r: Route, idx: CaseIndex) {
  if (r.kind === "entity") return TYPE_META[idx.byId.get(r.id)?.type ?? "CLAIM"].label;
  if (r.kind === "source") return "Source";
  if (r.kind === "image") return "Image";
  return { inbox: "Discovery Inbox", contradictions: "Contradictions", status: "Case status", about: "Research rules" }[r.kind];
}

// ---------------------------------------------------------------- tab screens
function TabHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <header className="pt-safe shrink-0 border-b border-zinc-800 bg-zinc-950">
      <div className="flex min-h-12 items-center gap-2 px-4">
        <h1 className="min-w-0 flex-1 truncate text-[17px] font-semibold text-zinc-50">{title}</h1>
        {children}
      </div>
    </header>
  );
}

function IconButton({ onClick, label, children, active }: { onClick: () => void; label: string; children: React.ReactNode; active?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label}
      className={cn("flex size-11 shrink-0 items-center justify-center rounded-lg text-zinc-300 active:bg-zinc-800", active && "bg-zinc-800 text-zinc-50")}>
      {children}
    </button>
  );
}

function SearchScreen({ onPick }: { onPick: (id: string) => void }) {
  const { idx } = useBoard();
  const fuse = useEntitySearch(idx.bundle.entities);
  const [q, setQ] = useState("");
  const [type, setType] = useState<string>("ALL");
  const [recent, setRecent] = useState<string[]>([]);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    try { setRecent(JSON.parse(localStorage.getItem("rb-recent-searches") ?? "[]")); } catch { /* storage unavailable */ }
    input.current?.focus();
  }, []);
  const remember = (term: string) => {
    const next = [term, ...recent.filter((r) => r !== term)].slice(0, 8);
    setRecent(next);
    try { localStorage.setItem("rb-recent-searches", JSON.stringify(next)); } catch { /* storage unavailable */ }
  };
  const results = q.trim().length >= 2 ? fuse.search(q.trim(), { limit: 80 }).map((r) => r.item).filter((e) => type === "ALL" || e.type === type) : [];
  return (
    <div className="flex h-full flex-col">
      <TabHeader title="Search" />
      <div className="shrink-0 border-b border-zinc-800 bg-zinc-950 px-4 pb-2 pt-2">
        <div className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3">
          <SearchIcon className="size-5 shrink-0 text-zinc-500" />
          <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} type="search" enterKeyHint="search" autoCapitalize="none" autoCorrect="off"
            placeholder="People, claims, events, places, sources…" className="h-12 min-w-0 flex-1 bg-transparent text-[16px] text-zinc-100 outline-none placeholder:text-zinc-500" />
          {q && <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="flex size-11 items-center justify-center text-zinc-400"><X className="size-5" /></button>}
        </div>
        <div className="mt-2 flex gap-2 overflow-x-auto">
          {["ALL", ...TYPE_ORDER].map((t) => (
            <button key={t} type="button" onClick={() => setType(t)} className={cn("min-h-11 shrink-0 rounded-full border px-3 text-[13px]", type === t ? "border-zinc-300 bg-zinc-100 text-zinc-900" : "border-zinc-700 text-zinc-300")}>
              {t === "ALL" ? "All" : TYPE_META[t as keyof typeof TYPE_META].plural}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-6">
      {q.trim().length < 2 && recent.length > 0 && (
        <div className="px-4 pt-3">
          <div className="mb-1 text-[12px] uppercase tracking-wider text-zinc-500">Recent searches</div>
          {recent.map((r) => (
            <button key={r} type="button" onClick={() => setQ(r)} className="flex min-h-11 w-full items-center gap-3 border-b border-zinc-900 text-left text-[15px] text-zinc-300">
              <SearchIcon className="size-4 text-zinc-600" /> {r}
            </button>
          ))}
        </div>
      )}
      {q.trim().length >= 2 && results.length === 0 && <p className="px-4 py-6 text-[15px] text-zinc-500">No indexed records match.</p>}
      <ul>
        {results.map((e) => (
          <li key={e.id}>
            <button type="button" onClick={() => { remember(q.trim()); onPick(e.id); }} className="flex min-h-14 w-full items-start gap-3 border-b border-zinc-900 px-4 py-3 text-left active:bg-zinc-900">
              <TypeIcon type={e.type} className="mt-1 size-4" />
              <div className="min-w-0 flex-1">
                <div className="wrap-anywhere line-clamp-3 text-[15px] leading-snug text-zinc-100">{e.label}</div>
                <div className="mt-0.5 truncate text-[12px] text-zinc-500">{TYPE_META[e.type].label} · {e.subtitle}</div>
              </div>
              {e.type === "CLAIM" && <StatusBadge status={e.status} className="mt-1" />}
            </button>
          </li>
        ))}
      </ul>
      </div>
    </div>
  );
}

function SourcesScreen({ onOpen }: { onOpen: (id: string) => void }) {
  const { idx } = useBoard();
  const [group, setGroup] = useState("ALL");
  const [limit, setLimit] = useState(40);
  const sources = idx.bundle.entities.filter((e) => e.type === "SOURCE");
  const groups = [...new Set(sources.map((s) => s.subtype ?? "OTHER"))];
  const list = sources.filter((s) => group === "ALL" || s.subtype === group)
    .sort((a, b) => (a.row.publication_date || "9999").localeCompare(b.row.publication_date || "9999") || a.label.localeCompare(b.label));
  return (
    <div className="flex h-full flex-col">
      <TabHeader title={`Sources · ${sources.length}`} />
      <div className="flex shrink-0 gap-2 overflow-x-auto border-b border-zinc-800 bg-zinc-950 px-4 py-2">
        {["ALL", ...groups].map((g) => (
          <button key={g} type="button" onClick={() => { setGroup(g); setLimit(40); }} className={cn("min-h-11 shrink-0 rounded-full border px-3.5 text-[14px]", group === g ? "border-zinc-300 bg-zinc-100 text-zinc-900" : "border-zinc-700 text-zinc-300")}>
            {g === "ALL" ? "All" : g.toLowerCase().replace(/_/g, " ")} <span className="font-mono text-[12px] opacity-70">{g === "ALL" ? sources.length : sources.filter((s) => s.subtype === g).length}</span>
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-6">
      <ul>
        {list.slice(0, limit).map((s) => {
          const claims = new Set((idx.claimSourcesBySource.get(s.id) ?? []).map((c) => c.claimId)).size;
          return (
            <li key={s.id}>
              <button type="button" onClick={() => onOpen(s.id)} className="flex min-h-16 w-full items-start gap-3 border-b border-zinc-900 px-4 py-3 text-left active:bg-zinc-900">
                <FileText className="mt-1 size-4 shrink-0 text-yellow-300" />
                <div className="min-w-0 flex-1">
                  <div className="wrap-anywhere text-[15px] font-medium leading-snug text-zinc-100">{s.label}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-zinc-500">
                    <span>{[s.row.publisher || s.row._article?.publication, s.row.publication_date].filter(Boolean).join(" · ") || "publication details not recorded"}</span>
                    <Tag>{s.row.reliability_class ? `class ${s.row.reliability_class}` : "class pending"}</Tag>
                    {claims > 0 && <span>{claims} claim{claims === 1 ? "" : "s"}</span>}
                  </div>
                </div>
                <ChevronRight className="mt-1 size-4 shrink-0 text-zinc-600" />
              </button>
            </li>
          );
        })}
      </ul>
      {list.length > limit && (
        <div className="px-4 pt-3"><button type="button" onClick={() => setLimit(limit + 40)} className="min-h-11 w-full rounded border border-zinc-700 text-[15px] text-zinc-300">Show more ({list.length - limit})</button></div>
      )}
      </div>
    </div>
  );
}

function MoreScreen({ push, awaiting, conCount }: { push: (r: Route) => void; awaiting: number; conCount: number }) {
  const { idx } = useBoard();
  const items: { label: string; detail: string; icon: typeof Gauge; route: Route; warn?: boolean }[] = [
    { label: "Discovery Inbox", detail: `${awaiting} awaiting a decision`, icon: InboxIcon, route: { kind: "inbox" } },
    { label: "Contradictions", detail: `${conCount} recorded`, icon: GitCompareArrows, route: { kind: "contradictions" } },
    { label: "Case status", detail: `Live counts · ${idx.bundle.meta.validation.errors} error(s), ${idx.bundle.meta.validation.warnings} warning(s)`, icon: Gauge, route: { kind: "status" }, warn: idx.bundle.meta.warnings.length > 0 },
    { label: "Research rules", detail: "How statuses and links should be read", icon: ShieldCheck, route: { kind: "about" } },
  ];
  return (
    <div>
      <TabHeader title={idx.bundle.meta.config.title} />
      <div className="px-4 pt-3"><ResearchStatus variant="card" /></div>
      <ul className="px-2 pt-2">
        {items.map((it) => (
          <li key={it.label}>
            <button type="button" onClick={() => push(it.route)} className="flex min-h-16 w-full items-center gap-3 rounded-lg px-3 text-left active:bg-zinc-900">
              <it.icon className={cn("size-5 shrink-0", it.warn ? "text-amber-400" : "text-zinc-400")} />
              <div className="min-w-0 flex-1">
                <div className="text-[16px] text-zinc-100">{it.label}</div>
                <div className="text-[13px] text-zinc-500">{it.detail}</div>
              </div>
              <ChevronRight className="size-5 text-zinc-600" />
            </button>
          </li>
        ))}
      </ul>
      <p className="px-5 pb-6 pt-4 text-[12px] text-zinc-600">Generated {idx.bundle.meta.syncedAt?.replace("T", " ").slice(0, 16)} UTC from the archive · data {idx.bundle.meta.dataVersion}{idx.bundle.meta.readOnly ? " · read-only deployment" : ""}.</p>
    </div>
  );
}

function ContradictionsScreen() {
  const { idx, select } = useBoard();
  const cons = idx.bundle.entities.filter((e) => e.type === "CONTRADICTION");
  return (
    <div className="flex flex-col gap-3 p-4">
      {cons.length === 0 && <p className="text-[15px] italic text-zinc-500">No contradiction records in the archive.</p>}
      {cons.map((c) => {
        const versions = idx.versionsByContradiction.get(c.id) ?? [];
        return (
          <button key={c.id} type="button" onClick={() => select(c.id)} className="rounded-lg border border-red-900/60 bg-zinc-900/80 p-3.5 text-left active:bg-zinc-800">
            <div className="flex items-center gap-2"><Tag className="border-red-700 text-red-300">{c.status}</Tag><span className="text-[12px] text-zinc-500">{versions.length} versions</span></div>
            <div className="wrap-anywhere mt-1.5 text-[16px] font-medium leading-snug text-zinc-50">{c.label}</div>
            <div className="mt-2 flex flex-col gap-1.5">
              {versions.slice(0, 4).map((v, i) => (
                <div key={v.id} className="rounded border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-[13px]">
                  <span className="text-[11px] uppercase tracking-wider text-zinc-500">Version {String.fromCharCode(65 + i)}{v.assertedStartAt && ` · ${v.assertedStartAt}`}</span>
                  <div className="wrap-anywhere text-zinc-200">“{v.versionText}”</div>
                </div>
              ))}
            </div>
            <div className="mt-2 text-[12px] text-zinc-500">No version is preferred automatically.</div>
          </button>
        );
      })}
    </div>
  );
}

function StatusScreen({ awaiting }: { awaiting: number }) {
  const { idx } = useBoard();
  const count = (t: string) => idx.bundle.entities.filter((e) => e.type === t).length;
  const leads = idx.bundle.inbox.filter((i) => i.originalIssueType === "LEAD" && !TERMINAL_DECISIONS.has(i.status)).length;
  const stats: [string, number][] = [
    ["Sources", count("SOURCE")], ["People", count("PERSON")], ["Events", count("EVENT")], ["Evidence", count("EVIDENCE")],
    ["Claims", count("CLAIM")], ["Contradictions", count("CONTRADICTION")], ["Open questions (leads)", leads], ["Awaiting review", awaiting],
  ];
  return (
    <div className="p-4">
      <div className="grid grid-cols-2 gap-2">
        {stats.map(([l, n]) => (
          <div key={l} className="rounded-lg border border-zinc-800 p-3">
            <div className="font-mono text-[24px] text-zinc-50">{n}</div>
            <div className="text-[12px] uppercase tracking-wider text-zinc-500">{l}</div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[13px] text-zinc-500">Counts come from the indexed archive registers. People are provisional records; inclusion implies no role or culpability.</p>
      {idx.bundle.meta.warnings.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-800 bg-amber-950/20 p-3">
          <div className="flex items-center gap-2 text-[14px] text-amber-300"><TriangleAlert className="size-4" />Validation issues</div>
          {idx.bundle.meta.warnings.map((w) => <p key={w} className="wrap-anywhere mt-2 font-mono text-[12px] text-amber-200">{w}</p>)}
        </div>
      )}
    </div>
  );
}

function AboutScreen() {
  const rules = [
    ["Claim statuses", "CONFIRMED and WELL_SUPPORTED require documented review. REPORTED means a source says it. ALLEGED is an unestablished allegation. Nothing is shown as fact beyond its status."],
    ["Relationships", "Links come only from register rows with a source or an explicit ID list. Two names in the same article are never linked automatically. No link implies guilt."],
    ["Researcher links", "Dashed amber: your own analytical connection. Not evidence and never corroboration."],
    ["Corroboration", "Repeated reports of the same underlying account are not independent. The provenance view flags shared origins."],
    ["Time", "Clock times are source-local readings. Approximate times show “~”. Date-only events show “time not stated”. Nothing is interpolated."],
    ["Images", "A person is linked to an image only when the source labels it with their name. No facial recognition."],
  ];
  return (
    <div className="flex flex-col gap-4 p-5">
      {rules.map(([h, t]) => (
        <div key={h}><h3 className="text-[15px] font-semibold text-zinc-100">{h}</h3><p className="mt-1 text-[15px] leading-relaxed text-zinc-400">{t}</p></div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- shell
export function MobileShell({ idx, onDecide, onAddLink }: {
  idx: CaseIndex;
  onDecide: (item: InboxItem, d: InboxDecision, note: string) => Promise<void>;
  onAddLink: (fromId: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("board");
  const [stack, setStack] = useState<Route[]>([]);
  const filters = useBoardFilters();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [fullBoard, setFullBoard] = useState(false);
  const [fitSignal, setFitSignal] = useState(0);

  // Default board focus: the record with the most register links (data-derived, not a judgement).
  const defaultFocus = useMemo(() => {
    let best: string | null = null, n = -1;
    for (const e of idx.bundle.entities) {
      if (e.type !== "PERSON") continue;
      const c = (idx.out.get(e.id)?.length ?? 0) + (idx.inc.get(e.id)?.length ?? 0);
      if (c > n) { n = c; best = e.id; }
    }
    return best;
  }, [idx]);
  const [focusId, setFocusId] = useState<string | null>(defaultFocus);
  const view = useBoardView(idx, filters, fullBoard ? null : focusId, null);

  // Navigation stack mirrored into browser history so the phone's back gesture works.
  // History writes happen outside React state updaters (which may run twice in development).
  const stackRef = useRef<Route[]>([]);
  const commit = useCallback((next: Route[]) => {
    stackRef.current = next;
    setStack(next);
  }, []);
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const d = typeof e.state?.rbDepth === "number" ? e.state.rbDepth : 0;
      commit(stackRef.current.slice(0, d));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [commit]);
  const push = useCallback((r: Route) => {
    const next = [...stackRef.current, r];
    history.pushState({ rbDepth: next.length }, "");
    commit(next);
  }, [commit]);
  const back = useCallback(() => history.back(), []);
  const closeAll = useCallback(() => {
    if (stackRef.current.length > 0) history.go(-stackRef.current.length);
  }, []);

  const select = useCallback((id: string | null) => {
    if (!id) return;
    const s = stackRef.current;
    const top = s[s.length - 1];
    if (top?.kind === "entity" && top.id === id) return;
    // Leaving the image viewer for a record replaces it, so "back" returns to the record behind it.
    if (top?.kind === "image") {
      const next = [...s.slice(0, -1), { kind: "entity" as const, id }];
      history.replaceState({ rbDepth: next.length }, "");
      commit(next);
    } else push({ kind: "entity", id });
  }, [commit, push]);

  const focusRelationships = useCallback((id: string) => {
    setFocusId(id);
    setFullBoard(false);
    setTab("board");
    closeAll();
    setFitSignal((n) => n + 1);
  }, [closeAll]);

  const baseApi: BoardApi = useMemo(() => ({
    idx, selectedId: null, isMobile: true,
    select: (id) => select(id),
    openSource: (req) => push({ kind: "source", req }),
    addResearcherLink: onAddLink,
    openImage: (assets, index) => push({ kind: "image", assets, index }),
    focusRelationships,
  }), [idx, select, push, onAddLink, focusRelationships]);

  const switchTab = (t: Tab) => {
    closeAll();
    setTab(t);
    // The board measures 0×0 while its tab is hidden, so re-fit once it is visible again.
    if (t === "board") setTimeout(() => setFitSignal((n) => n + 1), 30);
  };

  const awaiting = idx.bundle.inbox.filter((i) => !TERMINAL_DECISIONS.has(i.status)).length;
  const conCount = idx.bundle.entities.filter((e) => e.type === "CONTRADICTION").length;
  const focusEntity = focusId ? idx.byId.get(focusId) : null;
  const top = stack[stack.length - 1];

  return (
    <BoardContext.Provider value={baseApi}>
      <div data-touch className="flex h-[100dvh] flex-col overflow-hidden bg-zinc-950 text-zinc-200">
        <div className="relative min-h-0 flex-1">
          {/* Tab screens stay mounted so scroll position survives navigation. */}
          <div className={cn("absolute inset-0 flex flex-col", tab !== "board" && "hidden")}>
            <TabHeader title={fullBoard ? "Full board" : focusEntity ? focusEntity.label : "Board"}>
              <IconButton label="Filters" onClick={() => setFiltersOpen(true)}><SlidersHorizontal className="size-5" /></IconButton>
              <IconButton label="Fit to view" onClick={() => setFitSignal((n) => n + 1)}><Maximize className="size-5" /></IconButton>
            </TabHeader>
            <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-1.5 text-[13px]">
              <div className="flex rounded-lg border border-zinc-800 p-0.5">
                <button type="button" onClick={() => setFullBoard(false)} className={cn("min-h-11 rounded-md px-3", !fullBoard ? "bg-zinc-800 text-zinc-50" : "text-zinc-400")}>Focused</button>
                <button type="button" onClick={() => setFullBoard(true)} className={cn("min-h-11 rounded-md px-3", fullBoard ? "bg-zinc-800 text-zinc-50" : "text-zinc-400")}>Full board</button>
              </div>
              <span className="min-w-0 truncate text-zinc-500">{view.boardEntities.length} records · {view.boardEdges.length} links</span>
            </div>
            {fullBoard && <p className="border-b border-zinc-800 bg-amber-950/20 px-4 py-1.5 text-[12px] text-amber-200">Full graph is dense on a phone. Pinch to zoom; tap a record to inspect; use Focus relationships to narrow.</p>}
            {!fullBoard && focusEntity && (
              <button type="button" onClick={() => select(focusEntity.id)} className="flex min-h-11 items-center gap-2 border-b border-zinc-800 px-4 text-left text-[13px] text-zinc-400">
                <TypeIcon type={focusEntity.type} /> Showing this record and its immediate relationships · <span className="text-sky-300">details</span>
              </button>
            )}
            <div className="relative min-h-0 flex-1">
              {view.boardEntities.length === 0 ? (
                <p className="p-6 text-center text-[15px] text-zinc-500">No records match the current filters.</p>
              ) : (
                <CaseBoard compact entities={view.boardEntities} edges={view.boardEdges} selectedId={null} focusId={fullBoard ? null : focusId}
                  highlight={null} fitSignal={fitSignal} onSelect={(id) => id && select(id)} />
              )}
            </div>
          </div>
          <div className={cn("absolute inset-0 flex flex-col", tab !== "timeline" && "hidden")}>
            <TabHeader title="Timeline" />
            <div className="min-h-0 flex-1 overflow-y-auto"><MobileTimeline /></div>
          </div>
          <div className={cn("absolute inset-0", tab !== "search" && "hidden")}>
            {tab === "search" && <SearchScreen onPick={(id) => select(id)} />}
          </div>
          <div className={cn("absolute inset-0", tab !== "sources" && "hidden")}>
            <SourcesScreen onOpen={(id) => push({ kind: "source", req: { sourceId: id } })} />
          </div>
          <div className={cn("absolute inset-0 overflow-y-auto", tab !== "more" && "hidden")}>
            <MoreScreen push={push} awaiting={awaiting} conCount={conCount} />
          </div>

          {/* Detail stack (records, sources, inbox…) over the current tab. */}
          {stack.map((r, i) => {
            const active = i === stack.length - 1;
            if (r.kind === "image") return null;
            return (
              <div key={i} className={cn("absolute inset-0 z-30 flex flex-col bg-zinc-950", !active && "hidden")}>
                <header className="pt-safe shrink-0 border-b border-zinc-800 bg-zinc-950">
                  <div className="flex min-h-12 items-center gap-1 px-1">
                    <IconButton label="Back" onClick={back}><ArrowLeft className="size-5" /></IconButton>
                    <div className="min-w-0 flex-1 truncate text-[15px] text-zinc-300">{routeTitle(r, idx)}</div>
                    {stack.length > 1 && <span className="px-1 text-[12px] text-zinc-600">{stack.length} deep</span>}
                    <IconButton label="Close all" onClick={closeAll}><X className="size-5" /></IconButton>
                  </div>
                </header>
                <div className="min-h-0 flex-1 overflow-y-auto">
                  {r.kind === "entity" && (
                    <BoardContext.Provider value={{ ...baseApi, selectedId: r.id }}>
                      <Inspector />
                    </BoardContext.Provider>
                  )}
                  {r.kind === "source" && <SourceReader req={r.req} layout="page" />}
                  {r.kind === "inbox" && <Inbox compact items={idx.bundle.inbox} onDecide={onDecide} />}
                  {r.kind === "contradictions" && <ContradictionsScreen />}
                  {r.kind === "status" && <StatusScreen awaiting={awaiting} />}
                  {r.kind === "about" && <AboutScreen />}
                </div>
              </div>
            );
          })}
        </div>

        <nav className="pb-safe shrink-0 border-t border-zinc-800 bg-zinc-950" aria-label="Main">
          <div className="grid grid-cols-5">
            {TABS.map((t) => (
              <button key={t.key} type="button" onClick={() => switchTab(t.key)} aria-current={tab === t.key && !stack.length ? "page" : undefined}
                className={cn("relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px]", tab === t.key ? "text-zinc-50" : "text-zinc-500")}>
                <t.icon className="size-5" />
                {t.label}
                {t.key === "more" && awaiting > 0 && <span className="absolute right-[18%] top-1.5 rounded-full bg-amber-600 px-1.5 font-mono text-[9px] text-zinc-950">{awaiting > 99 ? "99+" : awaiting}</span>}
              </button>
            ))}
          </div>
        </nav>

        {filtersOpen && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60" onClick={() => setFiltersOpen(false)}>
            <div className="pb-safe max-h-[85dvh] overflow-y-auto rounded-t-2xl border-t border-zinc-700 bg-zinc-950 px-3" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Board filters">
              <div className="sticky top-0 z-10 flex min-h-14 items-center bg-zinc-950">
                <h2 className="flex-1 px-1 text-[17px] font-semibold text-zinc-50">Board filters</h2>
                <button type="button" onClick={() => setFiltersOpen(false)} className="min-h-11 rounded-lg bg-zinc-100 px-4 text-[15px] font-medium text-zinc-900">Done</button>
              </div>
              <FilterControls idx={idx} f={filters} showBoardOptions={false} />
              <div className="h-4" />
            </div>
          </div>
        )}
      </div>

      {top?.kind === "image" && (
        <ImageViewer assets={top.assets} index={top.index} onClose={back}
          onIndex={(i) => commit([...stackRef.current.slice(0, -1), { ...top, index: i }])} />
      )}
    </BoardContext.Provider>
  );
}
