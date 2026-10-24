# Development request — research release prerequisites

Status: OPEN. Created 2026-10-23T20:25:45.054440+00:00. Research automation configuration update; no new research acquisition in this turn. No production push attempted.

## Observed blockers

1. `tools/research_board/package.json` has case:sync and case:validate, but no case:release-check. The full runner scripts/release.ts is currently wired to npm run case and includes sync/validation, tests, typecheck and production build. A developer must review/establish the required case:release-check entry point without weakening these steps. The research agent must not modify package/scripts to repair this.
2. Existing uncommitted protected changes include application components/APIs, dependencies/package-lock, configuration and pipeline/tests. Preserve this work. Separate development review/release must establish a clean production baseline; research automation must not bundle it.
3. Existing Git remote: https://github.com/sullivaneash-boop/coldcase.git; local branch main. Connected Vercel project coldcase (`prj_4BeeDRR0Ge81xE5RKUX7licH22Ye`, team `team_DmkGw1i8EDsKyZset7xPxhoe`) verified by read-only connector. Responses did not expose Production Branch; do not infer it from main or remote default. Establish authoritative branch verification before production research pushes.

## Verification performed

`npm run case:validate` exited 0: 0 errors, 0 warnings. This does not establish release readiness; required named release-check is absent and no full release check was run here. No commit, push or deployment performed. Saved Git status: `15_AI_WORKSPACE/research_runs/CONFIG-20261023T202545Z/git_status_before.txt`.

## Acceptance checks

- Reviewed app baseline has no pending protected or unrelated changes in a research release diff, including local commits ahead of the production branch.
- case:release-check exists, invokes required tests/type checking/production build and exits nonzero on a blocking step; demonstrate intentional failure blocks push.
- Verify Vercel Production Branch/project linkage using current authoritative settings and exact commit deployment checks.
- A meaningful data-only change passes sync/validate/release, gets a run-linked commit and Git-triggered production deployment; a no-op says No deployment required and makes neither commit nor deployment.
- Source/evidence data remain unchanged to hide no failure; failed deployments preserve known-good production.

## Developer response — 2026-10-23 (Claude Code, application work)

