import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { INITIAL_STREAMING_STATE, streamReducer } = await jiti.import("./streaming-message.ts");

function assistant(content = []) {
  return { role: "assistant", content, model: "test-model", provider: "test-provider", timestamp: 123 };
}

function snapshot(state, message) {
  return streamReducer(state, { type: "snapshot", message });
}

function delta(state, event) {
  return streamReducer(state, { type: "delta", event });
}

test("builds thinking and text blocks from assistant deltas", () => {
  let state = streamReducer(INITIAL_STREAMING_STATE, { type: "start" });
  state = snapshot(state, assistant());
  state = delta(state, { type: "thinking_start", contentIndex: 0 });
  state = delta(state, { type: "thinking_delta", contentIndex: 0, delta: "Plan" });
  state = delta(state, { type: "thinking_end", contentIndex: 0, content: "Plan." });
  state = delta(state, { type: "text_start", contentIndex: 1 });
  state = delta(state, { type: "text_delta", contentIndex: 1, delta: "Hel" });
  state = delta(state, { type: "text_delta", contentIndex: 1, delta: "lo" });
  state = delta(state, { type: "text_end", contentIndex: 1, content: "Hello" });
  assert.deepEqual(state.streamingMessage.content, [
    { type: "thinking", thinking: "Plan." },
    { type: "text", text: "Hello" },
  ]);
});

test("reconnect snapshot replaces stale partial and deltas update immutably", () => {
  const stale = snapshot(INITIAL_STREAMING_STATE, assistant([{ type: "text", text: "stale" }]));
  const restored = snapshot(stale, assistant([{ type: "text", text: "Hello wor" }]));
  const next = delta(restored, { type: "text_delta", contentIndex: 0, delta: "ld" });
  assert.notStrictEqual(next, restored);
  assert.notStrictEqual(next.streamingMessage.content, restored.streamingMessage.content);
  assert.equal(restored.streamingMessage.content[0].text, "Hello wor");
  assert.equal(next.streamingMessage.content[0].text, "Hello world");
});

test("a start clears the first chunk leaked into the assistant snapshot", () => {
  // Pi's `start` event aliases the live partial message, so `message_start` can
  // already carry the block's first delta; the deltas then deliver it again.
  let thinking = snapshot(INITIAL_STREAMING_STATE, assistant([
    { type: "thinking", thinking: "The" },
  ]));
  thinking = delta(thinking, { type: "thinking_start", contentIndex: 0 });
  thinking = delta(thinking, { type: "thinking_delta", contentIndex: 0, delta: "The" });
  thinking = delta(thinking, { type: "thinking_delta", contentIndex: 0, delta: " user" });
  assert.deepEqual(thinking.streamingMessage.content, [
    { type: "thinking", thinking: "The user" },
  ]);

  let text = snapshot(INITIAL_STREAMING_STATE, assistant([
    { type: "text", text: "The" },
  ]));
  text = delta(text, { type: "text_start", contentIndex: 0 });
  text = delta(text, { type: "text_delta", contentIndex: 0, delta: "The" });
  text = delta(text, { type: "text_delta", contentIndex: 0, delta: " command" });
  assert.deepEqual(text.streamingMessage.content, [
    { type: "text", text: "The command" },
  ]);
});

test("a tool call start clears streamed input leaked into the snapshot", () => {
  let state = snapshot(INITIAL_STREAMING_STATE, assistant([
    { type: "toolCall", toolCallId: "call-1", toolName: "write", input: {}, rawInput: '{"path":' },
  ]));
  state = delta(state, { type: "toolcall_start", contentIndex: 0, id: "call-1", toolName: "write" });
  assert.equal(state.streamingMessage.content[0].rawInput, "");
  state = delta(state, { type: "toolcall_delta", contentIndex: 0, id: "call-1", toolName: "write", delta: '{"path":"' });
  assert.equal(state.streamingMessage.content[0].rawInput, '{"path":"');
});

test("streams tool arguments and accepts authoritative completion", () => {
  let state = snapshot(INITIAL_STREAMING_STATE, assistant());
  state = delta(state, { type: "toolcall_start", contentIndex: 0, id: "call-1", toolName: "write" });
  state = delta(state, { type: "toolcall_delta", contentIndex: 0, id: "call-1", toolName: "write", delta: '{"path":' });
  assert.equal(state.streamingMessage.content[0].rawInput, '{"path":');
  state = delta(state, {
    type: "toolcall_end",
    contentIndex: 0,
    toolCall: { type: "toolCall", id: "call-1", name: "write", arguments: { path: "/tmp/a" } },
  });
  assert.deepEqual(state.streamingMessage.content[0], {
    type: "toolCall",
    toolCallId: "call-1",
    toolName: "write",
    input: { path: "/tmp/a" },
  });
});
