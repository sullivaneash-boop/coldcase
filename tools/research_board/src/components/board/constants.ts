import {
  User, Building2, CalendarClock, Package, MapPin, Quote, MessageSquareText, FileText, GitCompareArrows,
  type LucideIcon,
} from "lucide-react";
import type { EdgeCategory, EntityType } from "@/lib/types";

export const TYPE_META: Record<EntityType, { label: string; plural: string; icon: LucideIcon; color: string; text: string; ring: string }> = {
  PERSON: { label: "Person", plural: "People", icon: User, color: "#60a5fa", text: "text-blue-300", ring: "ring-blue-400" },
  WITNESS_STATEMENT: { label: "Witness statement", plural: "Witness statements", icon: MessageSquareText, color: "#22d3ee", text: "text-cyan-300", ring: "ring-cyan-400" },
  EVENT: { label: "Event", plural: "Events", icon: CalendarClock, color: "#a78bfa", text: "text-violet-300", ring: "ring-violet-400" },
  CONTRADICTION: { label: "Contradiction", plural: "Contradictions", icon: GitCompareArrows, color: "#f87171", text: "text-red-300", ring: "ring-red-400" },
  CLAIM: { label: "Claim", plural: "Claims", icon: Quote, color: "#e5e7eb", text: "text-zinc-200", ring: "ring-zinc-300" },
  EVIDENCE: { label: "Evidence", plural: "Evidence", icon: Package, color: "#fb923c", text: "text-orange-300", ring: "ring-orange-400" },
  LOCATION: { label: "Location", plural: "Locations", icon: MapPin, color: "#4ade80", text: "text-green-300", ring: "ring-green-400" },
  ORGANIZATION: { label: "Organization", plural: "Organizations", icon: Building2, color: "#94a3b8", text: "text-slate-300", ring: "ring-slate-400" },
  SOURCE: { label: "Source", plural: "Sources", icon: FileText, color: "#facc15", text: "text-yellow-300", ring: "ring-yellow-400" },
};

export const TYPE_ORDER: EntityType[] = [
  "PERSON", "WITNESS_STATEMENT", "EVENT", "CONTRADICTION", "CLAIM", "EVIDENCE", "LOCATION", "ORGANIZATION", "SOURCE",
];

// Research-integrity status language. Never rendered as a truth score.
export const CLAIM_STATUS_META: Record<string, { cls: string; caveat: string }> = {
  CONFIRMED: { cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40", caveat: "Confirmed by documented human verification against adequate direct material." },
  WELL_SUPPORTED: { cls: "bg-green-500/15 text-green-300 border-green-500/40", caveat: "Strong traceable support; not formally confirmed." },
  REPORTED: { cls: "bg-sky-500/15 text-sky-300 border-sky-500/40", caveat: "Attributed report. Records what a source says — not independently verified." },
  ALLEGED: { cls: "bg-amber-500/15 text-amber-300 border-amber-500/40", caveat: "Allegation. Unestablished — do not treat as fact." },
  DISPUTED: { cls: "bg-orange-500/15 text-orange-300 border-orange-500/40", caveat: "Unresolved contrary material exists." },
  RUMOR: { cls: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/40", caveat: "Unverified circulation. Lead only." },
  UNKNOWN: { cls: "bg-zinc-500/15 text-zinc-300 border-zinc-500/40", caveat: "Not yet assessed." },
  REJECTED: { cls: "bg-red-500/15 text-red-300 border-red-500/40 line-through", caveat: "Documented reasons to reject." },
};

export const CATEGORY_META: Record<EdgeCategory, { label: string; description: string; stroke: string; dash?: string; width: number }> = {
  SOURCED: { label: "Sourced", description: "Source-attributed relationship (register row with source and locator).", stroke: "#71717a", width: 1.2 },
  REGISTER: { label: "Register link", description: "Explicit association stored in a register ID list.", stroke: "#52525b", dash: "2 3", width: 1 },
  LEAD: { label: "Research lead", description: "Register relationship flagged as a lead — not established.", stroke: "#fb923c", dash: "1 4", width: 1.6 },
  RESEARCHER: { label: "Researcher link", description: "Researcher connection — not evidence.", stroke: "#f59e0b", dash: "8 5", width: 2 },
};

export const REL_LABEL: Record<string, string> = {
  SUPPORTED_BY: "supported by",
  CONTRADICTED_BY: "contradicted by",
  CONTEXT_FROM: "context from",
  CLAIM_CONCERNS_PERSON: "concerns",
  CLAIM_CONCERNS_EVENT: "concerns event",
  CLAIM_CONCERNS_LOCATION: "concerns location",
  CLAIM_CONCERNS_EVIDENCE: "concerns evidence",
  EVENT_REPORTED_AT: "reported at",
  EVENT_REPORTED_IN: "reported in",
  EVENT_INVOLVES_PERSON: "involves",
  EVENT_INVOLVES_ORGANIZATION: "involves",
  EVIDENCE_REPORTED_IN: "reported in",
  EVIDENCE_REPORTED_AT: "reported at",
  EVIDENCE_RELATED_EVENT: "related event",
  EVIDENCE_RELATED_PERSON: "related person",
  REPORTED_CUSTODIAN: "reported custodian",
  MADE_STATEMENT: "made statement",
  STATEMENT_RECORDED_IN: "recorded in",
  RECORDED_BY: "recorded by",
  STATEMENT_ABOUT_EVENT: "about",
  SUPERSEDES: "supersedes",
  CONTRADICTION_INVOLVES_CLAIM: "involves claim",
  CONTRADICTION_CONCERNS_EVENT: "concerns event",
  VERSION_ASSERTED_BY: "version asserted by",
  MENTIONS: "mentions",
  APPEARS_ON_PAGE: "appears on page",
  CITES_SOURCE: "cites",
  LINKS_ATTACHMENT_NAMED: "links attachment",
  POSSIBLE_SAME_IDENTITY: "possible same identity (lead)",
  PART_OF: "part of",
  WITHIN: "within",
  RESEARCHER_LINK: "Researcher connection — not evidence",
};

// Relationship types hidden by default because they would swamp the board.
export const DEFAULT_HIDDEN_RELS = new Set(["MENTIONS", "APPEARS_ON_PAGE"]);

export const INBOX_KIND_LABEL: Record<string, string> = {
  NEW_PERSON: "New person",
  POSSIBLE_DUPLICATE_PERSON: "Possible duplicate person",
  NEW_LOCATION: "New location",
  UNASSIGNED_IMAGE: "Unassigned image",
  POSSIBLE_CONTRADICTION: "Possible contradiction",
  UNKNOWN_SOURCE: "Unknown source",
  SOURCE_TO_ACQUIRE: "Source we should acquire",
  AMBIGUOUS_DATE: "Ambiguous date",
  AMBIGUOUS_TEXT: "Ambiguous OCR / text",
  POSSIBLE_RELATIONSHIP: "Possible relationship",
  BATCH_REVIEW: "Batch review item",
  DATA_INTEGRITY: "Data integrity",
};

export const DECISION_LABEL: Record<string, string> = {
  OPEN: "Open",
  IN_REVIEW: "In review",
  ACCEPTED: "Accepted",
  MERGE_REQUESTED: "Merge requested",
  IGNORED: "Ignored",
  UNRESOLVED: "Marked unresolved",
};

export const TERMINAL_DECISIONS = new Set(["ACCEPTED", "MERGE_REQUESTED", "IGNORED"]);
