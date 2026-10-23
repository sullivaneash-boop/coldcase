// Writes the deployment artifacts produced by buildCase. All outputs are regenerated from the
// archive on every sync/build and are git-ignored; the archive in Git is the only input.
//
//   public/data/case-bundle.json     board data (entities, edges, provenance, inbox, research status)
//   public/data/sources/<SRC>.json   per-source reading payload (renditions + text), loaded lazily
//   public/archive/<archive path>    copies of archived images/PDFs served statically
//   generated/validation-report.*    ERROR/WARNING report for people and the research agent
//   generated/sync-state.json        row hashes for "changes since last sync" (local only)
import fs from "node:fs";
import path from "node:path";
import type { Issue } from "../src/lib/types";
import type { BuildResult } from "./build";

export interface OutputPaths {
  appRoot: string;
  archiveRoot: string;
}

const writeJson = (file: string, value: unknown) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value));
};

export function changesSince(appRoot: string, rowHashes: BuildResult["rowHashes"]) {
  const stateFile = path.join(appRoot, "generated", "sync-state.json");
  let prev: Record<string, Record<string, string>> = {};
  try { prev = JSON.parse(fs.readFileSync(stateFile, "utf8")).rowHashes ?? {}; } catch { /* first sync */ }
  const changes: Record<string, { added: string[]; changed: string[]; removed: string[] }> = {};
  for (const [reg, rows] of Object.entries(rowHashes)) {
    const before = prev[reg] ?? {};
    const added = Object.keys(rows).filter((k) => !(k in before));
    const changed = Object.keys(rows).filter((k) => k in before && before[k] !== rows[k]);
    const removed = Object.keys(before).filter((k) => !(k in rows));
    if (added.length || changed.length || removed.length) changes[reg] = { added, changed, removed };
  }
  return changes;
}

export function writeOutputs(result: BuildResult, p: OutputPaths) {
  const dataDir = path.join(p.appRoot, "public", "data");
  const archiveOut = path.join(p.appRoot, "public", "archive");

  // Replace data atomically enough for a dev server: write sources first, bundle last.
  const srcDir = path.join(dataDir, "sources");
  fs.rmSync(srcDir, { recursive: true, force: true });
  for (const [id, doc] of result.sourceDocs) writeJson(path.join(srcDir, `${id}.json`), doc);
  writeJson(path.join(dataDir, "case-bundle.json"), result.bundle);

  // Mirror publishable archive files; copy only changed files, drop ones no longer referenced.
  let copied = 0;
  for (const rel of result.publish) {
    const from = path.join(p.archiveRoot, rel);
    const to = path.join(archiveOut, rel);
    const st = fs.statSync(from);
    if (fs.existsSync(to) && fs.statSync(to).size === st.size && fs.statSync(to).mtimeMs >= st.mtimeMs) continue;
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
    copied++;
  }
  const wanted = new Set([...result.publish].map((r) => path.join(archiveOut, r)));
  const prune = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, d.name);
      if (d.isDirectory()) {
        prune(full);
        if (!fs.readdirSync(full).length) fs.rmdirSync(full);
      } else if (!wanted.has(full)) fs.rmSync(full);
    }
  };
  prune(archiveOut);

  writeReport(result.issues, path.join(p.appRoot, "generated"), result.bundle.meta.syncedAt ?? "");
  writeJson(path.join(p.appRoot, "generated", "sync-state.json"), { syncedAt: result.bundle.meta.syncedAt, rowHashes: result.rowHashes });
  return { copied, published: result.publish.size };
}

export function writeReport(issues: Issue[], dir: string, at: string) {
  fs.mkdirSync(dir, { recursive: true });
  const errors = issues.filter((i) => i.level === "ERROR");
  const warnings = issues.filter((i) => i.level === "WARNING");
  writeJson(path.join(dir, "validation-report.json"), { generatedAt: at, errors: errors.length, warnings: warnings.length, issues });
  const group = (list: Issue[]) => {
    const by = new Map<string, Issue[]>();
    for (const i of list) by.set(i.code, [...(by.get(i.code) ?? []), i]);
    return [...by.entries()].map(([code, l]) => `### ${code} (${l.length})\n\n${l.map((i) => `- ${i.message}`).join("\n")}`).join("\n\n");
  };
  fs.writeFileSync(path.join(dir, "validation-report.md"),
    `# Case validation report\n\nGenerated ${at}. ${errors.length} error(s), ${warnings.length} warning(s).\n` +
    `Errors block automated deployment. Warnings are recorded and allow deployment.\n\n## Errors\n\n${errors.length ? group(errors) : "None."}\n\n## Warnings\n\n${warnings.length ? group(warnings) : "None."}\n`);
}
