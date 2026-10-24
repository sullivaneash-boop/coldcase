// Plain-language labels for register codes. The codes stay canonical in the archive; the UI shows
// these words, with the meaning available on hover/tap. Unknown codes fall back to Title Case.
import type { Entity, EventTime } from "./types";
import { MONTHS, parseDay, timeText } from "./time";

export const titleCase = (code: string | null | undefined) =>
  (code ?? "").toLowerCase().replace(/_/g, " ").replace(/\b\w/, (c) => c.toUpperCase());

const L = (label: string, help: string) => ({ label, help });

export const LABELS: Record<string, Record<string, { label: string; help: string }>> = {
  claimStatus: {
    CONFIRMED: L("Confirmed", "Verified by a person against adequate direct material."),
    WELL_SUPPORTED: L("Well supported", "Strong, traceable support; not formally confirmed."),
    REPORTED: L("Reported", "A source says this. Not independently verified."),
    ALLEGED: L("Alleged", "An allegation. Not established — do not treat as fact."),
    DISPUTED: L("Disputed", "Sources conflict and the conflict is unresolved."),
    RUMOR: L("Rumor", "Circulating but unverified. A lead only."),
    UNKNOWN: L("Not assessed", "No one has assessed this yet."),
    REJECTED: L("Rejected", "There are documented reasons to reject it."),
  },
  timeStatus: {
    EXACT: L("Stated", "The source gives this date/time at the precision shown."),
    APPROXIMATE: L("Approximate", "The source says “about” or “around”."),
    RANGE: L("Range", "The source gives a window, not a moment."),
    UNKNOWN: L("Unknown", "The source does not establish when."),
  },
  knowledge: {
    FIRSTHAND: L("Firsthand", "The speaker saw or did it themselves."),
    HEARSAY: L("Secondhand", "Passed on from someone else."),
    MIXED: L("Mixed", "Partly firsthand, partly secondhand."),
    UNKNOWN: L("Basis unknown", "How the speaker knew is not recorded."),
  },
  representation: {
    VERBATIM: L("Exact words", "Recorded word for word."),
    PARAPHRASE: L("Paraphrase", "A summary, not the exact words."),
    TRANSLATION: L("Translation", "Translated from another language."),
    MIXED: L("Partly quoted", "Mix of quotes and paraphrase."),
    UNKNOWN: L("Form unknown", "Not recorded whether quoted or paraphrased."),
  },
  reliability: {
    A: L("A · Primary document", "Original documentary record."),
    B: L("B · Firsthand account", "Direct account by a witness or participant."),
    C: L("C · Contemporary news", "Journalism from the time of events."),
    D: L("D · Later journalism", "Professional reporting after the fact."),
    E: L("E · Secondary research", "Compiled or retrospective research (e.g. blogs)."),
    F: L("F · Community", "Community or user-generated. Leads only."),
    G: L("G · Unverified", "Unsupported or unverified."),
  },
  identity: {
    CONFIRMED_IDENTITY: L("Identity confirmed", "Who this is has been verified."),
    PROVISIONAL: L("Identity provisional", "Named in sources; identity not independently verified."),
    UNKNOWN: L("Identity unknown", "Not identified."),
  },
  custody: {
    RESEARCH_COPY_ONLY: L("We hold a research copy", "A copy is in the archive; not the original item."),
    REPORTED_HELD_BY_AGENCY: L("Reportedly held by an agency", "A source says an agency holds it."),
    PERSONALLY_HELD: L("Personally held", "Held by an individual."),
    UNKNOWN: L("Whereabouts unknown", "Custody is not documented."),
  },
  primary: {
    PRIMARY: L("Primary", "Created by a participant or at the time."),
    SECONDARY: L("Secondary", "Reports on or summarizes other material."),
    MIXED: L("Mixed", "Contains both primary and secondary material."),
    UNKNOWN: L("Unknown", "Not classified."),
  },
  sourceKind: {
    NEWS_ARTICLE: L("News article", ""), NEWSPAPER_PAGE: L("Newspaper page scan", ""), WEB_PAGE: L("Web page", ""),
    PHOTO: L("Photo", ""), DOCUMENT: L("Document", ""), AUDIO: L("Audio", ""), VIDEO: L("Video", ""),
    INTERVIEW: L("Interview", ""), OTHER: L("Other", ""), UNKNOWN: L("Source", ""),
  },
  contradiction: {
    UNRESOLVED: L("Unresolved", "Both versions are kept; none is preferred."),
    OPEN: L("Open", "Under consideration."),
    UNDER_REVIEW: L("Under review", "Being reviewed."),
    RESOLVED: L("Resolved", "Resolved with a documented rationale."),
    UNRESOLVABLE: L("Unresolvable", "Cannot be resolved with available material."),
  },
};

export function label(kind: keyof typeof LABELS, code: string | null | undefined) {
  if (!code) return LABELS[kind].UNKNOWN ?? { label: "Unknown", help: "" };
  return LABELS[kind][code] ?? { label: titleCase(code), help: "" };
}

/** "Wed, Oct 22, 1997" / "Oct 1997" / "1997", never more precise than the input. */
export function formatDate(iso: string | null | undefined): string {
  const d = parseDay(iso);
  if (!d) return "";
  if (!d.mo) return String(d.y);
  if (!d.d) return `${MONTHS[d.mo - 1]} ${d.y}`;
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(d.ms).getUTCDay()];
  return `${wd}, ${MONTHS[d.mo - 1]} ${d.d}, ${d.y}`;
}

/** Human "when" for an event, from its first time assertion (or the event row). */
export function eventWhen(e: Entity, times: EventTime[] = []): string {
  const t = times.find((x) => x.startAt) ?? {
    startAt: e.row.start_at || null, endAt: e.row.end_at || null, localStartTime: e.row.local_start_time || null,
    localEndTime: e.row.local_end_time || null, timeStatus: e.row.time_status || null,
  };
  if (!t.startAt) return "Date not established";
  const date = formatDate(t.startAt);
  const time = timeText(t);
  return time === "Time not stated" || /only$/.test(time) ? date : `${date} · ${time}`;
}

/** One readable line describing a record — used on cards, nodes, chips and search results. */
export function describe(e: Entity, extra?: { times?: EventTime[]; sourceCount?: number }): string {
  const r = e.row;
  switch (e.type) {
    case "EVENT":
      return eventWhen(e, extra?.times);
    case "SOURCE": {
      const pub = r.publisher || r._article?.publication;
      const kind = label("sourceKind", e.subtype).label;
      return [kind, pub, formatDate(r.publication_date)].filter(Boolean).join(" · ");
    }
    case "CLAIM":
      return [label("claimStatus", e.status).label, extra?.sourceCount !== undefined && `${extra.sourceCount} source${extra.sourceCount === 1 ? "" : "s"}`].filter(Boolean).join(" · ");
    case "PERSON":
      return label("identity", r.identity_status).label;
    case "WITNESS_STATEMENT":
      return [formatDate(r.statement_date) || "Date unknown", label("representation", r.representation_type).label, label("knowledge", r.knowledge_basis).label].join(" · ");
    case "EVIDENCE":
      return [titleCase(r.evidence_type), label("custody", r.custody_status).label].filter(Boolean).join(" · ");
    case "CONTRADICTION":
      return label("contradiction", e.status).label;
    case "LOCATION":
      return titleCase(r.location_type) || "Place";
    case "ORGANIZATION":
      return titleCase(r.organization_type) || "Organization";
  }
}
