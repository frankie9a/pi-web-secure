import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const themeSource = await readFile(new URL("../hooks/useTheme.ts", import.meta.url), "utf8");
const layoutSource = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
const sessionsRoute = await readFile(new URL("../app/api/sessions/route.ts", import.meta.url), "utf8");
const runningRoute = await readFile(new URL("../app/api/agent/running/route.ts", import.meta.url), "utf8");
const eventRoute = await readFile(new URL("../app/api/agent/[id]/events/route.ts", import.meta.url), "utf8");
const sidebarSource = await readFile(new URL("../components/SessionSidebar.tsx", import.meta.url), "utf8");
const messageSource = await readFile(new URL("../components/MessageView.tsx", import.meta.url), "utf8");
const inputSource = await readFile(new URL("../components/ChatInput.tsx", import.meta.url), "utf8");
const agentHookSource = await readFile(new URL("../hooks/useAgentSession.ts", import.meta.url), "utf8");
const explorerSource = await readFile(new URL("../components/FileExplorer.tsx", import.meta.url), "utf8");
const sessionDetailRoute = await readFile(new URL("../app/api/sessions/[id]/route.ts", import.meta.url), "utf8");

test("theme supports light, dark, and system preferences", () => {
  assert.match(themeSource, /ThemePreference = "light" \| "dark" \| "auto"/);
  assert.match(themeSource, /prefers-color-scheme: dark/);
  assert.match(themeSource, /addEventListener\("change", syncAutoThemeFromSystem\)/);
  assert.match(layoutSource, /t==="auto"/);
});

test("session and running snapshots explicitly bypass caches", () => {
  assert.match(sessionsRoute, /searchParams\.get\("force"\) === "1"/);
  assert.match(sessionsRoute, /"Cache-Control": "no-store"/);
  assert.match(runningRoute, /"Cache-Control": "no-store"/);
  assert.match(sidebarSource, /setTimeout\(\(\) => void poll\(\), 2500\)/);
  assert.match(sidebarSource, /loadSessions\(false, true\)/);
  assert.match(sidebarSource, /sessionLoadIdRef/);
  assert.match(sidebarSource, /loadId !== sessionLoadIdRef\.current/);
});

test("agent events support reconnect snapshots and unbuffered SSE", () => {
  assert.match(eventRoute, /isRunning: session\.isRunning\(\)/);
  assert.match(eventRoute, /isStreaming: session\.isStreaming/);
  assert.match(eventRoute, /message_start/);
  assert.match(eventRoute, /cancel\(\)/);
  assert.match(eventRoute, /no-cache, no-transform/);
  assert.match(eventRoute, /X-Accel-Buffering/);
  assert.match(agentHookSource, /eventReconnectTimerRef/);
  assert.match(agentHookSource, /clearTimeout\(eventReconnectTimerRef\.current\)/);
});

test("message actions preserve complete user messages including images", () => {
  assert.match(messageSource, /onEditContent\?\.\(message\)/);
  assert.match(inputSource, /replaceMessage: \(message: UserMessage\)/);
  assert.match(inputSource, /getUserMessageDraftImages/);
  assert.match(messageSource, /Edit from here/);
  assert.match(messageSource, /New session/);
});

test("the explorer keeps its tree mounted while refreshing", () => {
  // A refresh must not swap the whole tree for the placeholder: that unmounts
  // every node (losing loaded children) and collapses the scroll position, which
  // read as "the file view reset".
  assert.match(explorerSource, /loading && roots\.length === 0/);
  // The directory array is prop identity-compared by the load effect, so the
  // sidebar has to hand over a stable reference.
  assert.match(sidebarSource, /const explorerCwds = useMemo\(/);
  assert.match(sidebarSource, /cwds=\{explorerCwds\}/);
});

test("routine session-list refreshes read the server cache instead of forcing a rescan", () => {
  assert.match(sidebarSource, /loadSessions\(isFirst, false\)/);
  // The manual refresh button still forces a rescan.
  assert.match(sidebarSource, /loadSessions\(false, true\)/);
});

test("the session detail route supports a tail window but keeps the full default", () => {
  assert.match(sessionDetailRoute, /findVisibleTailStart\(fullMessages, requestedTail\)/);
  assert.match(sessionDetailRoute, /truncated: tailStart > 0/);
  assert.match(sessionDetailRoute, /totalMessages/);
  // No `tail` parameter means the untouched full history.
  assert.match(sessionDetailRoute, /const tailApplies = Number\.isSafeInteger\(requestedTail\) && requestedTail > 0;/);
});

test("the client pages past a tail by loading the full history once", () => {
  assert.match(agentHookSource, /loadSession\(sid, false, false, \{ fullHistory: true \}\)/);
  assert.match(agentHookSource, /historyTruncated/);
});

test("a recycled session tells its SSE listeners to drop the dead stream", () => {
  assert.match(agentHookSource, /case "session_shutdown"/);
  assert.match(agentHookSource, /STREAM_STALE_MS/);
  assert.match(agentHookSource, /checkStaleStream/);
});
