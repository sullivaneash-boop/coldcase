# Automated research deployment

How new research reaches the live research board without anyone editing application code. Read with `RESEARCH_RELEASE_PROTOCOL.md` (release policy and run-report fields) and `AUTONOMOUS_RESEARCH_PROTOCOL.md` (research method).

```
research run ──► archive files (registers, sources, assets, logs)
             ──► npm run case:sync       archive → validated board data (local)
             ──► npm run case:validate   ERROR blocks · WARNING allows
             ──► npm run case:release-check   sync + validation + tests + typecheck + production build
             ──► git commit (reviewed research paths only) ──► git push
             ──► Vercel build: `npm run build` = read-only sync + validation + next build
             ──► live site (static, read-only)
```

## Architecture

- **The archive is canonical.** All case information lives in the archive: `00_ADMIN/data_registers/*.csv`, `09_SOURCE_LIBRARY/`, ingestion batches, `15_AI_WORKSPACE/` logs and queues. The app has no case facts in its code. Case-specific display settings (title, timeline windows) are data in `00_ADMIN/board_config.json`.
- **The board is a generated, read-only projection.** `tools/research_board/pipeline/` reads the archive and writes:
  - `public/data/case-bundle.json`: records, links, provenance, inbox, research status and validation counts.
  - `public/data/sources/<SRC>.json`: per-source reading text, loaded only when a source is opened.
  - `public/archive/<archive path>`: copies of archived web images (png/jpg/gif/webp) and PDFs.
  - `generated/validation-report.md|json`, `generated/release-check.json` and `generated/sync-state.json`.
- **None of these generated files are committed.** They are git-ignored and rebuilt deterministically from the archive on every sync and every Vercel build. Identical archives produce an identical `dataVersion`.
- **No production database.** There is no SQLite or other mutable state on Vercel. The site only reads static JSON and files.
- **Writes happen only on the local board.** Inbox decisions append to `review_decisions.csv` and researcher links to `researcher_links.csv`. Deployed builds are read-only: those controls are hidden and the endpoints return 409. Decisions reach the site through Git like any other archive change.
- **Assets.**
  - Images and PDFs registered locally are published from their archived copies.
  - Images that exist only remotely are shown as "remote image not archived" with a link to the original. They are never hotlinked.
  - Missing or unsupported files become warnings and render as honest placeholders; they never break the build.
  - A person is linked to an image only when the source's own label names them.

## Commands (run in `tools/research_board/`)

Set `CASE_ARCHIVE_ROOT` if the archive is not two directories up. The default is `../..`, the repository root.

| Command | Does | Exit ≠ 0 when |
| --- | --- | --- |
| `npm run case:sync` | Archive → board data. Appends newly discovered image references to `assets.csv` (existing rows never rewritten). Prints register changes since the last sync. | validation ERRORs |
| `npm run case:validate` | Validation only. Writes nothing to the archive; writes `generated/validation-report.*`. | validation ERRORs |
| `npm run case:release-check` (alias `npm run case`) | 1 sync + validation → 2 tests → 3 typecheck → 4 production build (into `.next-release`). Stops at the first failure and writes `generated/release-check.json`. | any step fails: **do not push** |
| `npm run build` | What Vercel runs: read-only sync + validation, then `next build`. | validation ERRORs (Vercel keeps the previous deployment live) |
| `npm run dev` | Local board on http://localhost:3977 (syncs first). | — |

### Validation

**ERRORs (block deployment):**
- duplicate or malformed IDs, and rows without IDs;
- broken references, references to the wrong record type, and unresolved source IDs;
- claims with no source;
- blank required provenance (`claim_sources`, `contradiction_versions` or `witness_statements` without `source_id`);
- invalid or impossible dates and clock times, and ranges that end before they start;
- claim status or claim_source relationship outside its allowed list;
- absolute or `..` file paths;
- a registered ORIGINAL file whose SHA-256 no longer matches the register.

**WARNINGs (recorded, deployment allowed):**
- missing locators;
- relationships without a source;
- claim summary lists that disagree with `claim_sources`;
- malformed or duplicate source URLs;
- missing asset or source files, and unsupported asset formats;
- derivative hash mismatches;
- unknown confidence, time-status or reliability values;
- unresolved `source_chain` rows;
- malformed `board_config.json`.

Never fix an ERROR by changing facts or loosening the validator. Fix the bookkeeping from the source, or open a development request.

## What the research automation may change

Routine research runs may modify:

