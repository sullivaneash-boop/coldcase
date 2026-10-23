"use client";
import { useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Entity, EventTime } from "@/lib/types";
import { StatusBadge, Tag } from "./bits";
import { useBoard } from "./context";
import { ids, inSources, timeGroups, uniq } from "./graph";

// Clock values are source-local readings. They are formatted, never converted or completed.
type Window = "OCT_22_23" | "OCT_NOV" | "ALL";
const WINDOWS: { key: Window; label: string }[] = [
  { key: "OCT_22_23", label: "Oct 22–23" },
  { key: "OCT_NOV", label: "Oct–Nov 1997" },
  { key: "ALL", label: "All" },
];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseDay(s: string | null) {
  const m = s?.match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/);
  if (!m) return null;
  return { y: +m[1], mo: m[2] ? +m[2] : null, d: m[3] ? +m[3] : null, ms: Date.UTC(+m[1], (m[2] ? +m[2] : 1) - 1, m[3] ? +m[3] : 1) };
}
const minutes = (t: string | null) => {
  const m = t?.match(/^(\d{1,2}):(\d{2})/);
  return m ? +m[1] * 60 + +m[2] : null;
};
function clock12(t: string) {
  const m = minutes(t)!;
  const h = Math.floor(m / 60), mm = m % 60;
  return `${((h + 11) % 12) + 1}:${String(mm).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}
function dayLabel(ms: number, prec: "DAY" | "MONTH" | "YEAR") {
  const d = new Date(ms);
  if (prec === "YEAR") return `${d.getUTCFullYear()} (year only)`;
  if (prec === "MONTH") return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()} (month only)`;
  return `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getUTCDay()]} ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/** Display string for one attributed time assertion. */
export function timeText(t: EventTime): string {
  const s = parseDay(t.startAt);
  if (!s) return "?";
  if (!s.d) return s.mo ? `${MONTHS[s.mo - 1]} ${s.y} — month only` : `${s.y} — year only`;
  const approx = t.timeStatus === "APPROXIMATE" ? "~" : "";
  const e = parseDay(t.endAt);
  const crossDay = e && e.ms !== s.ms;
  if (t.localStartTime && t.localEndTime) {
    return crossDay
      ? `${approx}${clock12(t.localStartTime)} ${MONTHS[s.mo! - 1]} ${s.d} → ${clock12(t.localEndTime)} ${MONTHS[e!.mo! - 1]} ${e!.d}`
      : `${approx}${clock12(t.localStartTime)} – ${clock12(t.localEndTime)}`;
  }
  if (t.localStartTime) return `${approx}${clock12(t.localStartTime)}`;
  if (crossDay) return `${MONTHS[s.mo! - 1]} ${s.d} – ${MONTHS[e!.mo! - 1]} ${e!.d}, time not stated`;
  return "Time not stated";
}

interface Row {
  ev: Entity;
  times: EventTime[];
  first: EventTime | null;
  day: { ms: number; prec: "DAY" | "MONTH" | "YEAR" } | null;
  minute: number | null;
  conflicting: boolean;
  sourceCount: number;
}

function EventCard({ r }: { r: Row }) {
  const { idx, select, openSource } = useBoard();
  const [open, setOpen] = useState(false);
  const claims = inSources(idx, r.ev.id, "CLAIM_CONCERNS_EVENT");
  const statusCounts = new Map<string, number>();
  for (const c of claims) {
    const st = idx.byId.get(c)?.status ?? "UNKNOWN";
    statusCounts.set(st, (statusCounts.get(st) ?? 0) + 1);
  }
  const groups = timeGroups(r.times);
  return (
    <div className={cn("rounded-lg border bg-zinc-900/80", r.conflicting ? "border-red-800/70" : "border-zinc-800")}>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-start gap-3 px-3 py-3 text-left active:bg-zinc-800/60">
        <div className="min-w-0 flex-1">
          <div className={cn("font-mono text-[15px]", r.first?.localStartTime ? "text-violet-200" : "text-zinc-400")}>
            {r.conflicting ? groups.map((g) => timeText(g[0])).join("  vs  ") : r.first ? timeText(r.first) : "?"}
          </div>
          <div className="wrap-anywhere mt-0.5 text-[16px] font-medium leading-snug text-zinc-50">{r.ev.label}</div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {r.conflicting && <Tag className="border-red-700 text-red-300"><AlertTriangle className="mr-1 size-3" />conflicting times</Tag>}
            {[...statusCounts.entries()].map(([st, n]) => <span key={st} className="inline-flex items-center gap-1"><StatusBadge status={st} className="text-[11px]" />{n > 1 && <span className="text-[11px] text-zinc-500">×{n}</span>}</span>)}
            {!claims.length && <Tag>{r.ev.row.time_status || "UNKNOWN"}</Tag>}
            {r.ev.confidence && <span className="text-[12px] text-zinc-500">{r.ev.confidence} confidence</span>}
            <span className="text-[12px] text-zinc-400">{r.sourceCount} source{r.sourceCount === 1 ? "" : "s"}</span>
          </div>
        </div>
        <ChevronDown className={cn("mt-1 size-5 shrink-0 text-zinc-500 transition-transform", !open && "-rotate-90")} />
      </button>
      {open && (
        <div className="border-t border-zinc-800 px-3 py-3">
          {r.ev.row.neutral_description && <p className="mb-3 text-[14px] leading-relaxed text-zinc-300">{r.ev.row.neutral_description}</p>}
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Time assertions ({r.times.length})</div>
          <div className="flex flex-col gap-2">
            {r.times.map((t) => (
              <div key={t.id} className="rounded border border-zinc-800 p-2">
                <div className="font-mono text-[14px] text-zinc-100">{timeText(t)} <span className="text-[11px] text-zinc-500">{t.startAt}</span></div>
                {t.originalTimeText && <div className="wrap-anywhere text-[14px] text-zinc-300">“{t.originalTimeText}”</div>}
                <div className="mt-1 flex flex-wrap gap-1"><Tag>{t.timeStatus || "UNKNOWN"}</Tag><Tag>date {t.datePrecision || "?"}</Tag><Tag>clock {t.timePrecision || "?"}</Tag></div>
                {t.sourceId && (
                  <button type="button" onClick={() => openSource({ sourceId: t.sourceId!, locator: t.locator, anchor: t.originalTimeText })} className="mt-1 flex min-h-11 w-full items-center gap-2 text-left text-[14px] text-sky-300">
                    <BookOpen className="size-4 shrink-0" /><span className="wrap-anywhere">{idx.byId.get(t.sourceId)?.label ?? t.sourceId}</span>
                  </button>
                )}
              </div>
            ))}
          </div>
          <button type="button" onClick={() => select(r.ev.id)} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded bg-zinc-800 text-[15px] text-zinc-100 active:bg-zinc-700">
            Open event details <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export function MobileTimeline() {
  const { idx } = useBoard();
  const [win, setWin] = useState<Window>("OCT_22_23");
  const rows = useMemo<Row[]>(() => idx.bundle.entities.filter((e) => e.type === "EVENT").map((ev) => {
    const times = [...(idx.eventTimesByEvent.get(ev.id) ?? [])].sort((a, b) =>
      (a.startAt ?? "9999").localeCompare(b.startAt ?? "9999") || (minutes(a.localStartTime) ?? -1) - (minutes(b.localStartTime) ?? -1));
    const first = times.find((t) => parseDay(t.startAt)) ?? null;
    const p = first ? parseDay(first.startAt) : null;
    return {
      ev, times, first,
      day: p ? { ms: p.ms, prec: p.d ? "DAY" : p.mo ? "MONTH" : "YEAR" } : null,
      minute: first ? minutes(first.localStartTime) : null,
      conflicting: timeGroups(times).length > 1,
      sourceCount: uniq([...times.map((t) => t.sourceId).filter(Boolean) as string[], ...ids(ev.row.source_ids)]).length,
    };
  }), [idx]);

  const inWindow = (r: Row) => {
    if (win === "ALL") return true;
    if (!r.day) return false;
    const [lo, hi] = win === "OCT_22_23" ? [Date.UTC(1997, 9, 22), Date.UTC(1997, 9, 24)] : [Date.UTC(1997, 9, 1), Date.UTC(1997, 11, 1)];
    return r.times.some((t) => { const d = parseDay(t.startAt); return d && d.ms >= lo && d.ms < hi; });
  };
  const dated = rows.filter((r) => r.day && inWindow(r))
    .sort((a, b) => a.day!.ms - b.day!.ms || (a.minute ?? -1) - (b.minute ?? -1));
  const undated = rows.filter((r) => !r.day);

  // Group by day; untimed events lead each day ("time not stated").
  const days: { key: string; label: string; rows: Row[] }[] = [];
  for (const r of dated) {
    const key = `${r.day!.ms}|${r.day!.prec}`;
    let g = days.find((d) => d.key === key);
    if (!g) days.push((g = { key, label: dayLabel(r.day!.ms, r.day!.prec), rows: [] }));
    g.rows.push(r);
  }

  return (
    <div className="pb-6">
      <div className="sticky top-0 z-10 flex gap-2 overflow-x-auto border-b border-zinc-800 bg-zinc-950/95 px-4 py-2 backdrop-blur">
        {WINDOWS.map((w) => (
          <button key={w.key} type="button" onClick={() => setWin(w.key)} className={cn("min-h-11 shrink-0 rounded-full border px-4 text-[14px]", win === w.key ? "border-zinc-300 bg-zinc-100 text-zinc-900" : "border-zinc-700 text-zinc-300")}>
            {w.label}
          </button>
        ))}
      </div>
      <p className="px-4 pt-3 text-[12px] leading-snug text-zinc-500">
        Times are source-local readings (timezone not stated). “~” means approximate as worded by the source; “Time not stated” means only the date is reported. Nothing is interpolated.
      </p>
      {days.length === 0 && <p className="px-4 py-6 text-[14px] italic text-zinc-500">No dated events in this window.</p>}
      {days.map((d) => (
        <section key={d.key} className="px-4 pt-4">
          <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-zinc-400">{d.label}</h3>
          <ol className="relative ml-2 border-l border-zinc-700 pl-4">
            {d.rows.map((r, i) => {
              const prev = d.rows[i - 1];
              const gap = prev && prev.minute !== null && r.minute !== null && !prev.conflicting ? r.minute - prev.minute : null;
              return (
                <li key={r.ev.id} className="relative pb-3">
                  {gap !== null && gap >= 120 && (
                    <div className="-ml-4 mb-3 flex items-center gap-2 pl-4 text-[12px] italic text-zinc-500">
                      <span className="absolute -left-[5px] size-2 rounded-full border border-zinc-600 bg-zinc-950" />
                      ? No archived event for about {Math.round(gap / 60)} h — absence of records, not of activity
                    </div>
                  )}
                  <span className={cn("absolute -left-[21px] top-4 size-2.5 rounded-full", r.first?.localStartTime ? (r.first.timeStatus === "APPROXIMATE" ? "border border-dashed border-violet-300 bg-zinc-950" : "bg-violet-400") : "border border-zinc-500 bg-zinc-800")} />
                  <EventCard r={r} />
                </li>
              );
            })}
          </ol>
        </section>
      ))}
      {(win === "ALL" || undated.length > 0) && undated.length > 0 && (
        <section className="px-4 pt-4">
          <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-zinc-400">? Undated / date not established</h3>
          <div className="flex flex-col gap-3">{undated.map((r) => <EventCard key={r.ev.id} r={r} />)}</div>
        </section>
      )}
    </div>
  );
}
