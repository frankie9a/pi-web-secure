import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, {
  jsx: { runtime: "automatic" },
  tsconfigPaths: true,
});
const { UploadFeedback } = await jiti.import("./UploadFeedback.tsx");

function render(props) {
  return renderToStaticMarkup(
    React.createElement(UploadFeedback, {
      progress: 0,
      error: null,
      summary: null,
      pendingConflict: null,
      ...props,
    }),
  );
}

test("never claims 100% while the request body is still being sent", () => {
  const markup = render({ phase: "uploading", progress: 100 });
  assert.match(markup, /Uploading files/);
  // The last percent is reserved for the server's response: reaching 100% only
  // means the bytes left the browser, so the label must not read as finished.
  assert.match(markup, />99%</);
  assert.doesNotMatch(markup, />100%</);
});

test("switches to an explicit saving state once the bytes are sent", () => {
  const markup = render({ phase: "processing", progress: 100 });
  assert.match(markup, /Saving files/);
  assert.match(markup, /finishing/);
  assert.doesNotMatch(markup, /Uploading files/);
  assert.doesNotMatch(markup, />100%</);
});

test("keeps the checking state distinct", () => {
  const markup = render({ phase: "checking", progress: 0 });
  assert.match(markup, /Checking files/);
  assert.doesNotMatch(markup, /Saving files/);
});

test("renders nothing when idle with nothing to report", () => {
  assert.equal(render({ phase: "idle", progress: 0 }), "");
});
