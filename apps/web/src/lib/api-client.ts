import {
  Board,
  BoardSchema,
  Card,
  CardSchema,
  Column,
  ColumnSchema,
  CreateBoardRequest,
  CreateCardRequest,
  CreateColumnRequest,
  MoveCardRequest,
  StandardErrorSchema,
  UpdateCardRequest,
} from "@kinetix/contracts";
import { mockApi } from "./mock-data";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const DEFAULT_USE_MOCK =
  process.env.NEXT_PUBLIC_USE_MOCK !== undefined
    ? process.env.NEXT_PUBLIC_USE_MOCK === "true"
    : true;

async function fetchJson<T>(
  path: string,
  init: RequestInit | undefined,
  parse: (raw: unknown) => T
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);

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
      // First check if a specific board exists or list boards
      const boards = await fetchJson("/api/v1/boards", { method: "GET" }, (raw) => {
        if (Array.isArray(raw)) return raw;
        return [];
      });

      const targetId =
        boards.length > 0 && typeof boards[0]?.id === "string"
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
