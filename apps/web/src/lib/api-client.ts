import {
  Board,
  BoardSchema,
  Card,
  CardSchema,
  Column,
  ColumnSchema,
  Comment,
  CommentSchema,
  CopyCardRequest,
  CopyColumnRequest,
  CopyColumnResponse,
  CopyColumnResponseSchema,
  CreateBoardRequest,
  CreateCardRequest,
  CreateColumnRequest,
  CreateCommentRequest,
  MoveCardRequest,
  MoveColumnRequest,
  StandardErrorSchema,
  UpdateBoardRequest,
  UpdateCardRequest,
  UpdateColumnRequest,
} from "@kinetix/contracts";
import { mockApi } from "./mock-data";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const DEFAULT_USE_MOCK =
  process.env.NEXT_PUBLIC_USE_MOCK !== undefined
    ? process.env.NEXT_PUBLIC_USE_MOCK === "true"
    : false;

async function fetchJson<T>(
  path: string,
  init: RequestInit | undefined,
  parse: (raw: unknown) => T
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      signal: controller.signal,
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const parsedErr = StandardErrorSchema.safeParse(data);
      if (parsedErr.success) {
        throw new Error(parsedErr.data.error.message);
      }
      throw new Error(`API Error (${res.status}): ${res.statusText}`);
    }

    return parse(data);
  } finally {
    clearTimeout(timeout);
  }
}

export interface ApiClientOptions {
  useMock: boolean;
  onFallbackToMock?: (reason: string) => void;
}

