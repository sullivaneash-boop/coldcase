import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidDateOrTimestamp, isValidIsoDate, timeText } from "../src/lib/time";

const t = (o: Partial<Parameters<typeof timeText>[0]>) => timeText({ startAt: null, endAt: null, localStartTime: null, localEndTime: null, timeStatus: null, ...o });

test("never manufactures precision", () => {
  assert.equal(t({ startAt: "1997-10-22" }), "Time not stated");
  assert.equal(t({ startAt: "2002-01" }), "Jan 2002 — month only");
  assert.equal(t({ startAt: "1998" }), "1998 — year only");
  assert.equal(t({}), "?");
});

test("marks approximate and range readings", () => {
  assert.equal(t({ startAt: "1997-10-22", localStartTime: "19:30", timeStatus: "APPROXIMATE" }), "~7:30 PM");
  assert.equal(t({ startAt: "1997-10-22", localStartTime: "18:00", localEndTime: "18:30", timeStatus: "RANGE" }), "6:00 PM – 6:30 PM");
  assert.equal(t({ startAt: "1997-10-22", endAt: "1997-10-23", localStartTime: "18:00", localEndTime: "14:30" }), "6:00 PM Oct 22 → 2:30 PM Oct 23");
});

test("date validation rejects impossible calendar dates", () => {
  assert.ok(isValidIsoDate("1997-10-22"));
  assert.ok(!isValidIsoDate("1997-02-30"));
  assert.ok(isValidDateOrTimestamp("2026-10-23T19:01:36.180221+00:00"));
  assert.ok(!isValidDateOrTimestamp("Oct 22 1997"));
});
