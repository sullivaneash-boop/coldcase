// Records a human review decision for a Discovery Inbox item.
// Appends to 00_ADMIN/data_registers/review_decisions.csv (append-only; latest decision wins).
// A decision never edits case registers: applying it remains a separate, deliberate human step.
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import * as s from "@/db/schema";
import { getDb } from "@/lib/db";
import { REVIEW_DECISIONS_CSV, REVIEW_DECISION_HEADERS } from "@/lib/archive";
import { appendCsv } from "@/lib/csv";
import { INBOX_DECISIONS, type InboxDecision } from "@/lib/types";

export async function POST(req: Request) {
  const body = (await req.json()) as { itemId?: string; decision?: InboxDecision; note?: string };
  const db = getDb();
  if (!db) return Response.json({ error: "index not built" }, { status: 503 });
  if (!body.itemId || !body.decision || !INBOX_DECISIONS.includes(body.decision)) {
    return Response.json({ error: "itemId and a valid decision are required" }, { status: 400 });
  }
  const item = db.select().from(s.inboxItems).where(eq(s.inboxItems.id, body.itemId)).get();
  if (!item) return Response.json({ error: "unknown inbox item" }, { status: 404 });
  if (body.decision === "MERGE_REQUESTED" && item.kind !== "POSSIBLE_DUPLICATE_PERSON") {
    return Response.json({ error: "merge only applies to possible duplicate people" }, { status: 400 });
  }

  const decidedAt = new Date().toISOString();
  const decidedBy = process.env.RESEARCHER_NAME ?? "local-researcher";
  const note = (body.note ?? "").trim().slice(0, 4000);
  appendCsv(REVIEW_DECISIONS_CSV, REVIEW_DECISION_HEADERS, [{
    decision_id: `DEC-${crypto.randomUUID()}`,
    item_id: item.id,
    item_kind: item.kind,
    decision: body.decision,
    note,
    decided_by: decidedBy,
    decided_at: decidedAt,
    entity_ids: item.entityIds ?? "",
    source_ids: item.sourceIds ?? "",
  }]);
  db.update(s.inboxItems)
    .set({ status: body.decision, decisionNote: note || null, decidedAt, decidedBy })
    .where(eq(s.inboxItems.id, item.id))
    .run();
  return Response.json({ ok: true, status: body.decision, decidedAt, decidedBy, decisionNote: note || null });
}
