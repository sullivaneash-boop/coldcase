/**
 * Case pipeline CLI.
 *
 *   tsx scripts/case.ts sync        archive → validated board data (public/data, public/archive)
 *   tsx scripts/case.ts validate    validation only; writes nothing except generated/validation-report.*
 *
 * Flags:
 *   --readonly     mark the deployment read-only (no inbox decisions / researcher links). Implied on Vercel.
 *   --no-archive-writes   never append discovered assets to 00_ADMIN/data_registers/assets.csv. Implied by --readonly.
 *   --quiet        print only the summary line and errors.
 *
 * Exit status is 1 when validation finds ERRORs (deployment must not proceed), 0 otherwise.
 */
import path from "node:path";
import { appendCsv } from "../src/lib/csv";
import { buildCase, ASSET_COLUMNS } from "../pipeline/build";
import { changesSince, writeOutputs, writeReport } from "../pipeline/outputs";

const APP_ROOT = path.resolve(__dirname, "..");
const ARCHIVE_ROOT = path.resolve(process.env.CASE_ARCHIVE_ROOT ?? path.join(APP_ROOT, "..", ".."));

const args = process.argv.slice(2);
const mode = args.find((a) => !a.startsWith("--")) ?? "sync";
const readOnly = args.includes("--readonly") || !!process.env.VERCEL || process.env.CASE_READONLY === "1";
const archiveWrites = mode === "sync" && !readOnly && !args.includes("--no-archive-writes");
const quiet = args.includes("--quiet");

if (!["sync", "validate"].includes(mode)) {
  console.error(`Unknown mode "${mode}". Use "sync" or "validate".`);
  process.exit(2);
}

const t0 = Date.now();
const result = buildCase({ archiveRoot: ARCHIVE_ROOT, readOnly });
const { errors, warnings } = result.bundle.meta.validation;

if (mode === "validate") {
  writeReport(result.issues, path.join(APP_ROOT, "generated"), result.bundle.meta.syncedAt ?? "");
} else {
  if (archiveWrites && result.newAssetRows.length) {
    appendCsv(path.join(ARCHIVE_ROOT, "00_ADMIN", "data_registers", "assets.csv"), ASSET_COLUMNS, result.newAssetRows);
  }
  const changes = changesSince(APP_ROOT, result.rowHashes);
  const out = writeOutputs(result, { appRoot: APP_ROOT, archiveRoot: ARCHIVE_ROOT });
  if (!quiet) {
    console.log(`\nArchive: ${ARCHIVE_ROOT}`);
    for (const [k, v] of Object.entries(result.stats.registers as Record<string, number>)) console.log(`  ${k.padEnd(24)} ${v}`);
    console.log(`\n  ${result.stats.entities} records · ${result.stats.edges} links · ${result.stats.assets} assets (${result.newAssetRows.length} newly discovered${archiveWrites ? ", appended to assets.csv" : ", not written"}) · ${result.stats.inbox} inbox items`);
    console.log(`  ${out.published} archive files published (${out.copied} copied this run) · data version ${result.bundle.meta.dataVersion}${readOnly ? " · READ-ONLY build" : ""}`);
    const changed = Object.entries(changes);
    console.log(changed.length ? "\nChanges since last sync:" : "\nNo register changes since last sync.");
    for (const [k, c] of changed) console.log(`  ${k.padEnd(24)} +${c.added.length} ~${c.changed.length} -${c.removed.length}`);
  }
}

const show = (level: "ERROR" | "WARNING", limit: number) => {
  const list = result.issues.filter((i) => i.level === level);
  if (!list.length) return;
  console.log(`\n${level}S (${list.length}):`);
  for (const i of list.slice(0, limit)) console.log(`  ${level === "ERROR" ? "✖" : "!"} [${i.code}] ${i.message}`);
  if (list.length > limit) console.log(`  … ${list.length - limit} more in generated/validation-report.md`);
};
show("ERROR", 200);
if (!quiet) show("WARNING", 40);
console.log(`\n${mode === "sync" ? "Sync" : "Validation"} finished in ${((Date.now() - t0) / 1000).toFixed(1)}s: ${errors} error(s), ${warnings} warning(s). Report: tools/research_board/generated/validation-report.md`);
if (errors > 0) {
  console.log("✖ Validation ERRORs present — production must NOT be updated until they are fixed.");
  process.exit(1);
}
