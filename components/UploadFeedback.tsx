"use client";

import type { PendingUploadConflict, UploadPhase, UploadSummary } from "@/hooks/useFileUpload";

interface Props {
  phase: UploadPhase;
  progress: number;
  error: string | null;
  summary: UploadSummary | null;
  pendingConflict: PendingUploadConflict | null;
  onReplace: () => void;
  onSkip: () => void;
  onCancelConflict: () => void;
  onDismissError: () => void;
  onDismissSummary: () => void;
  onMention?: (fileNames: string[]) => void;
  compact?: boolean;
}

function DismissButton({ onClick, title }: { onClick: () => void; title: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      style={{ width: 24, height: 24, padding: 0, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "none", borderRadius: 4, background: "none", color: "var(--text-dim)", cursor: "pointer" }}
      onMouseEnter={(event) => { event.currentTarget.style.color = "var(--text-muted)"; event.currentTarget.style.background = "var(--bg-hover)"; }}
      onMouseLeave={(event) => { event.currentTarget.style.color = "var(--text-dim)"; event.currentTarget.style.background = "none"; }}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
        <path d="m6 6 12 12" />
        <path d="m18 6-12 12" />
      </svg>
    </button>
  );
}

function MentionIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" />
    </svg>
  );
}

export function UploadFeedback({
  phase,
  progress,
  error,
  summary,
  pendingConflict,
  onReplace,
  onSkip,
  onCancelConflict,
  onDismissError,
  onDismissSummary,
  onMention,
  compact = false,
}: Props) {
  const busy = phase !== "idle";
  if (!busy && !error && !summary && !pendingConflict) return null;

  return (
    <div
      style={{
        display: "grid",
        gap: 6,
        padding: compact ? "6px 8px" : "8px 10px",
        border: "1px solid var(--border)",
        borderRadius: compact ? 0 : 7,
        background: "var(--bg-panel)",
        color: "var(--text-muted)",
        fontSize: 11,
      }}
    >
      {busy && (
        <div role="status" aria-live="polite" aria-label={phase === "checking" ? "Checking files" : phase === "processing" ? "Saving files" : `Uploading, ${progress}%`}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, minHeight: 16 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" style={{ animation: phase === "checking" || phase === "processing" ? "spin 0.8s linear infinite" : undefined }} aria-hidden="true">
                {phase === "checking" || phase === "processing" ? (
                  <path d="M21 12a9 9 0 1 1-5.7-8.4" />
                ) : (
                  <>
                    <path d="M12 16V4" />
                    <path d="m7 9 5-5 5 5" />
                    <path d="M5 20h14" />
                  </>
                )}
              </svg>
              <span>{phase === "checking" ? "Checking files" : phase === "processing" ? "Saving files" : "Uploading files"}</span>
            </span>
            {phase === "uploading" && <span style={{ fontSize: 10 }}>{Math.min(progress, 99)}%</span>}
            {phase === "processing" && <span style={{ fontSize: 10 }}>finishing</span>}
          </div>
          {(phase === "uploading" || phase === "processing") && (
            <div style={{ height: 3, marginTop: 5, overflow: "hidden", borderRadius: 2, background: "var(--border)" }}>
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  background: "var(--accent)",
                  opacity: phase === "processing" ? 0.45 : 1,
                  transition: "width 120ms ease, opacity 160ms ease",
                }}
              />
            </div>
          )}
        </div>
      )}

      {pendingConflict && (
        <div role="alert" style={{ padding: 7, border: "1px solid color-mix(in srgb, #f59e0b 55%, var(--border))", borderRadius: 4, background: "color-mix(in srgb, #f59e0b 9%, var(--bg-panel))" }}>
          <div style={{ color: "var(--text)", lineHeight: 1.35, overflowWrap: "anywhere" }}>
            {pendingConflict.conflicts.length} file{pendingConflict.conflicts.length === 1 ? "" : "s"} already exist: {pendingConflict.conflicts.join(", ")}
          </div>
          {pendingConflict.nonReplaceable.length > 0 && (
            <div style={{ marginTop: 3, fontSize: 10, color: "#f59e0b", lineHeight: 1.35, overflowWrap: "anywhere" }}>
              Cannot replace: {pendingConflict.nonReplaceable.join(", ")}
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 7 }}>
            <button type="button" onClick={onReplace} style={{ height: 24, padding: "0 8px", border: "1px solid #ef4444", borderRadius: 4, background: "transparent", color: "#ef4444", cursor: "pointer", fontSize: 10 }}>
              Replace
            </button>
            <button type="button" onClick={onSkip} style={{ height: 24, padding: "0 8px", border: "1px solid var(--border)", borderRadius: 4, background: "var(--bg)", color: "var(--text)", cursor: "pointer", fontSize: 10 }}>
              Skip existing
            </button>
            <button type="button" onClick={onCancelConflict} style={{ height: 24, padding: "0 8px", border: "none", borderRadius: 4, background: "transparent", color: "var(--text-muted)", cursor: "pointer", fontSize: 10 }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <div role="alert" style={{ display: "flex", alignItems: "flex-start", gap: 6, lineHeight: 1.35, color: "#f87171" }}>
          <span style={{ minWidth: 0, flex: 1, overflowWrap: "anywhere" }}>{error}</span>
          <DismissButton onClick={onDismissError} title="Dismiss upload error" />
        </div>
      )}

      {summary && (
        <div aria-live="polite">
          <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 22 }}>
            <div style={{ minWidth: 0, flex: 1, display: "flex", alignItems: "center", gap: 10 }}>
              {summary.uploaded.length > 0 && (
                <span title={`${summary.uploaded.length} uploaded`} style={{ display: "flex", alignItems: "center", gap: 4, color: "#22c55e" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m5 12 4 4L19 6" />
                  </svg>
                  <span>{summary.uploaded.length} uploaded</span>
                </span>
              )}
              {summary.skipped.length > 0 && <span style={{ color: "var(--text-dim)" }}>{summary.skipped.length} skipped</span>}
              {summary.errors.length > 0 && <span style={{ color: "#f87171" }}>{summary.errors.length} failed</span>}
            </div>
            {summary.uploaded.length > 0 && onMention && (
              <button
                type="button"
                onClick={() => onMention(summary.uploaded)}
                title="Add uploaded files to chat"
                aria-label="Add uploaded files to chat"
                style={{ height: 24, padding: "0 8px", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, flexShrink: 0, border: "1px solid var(--border)", borderRadius: 4, background: "var(--bg)", color: "var(--accent)", cursor: "pointer", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}
              >
                <MentionIcon />
                mention
              </button>
            )}
            <DismissButton onClick={onDismissSummary} title="Dismiss upload results" />
          </div>
          {summary.errors.map((item) => (
            <div key={item.name} title={item.error} style={{ marginTop: 3, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 10, color: "#f87171" }}>
              {item.name}: {item.error}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
