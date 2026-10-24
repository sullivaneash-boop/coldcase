# Research automation production-release protocol

Applies after every hourly PROJECT LEVI research loop. This is authorization for validated research/data releases through the existing Git/Vercel integration. It does not authorize autonomous application development, branch reconfiguration, force-pushes or duplicate manual deployments. Read together with AUTONOMOUS_RESEARCH_PROTOCOL.md. Research sources and records remain canonical; deployment failures must never be hidden by modifying evidence.

## 1. Determine meaningful change

Capture beginning-of-run Git status/HEAD and semantic research/data hashes. Compare with final source/register/board content. A real acquisition, source/claim/event/provenance/review update or substantive research correction counts. Logs, timestamps, cache churn, generated IDs/order with unchanged meaning, this policy setup and failed-search-only bookkeeping do not by themselves justify production deployment. Do not include someone else's pre-existing work as the run's change.

If nothing meaningful changed: no empty commit, no push, no deployment. Record exactly **No deployment required** in the run log. Keep the research log even on a no-op. Do not run a production build simply to create deployment-worthy changes.

## 2. Preflight repository and scope

The existing repository remote is https://github.com/sullivaneash-boop/coldcase.git. A linked Vercel project was verified: coldcase, project prj_4BeeDRR0Ge81xE5RKUX7licH22Ye, team team_DmkGw1i8EDsKyZset7xPxhoe. These identify a project, not its Production Branch. Current local branch main is not proof of the Vercel production branch. The read-only connector responses at setup did not expose that setting. Verify it from current authoritative project settings before any release; if inaccessible or ambiguous, stop and create/update a development request. Never guess or change the Production Branch to fit the local branch.

Inspect staged, unstaged, untracked paths and all local commits ahead of the verified remote production branch; check the complete prospective push diff as well as this run's delta. Fetch current remote refs when allowed. If fetch/auth/permissions fail, remote is ahead/diverged, a merge/rebase is required, other work is staged, or protected changes are present, stop and record the blocker. Never stash, discard, reset, amend, force-push or silently bundle concurrent/unrelated work.

Routine allowed changes are sourced research/data/registered archive files, research notes/queues/wanted/open questions/review/development requests, ingestion manifests/audits/run logs and the established generated board output. Review each path explicitly; no blanket git add -A or force-add ignored files. Generated paths currently produced by the pipeline are tools/research_board/public/data/, tools/research_board/public/archive/ and tools/research_board/generated/. Respect the repository's tracking/ignore policy; caches, build outputs and generated local sync/release timestamps alone are not meaningful research changes. Do not publish excluded/restricted source assets contrary to archive rules.

Protected paths include application source/UI/API code, scripts/pipeline/test code, package.json/lockfiles/dependencies, Next/TypeScript/deployment/GitHub workflow configuration, .gitignore, credentials/auth/environment files, permissions and archive schema/protocol configuration. Unexpected protected changes anywhere in the prospective push block the release, even if the research agent did not cause them. Preserve them and request separate developer/human review. The research agent does not refactor, add script aliases, change dependencies, repair app bugs or rewrite deployment configuration to pass a gate. If the app cannot represent a discovery, create a development request rather than alter application code.

Never stage credentials, secrets, auth state, temporary acquisition downloads, unrelated files, local databases/cache, node_modules or .next build output. Temporary downloads belong outside the commit; only deliberate, provenance-registered source acquisitions belong in the archive. Review staged diffs for accidental disclosure with available established checks; never print secret values in logs.

## 3. Required gates (sequential; stop at first blocking failure)

Use tools/research_board as command working directory, with CASE_ARCHIVE_ROOT pointing to the existing archive. Re-read package scripts; do not assume historical command meanings.

1. `npm run case:sync` — run the established synchronization. Nonzero/error blocks release. Preserve validation output.
2. `npm run case:validate` — nonzero exit or blocking ERROR blocks release. Warnings may proceed only where the established validator explicitly permits them; record their codes/count and rationale. Never suppress errors or convert them to warnings to release.
3. `npm run case:release-check` — required full release gate. It must include required tests, type checking and production build, with successful exit/results for every step. Any blocking failure or missing required command/result blocks release. No npm --if-present, skipped failing test, reduced test scope or fabricated PASS. Stop, log output/exit and create a development request. Do not push.

At setup, case:sync and case:validate existed and validation returned 0 errors/0 warnings. A full tests/typecheck/build runner existed as npm run case, but case:release-check did NOT exist. This is a development prerequisite, not permission for the hourly research agent to create an alias or substitute an unapproved command silently. A developer/human must establish the required named gate. Once that work is reviewed and present, future runs should use the live established gate; this historical note must not create a permanent blocker after it is fixed.

