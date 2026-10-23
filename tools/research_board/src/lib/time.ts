// Pure helpers for source-local clock readings. Values are formatted, never converted,
// completed or interpolated: a date-only assertion never gains a clock time.
import type { EventTime } from "./types";

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function parseDay(s: string | null | undefined) {
  const m = s?.match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/);
  if (!m) return null;
  return { y: +m[1], mo: m[2] ? +m[2] : null, d: m[3] ? +m[3] : null, ms: Date.UTC(+m[1], (m[2] ? +m[2] : 1) - 1, m[3] ? +m[3] : 1) };
}

export const clockMinutes = (t: string | null | undefined) => {
  const m = t?.match(/^(\d{1,2}):(\d{2})/);
  return m ? +m[1] * 60 + +m[2] : null;
};

export function clock12(t: string) {
  const m = clockMinutes(t)!;
  const h = Math.floor(m / 60), mm = m % 60;
  return `${((h + 11) % 12) + 1}:${String(mm).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** Display string for one attributed time assertion. */
export function timeText(t: Pick<EventTime, "startAt" | "endAt" | "localStartTime" | "localEndTime" | "timeStatus">): string {
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

/** True when an ISO date (YYYY, YYYY-MM or YYYY-MM-DD) names a real calendar date. */
export function isValidIsoDate(s: string): boolean {
  const m = s.match(/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/);
  if (!m) return false;
  if (!m[2]) return true;
  const mo = +m[2];
  if (mo < 1 || mo > 12) return false;
  if (!m[3]) return true;
  const d = +m[3];
  const dt = new Date(Date.UTC(+m[1], mo - 1, d));
  return dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/** Accepts ISO dates or RFC 3339 timestamps (with or without offset). */
export function isValidDateOrTimestamp(s: string): boolean {
  if (isValidIsoDate(s)) return true;
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/);
  return !!m && isValidIsoDate(m[1]) && +m[2] < 24 && +m[3] < 60 && (!m[4] || +m[4] < 61);
}

export const isValidClock = (s: string) => /^([01]?\d|2[0-3]):[0-5]\d$/.test(s);
