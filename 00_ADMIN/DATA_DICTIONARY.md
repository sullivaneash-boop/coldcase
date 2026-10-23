# Data dictionary and interchange conventions

All CSV files are UTF-8, RFC 4180 compatible, with one header row. Registers begin empty and receive sourced research records during ingestion. Empty fields mean unknown/not recorded, never false, zero or a negative finding. One record per row; quote commas, quotes and newlines with a CSV-aware editor.

## IDs and relationships

IDs use a table prefix and an immutable UUID, e.g. `<PREFIX>-<UUID>`. The angle-bracket expression is a format placeholder, not a record. Generate UUIDs at intake with a standard library or trusted UUID generator. Never derive IDs from names, dates or row numbers; never recycle them. The first column is the primary key. All other ID references must resolve to an existing row of the appropriate type. `statement_series_id` uses `WSE-<UUID>` as a grouping key; it is not a separate person or statement record.

Fields ending `_ids`, plus `people_mentioned` and `locations_mentioned`, contain semicolon-separated stable IDs, no names, with no spaces or duplicates. These are convenience association lists, not duplicated entities. `people_mentioned` references PER and `locations_mentioned` references LOC. `source_ids` indicates support/context only as specified by the table; it is not an automatic assertion of truth. `claim_sources.csv` is authoritative for claim-to-source support/contradiction and precise locators; the claim lists are synchronized summaries. `relationships.csv` stores other sourced, directed associations. Use it as the authoritative relation when a list needs evidence or qualifiers. Do not infer involvement or guilt from a mention.

For SQL migration, create one table per register, replace each ID list with a typed junction table, and expand generic relationships into typed links with foreign keys. Preserve IDs as text primary keys, add foreign keys and checks, import in a transaction, and report unresolved references. CSV itself enforces no constraints. Keep date precision and uncertainty rather than coercing partial dates into SQL timestamps.

## Shared field semantics

- `created_at`, `updated_at`: UTC RFC 3339 timestamps; preserve creation time on edits. `notes`: human context, never a substitute for sourced assertions.

- `local_file`, `*_file`, `*_directory`, `storage_reference`: archive-root-relative POSIX paths, no absolute machine paths or `..`; storage_reference may be a documented external custody reference rather than a local file. URLs remain in URL columns.

- Date-only fields: ISO 8601 `YYYY-MM-DD`, `YYYY-MM` or `YYYY` at known precision. A `_date_precision` field uses DAY / MONTH / YEAR / RANGE / UNKNOWN; range endpoints are stored separately where available, otherwise describe the range in notes. Operational timestamps (`submitted_at`, `due_at`, etc.) use RFC 3339 when a time is known, or ISO dates for date-only deadlines.

- Event `start_at` / `end_at` and asserted equivalents may be full offset-bearing RFC 3339 timestamps or partial/date-only ISO values matching `time_precision`. `timezone`: IANA zone when known; leave blank if unknown. Never invent an offset. `time_precision`: SECOND / MINUTE / HOUR / DAY / MONTH / YEAR / UNKNOWN. `time_status`: EXACT / APPROXIMATE / RANGE / UNKNOWN. EXACT means exact at the stated precision. Ranges are inclusive bounds; blank endpoints represent unknown bounds. Approximation tolerance belongs in notes and original wording.

- `confidence`: HIGH / MEDIUM / LOW / UNKNOWN; human assessment, not probability. Explain basis in assessment_rationale or notes. `access_restriction`: PUBLIC / INTERNAL / RESTRICTED / UNKNOWN; labels do not enforce security.

- `knowledge_basis`: FIRSTHAND / HEARSAY / MIXED / UNKNOWN. `primary_or_secondary`: PRIMARY / SECONDARY / MIXED / UNKNOWN. `sha256`: 64 lowercase hex characters computed from original file bytes. `source_locator`: page/paragraph/line, audio or video timecode, or an exact web section/quotation anchor.

- Lists and aliases: aliases uses semicolon-separated names; it is not an ID relation. Avoid sensitive identifiers unless needed and authorized. Field names not further constrained below are descriptive free text.

## Register schemas

### `sources.csv` — `SRC-`

