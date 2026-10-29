# DEVELOPMENT REQUEST — iCloud-evicted ("dataless") files stall typecheck/sync

Status: OPEN (diagnosed 2026-10-29 by Claude during the independent review). This is probably the root cause of `DEV-20261023T215618Z__release-typecheck-timeout.md` and `DEV-20261023T215618Z__archive-register-read-stall.md`.

## Observation

- The archive lives in `~/Documents`, which iCloud Drive syncs with "Optimize Mac Storage". macOS had evicted files to the cloud (`ls -lO` shows `compressed,dataless`): about 14,500 files in `tools/research_board/node_modules`, 117 in `.next`, 27 in `.next-release`, 2 in `src/`, and about 300 in the archive.
- `tsc --noEmit` and `tsx scripts/case.ts sync` sat at 0% CPU, blocked on reads of evicted files (lsof showed `node_modules/@base-ui/...d.mts` and `node_modules/fsevents/package.json`). This matches the "stalled with no diagnostic" pattern in earlier runs.
- The `"… 2.ts"` / `"cache 2"` duplicate files behind the earlier TS2300 errors are iCloud conflict copies.
- `brctl download <path>` (or simply reading a file) materializes it. Downloads proceed but can take minutes for node_modules.

## Options (owner decision)

1. Move the repository out of iCloud-synced folders (e.g. `~/Code/LEVI-FRADY-CASE`) and update `CASE_ARCHIVE_ROOT` and the documented canonical path. This is the cleanest fix, but it changes the canonical path recorded in AGENTS.md.
2. Keep the location, and exclude `node_modules`, `.next` and `.next-release` from iCloud: rename them with a `.nosync` suffix and symlink, or mark the folder "Keep Downloaded" in Finder.
3. Add a pre-flight in `scripts/release.ts` that counts `dataless` files and fails fast with a clear message instead of hanging.

No application or dependency code was changed for this.
