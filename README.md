# Levi Frady case research archive

This is a local foundation for independent research, an eventual research application, a podcast and a documentary/docuseries. The archive contains the six-file GBI intake plus 13 historical newspaper page PDFs and 12 logical article records. Source/file provenance and provisional research registers are populated. All newspaper claims remain attributed and REPORTED, with independent human review pending. No live case research has been performed.

## Directory guide

| Directory | Purpose |
| --- | --- |
| `00_ADMIN` | Research rules, source ratings, data dictionary, canonical CSV registers, reusable templates and change log. |
| `01_MASTER_CASE` | Sourced case overview and open research questions. |
| `02_TIMELINE` | Human-readable master timeline and working views. |
| `03_PEOPLE` | People and organization profiles linked to registers. |
| `04_LOCATIONS` | Sourced location profiles. |
| `05_EVIDENCE` | Evidence catalog notes and clearly marked working copies. |
| `06_WITNESS_STATEMENTS` | Attributed transcriptions and comparisons of preserved versions. |
| `07_LAW_ENFORCEMENT` | Agencies, documented jurisdiction and public case materials. |
| `08_RECORDS_REQUESTS` | Drafts, submissions, correspondence and manifests of received material. |
| `09_SOURCE_LIBRARY` | Canonical unchanged originals, separate derivatives and source notes. |
| `10_THEORIES` | Explicit hypotheses, competing explanations and disconfirming tests. |
| `11_ANALYSIS` | Human source comparisons, contradiction reviews and research memos. |
| `12_MAPS` | Geographic data, working maps and exports. |
| `13_MEDIA` | Photo/audio/video working copies and edits. |
| `14_INTERVIEWS` | Planning, consent, restrictions, transcripts and research notes. |
| `15_AI_WORKSPACE` | Labeled AI hypotheses, comparisons, prompts and validation queue. |
| `16_PODCAST` | Development, scripts, production and exports. |
| `17_DOCUSERIES` | Development, outlines/scripts, production and exports. |

## Canonical records and stable IDs

All registers reside in `00_ADMIN/data_registers/`; topic folders link to them rather than maintaining competing CSV copies. Read `00_ADMIN/DATA_DICTIONARY.md` for complete headers, value conventions and validation rules.

| Record | Prefix |
| --- | --- |
| Source | SRC- |
| Claim | CLM- |
| Contradiction | CON- |
| Person | PER- |
| Organization | ORG- |
| Location | LOC- |
| Event | EVT- |
| Evidence item | EVD- |
| Witness statement version | WIT- |
| Records request | REQ- |
| Interview | INT- |
| Claim/source attribution | CSL- |
| Contradiction alternative | CVR- |
| Event time assertion | ETM- |
| Sourced relationship | REL- |
| Source file | FIL- |

Append an immutable UUID to the prefix. `WSE-` UUIDs group versions of the same witness account. IDs never change when names or assessments change. Filenames may include readable suffixes, but references use IDs. No example case records are supplied.

The five supporting registers preserve source-level support, alternative versions, competing timestamps, relationships and file processing history. Semicolon-delimited ID lists in the requested registers support practical CSV editing; attribution tables retain exact locators. Lists should later migrate to typed SQL junction tables. CSV is an interchange format and does not enforce foreign keys or validate values.

## Methodology and source intake

1. Read `00_ADMIN/RESEARCH_RULES.md` and `00_ADMIN/SOURCE_RATING_SYSTEM.md` before entry. Use neutral language and preserve uncertainty.
2. Assign a SRC ID. Record who acquired the material, when, from where, its publication date, underlying event dates, access date, rights and restrictions. Use `00_ADMIN/templates/SOURCE_INTAKE_TEMPLATE.md`.
3. Preserve the received bytes at `09_SOURCE_LIBRARY/originals/<source_id>/<original_filename>`. Avoid collisions without changing file contents. Record SHA-256, byte size and path in source_files; source registration is not authentication of the document's assertions. Originals may include documents, images, recordings or web captures. Record capture method and limitations in source notes.
4. Keep OCR, edited media, redacted documents and transcripts outside originals. Register derivatives in source_files with parent file IDs and transformation details. Never overwrite the original to improve readability. A new source edition receives a separate SRC ID.
5. Create or reference PER, ORG, LOC, EVT and EVD records only when supported. Record exact source locators for consequential assertions. One claim per CLM row, with support/contrary material in claim_sources. A source rating does not determine the claim's status.
6. Preserve each witness account version as a separate WIT record, with source, locator, date and representation type. Keep hearsay distinct from firsthand observation. Compare versions without erasing earlier wording.
7. Store incompatible accounts in contradictions plus contradiction_versions. Keep alternative event times in event_times. Do not automatically choose a winner, average timestamps or treat repeated reports as independent corroboration.
8. Update the master timeline as a readable view of the registers. Write human analysis in `11_ANALYSIS`, tests of theories in `10_THEORIES`, and source-based scripts in production folders. Keep source IDs/locators in production research notes so edits remain traceable.
9. Validate references, file hashes and restrictions. Record substantive decisions and previous assessments in `00_ADMIN/change_log/` using dated Markdown entries with record IDs, author, before/after and rationale. Use backups and access controls before real ingestion.