- `00_ADMIN/data_registers/*.csv`: case registers, `assets.csv`, `researcher_links.csv` and `review_decisions.csv`, following their protocols.
- `09_SOURCE_LIBRARY/**`: new acquisitions and derivatives. Originals are never edited.
- `00_ADMIN/ingestion_batches/**`, `00_ADMIN/change_log/**`, `02_TIMELINE/**`, `01_MASTER_CASE/**`, `03_PEOPLE` … `14_INTERVIEWS` research content.
- `15_AI_WORKSPACE/**`: research runs, queue, failed searches, wanted lists and `development_requests/`.
- `00_ADMIN/board_config.json`: board title and timeline windows only.
- Generated board output under `tools/research_board/public/data`, `public/archive` and `generated`. These are produced by the commands above; they are git-ignored, so they never appear in a commit.

Routine research runs must **not** modify, and must treat as blocking if they appear in a push:

- `tools/research_board/src/**`, `pipeline/**`, `scripts/**` and `tests/**`;
- `tools/research_board/package.json`, `package-lock.json`, `node_modules`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `components.json` and `.gitignore`;
- any Vercel or GitHub configuration, credentials or `.env*`;
- `00_ADMIN/DATA_DICTIONARY.md`, the research and release protocols, and `AGENTS.md`, except with human approval.

If research reveals something the app cannot represent, write `15_AI_WORKSPACE/development_requests/DEV-<UTC>__<topic>.md`. Include what is missing, the affected records, a reproduction and the acceptance checks. Do not change application code during a research run. Data that does not fit should still be recorded faithfully in the registers. The board shows it generically; new register columns appear in the inspector's "Register row" view.

## Release sequence for a research run

1. Research and ingest following the protocols. If nothing meaningful changed, write **No deployment required** in the run log and stop. Make no commit and no push.
2. Run `npm run case:sync`, then read `generated/validation-report.md`.
3. Run `npm run case:validate` and record the error and warning counts.
4. Run `npm run case:release-check`. A non-zero exit means stop: write a development request and do not push.
5. Review `git status` and `git diff`, and stage the reviewed research paths explicitly. Never use `git add -A`. Any protected path in the diff blocks the release.
6. Commit with `research: <summary> [automated]` and `Research-Run: RUN-<timestamp>`, then push normally (no force) to the verified Vercel Production Branch.
7. Vercel builds the pushed commit with `npm run build`. If validation fails there, the build fails and production stays on the previous deployment.
8. Verify the deployment for that exact commit, and record the seven release fields required by `RESEARCH_RELEASE_PROTOCOL.md`.

## Vercel configuration (one-time, human)

These are project `coldcase` settings. The assistant could not read them because its Vercel connection lacks access to this team scope. Verify each:

| Setting | Value |
| --- | --- |
| Git repository | `sullivaneash-boop/coldcase` |
| Production Branch | `main`, or whichever branch the research agent is told to push to; record it in `RESEARCH_RELEASE_PROTOCOL.md` |
| Root Directory | `tools/research_board` |
| Include files outside the Root Directory in the Build Step | **Enabled** (default). The build reads the archive at the repository root. |
| Framework Preset | Next.js |
| Build Command | default (`npm run build`) |
| Install Command | default (`npm install`). devDependencies must be installed, which is the default. |
| Node.js version | 20.x or 22.x (`engines.node >=20`) |
| Environment variables | none required. Optional: `CASE_READONLY=1` (implied on Vercel). |
| Deployment Protection | your choice; a private preview needs Vercel Authentication / password protection on the project |

Nothing depends on Mac paths, `Downloads`, uncommitted files, local databases or secrets. Each deployment ships about 150 MB of static archive files (newspaper PDFs and page previews).

## Recovery from a bad deployment

1. **Restore the site immediately.** In Vercel → Deployments, choose the last good production deployment and use **Instant Rollback** (Promote). This changes nothing in Git.
2. **Fix the archive in Git.**
   - Find the bad commit: `git log --oneline -- 00_ADMIN 09_SOURCE_LIBRARY`.
   - If the data was wrong, revert it with `git revert <sha>` (never force-push), then run `npm run case:release-check` and push.
   - If the data was right but the app misbehaved, leave the data alone and open a development request.
3. **Pause automated releases** while investigating: leave a note in the newest run log and an OPEN development request. The release protocol tells the agent to stop when a release prerequisite is open.
4. **Confirm the fix:** `npm run case:release-check` passes, the new deployment for the fix commit is READY, and the board shows the expected `dataVersion` (More → bottom line on mobile).
