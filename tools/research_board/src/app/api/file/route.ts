// Read-only file access into the archive (images, PDFs, text) for local viewing.
import fs from "node:fs";
import path from "node:path";
import { resolveArchivePath } from "@/lib/archive";

const TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".md": "text/plain; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json",
};

export async function GET(req: Request) {
  const rel = new URL(req.url).searchParams.get("path") ?? "";
  const abs = resolveArchivePath(rel);
  const type = TYPES[path.extname(rel).toLowerCase()];
  if (!abs || !type || !fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(fs.readFileSync(abs), {
    headers: { "content-type": type, "cache-control": "no-store", "x-content-type-options": "nosniff" },
  });
}
