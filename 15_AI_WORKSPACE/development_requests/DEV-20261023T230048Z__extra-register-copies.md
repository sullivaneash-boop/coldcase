# Human/development review: extra register copies

Status: OPEN. Observed during RUN-20261023T230048Z. No canonical register mutation or cleanup performed.

Six untracked files named `* 2.csv` are present beside canonical CSVs. Every row ID in each extra file exists in its corresponding canonical file, with identical field values; canonical files also have newer additional rows. Their origin is unknown. Recorded creation/modification metadata predates this run; discovery now does not establish when they appeared in this checkout. Do not infer a particular synchronization provider or cause.

| Extra file in 00_ADMIN/data_registers | Extra rows | Canonical rows | SHA-256 |
| --- | ---: | ---: | --- |
| contradiction_versions 2.csv | 8 | 12 | cca8389b26920bdacd364bdd77a3f4093c8753fb0935b326152797f6c4fcdf0b |
| contradictions 2.csv | 3 | 5 | 6a3cfcb15a68a3c245572da2c3cd5bd15257b1583f8aebda994149a8ebef8c34 |
| event_times 2.csv | 71 | 76 | ead0e3d0efe9f069a7bc03301527e8326bda0743fa82865b59a4815558a3e0d1 |
| people 2.csv | 60 | 65 | 633fd417f8df29fa606dd38701751031d2d2b3e2833e75a9efbb296892a8b5f1 |
| relationships 2.csv | 333 | 340 | 232fd427dafa0d66118c20fc6109b3c398d5b27a9ef82ed72c65181cdbef84fd |
| witness_statements 2.csv | 31 | 33 | 0c13bdd6ff4527745ab58b47bc67888986dcb08e9c1d0f29e08241e3c4a6df6a |

The review-plan helper `tools/newspaper_ingest/apply_review.py` lines 10–13 loads every `*.csv`, including these extras, and builds a set of existing IDs. Its set collapses shared IDs; a validation failure from these extras has NOT been demonstrated. They nevertheless introduce unintended table names and ambiguous register inventory for generic tooling. Board `case:validate` passed with zero errors/warnings; that does not establish intended placement of extra files.

Research agent deferred register ingestion and left every file untouched. All 208 registered source-file hashes matched; canonical registers match the run-start hashes. Existing pending register changes from earlier runs are preserved.

Requested resolution: establish file provenance and intended status; explicitly decide whether these belong outside the canonical register directory. Preserve bytes and an audit trail before any relocation. Do not replace current canonical registers with these older subsets. Review whether generic tooling should detect unexpected table names; application/script changes belong to development review, not hourly research.

Acceptance: approved register inventory; no lost canonical rows; all original hashes unchanged; existing IDs/references validated; extra copies handled explicitly without publishing them accidentally. No production push attempted. Existing protected-commit/production-branch/release-typecheck requests remain separate.
