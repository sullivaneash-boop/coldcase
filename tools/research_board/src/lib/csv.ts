import fs from "node:fs";
import { parse } from "csv-parse/sync";

export type Row = Record<string, string>;

export function readCsv(file: string): Row[] {
  if (!fs.existsSync(file)) return [];
  const text = fs.readFileSync(file, "utf8").replace(/^﻿/, "");
  if (!text.trim()) return [];
  return parse(text, { columns: true, skip_empty_lines: true, relax_column_count: true }) as Row[];
}

function cell(v: string | undefined | null): string {
  const s = v ?? "";
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function csvLine(headers: string[], row: Row): string {
  return headers.map((h) => cell(row[h])).join(",") + "\n";
}

/** Create the file with a header row if needed, then append rows. Never rewrites existing rows. */
export function appendCsv(file: string, headers: string[], rows: Row[]) {
  if (!fs.existsSync(file) || fs.statSync(file).size === 0) {
    fs.writeFileSync(file, headers.join(",") + "\n", "utf8");
  }
  if (rows.length) fs.appendFileSync(file, rows.map((r) => csvLine(headers, r)).join(""), "utf8");
}

export const splitIds = (v: string | undefined | null): string[] =>
  (v ?? "").split(";").map((s) => s.trim()).filter(Boolean);
