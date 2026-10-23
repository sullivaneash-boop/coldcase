// Archive location and the app-owned registers the local board may append to.
// Deployed builds are read-only: the canonical archive is only ever changed through Git.
import "server-only";
import path from "node:path";
import fs from "node:fs";
import type { CaseBundle } from "./types";

export const ARCHIVE_ROOT = path.resolve(process.env.CASE_ARCHIVE_ROOT ?? path.join(process.cwd(), "..", ".."));
export const REGISTER_DIR = path.join(ARCHIVE_ROOT, "00_ADMIN", "data_registers");

export const RESEARCHER_LINKS_CSV = path.join(REGISTER_DIR, "researcher_links.csv");
export const REVIEW_DECISIONS_CSV = path.join(REGISTER_DIR, "review_decisions.csv");

export const RESEARCHER_LINK_HEADERS = [
  "researcher_link_id", "from_record_id", "to_record_id", "label", "note", "created_by", "created_at", "status",
];
export const REVIEW_DECISION_HEADERS = [
  "decision_id", "item_id", "item_kind", "decision", "note", "decided_by", "decided_at", "entity_ids", "source_ids",
];

/** True on Vercel or when CASE_READONLY=1: the deployment must never write archive files. */
export const isReadOnly = () => !!process.env.VERCEL || process.env.CASE_READONLY === "1" || !fs.existsSync(REGISTER_DIR);

export const readOnlyResponse = () =>
  Response.json({ error: "This deployment is read-only. Record decisions and researcher links in the local board; they reach the site through Git." }, { status: 409 });

/** The generated bundle (public/data), used to validate IDs sent to the write endpoints. */
export function loadGeneratedBundle(): CaseBundle | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), "public", "data", "case-bundle.json"), "utf8"));
  } catch {
    return null;
  }
}