After gates, inspect the diff again, including changes generated by checks/builds. Unexpected application/config/dependency changes or unrelated staged/local commits still block production push. A gate is valid only for the exact file/commit state being released; if source/data changes after checks, rerun relevant gates. Do not include post-check unvalidated research changes. An audit-only final SHA/deployment-status log update may be kept locally for the next normal research commit; never recursively trigger another production push just to record deployment metadata.

## 4. Commit and push validated research only

If meaningful changes, scope and all gates pass, stage an explicit reviewed list, confirm git diff --cached --check and inspect cached content, then create a descriptive commit such as:

`research: ingest sources and update case board [automated]`

Include `Research-Run: RUN-<timestamp>` and run date in the message/body. Commit only the reviewed state. Capture full SHA. Recheck branch/remote/HEAD and prospective push scope. Push normally to the branch verified as Vercel's Production Branch. If not already on it or safe fast-forward publication cannot be established, stop for review; do not switch/reset/merge someone else's work. Do not push a research branch and call it production. No force pushes, no auto developer fixes.

Use the existing Git/Vercel integration. A successful Git push is the deployment trigger; do not run vercel --prod/create_deployment as a second trigger, recreate a project or redeploy an unrelated commit.

## 5. Verify the deployment for this exact commit

When status is accessible, find the deployment for the verified project, production target/branch and exact pushed commit SHA. Queued/building is PENDING, not success. Verify successful completion and production assignment before reporting Production updated: YES; an unrelated/latest older deployment proves nothing. Use bounded status checks; if pending at run end, persist deployment ID/commit as a follow-up target rather than claiming success or creating a duplicate deployment.

On failed/canceled deployment: record deployment ID, commit, URL and available diagnostics; create a DEVELOPMENT REQUEST; Production updated: NO. Do not alter source/evidence data to hide the failure, force-promote a failed deployment, or replace/redeploy the last known-good production deployment. Preserve the known-good production target; if platform routing is unexpectedly changed, flag it immediately rather than guessing a rollback target. Application/deployment repairs belong to a separate development agent/human review.

## 6. Development requests and run report

Create/update `15_AI_WORKSPACE/development_requests/DEV-<UTC timestamp>__<topic>.md` for validation/release/scope/target/deployment blockers or missing app capability. Include run ID/date, precise observed error, affected records/files (without secrets), reproduction command/results, desired behavior/acceptance checks and what remains blocked. Research-agent fixes are limited to legitimate source-backed data corrections within the research protocols; never change factual data merely to appease a build. Existing requests are deduplicated rather than recreated hourly.

Every run report MUST contain:

```
Data changed: YES/NO
Validation: PASS/WARN/FAIL
Release check: PASS/FAIL
Commit: <full SHA or NONE>
Push: SUCCESS/FAILED/NOT REQUIRED
Vercel deployment: SUCCESS/FAILED/PENDING/NOT REQUIRED
Production updated: YES/NO
```

Record actual commands, exits, warnings, blocked/skipped stages and brief reasons immediately below. PASS means executed and passed, not merely configured. With no meaningful change, say No deployment required; skipped checks are explicitly NOT RUN. The requested Release check enum has no NOT RUN option: use FAIL with detail NOT RUN / no release required (or blocked by prerequisite), meaning deployability was not established, not that tests were executed and failed. The same fail-closed convention applies to Validation if it was not run. If a release was required but a gate held it before push, use Push: FAILED with detail NOT ATTEMPTED—blocked by gate; never claim a network push failed if it was not attempted. Vercel: NOT REQUIRED when no push occurred; PENDING when a push/deployment occurred but success is unverified. Commit: NONE unless a commit was actually created. Preserve last known-good production.

## Reconciliation correction — 2026-10-24

The old saved project ID is stale. `00_ADMIN/VERIFIED_PRODUCTION_TARGET.json` records the verified current project/repository and effective Production Branch from two authoritative live connector responses: get_git_deployment_context and the current Git-sourced production deployment with repository metadata. That deployment uses main at1207ae7. The project summary alone omitted Git/branch fields; omission was not proof the repository was disconnected. Recheck exact project/repo, current production source/ref and prospective commit before pushing; record any evidence change instead of repeatedly blocking on the old404note. No infrastructure was reconfigured.

Persist each pipeline stage. Do not run a new research acquisition when a prior batch/run or required publication stage is unfinished. Record PIPELINE_STOPPED_AT and the actual failure; a successful research acquisition is not RUN COMPLETE. NO_MEANINGFUL_CHANGE skips publication honestly. Restricted review_pending content is local-only and must remain outside Git/public artifacts, including OCR/previews.
