/**
 * npm run case — release check. Runs, in order, and stops at the first failure:
 *   1. case sync + validation   (ERRORs fail the check; WARNINGs are reported)
 *   2. application tests
 *   3. type checking
 *   4. production build         (into .next-release so a running dev server is untouched)
 *
 * Exit status 0 means production may be updated from the current Git state; non-zero means it must not.
 * The result is also written to generated/release-check.json.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const APP_ROOT = path.resolve(__dirname, "..");
const bin = (name: string) => path.join(APP_ROOT, "node_modules", ".bin", name);

const steps: { name: string; cmd: string; args: string[]; env?: Record<string, string> }[] = [
  { name: "sync + validation", cmd: bin("tsx"), args: ["scripts/case.ts", "sync"] },
  { name: "tests", cmd: process.execPath, args: ["--import", "tsx", "--test", "tests/*.test.ts"] },
  { name: "typecheck", cmd: bin("tsc"), args: ["--noEmit"] },
  { name: "production build", cmd: bin("next"), args: ["build"], env: { NEXT_DIST_DIR: ".next-release" } },
];

const results: { step: string; ok: boolean; seconds: number }[] = [];
let failed: string | null = null;
for (const s of steps) {
  console.log(`\n━━ ${s.name} ━━`);
  const t0 = Date.now();
  const r = spawnSync(s.cmd, s.args, { cwd: APP_ROOT, stdio: "inherit", env: { ...process.env, ...s.env } });
  const ok = r.status === 0;
  results.push({ step: s.name, ok, seconds: Math.round((Date.now() - t0) / 100) / 10 });
  if (!ok) {
    failed = s.name;
    break;
  }
}

let validation: { errors?: number; warnings?: number } = {};
try { validation = JSON.parse(fs.readFileSync(path.join(APP_ROOT, "generated", "validation-report.json"), "utf8")); } catch { /* sync failed before writing */ }
const report = { checkedAt: new Date().toISOString(), deployable: !failed, failedStep: failed, validation: { errors: validation.errors, warnings: validation.warnings }, steps: results };
fs.mkdirSync(path.join(APP_ROOT, "generated"), { recursive: true });
fs.writeFileSync(path.join(APP_ROOT, "generated", "release-check.json"), JSON.stringify(report, null, 2));

console.log("\n━━ Release check ━━");
for (const r of results) console.log(`  ${r.ok ? "✔" : "✖"} ${r.step.padEnd(20)} ${r.seconds}s`);
for (const s of steps.slice(results.length)) console.log(`  · ${s.name.padEnd(20)} skipped`);
console.log(`  validation: ${validation.errors ?? "?"} error(s), ${validation.warnings ?? "?"} warning(s)`);
console.log(failed ? `\n✖ NOT DEPLOYABLE — "${failed}" failed. Do not push to the deployment branch.` : "\n✔ DEPLOYABLE — commit and push to update production.");
process.exit(failed ? 1 : 0);
