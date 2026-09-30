import { configureHttpDispatcher } from "@/lib/http-dispatcher";
import { closeAllAgentEventStreams } from "@/lib/agent-event-stream";
import { captureAuthPasswordFromEnvironment } from "@/lib/web-auth";

/**
 * Node-only instrumentation. Kept out of `instrumentation.ts` so the Edge
 * instrumentation entry never sees `process.on` or the undici dispatcher.
 */
export function registerNodeInstrumentation(): void {
  // Runs before the server accepts requests, so the login password is no longer
  // in process.env by the time any agent session can spawn a shell.
  captureAuthPasswordFromEnvironment();

  configureHttpDispatcher();

  // In production Next 16 answers SIGINT/SIGTERM with server.close() and waits
  // for every connection to end, without a timeout. SSE streams only end when
  // the client disconnects, so close them here or the process never exits.
  const shutdownStreams = () => closeAllAgentEventStreams();
  process.on("SIGINT", shutdownStreams);
  process.on("SIGTERM", shutdownStreams);
}
