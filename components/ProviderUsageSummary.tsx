"use client";

import { useCallback, useEffect, useState } from "react";

interface UsageBucket {
  id: string;
  label: string;
  percent: number;
  resetsAt?: number;
}

type ProviderUsageResult =
  | { status: "ready"; report: { providerId: string; capturedAt: number; buckets: UsageBucket[] } }
  | { status: "auth-unavailable" | "query-failed"; message: string };

function formatReset(resetsAt: number | undefined): string {
  if (!resetsAt) return "";
  const delta = resetsAt - Date.now();
  if (delta <= 0) return "resets now";
  const hours = Math.floor(delta / 3_600_000);
  const minutes = Math.round((delta % 3_600_000) / 60_000);
  if (hours >= 24) return `resets in ${Math.floor(hours / 24)}d ${hours % 24}h`;
  if (hours >= 1) return `resets in ${hours}h ${minutes}m`;
  return `resets in ${minutes}m`;
}

function barColor(percent: number): string {
  if (percent >= 90) return "#f87171";
  if (percent >= 70) return "#fbbf24";
  return "var(--text-muted)";
}

/**
 * OpenCode Go window usage (rolling / weekly / monthly). Renders nothing when the
 * provider is not connected, so the panel stays quiet for other setups.
 */
export function ProviderUsageSummary({ refreshKey }: { refreshKey?: number }) {
  const [result, setResult] = useState<ProviderUsageResult | null>(null);

  const load = useCallback(() => {
    fetch("/api/provider-usage")
      .then((response) => response.json())
      .then((data: ProviderUsageResult) => setResult(data))
      .catch(() => setResult({ status: "query-failed", message: "Usage query failed." }));
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  if (result?.status === "auth-unavailable") return null;
  if (result?.status === "query-failed") {
    return (
      <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
        OpenCode Go usage unavailable: {result.message}
      </div>
    );
  }
  if (result?.status !== "ready") return null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
      <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>OpenCode Go</span>
      {result.report.buckets.map((bucket) => (
        <div key={bucket.id} style={{ display: "flex", alignItems: "center", gap: 6 }} title={formatReset(bucket.resetsAt)}>
          <span style={{ fontSize: 11, color: "var(--text-dim)", whiteSpace: "nowrap" }}>{bucket.label}</span>
          <div style={{ width: 68, height: 5, borderRadius: 3, background: "var(--border)", overflow: "hidden" }}>
            <div style={{ width: `${bucket.percent}%`, height: "100%", background: barColor(bucket.percent) }} />
          </div>
          <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
            {Math.round(bucket.percent)}%
          </span>
          <span style={{ fontSize: 10, color: "var(--text-dim)", whiteSpace: "nowrap" }}>
            {formatReset(bucket.resetsAt)}
          </span>
        </div>
      ))}
    </div>
  );
}
