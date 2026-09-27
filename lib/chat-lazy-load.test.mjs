import test from "node:test";
import assert from "node:assert/strict";

async function loadSubject() {
  return import("./chat-lazy-load.ts");
}

test("shows only the last visible render items", async () => {
  const { getVisibleRenderWindow } = await loadSubject();
  assert.deepEqual(getVisibleRenderWindow(200, 50), { startIndex: 150, hasMore: true });
});

test("shows all render items when the visible count reaches the total", async () => {
  const { getVisibleRenderWindow } = await loadSubject();
  assert.deepEqual(getVisibleRenderWindow(30, 50), { startIndex: 0, hasMore: false });
  assert.deepEqual(getVisibleRenderWindow(50, 50), { startIndex: 0, hasMore: false });
  assert.deepEqual(getVisibleRenderWindow(0, 50), { startIndex: 0, hasMore: false });
});

test("continues paging when render items outnumber source messages", async () => {
  const { getNextVisibleCount, getVisibleRenderWindow } = await loadSubject();
  let visibleCount = 50;

  visibleCount = getNextVisibleCount(visibleCount);
  assert.deepEqual(getVisibleRenderWindow(120, visibleCount), { startIndex: 20, hasMore: true });

  visibleCount = getNextVisibleCount(visibleCount);
  assert.deepEqual(getVisibleRenderWindow(120, visibleCount), { startIndex: 0, hasMore: false });
});

test("restores the viewport after prepending content", async () => {
  const { captureScrollDistance, restoreScrollTop } = await loadSubject();
  const savedDistance = captureScrollDistance(2000, 500);

  assert.equal(savedDistance, 1500);
  assert.equal(restoreScrollTop(2500, savedDistance), 1000);
});

test("restores top and bottom boundary positions", async () => {
  const { captureScrollDistance, restoreScrollTop } = await loadSubject();
  assert.equal(restoreScrollTop(3000, captureScrollDistance(2000, 0)), 1000);
  assert.equal(restoreScrollTop(3000, captureScrollDistance(2000, 2000)), 3000);
});

test("keeps exactly the requested number of renderable messages in the tail", async () => {
  const { findVisibleTailStart } = await loadSubject();
  const messages = [
    { role: "user" }, { role: "assistant" }, { role: "toolResult" },
    { role: "user" }, { role: "toolResult" }, { role: "assistant" },
    { role: "user" }, { role: "assistant" },
  ];
  // The last two renderable messages are the final user/assistant pair; the tail
  // starts there and carries the tool results that belong to them.
  assert.equal(findVisibleTailStart(messages, 2), 6);
  assert.equal(findVisibleTailStart(messages, 3), 4);
  assert.equal(findVisibleTailStart(messages, 1), 7);
});

test("leaves a short transcript untouched", async () => {
  const { findVisibleTailStart } = await loadSubject();
  assert.equal(findVisibleTailStart([{ role: "user" }, { role: "assistant" }], 5), 0);
  assert.equal(findVisibleTailStart([], 5), 0);
  assert.equal(findVisibleTailStart([{ role: "toolResult" }], 5), 0);
});