`source_id`, `title`, `author`, `publisher`, `publication_date`, `publication_date_precision`, `underlying_event_start`, `underlying_event_end`, `underlying_event_date_precision`, `source_type`, `original_url`, `archive_url`, `local_file`, `date_accessed`, `acquired_at`, `acquired_by`, `reliability_class`, `primary_or_secondary`, `knowledge_basis`, `people_mentioned`, `locations_mentioned`, `sha256`, `mime_type`, `language`, `access_restriction`, `rights_notes`, `notes`, `created_at`, `updated_at`

### `claims.csv` — `CLM-`

`claim_id`, `claim`, `status`, `confidence`, `source_ids`, `contradicting_source_ids`, `people_ids`, `event_ids`, `location_ids`, `evidence_ids`, `assessment_rationale`, `reviewed_by`, `reviewed_at`, `notes`, `created_at`, `updated_at`

### `contradictions.csv` — `CON-`

`contradiction_id`, `subject`, `description`, `event_ids`, `claim_ids`, `status`, `resolution_notes`, `reviewed_by`, `reviewed_at`, `notes`, `created_at`, `updated_at`

### `people.csv` — `PER-`

`person_id`, `display_name`, `aliases`, `identity_status`, `profile_file`, `access_restriction`, `notes`, `created_at`, `updated_at`

### `organizations.csv` — `ORG-`

`organization_id`, `name`, `organization_type`, `parent_organization_id`, `jurisdiction_description`, `jurisdiction_source_ids`, `profile_file`, `notes`, `created_at`, `updated_at`

### `locations.csv` — `LOC-`

`location_id`, `name`, `location_type`, `parent_location_id`, `address`, `latitude`, `longitude`, `coordinate_reference_system`, `coordinate_precision_meters`, `coordinate_source_ids`, `profile_file`, `access_restriction`, `notes`, `created_at`, `updated_at`

### `events.csv` — `EVT-`

`event_id`, `title`, `neutral_description`, `time_status`, `start_at`, `end_at`, `timezone`, `time_precision`, `original_time_text`, `source_ids`, `people_ids`, `organization_ids`, `location_ids`, `confidence`, `notes`, `created_at`, `updated_at`

### `evidence.csv` — `EVD-`

`evidence_id`, `title`, `evidence_type`, `description`, `source_ids`, `event_ids`, `people_ids`, `location_ids`, `custody_status`, `custodian_organization_id`, `reported_chain_of_custody`, `storage_reference`, `access_restriction`, `notes`, `created_at`, `updated_at`

### `witness_statements.csv` — `WIT-`

`statement_id`, `statement_series_id`, `version_number`, `supersedes_statement_id`, `witness_person_id`, `recorded_by_person_id`, `recorded_by_organization_id`, `statement_date`, `statement_date_precision`, `underlying_event_ids`, `source_id`, `source_locator`, `knowledge_basis`, `representation_type`, `transcript_file`, `language`, `access_restriction`, `notes`, `created_at`, `updated_at`

### `records_requests.csv` — `REQ-`

`request_id`, `recipient_organization_id`, `requester_name`, `subject`, `scope`, `submitted_at`, `submission_method`, `status`, `agency_reference`, `acknowledged_at`, `due_at`, `due_date_basis`, `last_follow_up_at`, `next_action_at`, `fee_estimate`, `fee_paid`, `currency`, `request_file`, `correspondence_directory`, `response_source_ids`, `restriction_notes`, `notes`, `created_at`, `updated_at`

### `interviews.csv` — `INT-`

`interview_id`, `interviewee_person_id`, `interviewer_person_ids`, `scheduled_at`, `started_at`, `ended_at`, `timezone`, `status`, `consent_status`, `consent_file`, `usage_restrictions`, `recording_source_ids`, `transcript_source_ids`, `statement_ids`, `planning_file`, `notes`, `created_at`, `updated_at`

### `claim_sources.csv` — `CSL-`

`claim_source_id`, `claim_id`, `source_id`, `relationship`, `source_locator`, `excerpt`, `knowledge_basis`, `notes`, `created_at`, `updated_at`

### `contradiction_versions.csv` — `CVR-`

`contradiction_version_id`, `contradiction_id`, `version_text`, `source_id`, `source_locator`, `claim_id`, `event_id`, `statement_id`, `asserted_start_at`, `asserted_end_at`, `timezone`, `time_precision`, `original_time_text`, `notes`, `created_at`, `updated_at`

### `event_times.csv` — `ETM-`

`event_time_id`, `event_id`, `source_id`, `source_locator`, `time_status`, `start_at`, `end_at`, `timezone`, `time_precision`, `original_time_text`, `confidence`, `notes`, `created_at`, `updated_at`

