"use client";

import { forwardRef, useState, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { getFileIcon, FolderIcon } from "./FileIcons";
import { UploadFeedback } from "./UploadFeedback";
import { useFileUpload } from "@/hooks/useFileUpload";
import { useIsMobile } from "@/hooks/useIsMobile";
import {
  encodeFilePathForApi,
  getFileDirectory,
  getRelativeFilePath,
  joinFilePath,
  normalizeFilePathSlashes,
} from "@/lib/file-paths";
import type { GitFileStatus, GitFileStatusKind, GitStatusResponse } from "@/lib/git-types";

interface FileEntry {
  name: string;
  isDir: boolean;
  size: number;
  modified: string;
}

interface FileNode {
  name: string;
  fullPath: string;
  isDir: boolean;
  size: number;
  children?: FileNode[];
  loaded?: boolean;
}

interface Props {
  cwds: string[]; // Support multiple root directories
  onOpenFile: (filePath: string, fileName: string) => void;
  refreshKey?: number;
  onAtMention?: (relativePath: string, isDir: boolean) => void;
  onAtMentions?: (relativePaths: string[]) => void;
  onUploadBusyChange?: (busy: boolean) => void;
}

export interface FileExplorerHandle {
  openUploadPicker: () => void;
}

async function fetchEntries(dirPath: string): Promise<FileNode[]> {
  const encoded = encodeFilePathForApi(dirPath);
  const res = await fetch(`/api/files/${encoded}?type=list`);
  if (!res.ok) {
    let message = `Failed to load files (HTTP ${res.status})`;
    try {
      const data = await res.json() as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // ignore non-JSON error bodies
    }
    throw new Error(message);
  }
  const data = await res.json() as { entries?: FileEntry[] };
  return (data.entries ?? []).map((e) => ({
    name: e.name,
    fullPath: joinFilePath(dirPath, e.name),
    isDir: e.isDir,
    size: e.size,
    children: e.isDir ? [] : undefined,
    loaded: !e.isDir,
  }));
}

async function fetchGitStatus(cwd: string): Promise<GitStatusResponse> {
  const params = new URLSearchParams({ cwd });
  const res = await fetch(`/api/git/status?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to load Git status (HTTP ${res.status})`);
  return res.json() as Promise<GitStatusResponse>;
}

const GIT_STATUS_LABELS: Record<GitFileStatusKind, string> = {
  modified: "Modified",
  added: "Added",
  deleted: "Deleted",
  renamed: "Renamed",
  untracked: "Untracked",
  conflict: "Conflict",
};

const GIT_STATUS_COLORS: Record<GitFileStatusKind, string> = {
  modified: "#d6a84b",
  added: "#4ade80",
  deleted: "#f87171",
  renamed: "#60a5fa",
  untracked: "#4ade80",
  conflict: "#f87171",
};

function MentionIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" />
    </svg>
  );
}

