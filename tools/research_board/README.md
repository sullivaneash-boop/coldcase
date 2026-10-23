# Levi Frady research board

Local-only investigative research board over the case archive. The archive (`00_ADMIN/data_registers/`, `09_SOURCE_LIBRARY/`, batch folders) is canonical. `data/case-index.sqlite` is a disposable index.

```bash
npm install
npm run case        # rebuild the index from the archive (appends new rows to assets.csv)
npm run case:dry    # same, but writes nothing to the archive
npm run dev         # http://localhost:3977
```

## What sync reads

- All registers in `00_ADMIN/data_registers/`, including the app-owned `assets.csv`, `researcher_links.csv` and `review_decisions.csv`
- Per batch: `human_review_queue.csv`, `NEW_LEADS_FROM_BATCH.md`, `wanted_sources.csv`, `source_chain.csv`
- Registered Markdown sources (for image references) and `_INGEST/` (to flag files that are not yet registered)

Sync also checks for duplicate IDs, unresolved references, claim and claim_sources mismatches, missing files and SHA-256 mismatches. It reports per-register changes since the last sync.

## What the app writes

The app writes only by appending to `assets.csv` (sync), `researcher_links.csv` (Add researcher link) and `review_decisions.csv` (Inbox actions). These files are documented in `00_ADMIN/DATA_DICTIONARY.md`. Inbox decisions record judgment only and never edit registers.

## Layout

- `scripts/sync.ts`: the ingestion and rebuild command
- `src/db/`: Drizzle schema and DDL for the index
- `src/app/api/`: read-only file and source access, plus the two append endpoints
- `src/components/board/`: the workspace (board, inspector, provenance, timeline, search, source viewer, inbox)

Environment overrides: `CASE_ARCHIVE_ROOT`, `CASE_DB_PATH`, `RESEARCHER_NAME` (recorded as `decided_by` / `created_by`).
