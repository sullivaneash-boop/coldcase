export type EntityType =
  | "PERSON"
  | "ORGANIZATION"
  | "EVENT"
  | "EVIDENCE"
  | "LOCATION"
  | "CLAIM"
  | "WITNESS_STATEMENT"
  | "SOURCE"
  | "CONTRADICTION";

export type EdgeCategory = "SOURCED" | "REGISTER" | "LEAD" | "RESEARCHER" | "VIA_CLAIM";

export interface Entity {
  id: string;
  type: EntityType;
  subtype: string | null;
  label: string;
  subtitle: string | null;
  status: string | null;
  confidence: string | null;
  sortKey: string | null;
  register: string;
  row: Record<string, string> & { _article?: Record<string, string> };
  searchText: string;
}

export interface CaseEdge {
  id: string;
  from: string;
  to: string;
  rel: string;
  category: EdgeCategory;
  sourceId: string | null;
  locator: string | null;
  notes: string | null;
  origin: string;
}

export interface ClaimSource {
  id: string;
  claimId: string;
  sourceId: string;
  relationship: string | null;
  locator: string | null;
  excerpt: string | null;
  knowledgeBasis: string | null;
  speakerPersonId: string | null;
  assertionType: string | null;
  notes: string | null;
}

export interface EventTime {
  id: string;
  eventId: string;
  sourceId: string | null;
  locator: string | null;
  timeStatus: string | null;
  startAt: string | null;
  endAt: string | null;
  localStartTime: string | null;
  localEndTime: string | null;
  timePrecision: string | null;
  datePrecision: string | null;
  timezone: string | null;
  originalTimeText: string | null;
  confidence: string | null;
  notes: string | null;
  synthetic: number;
}

export interface ContradictionVersion {
  id: string;
  contradictionId: string;
  versionText: string | null;
  sourceId: string | null;
  locator: string | null;
  claimId: string | null;
  eventId: string | null;
  statementId: string | null;
  assertedStartAt: string | null;
  assertedEndAt: string | null;
  timePrecision: string | null;
  originalTimeText: string | null;
  notes: string | null;
}

export interface SourceFile {
  id: string;
  sourceId: string;
  fileRole: string | null;
  localFile: string | null;
  sha256: string | null;
  mimeType: string | null;
  byteSize: number | null;
  derivedFromFileId: string | null;
  transformation: string | null;
  exists: number;
  /** True when the file is copied into the deployment (public/archive). */
  published: boolean;
}

export interface Asset {
  id: string;
  type: string;
  localPath: string | null;
  originalUrl: string | null;
  caption: string | null;
  altText: string | null;
  sourceId: string | null;
  relatedEntityIds: string[];
  status: string;
  availability: string;
  identityBasis: string | null;
  discoveredIn: string | null;
  notes: string | null;
  /** True when localPath is copied into the deployment. */
  published?: boolean;
}

export interface InboxItem {
  id: string;
  kind: string;
  title: string;
  description: string | null;
  priority: string | null;
  entityIds: string[];
  sourceIds: string[];
  origin: string;
  originRef: string | null;
  originalIssueType: string | null;
  status: string;
  decisionNote: string | null;
  decidedAt: string | null;
  decidedBy: string | null;
}

export interface ResearcherLink {
  id: string;
  fromId: string;
  toId: string;
  label: string | null;
  note: string | null;
  createdBy: string | null;
  createdAt: string | null;
  status: string;
}

export interface SourceChainRow {
  id: string;
  sourceId: string;
  underlyingSource: string | null;
  sourceType: string | null;
  url: string | null;
  heldSourceId: string | null;
  wantedId: string | null;
  holdingStatus: string | null;
  independence: string | null;
  notes: string | null;
  batch: string | null;
}

export interface WantedSource {
  id: string;
  title: string | null;
  sourceType: string | null;
  url: string | null;
  requestedBySourceIds: string | null;
  status: string | null;
  notes: string | null;
}

export type IssueLevel = "ERROR" | "WARNING";
export interface Issue {
  level: IssueLevel;
  code: string;
  message: string;
  file?: string;
  recordId?: string;
}

export interface TimelineWindow {
  label: string;
  start: string; // ISO date, inclusive
  end: string; // ISO date, exclusive
  hourly?: boolean;
}

