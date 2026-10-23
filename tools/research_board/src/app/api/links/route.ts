// Creates a researcher link (local board only): an analyst's connection between two records.
// Stored in 00_ADMIN/data_registers/researcher_links.csv and always rendered as
// "Researcher connection — not evidence". It never becomes a sourced relationship.
import crypto from "node:crypto";
import { RESEARCHER_LINKS_CSV, RESEARCHER_LINK_HEADERS, isReadOnly, loadGeneratedBundle, readOnlyResponse } from "@/lib/archive";
import { appendCsv } from "@/lib/csv";

export async function POST(req: Request) {
  if (isReadOnly()) return readOnlyResponse();
  const body = (await req.json()) as { fromId?: string; toId?: string; label?: string; note?: string };
  const note = (body.note ?? "").trim();
  if (!body.fromId || !body.toId || body.fromId === body.toId || !note) {
    return Response.json({ error: "two different records and a note are required" }, { status: 400 });
  }
  const bundle = loadGeneratedBundle();
  if (!bundle) return Response.json({ error: "case data not generated — run npm run case:sync" }, { status: 503 });
  const ids = new Set(bundle.entities.map((e) => e.id));
  for (const id of [body.fromId, body.toId]) if (!ids.has(id)) return Response.json({ error: `unknown record ${id}` }, { status: 404 });
  const link = {
    id: `RLK-${crypto.randomUUID()}`, fromId: body.fromId, toId: body.toId,
    label: (body.label ?? "").trim().slice(0, 120) || "researcher connection", note: note.slice(0, 4000),
    createdBy: process.env.RESEARCHER_NAME ?? "local-researcher", createdAt: new Date().toISOString(), status: "ACTIVE",
  };
  appendCsv(RESEARCHER_LINKS_CSV, RESEARCHER_LINK_HEADERS, [{
    researcher_link_id: link.id, from_record_id: link.fromId, to_record_id: link.toId, label: link.label, note: link.note,
    created_by: link.createdBy, created_at: link.createdAt, status: link.status,
  }]);
  return Response.json(link);
}
