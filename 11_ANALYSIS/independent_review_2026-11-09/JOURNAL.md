# Development and investigation checkpoint

User-authorized development, independent analysis and preview only. Branch codex/levi-guided-investigation. Production release is not authorized in this task.

RESEARCH: initial source-first interpretation preserved in PRELIMINARY.md before theory review. Official GBI pages checked live. 1997 contemporary reporting and 2004 timeline reading derivatives reviewed; full 2004 page image inspected. 2002/2007 casing accounts and archived AccessNorthGa chronology checked. Prior AI review then challenged. No new evidence acquisition or register mutation. Latest prior reconciliation run marked complete; no ingestion plan reapplied.

INGEST: not required; no new source bytes registered. External search returned secondary summaries, not a new primary case record. Original AJC/agency chronology and medical/scene records remain missing. No identity merges or contact.

RECONCILE: new editorial/analysis layer in guided_case.json; prior Claude analysis and canonical registers unchanged. Important new audit observation: prior v2 projectCritique retains narrow-window and witness-time inferences withdrawn elsewhere. Repeated renditions remain one possible dependency chain, not independent corroboration.

IMPLEMENT: in progress. Public guide is an explicit editorial projection with source IDs/locators. Full investigator data, source payloads, images/PDFs and write endpoints require access. All public case narrative is separate from raw evidence.

Data changed: YES
Validation: FAIL
Release check: FAIL
Commit: NONE
Push: NOT REQUIRED
Vercel deployment: NOT REQUIRED
Production updated: NO

Validation/release check NOT RUN yet. Not RUN COMPLETE. Next: finish UI, sync, validate, release checks, browser verification, review diff and preview branch only.

Lazyweb screenshot review completed: https://www.lazyweb.com/report/lazyweb/ae38aa62-b5bb-4336-8ae9-f614457f3c59/?source=create . No degraded slots. Recommendations consulted: separate guided/advanced modes; six-chapter step indicator; cited comparison surface. These are design suggestions, not evidence about the case or measured conversion effects. Actual app implementation remains the deliverable. No AI-generated historical imagery used.

Local verification recovery: existing node_modules and some Git objects/source files were cloud-only (dataless); reads stalled. Preserved original directory unchanged after stopping failed read/move attempts. Exact package-lock dependencies installed in /tmp/levi-board-deps; sparse checkout of origin/main 63d6371 created in /tmp/levi-clean-repo and current app changes overlaid. CASE_ARCHIVE_ROOT remains canonical. No dependency versions changed. Initial isolated release gate: 21 tests and typecheck PASS; lint correctly blocked on internal anchor navigation. Fixed with Next Link and unoptimized original Image. Re-running full gate.

## Final pre-commit checkpoint

SYNC → VALIDATE → RELEASE CHECK: PASS. Sequential required commands executed in isolated exact-code checkout against canonical CASE_ARCHIVE_ROOT; 0 errors/0 warnings, 21 tests passed, typecheck/lint/build passed. No dependency changes. Canonical board data version 4b2b944f4be9597a unchanged; guide version 396d9743a4948897. Browser: guided entry, chapters, chronology selection, evidence filter, source drawer, exact paragraph navigation, return-to-chapter, conflicts before assessment, scenario switching/matrix, note save/export verified. Responsive inspection at 1440×900 and 390×844; no desktop document overflow. Test note cleared after export.

Local production HTTP verification: guide200; unauthenticated workspace307; case bundle, individual source, archive, write endpoints401; image optimizer404. Cross-origin login403, wrong passphrase rejected, valid login produces Secure/HttpOnly signed cookie and preserves source deep link; authenticated workspace/bundle/source200 with no-store; logout expires cookie. Unit checks cover malformed/expired/wrong-secret/missing-secret cases.

Current production rechecked live: project prj_9kocBQ5Vwt3e3EYIiORDORoZB4Xz, Git source main at63d637113d44570bc8014038bfac4c98735256d5, READY dpl_7fi2b1ddiHXAoQnJYhCJHa9d7KrC. Remote main same SHA, preview branch absent. Only codex/levi-guided-investigation will be pushed. Production is not an authorized target.

