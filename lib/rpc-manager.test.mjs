import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("RPC session startup preloads extension-registered providers before restoring models", async () => {
  const source = await readFile(new URL("./rpc-manager.ts", import.meta.url), "utf8");
  const startupSource = source.slice(source.indexOf("export async function startRpcSession"));

  assert.match(startupSource, /createAgentSessionServices\(/);
  assert.match(startupSource, /createAgentSessionFromServices\(/);
  assert.doesNotMatch(startupSource, /await createAgentSession\(/);
});

test("custom extension UI receives the fixed headless terminal facade", async () => {
  const source = await readFile(new URL("./rpc-manager.ts", import.meta.url), "utf8");
  const customUiSource = source.slice(
    source.indexOf("private requestExtensionCustomUi"),
    source.indexOf("private requestExtensionUi"),
  );

  assert.match(customUiSource, /createHeadlessCustomUiTui\(/);
  assert.match(customUiSource, /width,/);
});

test("the empty-prompt preset neutralises the transcript instead of assigning the getter", async () => {
  const source = await readFile(new URL("./rpc-manager.ts", import.meta.url), "utf8");

  // Pi >= 0.84 keeps the prompt in the transcript and exposes `state.systemPrompt`
  // as a getter only, so an assignment throws and the "no tools" preset fails.
  assert.doesNotMatch(source, /agent\.state\.systemPrompt\s*=/);
  assert.match(source, /private applyForcedEmptySystemPrompt\(\): void \{/);
  assert.match(source, /message\.role !== "system"/);
  // Leaving the preset must restore the wiped prompt, not leave the session bare.
  assert.match(source, /forcedEmptyPromptBackup\.set\(message,/);
  assert.match(source, /for \(const \[message, saved\] of this\.forcedEmptyPromptBackup\)/);
});

test("an explicit empty tool list stays the all-off preset while configured stays extension-only", async () => {
  const source = await readFile(new URL("./rpc-manager.ts", import.meta.url), "utf8");
  const setTools = source.slice(
    source.indexOf('case "set_tools"'),
    source.indexOf('case "reload"'),
  );

  assert.match(setTools, /requested === undefined \? extensionToolNames\(this\.inner\) : \[\]/);
  assert.match(setTools, /settingsManager\.getDefaultTools\(\)/);
});
