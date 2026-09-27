// Desktop users typically have more screen space and faster devices
export const VISIBLE_PAGE_SIZE = 150;
export const PAGING_PAGE_SIZE = 50;
export const MOBILE_PAGE_SIZE = 50;

export function getVisibleRenderWindow(totalCount: number, visibleCount: number): {
  startIndex: number;
  hasMore: boolean;
} {
  const clampedVisibleCount = Math.min(Math.max(visibleCount, 0), Math.max(totalCount, 0));
  const startIndex = Math.max(0, totalCount - clampedVisibleCount);
  return { startIndex, hasMore: startIndex > 0 };
}

export function getNextVisibleCount(currentVisibleCount: number, pageSize = PAGING_PAGE_SIZE): number {
  return currentVisibleCount + pageSize;
}

export function getInitialPageSize(isMobile: boolean): number {
  return isMobile ? MOBILE_PAGE_SIZE : VISIBLE_PAGE_SIZE;
}

/**
 * Index of the first message that keeps exactly `visibleLimit` user/assistant
 * messages in the tail, so a server-sent tail fills the client's render window.
 * Tool results and system messages ride along uncounted. Returns 0 when the
 * transcript is already short enough (nothing to trim).
 */
export function findVisibleTailStart(messages: readonly { role?: string }[], visibleLimit: number): number {
  let seen = 0;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const role = messages[index]?.role;
    if (role !== "user" && role !== "assistant") continue;
    if (seen === visibleLimit) return index + 1;
    seen += 1;
  }
  return 0;
}

export function captureScrollDistance(scrollHeight: number, scrollTop: number): number {
  return scrollHeight - scrollTop;
}

export function restoreScrollTop(scrollHeight: number, savedDistance: number): number {
  return Math.max(0, scrollHeight - savedDistance);
}