function TreeNode({
  node,
  depth,
  cwd,
  onOpenFile,
  onAtMention,
  expandedPaths,
  onToggleExpanded,
  refreshToken,
  highlightedPaths,
  gitStatusByPath,
  changedDirectoryPaths,
  isMobile,
}: {
  node: FileNode;
  depth: number;
  cwd: string;
  onOpenFile: (filePath: string, fileName: string) => void;
  onAtMention?: (relativePath: string, isDir: boolean) => void;
  expandedPaths: Set<string>;
  onToggleExpanded: (fullPath: string, open: boolean) => void;
  refreshToken: string;
  highlightedPaths: Set<string>;
  gitStatusByPath: Map<string, GitFileStatus>;
  changedDirectoryPaths: Set<string>;
  /** Touch devices have no hover, so the mention button must not be hover-gated there. */
  isMobile: boolean;
}) {
  const open = expandedPaths.has(node.fullPath);
  const highlighted = highlightedPaths.has(node.fullPath);
  const normalizedPath = normalizeFilePathSlashes(node.fullPath);
  const gitStatus = gitStatusByPath.get(normalizedPath);
  const containsGitChanges = node.isDir && (
    gitStatus !== undefined || changedDirectoryPaths.has(normalizedPath)
  );
  const [children, setChildren] = useState<FileNode[]>(node.children ?? []);
  const [loaded, setLoaded] = useState(node.loaded ?? false);
  const [loading, setLoading] = useState(false);
  const [hovered, setHovered] = useState(false);

  const loadChildren = useCallback(async (force = false) => {
    if (loaded && !force) return;
    setLoading(true);
    try {
      const entries = await fetchEntries(node.fullPath);
      setChildren(entries);
      setLoaded(true);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [loaded, node.fullPath]);

  // Re-fetch children when the tree refreshes and the directory is open.
  useEffect(() => {
    if (open && loaded) {
      loadChildren(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken]);

  const handleClick = useCallback(() => {
    if (node.isDir) {
      const next = !open;
      onToggleExpanded(node.fullPath, next);
      if (next && !loaded) loadChildren();
    } else {
      onOpenFile(node.fullPath, node.name);
    }
  }, [node.isDir, node.fullPath, node.name, loaded, open, loadChildren, onOpenFile, onToggleExpanded]);

  return (
    <div>
      <div
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: 4,
          paddingLeft: 8 + depth * 14,
          paddingRight: 8,
          height: 24,
          cursor: "pointer",
          background: hovered ? "var(--bg-hover)" : "transparent",
          borderRadius: 4,
          userSelect: "none",
        }}
      >
        {node.isDir && (
          <svg
            width="10" height="10" viewBox="0 0 10 10" fill="none"
            stroke="var(--text-dim)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
            style={{ flexShrink: 0, transform: open ? "rotate(90deg)" : "none", transition: "transform 0.1s" }}
          >
            <polyline points="3 2 7 5 3 8" />
          </svg>
        )}
        {!node.isDir && <span style={{ width: 10, flexShrink: 0 }} />}
        <span style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
          {node.isDir ? <FolderIcon size={14} open={open} /> : getFileIcon(node.name, 14)}
        </span>
        <span
          style={{
            fontSize: 12,
            color: "var(--text)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
          }}
          title={node.fullPath}
        >
          {node.name}
        </span>
        {highlighted && (
          <span
            title="Newly uploaded"
            aria-label="Newly uploaded"
            style={{ width: 6, height: 6, flexShrink: 0, borderRadius: "50%", background: "#3b82f6" }}
          />
        )}
        {!hovered && !node.isDir && gitStatus && (
          <span
            title={GIT_STATUS_LABELS[gitStatus.status]}
            aria-label={GIT_STATUS_LABELS[gitStatus.status]}
            style={{
              width: 14,
              flexShrink: 0,
              color: GIT_STATUS_COLORS[gitStatus.status],
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              fontWeight: 600,
              textAlign: "center",
            }}
          >
            {gitStatus.code}
          </span>
        )}
        {!hovered && containsGitChanges && (
          <span
            title="Contains changed files"
            aria-label="Contains changed files"
            style={{
              width: 6,
              height: 6,
              flexShrink: 0,
              borderRadius: "50%",
              background: "#d6a84b",
            }}
          />
        )}
        {loading && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="2" strokeLinecap="round">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" />
          </svg>
        )}
        {onAtMention && (hovered || isMobile) && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAtMention(getRelativeFilePath(node.fullPath, cwd), node.isDir);
            }}
            title="Insert path into chat"
            style={{
              position: "absolute",
              right: !node.isDir ? 28 : 4,
              top: "50%",
              transform: "translateY(-50%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              padding: "0 8px",
              height: 20,
              background: "var(--bg-panel)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              color: "var(--accent)",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            <MentionIcon />
            mention
          </button>
        )}
        {hovered && !node.isDir && (
          <a
            href={`/api/files/${encodeFilePathForApi(node.fullPath)}?type=download`}
            download
            onClick={(e) => e.stopPropagation()}
            title="Download file"
            style={{
              position: "absolute",
              right: 4,
              top: "50%",
              transform: "translateY(-50%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              padding: "0 5px",
              height: 20,
              background: "var(--bg-panel)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              color: "var(--text-muted)",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 600,
              whiteSpace: "nowrap",
              textDecoration: "none",
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </a>
        )}
      </div>
      {node.isDir && open && (
        <div>
          {children.map((child) => (
            <TreeNode
              key={child.fullPath}
              node={child}
              depth={depth + 1}
              cwd={cwd}
              onOpenFile={onOpenFile}
              onAtMention={onAtMention}
              expandedPaths={expandedPaths}
              onToggleExpanded={onToggleExpanded}
              refreshToken={refreshToken}
              highlightedPaths={highlightedPaths}
              gitStatusByPath={gitStatusByPath}
              changedDirectoryPaths={changedDirectoryPaths}
              isMobile={isMobile}
            />
          ))}
          {children.length === 0 && loaded && (
            <div style={{ paddingLeft: 8 + (depth + 1) * 14, fontSize: 11, color: "var(--text-dim)", height: 22, display: "flex", alignItems: "center" }}>
              empty
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export const FileExplorer = forwardRef<FileExplorerHandle, Props>(function FileExplorer({
  cwds,
  onOpenFile,
  refreshKey,
  onAtMention,
  onAtMentions,
  onUploadBusyChange,
}, ref) {
  // Use the first cwd as the primary one for uploads
  const primaryCwd = cwds[0] ?? "/";
  const isMobile = useIsMobile();
  const [rootsByCwd, setRootsByCwd] = useState<Map<string, FileNode[]>>(new Map());
  const [loadingCwds, setLoadingCwds] = useState<Set<string>>(new Set());
  const [errorsByCwd, setErrorsByCwd] = useState<Map<string, string>>(new Map());
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [treeRefreshKey, setTreeRefreshKey] = useState(0);
  const [highlightedPaths, setHighlightedPaths] = useState<Set<string>>(new Set());
  const [gitFilesByCwd, setGitFilesByCwd] = useState<Map<string, GitFileStatus[]>>(new Map());
  const prevCwdsRef = useRef<string[]>([]);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const refreshToken = `${refreshKey ?? 0}:${treeRefreshKey}`;
  const handleUploaded = useCallback((uploaded: string[]) => {
    setHighlightedPaths(new Set(uploaded.map((name) => joinFilePath(primaryCwd, name))));
    setTreeRefreshKey((key) => key + 1);
  }, [primaryCwd]);
  const upload = useFileUpload({ targetDirectory: primaryCwd, onUploaded: handleUploaded });
  const { prepareUpload } = upload;

  // Compute git status maps for each cwd
  const gitStatusByPathByCwd = useMemo(() => {
    const result = new Map<string, Map<string, GitFileStatus>>();
    for (const [cwd, files] of gitFilesByCwd.entries()) {
      result.set(cwd, new Map(files.map((status) => [normalizeFilePathSlashes(status.filePath), status])));
    }
    return result;
  }, [gitFilesByCwd]);

  const changedDirectoryPathsByCwd = useMemo(() => {
    const result = new Map<string, Set<string>>();
    for (const [cwd, files] of gitFilesByCwd.entries()) {
      const directories = new Set<string>();
      const normalizedCwd = normalizeFilePathSlashes(cwd).replace(/\/$/, "");
      for (const status of files) {
        let directory = getFileDirectory(normalizeFilePathSlashes(status.filePath));
        while (directory === normalizedCwd || directory.startsWith(`${normalizedCwd}/`)) {
          directories.add(directory);
          if (directory === normalizedCwd) break;
          const parent = getFileDirectory(directory);
          if (parent === directory) break;
          directory = parent;
        }
      }
      result.set(cwd, directories);
    }
    return result;
  }, [gitFilesByCwd]);

  const handleToggleExpanded = useCallback((fullPath: string, open: boolean) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (open) next.add(fullPath); else next.delete(fullPath);
      return next;
    });
  }, []);

  const handleUploadInput = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    void prepareUpload(files);
  }, [prepareUpload]);

  useImperativeHandle(ref, () => ({
    openUploadPicker() {
      if (!upload.busy) uploadInputRef.current?.click();
    },
  }), [upload.busy]);

  useEffect(() => {
    onUploadBusyChange?.(upload.busy);
  }, [onUploadBusyChange, upload.busy]);

  useEffect(() => () => onUploadBusyChange?.(false), [onUploadBusyChange]);

  // Load files for all cwds
  useEffect(() => {
    const cwdsChanged = JSON.stringify(prevCwdsRef.current) !== JSON.stringify(cwds);
    prevCwdsRef.current = cwds;

    // Reset expanded state only when cwds change, not on refreshKey bumps
    if (cwdsChanged) {
      setExpandedPaths(new Set());
      setHighlightedPaths(new Set());
    }

    const controllers = new Map<string, AbortController>();

    for (const cwd of cwds) {
      const controller = new AbortController();
      controllers.set(cwd, controller);

      setLoadingCwds((prev) => new Set(prev).add(cwd));
      setErrorsByCwd((prev) => {
        const next = new Map(prev);
        next.delete(cwd);
        return next;
      });

      fetchEntries(cwd)
        .then((entries) => {
          if (controller.signal.aborted) return;
          setRootsByCwd((prev) => new Map(prev).set(cwd, entries));
        })
        .catch((e) => {
          if (controller.signal.aborted) return;
          setErrorsByCwd((prev) => new Map(prev).set(cwd, e instanceof Error ? e.message : String(e)));
        })
        .finally(() => {
          if (controller.signal.aborted) return;
          setLoadingCwds((prev) => {
            const next = new Set(prev);
            next.delete(cwd);
            return next;
          });
        });
    }

    return () => {
      for (const controller of controllers.values()) {
        controller.abort();
      }
    };
  }, [cwds, refreshKey, treeRefreshKey]);

  // Load git status for all cwds
  useEffect(() => {
    const controllers = new Map<string, AbortController>();

    for (const cwd of cwds) {
      const controller = new AbortController();
      controllers.set(cwd, controller);

      fetchGitStatus(cwd)
        .then((status) => {
          if (controller.signal.aborted) return;
          setGitFilesByCwd((prev) => new Map(prev).set(cwd, status.isGitRepository ? status.files : []));
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setGitFilesByCwd((prev) => new Map(prev).set(cwd, []));
        });
    }

    return () => {
      for (const controller of controllers.values()) {
        controller.abort();
      }
    };
  }, [cwds, refreshKey, treeRefreshKey]);

  const addUploadedFilesToChat = useCallback((fileNames: string[]) => {
    onAtMentions?.(
      fileNames.map((name) => getRelativeFilePath(joinFilePath(primaryCwd, name), primaryCwd)),
    );
  }, [primaryCwd, onAtMentions]);

  return (
    <div style={{ minHeight: "100%" }}>
      <input ref={uploadInputRef} type="file" multiple hidden onChange={handleUploadInput} />
      <UploadFeedback
        phase={upload.phase}
        progress={upload.progress}
        error={upload.error}
        summary={upload.summary}
        pendingConflict={upload.pendingConflict}
        onReplace={() => upload.resolveConflict("overwrite")}
        onSkip={() => upload.resolveConflict("skip")}
        onCancelConflict={upload.cancelConflict}
        onDismissError={upload.dismissError}
        onDismissSummary={upload.dismissSummary}
        onMention={onAtMentions ? addUploadedFilesToChat : undefined}
        compact
      />

      <div style={{ padding: "2px 4px" }}>
        {cwds.map((cwd) => {
          const roots = rootsByCwd.get(cwd) ?? [];
          const loading = loadingCwds.has(cwd);
          const error = errorsByCwd.get(cwd);
          const gitStatusByPath = gitStatusByPathByCwd.get(cwd) ?? new Map();
          const changedDirectoryPaths = changedDirectoryPathsByCwd.get(cwd) ?? new Set();
          const cwdLabel = cwd.split('/').pop() || cwd;

          return (
            <div key={cwd} style={{ marginBottom: 8 }}>
              <div
                style={{
                  padding: "4px 8px",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  background: "var(--bg-hover)",
                  borderRadius: 4,
                  marginBottom: 4,
                  fontFamily: "var(--font-mono)",
                }}
              >
                {cwdLabel}
              </div>
              {loading && roots.length === 0 ? (
                // Only replace the tree while there is nothing to show. During a
                // refresh the existing nodes stay mounted, which preserves each
                // open directory's loaded children and the scroll position.
                <div style={{ padding: "8px 12px", fontSize: 11, color: "var(--text-dim)" }}>Loading files...</div>
              ) : error ? (
                <div style={{ padding: "8px 12px", fontSize: 11, color: "#f87171" }}>{error}</div>
              ) : (
                <>
                  {roots.map((node) => (
                    <TreeNode
                      key={node.fullPath}
                      node={node}
                      depth={0}
                      cwd={cwd}
                      onOpenFile={onOpenFile}
                      onAtMention={onAtMention}
                      expandedPaths={expandedPaths}
                      onToggleExpanded={handleToggleExpanded}
                      refreshToken={refreshToken}
                      highlightedPaths={highlightedPaths}
                      gitStatusByPath={gitStatusByPath}
                      changedDirectoryPaths={changedDirectoryPaths}
                      isMobile={isMobile}
                    />
                  ))}
                  {roots.length === 0 && (
                    <div style={{ padding: "8px 12px", fontSize: 11, color: "var(--text-dim)" }}>
                      No files found
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
