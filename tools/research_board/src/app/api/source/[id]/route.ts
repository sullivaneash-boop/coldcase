// Lists the readable renditions of a source (reading copy, original capture, OCR, previews, PDFs)
// and returns the text of the requested one.
import fs from "node:fs";
import { eq } from "drizzle-orm";
import * as s from "@/db/schema";
import { getDb } from "@/lib/db";
import { resolveArchivePath } from "@/lib/archive";

type Rendition = { key: string; label: string; path: string; kind: "markdown" | "text" | "image" | "pdf"; role: string };

const MAX_TEXT = 2_000_000;

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = getDb();
  if (!db) return Response.json({ error: "index not built" }, { status: 503 });
  const entity = db.select().from(s.entities).where(eq(s.entities.id, id)).get();
  if (!entity || entity.type !== "SOURCE") return Response.json({ error: "unknown source" }, { status: 404 });
  const row = JSON.parse(entity.rowJson);
  const files = db.select().from(s.sourceFiles).where(eq(s.sourceFiles.sourceId, id)).all();

  const renditions: Rendition[] = [];
  const add = (r: Rendition) => {
    if (!r.path || renditions.some((x) => x.path === r.path)) return;
    const abs = resolveArchivePath(r.path);
    if (abs && fs.existsSync(abs)) renditions.push(r);
  };
  const article = row._article as Record<string, string> | undefined;
  if (article?.reading_file) add({ key: "reading", label: "Reading transcription", path: article.reading_file, kind: "markdown", role: "READING_DERIVATIVE" });
  const sorted = [...files].sort((a, b) => Number(/reading/i.test(b.localFile ?? "")) - Number(/reading/i.test(a.localFile ?? "")));
  for (const f of sorted) {
    const p = f.localFile ?? "";
    const mime = f.mimeType ?? "";
    const role = f.fileRole ?? "";
    if (mime === "text/markdown") add({ key: f.id, label: /reading/i.test(p) ? "Reading copy" : role === "ORIGINAL" ? "Original capture (Markdown)" : "Markdown derivative", path: p, kind: "markdown", role });
    else if (mime === "text/plain") add({ key: f.id, label: /raw_text|ocr/i.test(p) ? "Raw embedded OCR text (uncorrected)" : "Text derivative", path: p, kind: "text", role });
    else if (mime.startsWith("image/")) add({ key: f.id, label: role === "ORIGINAL" ? "Original image" : "Page preview image", path: p, kind: "image", role });
    else if (mime === "application/pdf") add({ key: f.id, label: "Original PDF", path: p, kind: "pdf", role });
  }
  if (article?.raw_article_file) add({ key: "raw", label: "Raw article OCR extraction", path: article.raw_article_file, kind: "text", role: "OCR" });
  if (row.local_file) {
    const kind = /\.pdf$/i.test(row.local_file) ? "pdf" : /\.(png|jpe?g|gif|webp)$/i.test(row.local_file) ? "image" : /\.md$/i.test(row.local_file) ? "markdown" : "text";
    add({ key: "local", label: "Principal original", path: row.local_file, kind, role: "ORIGINAL" });
  }

  const want = new URL(req.url).searchParams.get("rendition") ?? renditions.find((r) => r.kind === "markdown" || r.kind === "text")?.key;
  const chosen = renditions.find((r) => r.key === want);
  let content: string | null = null;
  let truncated = false;
  if (chosen && (chosen.kind === "markdown" || chosen.kind === "text")) {
    const text = fs.readFileSync(resolveArchivePath(chosen.path)!, "utf8");
    truncated = text.length > MAX_TEXT;
    content = truncated ? text.slice(0, MAX_TEXT) : text;
  }
  return Response.json({ renditions, chosen: chosen?.key ?? null, content, truncated });
}
