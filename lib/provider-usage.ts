import { ModelRuntime } from "@earendil-works/pi-coding-agent";

export const OPENCODE_GO_PROVIDER_ID = "opencode-go";

const USAGE_ENDPOINT = "https://opencode.ai/zen/go/v1/usage";
const WINDOW_ORDER = ["rolling", "weekly", "monthly"];
const WINDOW_LABELS: Record<string, string> = { rolling: "Rolling", weekly: "Weekly", monthly: "Monthly" };
const MAX_RESPONSE_BYTES = 64 * 1024;
const REQUEST_TIMEOUT_MS = 15_000;

export interface UsageBucket {
  id: string;
  label: string;
  percent: number;
  resetsAt?: number;
}

export interface ProviderUsageReport {
  providerId: string;
  capturedAt: number;
  buckets: UsageBucket[];
}

export type ProviderUsageResult =
  | { status: "ready"; report: ProviderUsageReport }
  | { status: "auth-unavailable" | "query-failed"; message: string };

type UsageAuth = {
  apiKey?: string;
  headers?: Record<string, string | null>;
  baseUrl?: string;
};

/**
 * Only the official origin may receive the provider credential. A user-configured
 * baseUrl must never be handed an API key just because usage display asked for it.
 */
function isOfficialUsageOrigin(baseUrl: string | undefined): boolean {
  if (!baseUrl) return false;
  try {
    const url = new URL(baseUrl);
    return url.protocol === "https:" && (url.hostname === "opencode.ai" || url.hostname.endsWith(".opencode.ai"));
  } catch {
    return false;
  }
}

function toPercent(value: unknown): number | undefined {
  const numeric = typeof value === "number"
    ? value
    : typeof value === "string" && value.trim() !== ""
      ? Number(value)
      : undefined;
  if (numeric === undefined || !Number.isFinite(numeric) || numeric < 0) return undefined;
  return Math.min(100, Math.max(0, numeric));
}

function toEpochMs(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 1e12 ? value : value * 1000;
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return undefined;
}

/**
 * OpenCode Go reports only the used percentage of each fixed window plus a reset
 * timestamp, so each window becomes one percent bucket.
 */
export function normalizeOpenCodeGoUsage(
  payload: unknown,
  providerId: string = OPENCODE_GO_PROVIDER_ID,
  capturedAt: number = Date.now(),
): ProviderUsageReport | null {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return null;

  const container = (payload as { usage?: unknown }).usage;
  const usage = (typeof container === "object" && container !== null && !Array.isArray(container)
    ? container
    : payload) as Record<string, unknown>;

  const buckets: UsageBucket[] = [];
  for (const [id, raw] of Object.entries(usage)) {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) continue;
    const entry = raw as Record<string, unknown>;
    const percent = toPercent(entry.percent ?? entry.usagePercent ?? entry.usage_percent);
    if (percent === undefined) continue;
    const resetsAt = toEpochMs(entry.resetsAt ?? entry.resetAt ?? entry.resets_at ?? entry.reset_at);
    buckets.push({
      id,
      label: WINDOW_LABELS[id] ?? id,
      percent,
      ...(resetsAt !== undefined ? { resetsAt } : {}),
    });
  }
  if (buckets.length === 0) return null;

  const order = (id: string) => {
    const index = WINDOW_ORDER.indexOf(id);
    return index === -1 ? WINDOW_ORDER.length : index;
  };
  buckets.sort((a, b) => order(a.id) - order(b.id) || a.id.localeCompare(b.id));

  return { providerId, capturedAt, buckets };
}

export async function queryOpenCodeGoUsage(): Promise<ProviderUsageResult> {
  const runtime = await ModelRuntime.create({ refreshOnCreate: false });

  let resolved: { auth?: UsageAuth } | undefined;
  try {
    resolved = await runtime.getAuth(OPENCODE_GO_PROVIDER_ID);
  } catch {
    return { status: "auth-unavailable", message: "OpenCode Go authentication is unavailable." };
  }
  if (!resolved?.auth) {
    return { status: "auth-unavailable", message: "Connect OpenCode Go before querying usage." };
  }

  // Catalog providers such as opencode-go carry their base URL per model rather
  // than on the provider, so fall back to the first model before rejecting a
  // non-official origin.
  const provider = runtime.getProvider(OPENCODE_GO_PROVIDER_ID);
  const baseUrl = resolved.auth.baseUrl ?? provider?.baseUrl ?? provider?.getModels()[0]?.baseUrl;
  if (!isOfficialUsageOrigin(baseUrl)) {
    return { status: "query-failed", message: "OpenCode Go usage is only queried from its official origin." };
  }

  const headers = new Headers();
  for (const [name, value] of Object.entries(resolved.auth.headers ?? {})) {
    if (typeof value === "string") headers.set(name, value);
  }
  if (!headers.has("authorization") && resolved.auth.apiKey) {
    headers.set("Authorization", `Bearer ${resolved.auth.apiKey}`);
  }

  try {
    const response = await fetch(USAGE_ENDPOINT, {
      headers,
      redirect: "error",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const body = await response.text();
    if (body.length > MAX_RESPONSE_BYTES) throw new Error("Usage response was too large.");
    if (!response.ok) throw new Error(`Usage endpoint returned ${response.status}.`);
    const report = normalizeOpenCodeGoUsage(JSON.parse(body));
    if (!report) throw new Error("Usage response did not contain any usage windows.");
    return { status: "ready", report };
  } catch (error) {
    return {
      status: "query-failed",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
