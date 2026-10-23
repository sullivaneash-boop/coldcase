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

export type EdgeCategory = "SOURCED" | "REGISTER" | "LEAD" | "RESEARCHER";

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
  meta: {
    syncedAt: string | null;
    archiveRoot: string | null;
    warnings: string[];
    openQuestionFiles: number;
  };
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
