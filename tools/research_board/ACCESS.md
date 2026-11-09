# Guided case and protected workspace

`/` loads only `/guide/case.json` and the source-registered portrait. The canonical editorial dataset is `11_ANALYSIS/independent_review_2026-11-09/guided_case.json`; `case:sync` generates this projection. It does not replace the CSV registers or the prior Claude review.

`/workspace`, `/data/**`, `/archive/**` and existing write APIs require a signed, expiring HttpOnly session. `/access` accepts the server-only `CASE_WORKSPACE_SECRET` (at least 32 characters). Missing configuration fails closed. No secret is stored in Git or a client bundle. Image optimization is disabled to avoid caching protected archive images through a separate endpoint. The original image/PDF viewer remains available after sign-in.

For a local development session only, `CASE_LOCAL_WORKSPACE=1 npm run dev` enables the workspace; this switch cannot bypass protection in production or on Vercel. Do not expose that development server publicly. Use the passphrase flow when testing production builds.

The preview branch requires a separate secret scoped to `codex/levi-guided-investigation`. Provisioning was blocked by automatic approval review pending explicit approval to send this credential to Vercel; the deployed workspace therefore remains locked. Production is deliberately unconfigured. The local passphrase is in `.env.local`. The project also uses existing Vercel preview access protection. No access protection was disabled. A future production release requires review and deliberate production access configuration.

Guide notes are opt-in sessionStorage drafts and downloadable text, never evidence register edits. They clear when the browser session ends. The full workspace retains its existing browser-local notes and read-only deployment behavior. Returning to `/` restores the last chapter in the same session.