## Files, media and geography

CSV paths are relative to this archive root and use `/`, so the archive can move between systems. Keep one canonical original; topic, media and production folders contain links/manifests or labeled derivatives. Do not use symlinks as the sole portable source reference. Use `<record_id>__short-description.ext` for new working files and ISO dates for logs. GeoJSON in WGS84 is a practical interchange choice for maps; retain original CRS and precision when transforming geographic data.

An evidence catalog entry describes an item or a source's report of it. It does not establish possession, authenticity or an official chain of custody. Restriction labels do not provide encryption or permissions. Avoid unnecessary sensitive personal data in filenames and general notes.

## AI analysis

AI-GENERATED ANALYSIS IS NOT EVIDENCE. Store prompts in `15_AI_WORKSPACE/prompts`, raw hypotheses in generated_hypotheses, comparisons in source_comparisons, and candidates awaiting human checks in validation_queue. Use the AI analysis template to capture model/run metadata, input IDs/hashes, prompt, output and review. Verify every proposed citation against the underlying material. Only independently sourced, human-reviewed assertions enter the claims register. Do not cite AI output as corroboration. Decide privacy and provider handling before uploading real material.

## Future application

No application, database or package dependency is created. Stable text IDs, explicit relationships, portable paths and documented uncertainty permit later migration to SQLite or PostgreSQL. At migration, create typed junction tables for ID lists, enforce foreign keys/enums, validate dates and retain audit history. Keep the filesystem as preserved document storage, with database paths referencing files. Do not silently coerce unknown dates or convert assessment labels into truth scores.

## Decisions before evidence ingestion

- Who may access private sources, interview identities and restricted records; which storage/encryption and AI handling policy will enforce this?
- Where will original files and encrypted backups live, who maintains them, and how often will restoration and hash verification be tested? Git alone is not a backup policy; decide whether any originals belong in version control.
- Who assigns IDs, edits registers and reviews claim status changes? For multiple editors, define a single-writer/merge procedure to avoid CSV conflicts.
- What threshold and review process will govern CONFIRMED versus WELL_SUPPORTED, contradiction resolutions and publication of sensitive assertions?
- What consent, retention, withdrawal and publication rules will apply to interviews, recordings and third-party material?
- Which date/time convention will apply when historical material omits a timezone? Preserve ambiguity until there is support for interpretation.

These decisions do not block the empty scaffold. Resolve the relevant handling decisions before collecting or sharing affected material. The directory tree is recorded in `00_ADMIN/DIRECTORY_TREE.txt`; empty directories are intentional and may require explicit preservation when using Git or file packaging.

## Initial uploads

See `09_SOURCE_LIBRARY/README.md` for original and reading-copy links, `13_MEDIA/README.md` for image links, `00_ADMIN/FILE_NAMING_CONVENTIONS.md` for future upload names, and `00_ADMIN/change_log/2026-10-23__initial-gbi-uploads.md` for intake provenance.

## Historical newspaper ingestion

Batch BATCH-FCN-1997-001 preserves 13 Forsyth County News page PDFs and catalogs 12 distinct case-related items from October 26 to November 12, 1997. The prior note that research registers are unpopulated describes the initial GBI intake only; they now contain attributed, provisional newspaper research records. Start with `00_ADMIN/ingestion_batches/BATCH-FCN-1997-001/BATCH-FCN-1997-001_REPORT.md`. Reusable process: `00_ADMIN/NEWSPAPER_INGESTION_PROTOCOL.md`; tools: `tools/newspaper_ingest/`. All new claims are REPORTED, and human review remains open.

## Markdown inbox

Default inbox: `_INGEST/MARKDOWN/` (separate from `_INGEST/PDF/`). Say “Ingest my new markdown sources.” See `00_ADMIN/MARKDOWN_SOURCE_INGESTION_PROTOCOL.md`. The first Markdown batch is documented in `00_ADMIN/ingestion_batches/BATCH-MD-001/BATCH-MD-001_REPORT.md`; missing underlying records are tracked in `09_SOURCE_LIBRARY/WANTED_SOURCES.md`.

Newspaper ingestion: [BATCH-FCN-MIXED-002 report](00_ADMIN/ingestion_batches/BATCH-FCN-MIXED-002/BATCH-FCN-MIXED-002_REPORT.md), nine unique pages / 13 article items, human review pending.

Autonomous research: [protocol](00_ADMIN/AUTONOMOUS_RESEARCH_PROTOCOL.md), [queue](15_AI_WORKSPACE/research_queue.md), [run reports](15_AI_WORKSPACE/research_runs/INDEX.md). Hourly local chat automation configured; setup/permission limitations recorded in 00_ADMIN/AUTONOMOUS_RESEARCH_SETUP.json.
