# Research board

A read-only investigative board generated from the case archive. The archive at the repository root is canonical. This app contains no case facts: everything it shows is generated from the archive by the pipeline.

```bash
npm ci
npm run case:sync           # archive → validated board data (public/data, public/archive)
npm run case:validate       # validation only (ERROR blocks deployment, WARNING allows it)
npm run case:release-check  # sync + validation + tests + typecheck + production build (alias: npm run case)
npm run dev                 # http://localhost:3977
```

## Layout

| Path | What |
| --- | --- |
| `pipeline/` | `registers.ts` (load), `validate.ts` (ERROR/WARNING rules), `build.ts` (bundle, provenance, inbox, assets, research status), `outputs.ts` (write generated files) |
| `scripts/case.ts` | `sync` / `validate` CLI; exits 1 on validation errors |
| `scripts/release.ts` | release check |
| `tests/` | pipeline and time-formatting tests against synthetic fixture archives |
| `src/components/board/` | UI: desktop workspace and mobile shell |
| `src/app/api/` | local-only write endpoints (inbox decisions, researcher links); 409 on read-only deployments |

Generated and git-ignored: `public/data/`, `public/archive/`, `generated/`, `.next*`.

Environment variables: `CASE_ARCHIVE_ROOT` (default `../..`), `CASE_READONLY=1` (implied on Vercel), `RESEARCHER_NAME` (recorded on local decisions and links).

The full automation, deployment and recovery guide is in `00_ADMIN/AUTOMATED_RESEARCH_DEPLOYMENT.md`.