### `relationships.csv` — `REL-`

`relationship_id`, `from_record_id`, `relationship_type`, `to_record_id`, `source_id`, `source_locator`, `notes`, `created_at`, `updated_at`

### `source_files.csv` — `FIL-`

`source_file_id`, `source_id`, `file_role`, `local_file`, `sha256`, `mime_type`, `byte_size`, `derived_from_file_id`, `transformation_description`, `created_by`, `created_at`, `notes`

## Table-specific rules

- **sources**: one acquired document, recording, page or edition per SRC. A changed edition gets a new SRC linked by `relationships` (`REVISION_OF`). `publication_date` is not event time. `underlying_event_*` is optional coarse coverage; specific events belong in events. `source_type`: DOCUMENT / NEWS_ARTICLE / WEB_PAGE / PHOTO / AUDIO / VIDEO / INTERVIEW / OTHER. Authors and publishers may be printed credits; link identified people/organizations separately. `date_accessed` is an ISO date; acquisition time can differ. `reliability_class`: A–G or blank pending review. `local_file` and `sha256` summarize the principal original; file-level manifests are authoritative when multiple files exist.

- **claims**: one atomic assertion per row. `status`: CONFIRMED / WELL_SUPPORTED / REPORTED / ALLEGED / DISPUTED / RUMOR / UNKNOWN / REJECTED. CONFIRMED requires documented human verification against adequate direct material; WELL_SUPPORTED requires strong traceable support; REPORTED records an attributed report; ALLEGED records an unestablished allegation; DISPUTED has unresolved contrary material; RUMOR has unverified circulation; UNKNOWN lacks assessment; REJECTED has documented reasons to reject. None assigns guilt. Explain every consequential status change and retain previous assessments in the change log.

- **claim_sources**: relationship SUPPORTS / CONTRADICTS / CONTEXT_ONLY. Excerpt is optional faithful source text, with locator, not an AI paraphrase. Distinguish what a source says from what it establishes.

- **contradictions**: one incompatibility under review. `status`: UNRESOLVED / OPEN / UNDER_REVIEW / RESOLVED / UNRESOLVABLE. Use UNRESOLVED for newly ingested conflicts; OPEN remains accepted for older records. RESOLVED requires a human rationale and linked source support; retain all alternatives and earlier assessments. No automatic winner. **contradiction_versions**: one source-specific alternative per row, so several sources asserting the same version still receive distinct attributed rows. Link at least one source and locator; optional claim/event/statement links narrow context. Two or more incompatible alternatives constitute a comparison.

- **people**: identity_status CONFIRMED_IDENTITY / PROVISIONAL / UNKNOWN describes identification only. Keep distinct identities separate pending evidence; source aliases and any merge decision through relationships and change log. Profiles contain sourced research, never unsourced role labels implying guilt.

- **organizations**: parent_organization_id references ORG. Jurisdiction descriptions must identify the scope/time period and cite source IDs; a jurisdictional role is not inferred from geography. Organization_type is descriptive (agency, court, publisher, etc.).

- **locations**: parent_location_id references LOC. Coordinates use decimal degrees only with an explicit CRS (normally EPSG:4326); positive coordinate_precision_meters is uncertainty radius, not a measured accuracy claim. Coordinates and addresses are optional and require sources.

- **events**: neutral description with related IDs. Keep competing times in **event_times**, one attributed assertion per row; any summary time must be explicitly justified in notes. An unknown time is blank, never a zero date. Differences may also link to a contradiction.

- **evidence**: catalog of reported physical or documentary items, not a claim of possession. evidence_type PHYSICAL / DOCUMENTARY / DIGITAL / OTHER. custody_status RESEARCH_COPY_ONLY / REPORTED_HELD_BY_AGENCY / PERSONALLY_HELD / UNKNOWN. Reported chain of custody must be sourced; do not assert a forensic chain from research copies. Custodian references ORG only when supported. Preserve files through SRC/FIL records.

- **witness_statements**: one recorded version per row; witness_person_id references PER; source_id references SRC. statement_series_id groups versions of the same account, not every statement by a witness. version_number is a positive sequence assigned for cataloging and does not establish chronology or truth. supersedes_statement_id references WIT only if an explicit revision exists; an independent later account need not supersede an earlier one. representation_type VERBATIM / PARAPHRASE / TRANSLATION / MIXED / UNKNOWN. Preserve all versions and their dates, locators, acquisition provenance and knowledge basis. Use contradiction_versions and human comparison notes for incompatible passages.

