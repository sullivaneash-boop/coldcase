# Newspaper ingestion tools

Read `00_ADMIN/NEWSPAPER_INGESTION_PROTOCOL.md`. newspaper_ingest.py defaults to dry-run discovery; --execute preserves/extracts a new batch. apply_review.py defaults to structural validation of an explicit source-anchored plan. Neither tool edits/deletes/renames inbox files. Semantic extraction/classification requires source review by the assistant/reviewer; pending human checks remain explicit.

Mixed-year batches support `--year-map` (JSON filename → verified four-digit publication year). Default input location is the project `_INGEST/PDF` inbox. See 00_ADMIN/NEWSPAPER_INGESTION_PROTOCOL.md. Semantic review and an explicit attributed register plan remain required after preparation.
