"use client";
import { useMemo, useRef, useState, useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EventTime } from "@/lib/types";
import { useBoard } from "./context";
import { timeGroups } from "./graph";

// All arithmetic uses "source-local" clock readings mapped onto a UTC number line purely for
// layout. No timezone or offset is asserted; timestamps never gain precision they lack.
const H = 3600_000;
const D = 24 * H;

// Windows come from 00_ADMIN/board_config.json (timelineWindows), plus "All dated events".
type Scale = "HOURS" | "DAYS" | "YEARS";

interface Mark {
  t: EventTime;
  start: number; // ms
  end: number; // ms (== start for points)
  kind: "point" | "range" | "dayband" | "coarse";
  approximate: boolean;
  label: string;
}

function parseDate(s: string | null): { ms: number; prec: "DAY" | "MONTH" | "YEAR" } | null {
  if (!s) return null;
  const m = s.match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), m[2] ? Number(m[2]) : 1, m[3] ? Number(m[3]) : 1];
  return { ms: Date.UTC(y, mo - 1, d), prec: m[3] ? "DAY" : m[2] ? "MONTH" : "YEAR" };
}
const clock = (s: string | null) => {
  const m = s?.match(/^(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * H + Number(m[2]) * 60_000 : null;
};
function periodEnd(ms: number, prec: "DAY" | "MONTH" | "YEAR") {
  const d = new Date(ms);
  if (prec === "DAY") return ms + D;
  if (prec === "MONTH") return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
  return Date.UTC(d.getUTCFullYear() + 1, 0, 1);
}

function toMark(t: EventTime): Mark | null {
  const s = parseDate(t.startAt);
  if (!s) return null;
  const e = parseDate(t.endAt) ?? s;
  const cs = clock(t.localStartTime);
  const ce = clock(t.localEndTime);
  const approximate = t.timeStatus === "APPROXIMATE";
  const text = t.originalTimeText ?? "";
  if (s.prec !== "DAY") {
    return { t, start: s.ms, end: periodEnd(e.ms, e.prec), kind: "coarse", approximate, label: `${text} (${s.prec.toLowerCase()} only)` };
  }
  if (cs !== null && (ce !== null || t.timeStatus === "RANGE")) {
    const end = ce !== null ? e.ms + ce : periodEnd(e.ms, "DAY");
    return { t, start: s.ms + cs, end, kind: "range", approximate, label: text };
  }
  if (cs !== null) return { t, start: s.ms + cs, end: s.ms + cs, kind: "point", approximate, label: `${approximate ? "~" : ""}${t.localStartTime} ${text}` };
  // Date known, clock time not stated: show the whole day (or range of days), never a point.
  return { t, start: s.ms, end: periodEnd(e.ms, "DAY"), kind: "dayband", approximate, label: `${text} — time not stated` };
}

export function Timeline() {
  const { idx, select, selectedId } = useBoard();
  const windows = idx.bundle.meta.config.timelineWindows;
  const [mode, setMode] = useState<number>(windows.length ? 0 : -1); // -1 = all dated events
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);
  useEffect(() => {
    if (!wrap.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);

  const events = idx.bundle.entities.filter((e) => e.type === "EVENT");
  const rows = useMemo(() => events.map((ev) => {
    const times = idx.eventTimesByEvent.get(ev.id) ?? [];
    const marks = times.map(toMark).filter(Boolean) as Mark[];
    return { ev, marks, undated: times.filter((t) => !parseDate(t.startAt)), conflicting: timeGroups(times).length > 1 };
  }), [events, idx]);

  const win = mode >= 0 ? windows[mode] : null;
  const [lo, hi] = useMemo(() => {
    const a0 = parseDate(win?.start ?? null), b0 = parseDate(win?.end ?? null);
    if (win && a0 && b0 && b0.ms > a0.ms) return [a0.ms, b0.ms];
    const all = rows.flatMap((r) => r.marks.flatMap((m) => [m.start, m.end]));
    if (!all.length) return [0, 1];
    const a = Math.min(...all), b = Math.max(...all);
    const pad = (b - a) * 0.03 || D;
    return [a - pad, b + pad];
  }, [win, rows]);
  const scale: Scale = win?.hourly || hi - lo <= 3 * D ? "HOURS" : hi - lo <= 120 * D ? "DAYS" : "YEARS";

  const LABEL_W = 210;
  const plotW = Math.max(200, width - LABEL_W - 16);
  const x = (ms: number) => LABEL_W + ((ms - lo) / (hi - lo)) * plotW;
  const visible = rows
    .filter((r) => r.marks.some((m) => m.end >= lo && m.start <= hi))
    .sort((a, b) => Math.min(...a.marks.map((m) => m.start)) - Math.min(...b.marks.map((m) => m.start)));
  const undated = rows.filter((r) => r.marks.length === 0 || (r.undated.length > 0 && r.marks.length === 0));

  const ticks = useMemo(() => {
    const out: { ms: number; label: string; major: boolean }[] = [];
    if (scale === "HOURS") {
      for (let t = Math.ceil(lo / (3 * H)) * 3 * H; t <= hi; t += 3 * H) {
        const d = new Date(t);
        const hh = d.getUTCHours();
        out.push({ ms: t, label: hh === 0 ? `${d.getUTCMonth() + 1}/${d.getUTCDate()}` : `${String(hh).padStart(2, "0")}:00`, major: hh === 0 });
      }
    } else if (scale === "DAYS") {
      for (let t = Math.ceil(lo / D) * D; t <= hi; t += D) {
        const d = new Date(t);
        out.push({ ms: t, label: `${d.getUTCMonth() + 1}/${d.getUTCDate()}`, major: d.getUTCDay() === 0 });
      }
    } else {
      const y0 = new Date(lo).getUTCFullYear(), y1 = new Date(hi).getUTCFullYear();
      const step = Math.max(1, Math.ceil((y1 - y0) / 14));
      for (let y = y0; y <= y1 + 1; y += step) out.push({ ms: Date.UTC(y, 0, 1), label: String(y), major: true });
    }
    return out.filter((t) => t.ms >= lo && t.ms <= hi);
  }, [scale, lo, hi]);

  const ROW = 17;
  const height = 22 + visible.length * ROW + 6;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-zinc-800 px-3 py-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Timeline</span>
        {[...windows.map((w, i) => ({ i, label: w.label })), { i: -1, label: "All dated events" }].map((m) => (
          <button key={m.i} type="button" onClick={() => setMode(m.i)} className={cn("rounded px-1.5 py-0.5 text-[11px]", mode === m.i ? "bg-zinc-700 text-zinc-100" : "text-zinc-400 hover:bg-zinc-800")}>
            {m.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-3 text-[10px] text-zinc-500">
          <span className="flex items-center gap-1"><svg width="10" height="10"><circle cx="5" cy="5" r="3.5" fill="#a78bfa" /></svg>stated time</span>
          <span className="flex items-center gap-1"><svg width="14" height="10"><circle cx="7" cy="5" r="3.5" fill="none" stroke="#a78bfa" strokeDasharray="2 1.5" /></svg>approximate</span>
          <span className="flex items-center gap-1"><svg width="16" height="10"><rect y="2" width="16" height="6" fill="#a78bfa" opacity=".55" rx="1" /></svg>range</span>
          <span className="flex items-center gap-1"><svg width="16" height="10"><rect y="2" width="16" height="6" fill="url(#hatch)" stroke="#71717a" strokeWidth=".5" /></svg>date only / coarse</span>
          <span className="flex items-center gap-1 text-red-300"><AlertTriangle className="size-3" />conflicting</span>
          <span>Clock times are source-local readings; timezone not stated.</span>
        </div>
      </div>
      <div ref={wrap} className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-y-auto">
          {visible.length === 0 ? (
            <p className="p-4 text-[12px] italic text-zinc-500">No dated event assertions fall in this window.</p>
          ) : (
            <svg width={width} height={height} className="block">
              <defs>
                <pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <line x1="0" y1="0" x2="0" y2="5" stroke="#a78bfa" strokeWidth="2" opacity=".45" />
                </pattern>
              </defs>
              {ticks.map((t) => (
                <g key={t.ms}>
                  <line x1={x(t.ms)} x2={x(t.ms)} y1={16} y2={height} stroke={t.major ? "#3f3f46" : "#27272a"} />
                  <text x={x(t.ms) + 2} y={11} fontSize="9" fill={t.major ? "#d4d4d8" : "#71717a"}>{t.label}</text>
                </g>
              ))}
              {visible.map((r, i) => {
                const y = 22 + i * ROW;
                const sel = selectedId === r.ev.id;
                return (
                  <g key={r.ev.id} className="cursor-pointer" onClick={() => select(r.ev.id, { focus: true })}>
                    <rect x={0} y={y - 1} width={width} height={ROW} fill={sel ? "#3f3f46" : "transparent"} opacity={0.5} />
                    <text x={6} y={y + 11} fontSize="10.5" fill={sel ? "#fafafa" : "#d4d4d8"}>
                      {(r.conflicting ? "⚠ " : "") + (r.ev.label.length > 34 ? r.ev.label.slice(0, 33) + "…" : r.ev.label)}
                      <title>{r.ev.label}</title>
                    </text>
                    {r.conflicting && r.marks.length > 1 && (
                      <line x1={x(Math.min(...r.marks.map((m) => m.start)))} x2={x(Math.max(...r.marks.map((m) => m.start)))} y1={y + 7} y2={y + 7} stroke="#f87171" strokeDasharray="2 2" />
                    )}
                    {r.marks.map((m) => {
                      const x1 = Math.max(LABEL_W, x(m.start));
                      const x2 = Math.min(LABEL_W + plotW, x(m.end));
                      const stroke = r.conflicting ? "#f87171" : "#a78bfa";
                      const tip = `${m.label}\n${m.t.timeStatus ?? ""} · date ${m.t.datePrecision ?? "?"} · clock ${m.t.timePrecision ?? "?"}\n${m.t.sourceId ? idx.byId.get(m.t.sourceId)?.label ?? m.t.sourceId : ""}`;
                      if (m.kind === "point") {
                        if (x(m.start) < LABEL_W || x(m.start) > LABEL_W + plotW) return null;
                        return (
                          <g key={m.t.id}>
                            <circle cx={x(m.start)} cy={y + 7} r={4} fill={m.approximate ? "none" : stroke} stroke={stroke} strokeWidth={1.4} strokeDasharray={m.approximate ? "2 1.5" : undefined} />
                            {scale === "HOURS" && <text x={x(m.start) + 7} y={y + 10.5} fontSize="9" fill="#a1a1aa">{m.label.slice(0, 40)}</text>}
                            <title>{tip}</title>
                          </g>
                        );
                      }
                      if (x2 < LABEL_W || x1 > LABEL_W + plotW) return null;
                      return (
                        <g key={m.t.id}>
                          <rect x={x1} y={y + 3} width={Math.max(3, x2 - x1)} height={8} rx={1.5}
                            fill={m.kind === "range" ? stroke : "url(#hatch)"} fillOpacity={m.kind === "range" ? 0.5 : 1}
                            stroke={m.kind === "range" ? stroke : "#71717a"} strokeWidth={0.6} strokeDasharray={m.approximate && m.kind === "range" ? "3 2" : undefined} />
                          {scale === "HOURS" && <text x={x1 + 3} y={y + 10} fontSize="8.5" fill="#d4d4d8">{m.label.slice(0, 48)}</text>}
                          <title>{tip}</title>
                        </g>
                      );
                    })}
                  </g>
                );
              })}
            </svg>
          )}
        </div>
        <div className="w-56 shrink-0 overflow-y-auto border-l border-zinc-800 px-2 py-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Undated / unknown time</div>
          {undated.length === 0 && <p className="text-[11px] italic text-zinc-600">None.</p>}
          {undated.map((r) => (
            <button key={r.ev.id} type="button" onClick={() => select(r.ev.id, { focus: true })} className="block w-full truncate py-0.5 text-left text-[11px] text-zinc-300 hover:text-white" title={r.ev.row.original_time_text}>
              {r.ev.label}
            </button>
          ))}
          <div className="mt-1 text-[10px] text-zinc-600">{visible.length} of {rows.length} events in window</div>
        </div>
      </div>
    </div>
  );
}
