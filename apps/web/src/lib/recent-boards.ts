export interface RecentBoardRecord {
  boardId: string;
  openedAt: number;
}

const STORAGE_KEY_RECENT_BOARDS = "kanbanify_recent_boards";

export function getRecentBoards(): RecentBoardRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_RECENT_BOARDS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => {
          if (typeof item === "string") {
            return { boardId: item, openedAt: Date.now() };
          }
          if (item && typeof item === "object" && item.boardId) {
            return {
              boardId: String(item.boardId),
              openedAt: Number(item.openedAt) || Date.now(),
            };
          }
          return null;
        })
        .filter((r): r is RecentBoardRecord => Boolean(r));
    }
  } catch {
    // fallback
  }
  return [];
}

export function recordRecentBoard(boardId: string): void {
  if (typeof window === "undefined" || !boardId) return;
  try {
    const existing = getRecentBoards().filter((r) => r.boardId !== boardId);
    const updated: RecentBoardRecord[] = [
      { boardId, openedAt: Date.now() },
      ...existing,
    ].slice(0, 10);
    window.localStorage.setItem(
      STORAGE_KEY_RECENT_BOARDS,
      JSON.stringify(updated)
    );
  } catch {
    // fallback
  }
}
