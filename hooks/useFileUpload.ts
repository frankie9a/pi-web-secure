"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { encodeFilePathForApi } from "@/lib/file-paths";

export type UploadPhase = "idle" | "checking" | "uploading" | "processing";
export type UploadConflictStrategy = "error" | "overwrite" | "skip";

export interface UploadError {
  name: string;
  error: string;
}

export interface UploadResponse {
  uploaded?: string[];
  skipped?: string[];
  errors?: UploadError[];
  conflicts?: string[];
  nonReplaceable?: string[];
  error?: string;
}

export interface UploadSummary {
  uploaded: string[];
  skipped: string[];
  errors: UploadError[];
}

export interface PendingUploadConflict {
  files: File[];
  conflicts: string[];
  nonReplaceable: string[];
}

interface UseFileUploadOptions {
  targetDirectory: string | null | undefined;
  onUploaded?: (fileNames: string[]) => void;
}

function uploadFiles(
  targetDirectory: string,
  files: File[],
  strategy: UploadConflictStrategy,
  onProgress: (progress: number) => void,
): Promise<{ status: number; data: UploadResponse }> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file, file.name));

    const xhr = new XMLHttpRequest();
    xhr.open(
      "POST",
      `/api/files/${encodeFilePathForApi(targetDirectory)}?type=upload&conflict=${strategy}`,
    );
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onerror = () => reject(new Error("Network error while uploading files"));
    xhr.onabort = () => reject(new Error("Upload cancelled"));
    xhr.onload = () => {
      let data: UploadResponse = {};
      try {
        data = JSON.parse(xhr.responseText) as UploadResponse;
      } catch {
        if (xhr.responseText) data.error = xhr.responseText;
      }
      resolve({ status: xhr.status, data });
    };
    xhr.send(formData);
  });
}

export function useFileUpload({ targetDirectory, onUploaded }: UseFileUploadOptions) {
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<UploadSummary | null>(null);
  const [pendingConflict, setPendingConflict] = useState<PendingUploadConflict | null>(null);
  const busyRef = useRef(false);
  const operationRef = useRef(0);
  const onUploadedRef = useRef(onUploaded);
  onUploadedRef.current = onUploaded;

  const resetFeedback = useCallback(() => {
    setError(null);
    setSummary(null);
    setPendingConflict(null);
  }, []);

  const applyResult = useCallback((data: UploadResponse) => {
    const uploaded = data.uploaded ?? [];
    const nextSummary = {
      uploaded,
      skipped: data.skipped ?? [],
      errors: data.errors ?? [],
    };
    setSummary(nextSummary);
    if (uploaded.length > 0) onUploadedRef.current?.(uploaded);
  }, []);

  const performUpload = useCallback(async (
    files: File[],
    strategy: UploadConflictStrategy,
  ) => {
    if (!targetDirectory || files.length === 0 || busyRef.current) return;
    const operation = ++operationRef.current;
    busyRef.current = true;
    setPendingConflict(null);
    setError(null);
    setProgress(0);
    setPhase("uploading");

    try {
      const { status, data } = await uploadFiles(targetDirectory, files, strategy, (nextProgress) => {
        if (operation !== operationRef.current) return;
        setProgress(nextProgress);
        // The browser reports the request body as sent long before the server has
        // parsed the multipart body and written it to disk. Showing "100%" during
        // that gap is what made the bar look finished while the upload was still
        // running, so switch to an explicit processing state instead.
        if (nextProgress >= 100) setPhase("processing");
      });
      if (operation !== operationRef.current) return;
      if (status === 409 && data.conflicts?.length) {
        setPendingConflict({
          files,
          conflicts: data.conflicts,
          nonReplaceable: data.nonReplaceable ?? [],
        });
        return;
      }
      if (status < 200 || status >= 300) {
        throw new Error(data.error ?? `Upload failed (HTTP ${status})`);
      }
      setProgress(100);
      applyResult(data);
    } catch (uploadFailure) {
      if (operation === operationRef.current) {
        setError(uploadFailure instanceof Error ? uploadFailure.message : String(uploadFailure));
      }
    } finally {
      if (operation === operationRef.current) {
        busyRef.current = false;
        setPhase("idle");
      }
    }
  }, [applyResult, targetDirectory]);

  const prepareUpload = useCallback(async (files: File[]) => {
    if (files.length === 0 || busyRef.current) return;
    if (!targetDirectory) {
      setError("Select a working directory before uploading files");
      return;
    }

    const operation = ++operationRef.current;
    busyRef.current = true;
    setSummary(null);
    setPendingConflict(null);
    setError(null);
    setProgress(0);
    setPhase("checking");

    try {
      const res = await fetch(
        `/api/files/${encodeFilePathForApi(targetDirectory)}?type=upload-check`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileNames: files.map((file) => file.name) }),
        },
      );
      const data = await res.json().catch(() => ({})) as UploadResponse;
      if (operation !== operationRef.current) return;
      if (!res.ok) throw new Error(data.error ?? `Upload check failed (HTTP ${res.status})`);

      if (data.conflicts?.length) {
        setPendingConflict({
          files,
          conflicts: data.conflicts,
          nonReplaceable: data.nonReplaceable ?? [],
        });
        return;
      }
    } catch (uploadFailure) {
      if (operation === operationRef.current) {
        setError(uploadFailure instanceof Error ? uploadFailure.message : String(uploadFailure));
      }
      return;
    } finally {
      if (operation === operationRef.current) {
        busyRef.current = false;
        setPhase("idle");
      }
    }

    if (operation === operationRef.current) await performUpload(files, "error");
  }, [performUpload, targetDirectory]);

  const resolveConflict = useCallback((strategy: Exclude<UploadConflictStrategy, "error">) => {
    if (!pendingConflict) return;
    void performUpload(pendingConflict.files, strategy);
  }, [pendingConflict, performUpload]);

  useEffect(() => {
    operationRef.current += 1;
    busyRef.current = false;
    setPhase("idle");
    setProgress(0);
    resetFeedback();
  }, [resetFeedback, targetDirectory]);

  return {
    phase,
    progress,
    busy: phase !== "idle",
    error,
    summary,
    pendingConflict,
    prepareUpload,
    resolveConflict,
    cancelConflict: () => setPendingConflict(null),
    dismissError: () => setError(null),
    dismissSummary: () => setSummary(null),
  };
}
