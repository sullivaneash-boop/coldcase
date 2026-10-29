# Independent review (Claude analysis layer)

`case_review.json` is the structured independent cold-case review that the research board shows under **Command center**. It is **AI analysis, not evidence**. It never changes the canonical registers.

## Layers, and how to tell them apart

| Layer | Where it lives | Shown on the board as |
| --- | --- | --- |
| Source material | `09_SOURCE_LIBRARY/` originals (unchanged) | Sources, source viewer |
| Structured facts | `00_ADMIN/data_registers/*.csv` (claims, events, evidence…) | Board records, "Reported"/"Alleged" status |
| Claude analysis | this folder (`case_review.json`) | Command center items labelled "Claude analysis", with grades |
| Hypotheses | `case_review.json` → `hypotheses` | Command center → Hypotheses, labelled "Hypothesis" |
| Human notes and decisions | `00_ADMIN/data_registers/review_decisions.csv` (append-only, `item_kind = ANALYSIS_ITEM`) | "Your notes" under each item |

## Editing

- **Change the analysis**: edit `case_review.json` directly. Item IDs (`OBS-`, `TL-`, `EV-`, `CX-`, `H-`, `PR-`, `BA-`, `PV-`, `HR-`, `OQ-`, `PP-`, `LC-`) are stable; keep them when rewording. `recordIds` must be existing register IDs. Unknown IDs show up as sync warnings.
- **Agree, disagree, mark for review, change a grade or add a note**: use the buttons on each item in the local board (`npm run dev`). Each click appends one row to `review_decisions.csv`; the latest row per item wins. A grade change is stored as decision `REGRADE` with the new grade in `note` as `[grade:PROBABLE] …`. Nothing rewrites `case_review.json` or the registers.
- **Connect or disconnect records**: use the existing researcher-link control in the inspector.
- Run `npm run case:sync` from `tools/research_board` after editing.

The concise notebook is `/LEAD_DETECTIVE_REVIEW.md` at the archive root.
