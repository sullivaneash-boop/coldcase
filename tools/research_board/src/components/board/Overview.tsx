"use client";
import { useMemo } from "react";
import { AlertTriangle, ArrowRight, CalendarClock, FileText, GitCompareArrows, Inbox as InboxIcon, Pin, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { describe, formatDate } from "@/lib/labels";
import { parseDay, timeText, clockMinutes } from "@/lib/time";
import { TERMINAL_DECISIONS, INBOX_KIND_LABEL } from "./constants";
import { TypeIcon } from "./bits";
import { useBoard } from "./context";
import { inSources, outTargets } from "./graph";
import { usePrefs } from "./prefs";
import { ResearchStatus } from "./ResearchStatus";

export type OverviewTarget = "board" | "timeline" | "sources" | "inbox" | "contradictions";

function Card({ title, icon: Icon, action, onAction, children, className }: {
  title: string; icon: typeof Users; action?: string; onAction?: () => void; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={cn("flex min-w-0 flex-col rounded-xl border border-zinc-800 bg-zinc-900/50", className)}>
      <header className="flex items-center gap-2 border-b border-zinc-800 px-4 py-2.5">
        <Icon className="size-4 text-zinc-400" />
        <h2 className="flex-1 text-[13px] font-semibold text-zinc-200 touchui:text-[15px]">{title}</h2>
        {action && onAction && (
          <button type="button" onClick={onAction} className="inline-flex items-center gap-1 text-[12px] text-sky-300 hover:text-sky-200 touchui:min-h-11 touchui:text-[14px]">
            {action} <ArrowRight className="size-3" />
          </button>
        )}
      </header>
      <div className="flex-1 p-2">{children}</div>
    </section>
  );
}

function Row({ id, right, sub }: { id: string; right?: React.ReactNode; sub?: string }) {
  const { idx, select } = useBoard();
  const e = idx.byId.get(id);
  if (!e) return null;
  return (
    <button type="button" onClick={() => select(id, { focus: true })} className="flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-zinc-800/60 touchui:min-h-14 touchui:py-3">
      <TypeIcon type={e.type} className="mt-0.5 size-4" />
      <span className="min-w-0 flex-1">
        <span className="wrap-anywhere line-clamp-2 block text-[13px] leading-snug text-zinc-100 touchui:text-[15px]">{e.label}</span>
        <span className="block truncate text-[11px] text-zinc-500 touchui:text-[13px]">{sub ?? describe(e)}</span>
      </span>
      {right}
    </button>
  );
}

/** Case home: what the case is, what changed, what needs attention, and where to go next. */
export function Overview({ go }: { go: (t: OverviewTarget) => void }) {
  const { idx } = useBoard();
  const prefs = usePrefs();
  const b = idx.bundle;
  const linkCount = (id: string) => (idx.out.get(id)?.length ?? 0) + (idx.inc.get(id)?.length ?? 0);

  const keyPeople = useMemo(() => b.entities.filter((e) => e.type === "PERSON").sort((a, c) => linkCount(c.id) - linkCount(a.id)).slice(0, 6), [b]); // eslint-disable-line react-hooks/exhaustive-deps
  const peopleSub = (id: string) => {
    const claims = inSources(idx, id, "CLAIM_CONCERNS_PERSON").length;
    const statements = outTargets(idx, id, "MADE_STATEMENT").length;
    const sources = inSources(idx, id, "MENTIONS").length;
    return [claims && `in ${claims} claims`, statements && `${statements} statement${statements > 1 ? "s" : ""}`, sources && `named in ${sources} sources`].filter(Boolean).join(" · ") || "No linked records yet";
  };

  const window0 = b.meta.config.timelineWindows[0];
  const keyEvents = useMemo(() => {
    const lo = parseDay(window0?.start)?.ms ?? -Infinity, hi = parseDay(window0?.end)?.ms ?? Infinity;
    return b.entities.filter((e) => e.type === "EVENT").map((e) => {
      const t = (idx.eventTimesByEvent.get(e.id) ?? []).find((x) => x.startAt);
      const d = parseDay(t?.startAt);
      return { e, t, ms: d?.ms ?? NaN, min: clockMinutes(t?.localStartTime) ?? -1 };
    }).filter((x) => x.ms >= lo && x.ms < hi).sort((a, c) => a.ms - c.ms || a.min - c.min);
  }, [b, idx, window0]);

  const contradictions = b.entities.filter((e) => e.type === "CONTRADICTION");
  const review = b.inbox.filter((i) => !TERMINAL_DECISIONS.has(i.status));
  const high = review.filter((i) => i.priority === "HIGH");
  const newestSources = [...b.entities.filter((e) => e.type === "SOURCE" && e.subtype !== "NEWSPAPER_PAGE")]
    .sort((a, c) => (c.row.created_at ?? "").localeCompare(a.row.created_at ?? "")).slice(0, 5);
  const allegations = b.entities.filter((e) => e.type === "CLAIM" && e.status === "ALLEGED").length;
  const counts = [
    ["Sources", b.entities.filter((e) => e.type === "SOURCE").length, "sources"],
    ["Events", b.entities.filter((e) => e.type === "EVENT").length, "timeline"],
    ["People", b.entities.filter((e) => e.type === "PERSON").length, "board"],
    ["Claims", b.entities.filter((e) => e.type === "CLAIM").length, "board"],
  ] as const;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-4 touchui:p-4 sm:p-6">
      <div>
        <h1 className="text-[22px] font-semibold text-zinc-50 touchui:text-[24px]">{b.meta.config.title}</h1>
        <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-zinc-400 touchui:text-[15px]">
          {b.meta.config.subtitle ?? "A research board built from the case archive. Everything shown here comes from sourced records; status labels say how established each item is."}
          {allegations > 0 && <> {allegations} item{allegations > 1 ? "s are" : " is"} marked <b className="font-medium text-amber-300">Alleged</b> — allegations, not facts.</>}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {counts.map(([l, n, t]) => (
            <button key={l} type="button" onClick={() => go(t)} className="rounded-lg border border-zinc-800 px-3 py-1.5 text-left hover:border-zinc-600 touchui:min-h-12">
              <span className="font-mono text-[16px] text-zinc-100">{n}</span> <span className="text-[12px] text-zinc-500">{l}</span>
            </button>
          ))}
        </div>
      </div>

      <ResearchStatus variant="card" />

      {prefs.pinned.length > 0 && (
        <Card title="Pinned" icon={Pin}>
          {prefs.pinned.filter((id) => idx.byId.has(id)).map((id) => <Row key={id} id={id} />)}
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={window0 ? `What happened · ${window0.label}` : "Timeline"} icon={CalendarClock} action="Full timeline" onAction={() => go("timeline")}>
          {keyEvents.length === 0 && <p className="p-2 text-[13px] italic text-zinc-500">No dated events in this window.</p>}
          {keyEvents.slice(0, 10).map(({ e, t }) => (
            <Row key={e.id} id={e.id} sub={t ? `${formatDate(t.startAt)} · ${timeText(t)}` : describe(e)} />
          ))}
          {keyEvents.length > 10 && <button type="button" onClick={() => go("timeline")} className="w-full p-2 text-left text-[12px] text-sky-300 touchui:min-h-11">+ {keyEvents.length - 10} more events</button>}
        </Card>

        <Card title="Key people" icon={Users} action="Explore on board" onAction={() => go("board")}>
          <p className="px-2 pb-1 text-[11px] text-zinc-500 touchui:text-[13px]">Ordered by how many records mention them. Being listed implies no role or wrongdoing.</p>
          {keyPeople.map((p) => <Row key={p.id} id={p.id} sub={peopleSub(p.id)} />)}
        </Card>

        <Card title="Needs your review" icon={InboxIcon} action={`All ${review.length}`} onAction={() => go("inbox")}>
          <p className="px-2 pb-1 text-[11px] text-zinc-500 touchui:text-[13px]">{high.length} high priority · {review.length - high.length} other</p>
          {(high.length ? high : review).slice(0, 5).map((i) => (
            <button key={i.id} type="button" onClick={() => go("inbox")} className="flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-zinc-800/60 touchui:min-h-14">
              <AlertTriangle className={cn("mt-0.5 size-4 shrink-0", i.priority === "HIGH" ? "text-red-400" : "text-zinc-500")} />
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 block text-[13px] text-zinc-100 touchui:text-[15px]">{i.title}</span>
                <span className="block text-[11px] text-zinc-500 touchui:text-[13px]">{INBOX_KIND_LABEL[i.kind] ?? i.kind}</span>
              </span>
            </button>
          ))}
        </Card>

        <Card title="Conflicting accounts" icon={GitCompareArrows} action="All" onAction={() => go("contradictions")}>
          {contradictions.length === 0 && <p className="p-2 text-[13px] italic text-zinc-500">No contradictions recorded.</p>}
          {contradictions.map((c) => <Row key={c.id} id={c.id} sub={`${(idx.versionsByContradiction.get(c.id) ?? []).length} competing versions · ${describe(c)}`} />)}
        </Card>

        <Card title="Recently added sources" icon={FileText} action="All sources" onAction={() => go("sources")} className="lg:col-span-2">
          <div className="grid gap-1 md:grid-cols-2">
            {newestSources.map((s) => (
              <Row key={s.id} id={s.id} right={<span className="shrink-0 text-[11px] text-zinc-500">{formatDate(s.row.created_at?.slice(0, 10))}</span>} />
            ))}
          </div>
        </Card>
      </div>
      <p className="pb-4 text-[11px] text-zinc-600">
        Tip: click any item to open it. On the board, choose a view (The story, Claims &amp; sources, Witnesses) or save your own. Pins and private notes are stored in this browser only.
      </p>
    </div>
  );
}
