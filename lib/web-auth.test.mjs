import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTH_SESSION_MAX_AGE_SECONDS,
  captureAuthPasswordFromEnvironment,
  createAuthToken,
  getAuthPassword,
  isAuthPasswordValid,
  isUnsafeCrossSiteRequest,
  passwordsMatch,
  verifyAuthToken,
} from "./web-auth.ts";

const PASSWORD = "correct-horse-battery-staple";

test("auth tokens are signed, expire, and change with the password", () => {
  const now = Date.UTC(2026, 0, 1);
  const token = createAuthToken(PASSWORD, now);

  assert.equal(verifyAuthToken(token, PASSWORD, now), true);
  assert.equal(verifyAuthToken(token, "a-different-long-password", now), false);
  assert.equal(
    verifyAuthToken(token, PASSWORD, now + (AUTH_SESSION_MAX_AGE_SECONDS + 1) * 1000),
    false,
  );
  assert.equal(verifyAuthToken(`${token}tampered`, PASSWORD, now), false);
});

test("captures the login password and removes it from the process environment", () => {
  const previousCached = globalThis.__piWebAuthPassword;
  try {
    globalThis.__piWebAuthPassword = undefined;
    process.env.PI_WEB_AUTH_PASSWORD = PASSWORD;

    captureAuthPasswordFromEnvironment();

    // Authentication still works, but there is nothing left for a child
    // process (agent bash, terminal) to inherit.
    assert.equal(getAuthPassword(), PASSWORD);
    assert.equal(process.env.PI_WEB_AUTH_PASSWORD, undefined);
    assert.equal(getAuthPassword(), PASSWORD);

    // An unset variable must disable auth rather than resurrect a stale value.
    globalThis.__piWebAuthPassword = undefined;
    delete process.env.PI_WEB_AUTH_PASSWORD;
    captureAuthPasswordFromEnvironment();
    assert.equal(getAuthPassword(), null);
  } finally {
    delete process.env.PI_WEB_AUTH_PASSWORD;
    globalThis.__piWebAuthPassword = previousCached;
  }
});

test("password validation and comparison enforce the configured minimum", () => {
  assert.equal(isAuthPasswordValid("1234567890"), true);
  assert.equal(isAuthPasswordValid("123456789"), false);
  assert.equal(passwordsMatch(PASSWORD, PASSWORD), true);
  assert.equal(passwordsMatch("wrong", PASSWORD), false);
});

test("cross-site writes are rejected without blocking same-origin requests", () => {
  const crossSite = new Request("https://pi.example/api/agent/new", {
    method: "POST",
    headers: { "sec-fetch-site": "cross-site", origin: "https://evil.example" },
  });
  const sameOrigin = new Request("https://pi.example/api/agent/new", {
    method: "POST",
    headers: { "sec-fetch-site": "same-origin", origin: "https://pi.example" },
  });
  const legacySameOrigin = new Request("https://pi.example/api/agent/new", {
    method: "POST",
    headers: { origin: "https://pi.example", host: "pi.example" },
  });

  assert.equal(isUnsafeCrossSiteRequest(crossSite), true);
  assert.equal(isUnsafeCrossSiteRequest(sameOrigin), false);
  assert.equal(isUnsafeCrossSiteRequest(legacySameOrigin), false);
});