export interface BoardConfig {
  title: string;
  subtitle?: string;
  timelineWindows: TimelineWindow[];
}

export interface ResearchStatus {
  lastRun: { id: string; at: string | null; file: string } | null;
  registersChangedAt: string | null;
  latestSource: { id: string; title: string; at: string | null } | null;
  latestFinding: { text: string; origin: string; recordIds: string[] } | null;
}

export interface CaseBundle {
  entities: Entity[];
  edges: CaseEdge[];
  claimSources: ClaimSource[];
  eventTimes: EventTime[];
  contradictionVersions: ContradictionVersion[];
  sourceFiles: SourceFile[];
  assets: Asset[];
  inbox: InboxItem[];
  researcherLinks: ResearcherLink[];
  sourceChain: SourceChainRow[];
  wanted: WantedSource[];
  /** Independent review (Claude analysis layer) from 11_ANALYSIS/independent_review; null when absent. */
  review: CaseReview | null;
  /** Human notes and decisions on review items, oldest first. */
  reviewNotes: ReviewNote[];
  meta: {
    syncedAt: string | null;
    /** Hash of the generated data; changes only when case data changes. */
    dataVersion: string;
    readOnly: boolean;
    config: BoardConfig;
    research: ResearchStatus;
    validation: { errors: number; warnings: number };
    warnings: string[];
    openQuestionFiles: number;
  };
}

/** Per-source reading payload: public/data/sources/<SRC>.json */
export interface SourceRendition {
  key: string;
  label: string;
  path: string;
  kind: "markdown" | "text" | "image" | "pdf";
  role: string;
  published: boolean;
}
export interface SourceDoc {
  renditions: SourceRendition[];
  contents: Record<string, string>;
  truncated: Record<string, boolean>;
}

export const CLAIM_STATUSES = [
  "CONFIRMED",
  "WELL_SUPPORTED",
  "REPORTED",
  "ALLEGED",
  "DISPUTED",
  "RUMOR",
  "UNKNOWN",
  "REJECTED",
] as const;

export const INBOX_DECISIONS = ["IN_REVIEW", "ACCEPTED", "MERGE_REQUESTED", "IGNORED", "UNRESOLVED"] as const;
export type InboxDecision = (typeof INBOX_DECISIONS)[number];

// ---------------------------------------------------------------- independent review (analysis layer)
/** Grades used by the analysis layer; they describe source support, never truth or guilt. */
export const ANALYSIS_GRADES = ["CONFIRMED", "STRONGLY_SUPPORTED", "PROBABLE", "POSSIBLE", "ALLEGED", "DISPUTED", "RUMOR", "UNKNOWN"] as const;
export type AnalysisGrade = (typeof ANALYSIS_GRADES)[number];
/** Human responses to an analysis item, appended to review_decisions.csv with item_kind ANALYSIS_ITEM. */
export const ANALYSIS_DECISIONS = ["AGREE", "DISAGREE", "NEEDS_REVIEW", "REGRADE", "NOTE"] as const;
export type AnalysisDecision = (typeof ANALYSIS_DECISIONS)[number];

/** Any item in case_review.json: every list item has a stable id and may cite register records. */
export interface ReviewItem {
  id: string;
  recordIds?: string[];
  grade?: string;
  [key: string]: unknown;
}

export interface CaseReview {
  meta: { title: string; layer: string; author: string; version: number; updatedAt: string; notebook?: string; disclaimer: string; method?: string };
  lineages: { id: string; label: string }[];
  gradeScale: { grade: string; meaning: string }[];
  overview: { headline: string; paragraphs: string[] };
  observations: ReviewItem[];
  timeline: ReviewItem[];
  evidence: ReviewItem[];
  people: ReviewItem[];
  locations: ReviewItem[];
  contradictions: ReviewItem[];
  hypotheses: ReviewItem[];
  priorities: ReviewItem[];
  openQuestions: ReviewItem[];
  biasAudit: ReviewItem[];
  provenance: ReviewItem[];
  projectCritique: { overstated?: string[]; understated?: string[]; organizedPoorly?: string[] };
  humanReview: ReviewItem[];
  changes: { date: string; summary: string }[];
  /** File the review was loaded from (archive-relative). */
  file: string;
}

export interface ReviewNote {
  id: string;
  itemId: string;
  decision: string;
  grade: string | null;
  note: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
}