Preview credential provisioning blocked: automatic approval review rejected create_project_env sending CASE_WORKSPACE_SECRET to the coldcase Vercel project without explicit approval for that credential/destination. No credential was provisioned, and no workaround was attempted. Preview archive fails closed; local protected build verified. User must approve preview-only sensitive environment variable before deployed investigator login can work.

Data changed: YES
Validation: PASS
Release check: PASS
Commit: NONE
Push: NOT REQUIRED
Vercel deployment: NOT REQUIRED
Production updated: NO

COMMIT next: explicit development/analysis paths only, then preview push and deployment verification. Full task remains pending credential approval; no RUN COMPLETE claim.

## Preview release checkpoint

COMMIT: d13d6363c79c4a85d81fd7337cd0b57e1f09df63. Explicit26-file staged diff reviewed and whitespace/secret/scope checks passed. PUSH: one normal push to codex/levi-guided-investigation. Draft review: https://github.com/sullivaneash-boop/coldcase/pull/1 (GitHub connector lacked PR permission; existing signed-in CLI succeeded).

DEPLOYMENT: Vercel READY dpl_DSCEULfvqpaTjLiFhPsdJyjSKY8v, Git source branch and full SHA match, preview target (target null), alias assigned. https://coldcase-ihkupq7j9-sullivaneash-2433s-projects.vercel.app . Build logs confirm deployed outputs, successful compile and readonly archive sync. Existing >=20 engine range selected Node26 instead of24; dependency/toolchain warnings recorded, no versions altered in this task.

PRODUCTION VERIFICATION: original production dpl_7fi2b1ddiHXAoQnJYhCJHa9d7KrC still READY at main63d637113d44570bc8014038bfac4c98735256d5 after preview completed. No promotion, merge or production env modification.

DEPLOYMENT VERIFICATION LIMIT: browser reaches Vercel sign-in. The authenticated fetch tool was also rejected by automatic approval review because it may create a23-hour share link. No bypass or protection change was attempted. Exact live guide response/dataVersion and hosted authenticated workspace remain unverified pending approved access. Expected guide396d9743a4948897, archive4b2b944f4be9597a validated locally. User approval requested for branch-only sensitive secret plus temporary verification link.

Data changed: YES
Validation: PASS
Release check: PASS
Commit: d13d6363c79c4a85d81fd7337cd0b57e1f09df63
Push: SUCCESS
Vercel deployment: SUCCESS
Production updated: NO

PIPELINE_STOPPED_AT: DEPLOYMENT VERIFICATION
Reason: platform build/SHA verified; live application verification and hosted workspace login await explicit access approval. RUN COMPLETE is not claimed. This audit-only checkpoint is intentionally local for the next normal commit; no duplicate deployment.

## User-authorized public access revision

User response: “Just keep it all public it doesnt matter.” This supersedes the secret/temporary-share-link proposal. No secret transfer is needed. Implemented public source edition with no application login, retaining the complete original archive locally. Publication manifest pins 101 reviewed records, 10 source renditions and one portrait; omissions are marked in derived public readings. Private notes, queues, unverified allegations, unreviewed full-page PDFs and full prior AI review are not emitted. Source IDs, attribution, locators and precision preserved. Selected unchanged prior-review excerpts remain inspectable. Mutation endpoints remain disabled.

SYNC → VALIDATE → RELEASE CHECK: PASS after fixing one field type guard. 23 tests pass, typecheck/lint/build pass; 0 errors/0 warnings. Public bundle version 4cbc366ba69330aa; guide396d9743a4948897; canonical archive4b2b944f4be9597a unchanged. Anonymous HTTP checks: workspace, public bundle, reviewed source and audit route200; excluded source/raw PDF404; archive mutation403; removed login endpoint404. Browser source deep link highlights P002 and displays omissions at original paragraph markers.

COMMIT/PUSH next: public revision on existing development branch. New immutable preview only will receive a URL-scoped public-access override after deployment. Existing production and older preview protections stay unchanged.

Data changed: YES
Validation: PASS
Release check: PASS
Commit: pending public-access revision
Push: NOT REQUIRED
Vercel deployment: NOT REQUIRED
Production updated: NO