- **records_requests**: status DRAFT / SUBMITTED / ACKNOWLEDGED / PARTIAL_RESPONSE / COMPLETED / DENIED / APPEALED / WITHDRAWN. No deadline is inferred automatically. due_date_basis records the documented reason/source for any due date. Monetary values are decimal, nonnegative, no currency symbols; currency uses ISO 4217. Response material receives SRC IDs; response manifests point to originals rather than duplicating them.

- **interviews**: status PLANNED / SCHEDULED / COMPLETED / CANCELED. consent_status NOT_REQUESTED / PENDING / GRANTED / LIMITED / DECLINED / WITHDRAWN / UNKNOWN. Usage restrictions and consent control handling; granted consent is not unlimited permission. Recording and transcript IDs reference SRC; attributed statements reference WIT.

- **relationships**: from/to_record_id use existing entity IDs; relationship_type is a documented uppercase verb such as MENTIONS, MEMBER_OF, DERIVED_FROM or REVISION_OF. Direction matters. Record a source and locator for factual associations; unsourced administrative links must be identified in notes. Contradictory factual relations belong in claims/contradictions too.

- **source_files**: one actual stored file per row; file_role ORIGINAL / OCR / TRANSCRIPT / REDACTED / OTHER_DERIVATIVE. derived_from_file_id references FIL; required for derivatives where a parent file exists. transformation_description records tool/version/operator and process. byte_size is a nonnegative integer. Keep source provenance distinct from processing provenance.

## Intake validation checklist

Check unique IDs, resolvable foreign references, valid enums, ISO dates and time precision, matching claim-source summaries, file existence, SHA-256 hashes, restrictions, exact locators and retained statement versions. Require source_id plus locator for claim-source links, event-time assertions and contradiction alternatives. Leave unknown information blank and explain consequential gaps. Before SQL import, resolve any incomplete required references or quarantine the records for review.

## Newspaper ingestion extensions (BATCH-FCN-1997-001)

- `newspaper_articles.csv` is a dependent article metadata index keyed by the existing article `source_id` (a foreign key to sources, not a second independent entity ID). It includes publication/date/page/edition, headline/subhead/byline, genre/rating, page-source IDs, original filenames/archived paths, reading/raw paths, OCR quality/relevance, entity IDs, summary, completeness and notes. Do not count page and article SRCs as independent corroboration. Multi-path and filename lists are semicolon-delimited; only ID lists are foreign-key lists. Summary is analysis, not source text.
- `claim_sources` adds `speaker_person_id` (optional PER reference) and `assertion_type` (NEWSPAPER_ASSERTION, ATTRIBUTED_OFFICIAL_STATEMENT/REPORT, ATTRIBUTED_AGENCY_REPORT, REPORTED_PERSON_ACCOUNT, RELAYED_ACCOUNT, ATTRIBUTED_FAMILY_ACCOUNT, SIGNED_FAMILY_LETTER, REPORTED_SCHOOL_ACCOUNT, ATTRIBUTED_PERSON_STATEMENT, DATE_CONFLICT). SUPPORTS describes support for the attributed claim; it need not establish the underlying event as true.
- `witness_statements` adds `statement_text` (exact text or explicitly labeled synopsis), `underlying_event_start`, `underlying_event_end` (ISO dates), `confidence`, and `limitations`. Existing `statement_date` is the publication date for newspaper accounts; actual interview date stays unknown unless documented. `transcript_file` may link a reported-account synopsis, never falsely described as an original transcript.
- `events` and `event_times` add `local_start_time`, `local_end_time` (24-hour HH:MM source-local readings) and `date_precision` (DAY/MONTH/YEAR/UNKNOWN). `start_at/end_at` may hold dates only, with date_precision describing those bounds while time_precision describes the separate local clock fields. Timezone remains blank when not supplied; do not fabricate an offset. Approximate local 17:15 remains APPROXIMATE, never an exact timestamp. Without clock values, DAY precision or UNKNOWN time preserves the available wording.
- Batch manifests preserve every PDF including R0 negative results. Their `case_relevance/classification`: R0/R1/R2/R3/R4 after source review, PENDING_REVIEW before review. Extraction failure or missing OCR is never R0. `human_review_queue.csv` uses stable REV UUIDs, source IDs, OPEN status, reason, reviewer/time and resolution. Lead identifiers are local LEAD-FCN-001-NNN anchors, not evidence entities.
- Read-only raw permissions are not a forensic chain or a backup guarantee. No changes to Downloads/Documents input bytes, names, timestamps or permissions are part of ingestion.

