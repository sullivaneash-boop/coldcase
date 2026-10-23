import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildCase } from "../pipeline/build";
import { baseTables, ID, makeArchive } from "./fixture";

const codes = (r: ReturnType<typeof buildCase>, level: "ERROR" | "WARNING") => r.issues.filter((i) => i.level === level).map((i) => i.code);

test("a valid archive builds with no errors and exposes records, provenance and timeline data", () => {
  const r = buildCase({ archiveRoot: makeArchive(baseTables()), now: "2026-01-03T00:00:00Z" });
  assert.deepEqual(codes(r, "ERROR"), []);
  const ids = new Set(r.bundle.entities.map((e) => e.id));
  for (const id of [ID.src, ID.clm, ID.per, ID.evt]) assert.ok(ids.has(id), `${id} present`);
  assert.equal(r.bundle.claimSources[0].locator, "para 1");
  assert.ok(r.bundle.edges.some((e) => e.from === ID.clm && e.to === ID.src && e.rel === "SUPPORTED_BY"));
  assert.equal(r.bundle.eventTimes.find((t) => t.eventId === ID.evt)?.localStartTime, "18:30");
  assert.equal(r.bundle.meta.research.latestSource?.id, ID.src);
});

test("never infers relationships from co-mention in the same source", () => {
  const r = buildCase({ archiveRoot: makeArchive(baseTables()) });
  const personIds = new Set([ID.per, ID.per2]);
  assert.ok(!r.bundle.edges.some((e) => personIds.has(e.from) && personIds.has(e.to)));
});

test("duplicate stable IDs are errors", () => {
  const t = baseTables();
  t["people.csv"]!.push({ person_id: ID.per, display_name: "Duplicate" });
  assert.ok(codes(buildCase({ archiveRoot: makeArchive(t) }), "ERROR").includes("DUPLICATE_ID"));
});

test("malformed IDs and records are errors", () => {
  const t = baseTables();
  t["people.csv"]!.push({ person_id: "PER-not-a-uuid", display_name: "Bad" }, { person_id: "", display_name: "No ID" });
  const e = codes(buildCase({ archiveRoot: makeArchive(t) }), "ERROR");
  assert.ok(e.includes("MALFORMED_ID") && e.includes("MALFORMED_RECORD"));
});

test("claims without sources are errors", () => {
  const t = baseTables();
  t["claims.csv"]![0].source_ids = "";
  t["claim_sources.csv"] = [];
  assert.ok(codes(buildCase({ archiveRoot: makeArchive(t) }), "ERROR").includes("CLAIM_WITHOUT_SOURCE"));
});

test("broken, impossible and unresolved-source references are errors and are never drawn", () => {
  const t = baseTables();
  t["claims.csv"]![0].people_ids = `${ID.per};PER-00000000-0000-4000-8000-0000000000ff`;
  t["claims.csv"]![0].event_ids = ID.per; // wrong record type for the field
  t["claim_sources.csv"]!.push({ claim_source_id: "CSL-00000000-0000-4000-8000-000000000002", claim_id: ID.clm, source_id: "SRC-00000000-0000-4000-8000-0000000000ff", relationship: "SUPPORTS", source_locator: "x" });
  const r = buildCase({ archiveRoot: makeArchive(t) });
  const e = codes(r, "ERROR");
  assert.ok(e.includes("BROKEN_REFERENCE") && e.includes("IMPOSSIBLE_REFERENCE") && e.includes("UNRESOLVED_SOURCE"));
  assert.ok(!r.bundle.edges.some((x) => x.to.endsWith("0000000000ff")));
});

test("invalid dates, clock times and impossible ranges are errors", () => {
  const t = baseTables();
  t["events.csv"]![0].start_at = "1990-02-30";
  t["event_times.csv"]![0].local_start_time = "25:10";
  t["event_times.csv"]![0].end_at = "1989-01-01";
  const e = codes(buildCase({ archiveRoot: makeArchive(t) }), "ERROR");
  assert.ok(e.includes("INVALID_DATE") && e.includes("IMPOSSIBLE_RANGE"));
});

test("invalid claim status is an error; malformed and duplicate URLs are warnings", () => {
  const t = baseTables();
  t["claims.csv"]![0].status = "PROVEN";
  t["sources.csv"]!.push({ source_id: ID.src2, title: "Second capture", source_type: "WEB_PAGE", original_url: "https://www.example.org/test/" });
  t["sources.csv"]![0].archive_url = "not a url";
  const r = buildCase({ archiveRoot: makeArchive(t) });
  assert.ok(codes(r, "ERROR").includes("INVALID_VALUE"));
  const w = codes(r, "WARNING");
  assert.ok(w.includes("MALFORMED_URL") && w.includes("DUPLICATE_SOURCE_URL"));
});