export const apiClient = {
  async checkHealth(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1800);
      const res = await fetch(`${API_BASE_URL}/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return res.ok;
    } catch {
      return false;
    }
  },

  async getBoard(boardId: string, opts: ApiClientOptions): Promise<Board> {
    if (opts.useMock) {
      return mockApi.getBoard(boardId);
    }
    try {
      const boards = await fetchJson("/api/v1/boards", { method: "GET" }, (raw) => {
        if (Array.isArray(raw)) return raw;
        return [];
      });

      const targetId = boards.some(
        (b) => typeof b?.id === "string" && b.id === boardId
      )
        ? boardId
        : boards.length > 0 && typeof boards[0]?.id === "string"
          ? boards[0].id
          : boardId;

      return await fetchJson(
        `/api/v1/boards/${targetId}`,
        { method: "GET" },
        (raw) => BoardSchema.parse(raw)
      );
    } catch (err) {
      opts.onFallbackToMock?.(
        err instanceof Error ? err.message : "Backend API unreachable"
      );
      return mockApi.getBoard(boardId);
    }
  },

  async createBoard(
    payload: CreateBoardRequest,
    opts: ApiClientOptions
  ): Promise<Board> {
    if (opts.useMock) {
      return mockApi.createBoard(payload);
    }
    try {
      return await fetchJson(
        "/api/v1/boards",
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
        (raw) => BoardSchema.parse(raw)
      );
    } catch (err) {
      opts.onFallbackToMock?.(
        err instanceof Error ? err.message : "Backend API unreachable"
      );
      return mockApi.createBoard(payload);
    }
  },

  async updateBoard(
    boardId: string,
    payload: UpdateBoardRequest,
    opts: ApiClientOptions
  ): Promise<Board> {
    if (opts.useMock) {
      return mockApi.updateBoard(boardId, payload);
    }
    try {
      return await fetchJson(
        `/api/v1/boards/${boardId}`,
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        },
        (raw) => BoardSchema.parse(raw)
      );
    } catch (err) {
      opts.onFallbackToMock?.(
        err instanceof Error ? err.message : "Backend API unreachable"
      );
      return mockApi.updateBoard(boardId, payload);
    }
  },

  async createColumn(
    boardId: string,
    payload: CreateColumnRequest,
    opts: ApiClientOptions
  ): Promise<Column> {
    if (opts.useMock) {
      return mockApi.createColumn(boardId, payload);
    }
    try {
      return await fetchJson(
        `/api/v1/boards/${boardId}/columns`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
        (raw) => ColumnSchema.parse(raw)
      );
    } catch (err) {
      opts.onFallbackToMock?.(
        err instanceof Error ? err.message : "Backend API unreachable"
      );
      return mockApi.createColumn(boardId, payload);
    }
  },

  async updateColumn(
    columnId: string,
    payload: UpdateColumnRequest,
    opts: ApiClientOptions
  ): Promise<Column> {
    if (opts.useMock) {
      return mockApi.updateColumn(columnId, payload);
    }
    try {
      return await fetchJson(
        `/api/v1/columns/${columnId}`,
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        },
        (raw) => ColumnSchema.parse(raw)
      );
    } catch (err) {
      opts.onFallbackToMock?.(
        err instanceof Error ? err.message : "Backend API unreachable"
      );
      return mockApi.updateColumn(columnId, payload);
    }
  },

  async moveColumn(
    columnId: string,
    payload: MoveColumnRequest,
    opts: ApiClientOptions
  ): Promise<Column> {
    if (opts.useMock) {
      return mockApi.moveColumn(columnId, payload);
    }
    try {
      return await fetchJson(
        `/api/v1/columns/${columnId}/move`,
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        },
        (raw) => ColumnSchema.parse(raw)
      );
    } catch (err) {
      opts.onFallbackToMock?.(
        err instanceof Error ? err.message : "Backend API unreachable"
      );
      return mockApi.moveColumn(columnId, payload);
    }
  },

  async copyColumn(
    columnId: string,
    payload: CopyColumnRequest | undefined,
    opts: ApiClientOptions
  ): Promise<CopyColumnResponse> {
    if (opts.useMock) {
      return mockApi.copyColumn(columnId, payload);
    }
    try {
      return await fetchJson(
        `/api/v1/columns/${columnId}/copy`,
        {
          method: "POST",
          body: JSON.stringify(payload ?? {}),
        },
        (raw) => CopyColumnResponseSchema.parse(raw)
      );
    } catch (err) {
      opts.onFallbackToMock?.(
        err instanceof Error ? err.message : "Backend API unreachable"
      );
      return mockApi.copyColumn(columnId, payload);
    }
  },

  async createCard(
    boardId: string,
    payload: CreateCardRequest,
    opts: ApiClientOptions
  ): Promise<Card> {
    if (opts.useMock) {
      return mockApi.createCard(boardId, payload);
    }
    try {
      return await fetchJson(
        `/api/v1/boards/${boardId}/cards`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
        (raw) => CardSchema.parse(raw)
      );
    } catch (err) {
      opts.onFallbackToMock?.(
        err instanceof Error ? err.message : "Backend API unreachable"
      );
      return mockApi.createCard(boardId, payload);
    }
  },

  async updateCard(
    cardId: string,
    payload: UpdateCardRequest,
    opts: ApiClientOptions
  ): Promise<Card> {
    if (opts.useMock) {
      return mockApi.updateCard(cardId, payload);
    }
    try {
      return await fetchJson(
        `/api/v1/cards/${cardId}`,
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        },
        (raw) => CardSchema.parse(raw)
      );
    } catch (err) {
      opts.onFallbackToMock?.(
        err instanceof Error ? err.message : "Backend API unreachable"
      );
      return mockApi.updateCard(cardId, payload);
    }
  },

  async moveCard(
    cardId: string,
    payload: MoveCardRequest,
    opts: ApiClientOptions
  ): Promise<Card> {
    if (opts.useMock) {
      return mockApi.moveCard(cardId, payload);
    }
    try {
      return await fetchJson(
        `/api/v1/cards/${cardId}/move`,
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        },
        (raw) => CardSchema.parse(raw)
      );
    } catch (err) {
      opts.onFallbackToMock?.(
        err instanceof Error ? err.message : "Backend API unreachable"
      );
      return mockApi.moveCard(cardId, payload);
    }
  },

  async copyCard(
    cardId: string,
    payload: CopyCardRequest | undefined,
    opts: ApiClientOptions
  ): Promise<Card> {
    if (opts.useMock) {
      return mockApi.copyCard(cardId, payload);
    }
    try {
      return await fetchJson(
        `/api/v1/cards/${cardId}/copy`,
        {
          method: "POST",
          body: JSON.stringify(payload ?? {}),
        },
        (raw) => CardSchema.parse(raw)
      );
    } catch (err) {
      opts.onFallbackToMock?.(
        err instanceof Error ? err.message : "Backend API unreachable"
      );
      return mockApi.copyCard(cardId, payload);
    }
  },

  async deleteCard(
    cardId: string,
    opts: ApiClientOptions
  ): Promise<{ id: string; deleted: boolean }> {
    if (opts.useMock) {
      return mockApi.deleteCard(cardId);
    }
    try {
      return await fetchJson(
        `/api/v1/cards/${cardId}`,
        {
          method: "DELETE",
        },
        () => ({ id: cardId, deleted: true })
      );
    } catch (err) {
      opts.onFallbackToMock?.(
        err instanceof Error ? err.message : "Backend API unreachable"
      );
      return mockApi.deleteCard(cardId);
    }
  },

  async addComment(
    cardId: string,
    payload: CreateCommentRequest,
    opts: ApiClientOptions
  ): Promise<Comment> {
    if (opts.useMock) {
      return mockApi.addComment(cardId, payload);
    }
    try {
      return await fetchJson(
        `/api/v1/cards/${cardId}/comments`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
        (raw) => CommentSchema.parse(raw)
      );
    } catch (err) {
      opts.onFallbackToMock?.(
        err instanceof Error ? err.message : "Backend API unreachable"
      );
      return mockApi.addComment(cardId, payload);
    }
  },

  async deleteComment(
    cardId: string,
    commentId: string,
    opts: ApiClientOptions
  ): Promise<{ id: string; deleted: boolean }> {
    if (opts.useMock) {
      return mockApi.deleteComment(cardId, commentId);
    }
    try {
      return await fetchJson(
        `/api/v1/cards/${cardId}/comments/${commentId}`,
        {
          method: "DELETE",
        },
        () => ({ id: commentId, deleted: true })
      );
    } catch (err) {
      opts.onFallbackToMock?.(
        err instanceof Error ? err.message : "Backend API unreachable"
      );
      return mockApi.deleteComment(cardId, commentId);
    }
  },

  async aiDecomposeCard(
    cardId: string,
    boardContext: string[],
    opts: ApiClientOptions
  ): Promise<Card> {
    if (opts.useMock) {
      return mockApi.aiDecomposeCard(cardId);
    }
    try {
      return await fetchJson(
        `/api/v1/cards/${cardId}/ai-decompose`,
        {
          method: "POST",
          body: JSON.stringify({ board_context: boardContext }),
        },
        (raw) => CardSchema.parse(raw)
      );
    } catch (err) {
      opts.onFallbackToMock?.(
        err instanceof Error ? err.message : "AI Engine / API unreachable"
      );
      return mockApi.aiDecomposeCard(cardId);
    }
  },
};