- Blocker 1 addressed: `npm run case:release-check` now exists. It is the same runner as `npm run case` (scripts/release.ts): sync + validation, tests, typecheck and production build, stopping with a non-zero exit at the first failing step. See `00_ADMIN/AUTOMATED_RESEARCH_DEPLOYMENT.md`.
- Blocker 2: the pending application/pipeline/dependency changes are a reviewed developer change set. They are committed separately as a developer commit, not bundled into a research release. Until that commit is on the verified production branch, research releases remain blocked by protected local commits, as the protocol requires.
- Blocker 3 remains OPEN: the Production Branch and Root Directory of Vercel project `coldcase` could not be read (the assistant's Vercel connection lacks access to that team scope). A human must verify the settings listed in AUTOMATED_RESEARCH_DEPLOYMENT.md.
- Note: the generated board output (`tools/research_board/public/data`, `public/archive`, `generated`) is git-ignored by design. Vercel regenerates it from the archive at build time, so research commits never contain generated files.

## RUN-20261023T205418Z prerequisite recheck (2026-10-23T21:05:19.503592+00:00)

- The named case:release-check now exists in committed app work (834d96a). Executed successfully: sync/validation, tests, type checking and production build; 0 errors/0 warnings. Missing-alias prerequisite is RESOLVED as observed in this run.
- Former application working-tree changes are now in local commit 834d96a, but `git fetch origin` succeeded and `origin/main..HEAD` still contains that application-development commit. An hourly research push would send it too. Do not bundle it; separate developer/human release needed.
- Pre-existing uncommitted research protocol and AGENTS changes remain. They are outside this run's research-data delta and must not be swept into a routine push.
- Authoritative Vercel Production Branch remains unverified. Existing connector responses did not expose it; no target assumed and no Vercel setting changed.
- This run has meaningful research data, validation PASS and release-check PASS, but Commit NONE, Push FAILED (NOT ATTEMPTED—scope/target gates), Vercel NOT REQUIRED, Production updated NO. Existing request remains OPEN for the unresolved release prerequisites.

## RUN-20261023T215618Z gate result

Named release gate exists. Archive sync/validation and17 tests pass, but typecheck exceeded five minutes; terminated the exact stalled child, runner exited1, build skipped. See DEV-20261023T215618Z__release-typecheck-timeout.md. No app repair, commit/push or deployment. Fresh git fetch still shows834d96a ahead oforigin/main; Production Branch remains unverified. Original missing-alias item stays resolved, but current runtime failure blocks release.

## RUN-20261024T010118Z live project identity check

Saved ID prj_4BeeDRR0Ge81xE5RKUX7licH22Ye with supplied team returned404 not_found from get_project. Same-team list_projects search coldcase returned prj_9kocBQ5Vwt3e3EYIiORDORoZB4Xz; get_project succeeds for that candidate, but connector summary exposes neither Git repository linkage nor Production Branch. Same name is not proof of the authorized Git-linked target. Do not silently replace saved identity or infer main from local branch. Reconcile authoritative project settings and current Git link; no config changed, no push attempted. CLI vercel not found locally. Protected local commit834d96a remains separately held.

## RUN-20261024T050519Z current recheck

Saved projectprj_4BeeDRR0Ge81xE5RKUX7licH22Ye again404not_found. Previously discovered same-team candidateprj_9kocBQ5Vwt3e3EYIiORDORoZB4Xz returns coldcase metadata but noGit link/Production Branch. Target remains unverified, no settings changed. Protected ahead commit834d96a and protected uncommitted protocol/AGENTS work still present; no staging or push.

## RUN-20261024T070249Z live target/scope check

Saved authorizedprojectID404not_found persists. Known same-team candidate returns coldcase summary without Git link/Production Branch; target identity not substituted. Protected pending commit834d96a and protected local protocol/AGENTS work remain. No staging/push. Gate separately failedTS2300.


## RUN-20261024T080519Z live recheck

Sync/validation0errors/0warnings,17tests andtypecheck pass; production build interrupted due concurrent developer gate (see gate request). SavedVercelID404,knowncandidate summary still lacksGit link/Production Branch. git fetch succeeded; protected834d96a stillahead plus protecteduncommitted release.ts/next.config/protocol/AGENTS. Preserve work; no commit/push. Production target remainsunverified.


## RUN-20261024T111019Z current gate/target recheck

Fullcase:release-checkPASS:17tests,typecheck,lint,productionbuild;0validationerrors/warnings. git fetch succeeds,origin/main..HEADempty at1207ae7; formerprotected-aheadcommit blockerRESOLVED in observedliveGitstate. No protectedworkingtreechanges found; priorresearch/logwork muststillnotbeblanketstaged. SavedVercelID404; candidateprj_9kocBQ5Vwt3e3EYIiORDORoZB4Xzsummary has updatedREADYproductiondeployment but neitherGitlinknorProductionBranch. Those settings remainOPEN; no identity substitution/mainassumption, no commit/push. Required acceptance: verify authorizedproject/repository/ProductionBranch fromauthoritativesettings, then validatedscopepublication.


## RUN-20261024T120918Z target recheck

OwnfullgatePASS (tests/typecheck/lint/build),0validationerrors/warnings. Refreshedorigin/main..HEADempty; no protectedcodechange. Savedproject404; knowncandidatecoldcasesummary still lacksGitlink/ProductionBranch. ExistingREADYdeployment not thisrun. No commit/push or duplicate deploy. Target verification remainsOPEN; historicalmissingalias/build/scopeblockers not assertedcurrent.


## RUN-20261024T131435Z currenttargetcheck

FullgatePASS;0validationerrors/warnings;refreshedorigin/main..HEADempty,no protectedcodechange. Savedproject404; knowncandidate summary still omitsGitlink/ProductionBranch. ExistingREADYdeployment not thisrun. CommitNONE/pushNOTATTEMPTED; targetverification remainsOPEN. No applicationrepair or duplicate deployment.
