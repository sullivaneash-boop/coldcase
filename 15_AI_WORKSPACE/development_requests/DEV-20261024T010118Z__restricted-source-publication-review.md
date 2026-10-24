# Development / handling review: restricted source publication boundary

Status: OPEN. RUN-20261024T010118Z.

A mixed, publicly hosted 21-page PDF was preserved internally under review_pending/BATCH-RESEARCH-20261024-001. It includes personal information and unrelated allegations. Source authenticity/attachment boundaries are not established. No SRC, FIL or claim rows have been created for this packet; its bytes/OCR are not authorized for public release. A minimal nonidentifying review item is in the batch human-review queue.

Observed pipeline behavior: pipeline/build.ts lines68–73 adds existing source_files paths to the public publish set based on extension, with no access_restriction decision in that loop; outputs.ts copies the publish set. The restriction label displayed by the UI does not demonstrate enforcement. No code changes attempted. This does not establish existing restricted sources have been exposed; that separate audit was not performed.

Before registering a restricted packet for the public board, a developer/human must establish approved handling: source metadata may be cataloged without private content being mirrored, and raw/OCR/preview derivatives must share the exclusion. Tests should verify restricted files cannot enter publish outputs, with explicit reviewer decisions for any sanitized derivative. Preserve originals and provenance internally. Do not remove restrictions or alter evidence to pass a release gate. Review which portions may legitimately be cataloged/published before source registration. No independent record requests/outreach authorized.

Acceptance: documented metadata-only/restricted-source behavior, applicable tests, no private bytes in public/archive or source renderers, reviewed derivative policy, and safe separate ingestion. Existing extra-register-copy and production-target/protected-commit review items also remain open.


## Reconciliation correction

Hold files were already tracked by priorcommit1207ae7. Removed only from the next Git tree with git rm --cached and ignored locally; raw files/hashes remain. No history rewrite. No raw/OCR/previews registered in public source_files/assets, and generated publish set must be verified clear. Human review of prior repository visibility/history remains HIGH.
