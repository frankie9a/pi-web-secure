import assert from "node:assert/strict";
import test from "node:test";
import { safeLoginDestination } from "./login-destination.ts";

const origin = "http://192.168.0.13:30140";

test("returns to the local page that sent the browser to the login page", () => {
  assert.equal(safeLoginDestination("/?session=abc", origin), "/?session=abc");
  assert.equal(safeLoginDestination("/?cwd=%2Fhome%2Fpi#top", origin), "/?cwd=%2Fhome%2Fpi#top");
  assert.equal(safeLoginDestination("/project/files", origin), "/project/files");
});

test("falls back to the app root without a usable destination", () => {
  assert.equal(safeLoginDestination(null, origin), "/");
  assert.equal(safeLoginDestination("", origin), "/");
  assert.equal(safeLoginDestination("session", origin), "/");
  assert.equal(safeLoginDestination("https://evil.example/", origin), "/");
  assert.equal(safeLoginDestination("javascript:alert(1)", origin), "/");
});

test("rejects destinations that only look local to a startsWith check", () => {
  // A leading `/` does not prove the target is local. The URL parser reads
  // `\` as `/` in a special scheme, and strips tabs, so each of these resolves
  // to another host while still passing a `startsWith("/") && !startsWith("//")`
  // guard. Verified against the URL parser, not assumed.
  const crossOrigin = [
    "/\\evil.example",
    "/\\/evil.example",
    "/\\evil.example?x=1",
    "//evil.example",
    "/\t/evil.example",
  ];
  for (const value of crossOrigin) {
    assert.equal(
      safeLoginDestination(value, origin),
      "/",
      `${JSON.stringify(value)} must not leave the origin`,
    );
  }
});

test("keeps same-origin paths that the parser normalises", () => {
  // These stay on the current origin once parsed, so they are ordinary paths.
  assert.equal(safeLoginDestination("/\tevil.example", origin), "/evil.example");
  assert.equal(safeLoginDestination("/%2F%2Fevil.example", origin), "/%2F%2Fevil.example");
});

test("never returns an absolute URL", () => {
  for (const value of ["/", "/a/b", "/a?b=c#d"]) {
    assert.ok(safeLoginDestination(value, origin).startsWith("/"));
    assert.ok(!safeLoginDestination(value, origin).includes(origin));
  }
});
