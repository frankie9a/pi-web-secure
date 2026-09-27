import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { normalizeOpenCodeGoUsage } = await jiti.import("./provider-usage.ts");

// Shape captured from GET https://opencode.ai/zen/go/v1/usage
test("normalizes the OpenCode Go payload into ordered percent buckets", () => {
  const report = normalizeOpenCodeGoUsage({
    usage: {
      monthly: { status: "ok", percent: 20, resetsAt: "2026-10-26T12:46:50.000Z" },
      rolling: { status: "ok", percent: 0, resetsAt: "2026-09-27T04:31:11.398Z" },
      weekly: { status: "ok", percent: 40, resetsAt: "2026-09-28T00:00:00.000Z" },
    },
  });

  assert.ok(report);
  assert.deepEqual(report.buckets.map((b) => b.id), ["rolling", "weekly", "monthly"]);
  assert.deepEqual(report.buckets.map((b) => b.percent), [0, 40, 20]);
  assert.deepEqual(report.buckets.map((b) => b.label), ["Rolling", "Weekly", "Monthly"]);
  assert.equal(report.buckets[0].resetsAt, Date.parse("2026-09-27T04:31:11.398Z"));
});

test("accepts the payload without the usage wrapper", () => {
  const report = normalizeOpenCodeGoUsage({ rolling: { percent: 7 } });
  assert.equal(report.buckets.length, 1);
  assert.equal(report.buckets[0].percent, 7);
});

test("clamps out-of-range percentages and ignores windows without one", () => {
  const report = normalizeOpenCodeGoUsage({
    usage: { rolling: { usage_percent: 140 }, weekly: { percent: -5 }, monthly: { status: "ok" } },
  });
  assert.deepEqual(report.buckets.map((b) => b.id), ["rolling"]);
  assert.equal(report.buckets[0].percent, 100);
});

test("keeps an unrecognised window id instead of dropping it", () => {
  const report = normalizeOpenCodeGoUsage({ usage: { daily: { percent: 5 } } });
  assert.deepEqual(report.buckets.map((b) => b.id), ["daily"]);
  assert.equal(report.buckets[0].label, "daily");
});

test("rejects payloads that carry no usable usage window", () => {
  assert.equal(normalizeOpenCodeGoUsage({ usage: {} }), null);
  assert.equal(normalizeOpenCodeGoUsage({}), null);
  assert.equal(normalizeOpenCodeGoUsage(null), null);
  assert.equal(normalizeOpenCodeGoUsage("nope"), null);
  assert.equal(normalizeOpenCodeGoUsage([{ percent: 1 }]), null);
});