## Saved Markdown source batches

`BATCH-MD-*` manifests and source_metadata.csv catalog captures, publication metadata, source ratings/relevance, hashes, original/reading paths and duplicate dispositions. These are dependent batch indexes, not additional SRC entities. A full-file hash differs from the article-body identity hash. Identical body plus same URL can share one logical SRC only after review, while all raw captures remain preserved.

Batch source_chain.csv links requesting SRC IDs to held_source_id or a WNT acquisition anchor. An unheld WNT is not a source record, and EXCERPT_OR_LINK_ONLY_NOT_ACQUIRED is not possession of the original. wanted_sources.csv and WANTED_SOURCES.md preserve titles/types/URLs/requesting SRC IDs and NOT_ACQUIRED status. The independence field prevents repeated secondary reports being mistaken for independent corroboration. References to illustrative/related items require role review; byline metadata links are not requested as evidence. Linked-image rendition grouping describes acquisition identity, not byte identity.

Claim attribution types added: SECONDARY_ATTRIBUTED_REPORT, SAVED_PAGE_ASSERTION, REPEATS_SAME_UNDERLYING_ACCOUNT, REPEATS_HELD_NEWSPAPER. They preserve reporting layers and do not raise the claim’s truth status. Community comments remain lead material separately from the article.

## Research board registers (tools/research_board)

The research board (`tools/research_board/`) is a generated, read-only projection of this archive (static JSON under `public/data`, archived file copies under `public/archive`, both git-ignored). It is not a case database. Only the local board writes to the three append-only registers below, and it never edits other registers, source files or batch artifacts. Regenerate with `npm run case:sync` inside `tools/research_board/`. `00_ADMIN/board_config.json` holds display settings only: `title` and `timelineWindows` (each with `label`, `start`, `end` as ISO dates with `end` exclusive, and optional `hourly`). See `AUTOMATED_RESEARCH_DEPLOYMENT.md`.

### `assets.csv` — `AST-`

`asset_id`, `type`, `local_path`, `original_url`, `caption`, `alt_text`, `source_id`, `related_entity_ids`, `status`, `availability`, `identity_basis`, `discovered_in`, `notes`, `created_at`, `updated_at`

One image or media reference per row: photo-source originals, image derivatives in source_files (e.g. page previews) and image references inside registered Markdown sources. IDs are UUIDv5 of source ID plus path/URL, so re-syncs are stable. Sync appends newly discovered rows and never rewrites existing ones; human edits to status or related IDs survive. `type`: IMAGE / PAGE_PREVIEW. `availability`: LOCAL / REMOTE_ONLY (bytes not archived) / EMBEDDED_IN_SOURCE / MISSING. `status`: UNASSIGNED (who/what is depicted not established by source labeling; enters the review inbox), SOURCE_LABELED (the source's own title/alt/caption is a label of a named PER, e.g. "Picture of NAME"), DERIVATIVE_INDEXED, or a later human status. `related_entity_ids` is populated only from explicit source labeling, recorded in `identity_basis`; a caption that merely mentions a name does not count. No facial recognition or visual identification is used.

### `researcher_links.csv` — `RLK-`

`researcher_link_id`, `from_record_id`, `to_record_id`, `label`, `note`, `created_by`, `created_at`, `status`

An analyst's own connection between two records, displayed as "Researcher connection — not evidence". It is never a sourced relationship, never corroboration and never implies guilt. `status`: ACTIVE / RETIRED; retire rather than delete.

### `review_decisions.csv` — `DEC-`

`decision_id`, `item_id`, `item_kind`, `decision`, `note`, `decided_by`, `decided_at`, `entity_ids`, `source_ids`

Append-only log of Discovery Inbox decisions; the latest row per `item_id` is current. `item_id` is a REV-, LEAD-, WNT- or AST- anchor, or a derived INB- UUIDv5 ID. `decision`: IN_REVIEW / ACCEPTED / MERGE_REQUESTED / IGNORED / UNRESOLVED. A decision records judgment only: it does not merge people, resolve contradictions, change claim status or close batch queue rows. Applying it to registers is a separate, change-logged human step.
