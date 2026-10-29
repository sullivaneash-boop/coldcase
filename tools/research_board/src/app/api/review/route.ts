// Records a human response to an independent-review (analysis) item (local board only).
// Appends to 00_ADMIN/data_registers/review_decisions.csv with item_kind ANALYSIS_ITEM (append-only; latest wins).
// Never edits case_review.json or the case registers: the analysis file stays the analyst's draft.
import crypto from "node:crypto";
import { REVIEW_DECISIONS_CSV, REVIEW_DECISION_HEADERS, isReadOnly, loadGeneratedBundle, readOnlyResponse } from "@/lib/archive";
import { appendCsv } from "@/lib/csv";
import { ANALYSIS_DECISIONS, ANALYSIS_GRADES, type AnalysisDecision, type ReviewItem } from "@/lib/types";

const LISTS = [
  "observations", "timeline", "evidence", "people", "locations", "contradictions", "hypotheses", "priorities",
  "openQuestions", "biasAudit", "provenance", "humanReview",
] as const;

export async function POST(req: Request) {
  if (isReadOnly()) return readOnlyResponse();
  const body = (await req.json()) as { itemId?: string; decision?: AnalysisDecision; grade?: string; note?: string };
  if (!body.itemId || !body.decision || !ANALYSIS_DECISIONS.includes(body.decision)) {
    return Response.json({ error: "itemId and a valid decision are required" }, { status: 400 });
  }
  if (body.decision === "REGRADE" && !(ANALYSIS_GRADES as readonly string[]).includes(body.grade ?? "")) {
    return Response.json({ error: "a regrade needs one of the defined grades" }, { status: 400 });
  }
  const note = (body.note ?? "").trim().slice(0, 4000);
  if (body.decision === "NOTE" && !note) return Response.json({ error: "a note cannot be empty" }, { status: 400 });
  const bundle = loadGeneratedBundle();
  if (!bundle?.review) return Response.json({ error: "review data not generated — run npm run case:sync" }, { status: 503 });
  const item = LISTS.flatMap((l) => (bundle.review![l] ?? []) as ReviewItem[]).find((i) => i.id === body.itemId);
  if (!item) return Response.json({ error: "unknown review item" }, { status: 404 });

  const decidedAt = new Date().toISOString();
  const decidedBy = process.env.RESEARCHER_NAME ?? "local-researcher";
  const grade = body.decision === "REGRADE" ? body.grade! : null;
  const stored = grade ? `[grade:${grade}] ${note}`.trim() : note;
  const id = `DEC-${crypto.randomUUID()}`;
  const ids = item.recordIds ?? [];
  appendCsv(REVIEW_DECISIONS_CSV, REVIEW_DECISION_HEADERS, [{
    decision_id: id, item_id: item.id, item_kind: "ANALYSIS_ITEM", decision: body.decision, note: stored,
    decided_by: decidedBy, decided_at: decidedAt,
    entity_ids: ids.filter((r) => !r.startsWith("SRC-")).join(";"), source_ids: ids.filter((r) => r.startsWith("SRC-")).join(";"),
  }]);
  return Response.json({ ok: true, note: { id, itemId: item.id, decision: body.decision, grade, note: note || null, decidedBy, decidedAt } });
}
