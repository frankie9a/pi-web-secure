import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { tsconfigPaths: true });
const { mergeDeliveredUserMessage, userMessageKey } = await jiti.import("./useAgentSession.ts");

const user = (text) => ({ role: "user", content: text, timestamp: 1 });
const system = { role: "system", content: "", timestamp: 2 };
const assistant = { role: "assistant", content: [{ type: "text", text: "hi" }], timestamp: 3 };

function userCount(messages) {
  return messages.filter((message) => message.role === "user").length;
}

test("a tool-declaration system message before the echo does not duplicate the prompt", () => {
  // Observed event order for the first prompt of a session: agent_start, the
  // system message start/end pair, then the user message start/end. The system
  // message therefore sits between the optimistic bubble and its echo.
  const optimistic = user("hello world");
  const before = [optimistic, system];

  const merged = mergeDeliveredUserMessage(before, user("hello world"), userMessageKey(optimistic));

  assert.equal(userCount(merged), 1);
  assert.equal(merged.length, 2);
  assert.equal(merged[0], optimistic, "keeps the local bubble, including its timestamp");
  assert.equal(merged[1], system);
});

test("replaces the optimistic bubble in place when the server text differs", () => {
  const optimistic = user("hello world\n");
  const before = [optimistic, system, assistant];
  const delivered = user("hello world");

  const merged = mergeDeliveredUserMessage(before, delivered, userMessageKey(optimistic));

  assert.equal(userCount(merged), 1);
  assert.equal(merged[0], delivered, "the server copy replaces it at the same index");
  assert.equal(merged[1], system);
  assert.equal(merged[2], assistant);
});

test("appends when there is no optimistic bubble to consume", () => {
  // A steering/follow-up delivery for a run this client did not send.
  const merged = mergeDeliveredUserMessage([assistant], user("queued message"), null);

  assert.equal(userCount(merged), 1);
  assert.equal(merged.length, 2);
});

test("a later same-text queue delivery still renders", () => {
  const merged = mergeDeliveredUserMessage([assistant], user("hello world"), null);

  assert.equal(userCount(merged), 1);
  assert.equal(merged[1].content, "hello world");
});

test("does not consume a matching key from further up the history", () => {
  // An old prompt with the same text must not be rewritten by a fresh delivery.
  const historic = user("hello world");
  const before = [historic, assistant, system, assistant, assistant];
  const delivered = user("hello world");

  const merged = mergeDeliveredUserMessage(before, delivered, userMessageKey(historic));

  assert.equal(userCount(merged), 2, "appends instead of editing a distant message");
  assert.equal(merged[0], historic);
  assert.equal(merged[merged.length - 1], delivered);
});
