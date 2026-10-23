# File naming conventions

Use `<SRC-ID>__<description>__<role>.<extension>` with lowercase ASCII descriptive words, hyphens within words and double underscores between components. Keep stable ID prefixes uppercase and extensions lowercase. Avoid spaces, colons, slashes and unnecessary personal data.

- Preserved upload: `09_SOURCE_LIBRARY/originals/<SRC-ID>/<SRC-ID>__<description>__original.<ext>`
- Reading copy: `09_SOURCE_LIBRARY/derivatives/<SRC-ID>/<SRC-ID>__<description>__reading-v01.md`
- Other derivatives: the same pattern with `ocr-v01`, `transcript-v01` or `redacted-v01`.
- Topic working files: `<record-ID>__<description>.<ext>`.
- Intake logs: `YYYY-MM-DD__<description>.md` with sequence suffix if needed.

Example descriptions are `gbi__levis-call`, `levi-frady__portrait`, and `possible-witness-01__composite-sketch`. Describe the item without inferring guilt or unsupported identity. Stable IDs prevent collisions; filenames are labels, not database keys.

Original content remains byte-identical even when its archival filename changes. Preserve original upload names and supplied paths in sources.csv and the intake log. Each derivative receives a FIL ID, hash, parent file ID and transformation description. Increment derivative version numbers; never overwrite an earlier version. A newly supplied edition of a source receives a separate SRC ID.

Record publication, event, download/access and ingestion dates separately; unknown dates stay blank. Do not add an ingestion date to a filename as though it were publication date. Check hashes before registering duplicate uploads. Maintain a single canonical original; topic/media indexes point to it. Downloads are left unchanged after verified archive copying.

## Newspaper raw-copy exception

Retain the exact original downloaded PDF filename under the batch-specific newspaper raw_pdfs directory. The batch manifest maps it to a stable SRC and publication/date/printed page. Readable normalization belongs in article derivative names and indexes, never by renaming the raw PDF. Generic seq-N filenames do not encode a newspaper date or establish uniqueness without hashes and page review.