test("missing assets are warnings, are not published, and do not fail the build", () => {
  const t = baseTables();
  t["source_files.csv"] = [{ source_file_id: ID.fil, source_id: ID.src, file_role: "ORIGINAL", local_file: "09_SOURCE_LIBRARY/missing.png", mime_type: "image/png" }];
  t["assets.csv"] = [{ asset_id: ID.ast, type: "IMAGE", local_path: "09_SOURCE_LIBRARY/missing.png", source_id: ID.src, status: "UNASSIGNED", availability: "LOCAL" }];
  const r = buildCase({ archiveRoot: makeArchive(t) });
  assert.deepEqual(codes(r, "ERROR"), []);
  assert.ok(codes(r, "WARNING").includes("MISSING_ASSET"));
  assert.equal(r.publish.size, 0);
  const asset = r.bundle.assets.find((a) => a.id === ID.ast)!;
  assert.equal(asset.published, false);
  assert.equal(asset.availability, "MISSING");
});

test("unsafe absolute paths are errors; a modified original is an error", () => {
  const t = baseTables();
  t["sources.csv"]![0].local_file = "/Users/someone/Downloads/file.pdf";
  t["source_files.csv"] = [{ source_file_id: ID.fil, source_id: ID.src, file_role: "ORIGINAL", local_file: "09_SOURCE_LIBRARY/a.txt", sha256: "0".repeat(64), mime_type: "text/plain" }];
  const e = codes(buildCase({ archiveRoot: makeArchive(t, { "09_SOURCE_LIBRARY/a.txt": "changed" }) }), "ERROR");
  assert.ok(e.includes("UNSAFE_PATH") && e.includes("ORIGINAL_MODIFIED"));
});

test("local images are published and identities come only from explicit source labels", () => {
  const t = baseTables();
  t["sources.csv"]!.push(
    { source_id: ID.src2, title: "Test Person One — supplied portrait", source_type: "PHOTO", local_file: "09_SOURCE_LIBRARY/p.jpg" },
  );
  t["sources.csv"]!.push({ source_id: "SRC-00000000-0000-4000-8000-000000000003", title: "Poster in the Test Person One case", source_type: "PHOTO", local_file: "09_SOURCE_LIBRARY/q.jpg" });
  const r = buildCase({ archiveRoot: makeArchive(t, { "09_SOURCE_LIBRARY/p.jpg": Buffer.from([0xff, 0xd8]), "09_SOURCE_LIBRARY/q.jpg": Buffer.from([0xff, 0xd8]) }) });
  assert.ok(r.publish.has("09_SOURCE_LIBRARY/p.jpg"));
  const labelled = r.bundle.assets.find((a) => a.localPath === "09_SOURCE_LIBRARY/p.jpg")!;
  const mention = r.bundle.assets.find((a) => a.localPath === "09_SOURCE_LIBRARY/q.jpg")!;
  assert.deepEqual(labelled.relatedEntityIds, [ID.per]);
  assert.deepEqual(mention.relatedEntityIds, []);
  assert.equal(mention.status, "UNASSIGNED");
});

test("tolerates incomplete research: untitled source, unknown date, unnamed person", () => {
  const t = baseTables();
  t["sources.csv"]![0].title = "";
  t["events.csv"]!.push({ event_id: "EVT-00000000-0000-4000-8000-000000000002", title: "Undated", time_status: "UNKNOWN", source_ids: ID.src });
  t["people.csv"]!.push({ person_id: "PER-00000000-0000-4000-8000-000000000003", display_name: "" });
  const r = buildCase({ archiveRoot: makeArchive(t) });
  assert.deepEqual(codes(r, "ERROR"), []);
  assert.ok(r.bundle.entities.find((e) => e.id === ID.src)!.label.startsWith("Untitled source"));
  assert.ok(r.bundle.inbox.some((i) => i.kind === "AMBIGUOUS_DATE"));
});

test("latest finding is derived from the newest research run log", () => {
  const log = `# RUN\n\n## FINDINGS\n\nTEST finding about ${ID.clm}.\n\n## NEXT\n`;
  const r = buildCase({ archiveRoot: makeArchive(baseTables(), { "15_AI_WORKSPACE/research_runs/RUN-20260101T000000Z.md": log }) });
  assert.equal(r.bundle.meta.research.lastRun?.id, "RUN-20260101T000000Z");
  assert.match(r.bundle.meta.research.latestFinding!.text, /TEST finding/);
  assert.deepEqual(r.bundle.meta.research.latestFinding!.recordIds, [ID.clm]);
});

test("data version is deterministic for identical archives", () => {
  const root = makeArchive(baseTables());
  const a = buildCase({ archiveRoot: root, now: "2026-01-01T00:00:00Z" });
  const b = buildCase({ archiveRoot: root, now: "2026-02-01T00:00:00Z" });
  assert.equal(a.bundle.meta.dataVersion, b.bundle.meta.dataVersion);
  assert.ok(fs.existsSync(root));
});
