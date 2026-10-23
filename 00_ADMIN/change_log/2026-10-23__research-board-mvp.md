# 2026-10-23 — Research board MVP and app-owned registers

- Author: Claude Code (assistant), at the researcher's request.
- Added `tools/research_board/`, a local Next.js research board. Its SQLite index (`tools/research_board/data/case-index.sqlite`) is a cache rebuilt from this archive by `npm run case` and may be deleted at any time.
- Added three append-only registers documented in `DATA_DICTIONARY.md`: `assets.csv` (AST-), `researcher_links.csv` (RLK-), `review_decisions.csv` (DEC-). Only `assets.csv` exists so far: the first sync appended 90 discovered asset rows. The other two are created on first use.
- Asset identity rule: a person is linked to an image only when the source's own label names them ("Picture of NAME", "NAME MUGSHOT", "photo of … NAME"). A caption that mentions a name is not treated as identification, and no image content analysis is performed. 6 rows were labelled this way; 69 remain UNASSIGNED for review.
- No existing register, source file, batch artifact or `_INGEST` file was modified.
- Sync validation surfaced one pre-existing inconsistency for human review: `CLM-895e038d-bfc6-5ce9-bb69-ef4d30aad068` lists `SRC-4c10aa08-4c99-52d7-84e2-640253c2fe53` in `claims.csv source_ids`, but there is no matching `claim_sources.csv` row.
