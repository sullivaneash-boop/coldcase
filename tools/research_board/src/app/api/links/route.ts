// Creates a researcher link: an analyst's connection between two records.
// Stored in 00_ADMIN/data_registers/researcher_links.csv and always rendered as
// "Researcher connection — not evidence". It never becomes a sourced relationship.
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import * as s from "@/db/schema";
import { getDb } from "@/lib/db";
import { RESEARCHER_LINKS_CSV, RESEARCHER_LINK_HEADERS } from "@/lib/archive";
import { appendCsv } from "@/lib/csv";

export async function POST(req: Request) {
  const body = (await req.json()) as { fromId?: string; toId?: string; label?: string; note?: string };
  const db = getDb();
  if (!db) return Response.json({ error: "index not built" }, { status: 503 });
  const note = (body.note ?? "").trim();
  if (!body.fromId || !body.toId || body.fromId === body.toId || !note) {
    return Response.json({ error: "two different records and a note are required" }, { status: 400 });
  }
  for (const id of [body.fromId, body.toId]) {
    if (!db.select().from(s.entities).where(eq(s.entities.id, id)).get()) {
      return Response.json({ error: `unknown record ${id}` }, { status: 404 });
    }
  }
  const link = {
    id: `RLK-${crypto.randomUUID()}`,
    fromId: body.fromId,
    toId: body.toId,
    label: (body.label ?? "").trim().slice(0, 120) || "researcher connection",
    note: note.slice(0, 4000),
    createdBy: process.env.RESEARCHER_NAME ?? "local-researcher",
    createdAt: new Date().toISOString(),
    status: "ACTIVE",
  };
  appendCsv(RESEARCHER_LINKS_CSV, RESEARCHER_LINK_HEADERS, [{
    researcher_link_id: link.id,
    from_record_id: link.fromId,
    to_record_id: link.toId,
    label: link.label,
    note: link.note,
    created_by: link.createdBy,
    created_at: link.createdAt,
    status: link.status,
  }]);
  db.insert(s.researcherLinks).values(link).run();
  return Response.json(link);
}
