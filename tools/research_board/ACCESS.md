# Public guided case and source workspace

The user authorized public access on November 9, 2026. `/`, `/workspace`, public source payloads and reviewed images require no sign-in or passphrase. `/access` redirects to the workspace, retaining valid source deep links. Public browsing never permits archive writes; the mutation endpoints return403.

The archive remains complete and unchanged locally. `11_ANALYSIS/independent_review_2026-11-09/publication.json` explicitly identifies reviewed records, source renditions, paragraph omissions and images, with hashes. Publication fails if approved content changes. Arbitrary register fields, personal research notes, review queues, unverified allegations, unreviewed sources, raw newspaper pages containing unrelated material and full prior AI analysis are not included in deployed artifacts. Omitted passages in public reading derivatives are visibly marked; original bytes are not changed. Stable IDs and source-local time precision are retained. Source metadata retains attribution and external publisher/archive URLs.

`case:sync` produces the public edition by default. An explicitly requested local development sync can use `CASE_LOCAL_WORKSPACE=1`; Vercel and production-mode syncs cannot use this switch. Do not expose a full local development server publicly. Generated public directories are pruned during sync so excluded files do not linger after switching editions.

The guide remains sourced from guided_case.json. `/review-notes` shows selected unchanged excerpts of the prior AI review to make the critique inspectable, clearly labeled as analysis rather than evidence. All other prior analysis remains local. Personal guide notes use sessionStorage and text export; no submission to the archive or server occurs.

The new sanitized preview URL is made public with a URL-scoped Vercel protection override, not a project-wide protection change. Older deployments retain protection. Production is not promoted or changed. No workspace secret or temporary verification link is needed.
