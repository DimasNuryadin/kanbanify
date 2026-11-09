import {
  AIAnalyticsReport,
  AIAnalyticsReportSchema,
  AIParseAutomationResponse,
  AIParseAutomationResponseSchema,
  AutomationRule,
  AutomationRuleSchema,
  Board,
  BoardAnalytics,
  BoardAnalyticsSchema,
  BoardExportCsvResponse,
  BoardExportCsvResponseSchema,
  BoardSchema,
  BoardSummary,
  BoardSummarySchema,
  BoardTemplate,
  BoardTemplateSchema,
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
  CreateAutomationRuleRequest,
  CreateBoardRequest,
  CreateCardRequest,
  CreateColumnRequest,
  CreateCommentRequest,
  CreateWorkspaceRequest,
  MoveCardRequest,
  MoveColumnRequest,
  StandardErrorSchema,
  TrelloImportRequest,
  TrelloImportResult,
  TrelloImportResultSchema,
  UpdateAutomationRuleRequest,
  UpdateBoardRequest,
  UpdateCardRequest,
  UpdateColumnRequest,
  Workspace,
  WorkspaceSchema,
  WorkspaceWithBoards,
  WorkspaceWithBoardsSchema,
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

  async getWorkspaces(opts: ApiClientOptions): Promise<WorkspaceWithBoards[]> {
    if (opts.useMock) {
      return mockApi.listWorkspaces();
    }
    try {
      return await fetchJson(
        "/api/v1/workspaces",
        { method: "GET" },
        (raw) =>
          Array.isArray(raw)
            ? raw.map((w) => WorkspaceWithBoardsSchema.parse(w))
            : []
      );
    } catch (err) {
      opts.onFallbackToMock?.(
        err instanceof Error ? err.message : "Backend API unreachable"
      );
      return mockApi.listWorkspaces();
    }
  },

  async getWorkspace(
    workspaceId: string,
    opts: ApiClientOptions
  ): Promise<WorkspaceWithBoards> {
    if (opts.useMock) {
      return mockApi.getWorkspace(workspaceId);
    }
    try {
      return await fetchJson(
        `/api/v1/workspaces/${workspaceId}`,
        { method: "GET" },
        (raw) => WorkspaceWithBoardsSchema.parse(raw)
      );
    } catch (err) {
      opts.onFallbackToMock?.(
        err instanceof Error ? err.message : "Backend API unreachable"
      );
      return mockApi.getWorkspace(workspaceId);
    }
  },

  async createWorkspace(
    payload: CreateWorkspaceRequest,
    opts: ApiClientOptions
  ): Promise<Workspace> {
    if (opts.useMock) {
      return mockApi.createWorkspace(payload);
    }
    try {
      return await fetchJson(
        "/api/v1/workspaces",
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
        (raw) => WorkspaceSchema.parse(raw)
      );
    } catch (err) {
      opts.onFallbackToMock?.(
        err instanceof Error ? err.message : "Backend API unreachable"
      );
      return mockApi.createWorkspace(payload);
    }
  },

  async getBoardTemplates(opts: ApiClientOptions): Promise<BoardTemplate[]> {
    if (opts.useMock) {
      return mockApi.getBoardTemplates();
    }
    try {
      return await fetchJson(
        "/api/v1/board-templates",
        { method: "GET" },
        (raw) =>
          Array.isArray(raw)
            ? raw.map((t) => BoardTemplateSchema.parse(t))
            : []
      );
    } catch (err) {
      opts.onFallbackToMock?.(
        err instanceof Error ? err.message : "Backend API unreachable"
      );
      return mockApi.getBoardTemplates();
    }
  },

  async listBoards(opts: ApiClientOptions): Promise<Board[]> {
    if (opts.useMock) {
      return mockApi.listBoards();
    }
    try {
      return await fetchJson(
        "/api/v1/boards",
        { method: "GET" },
        (raw) =>
          Array.isArray(raw) ? raw.map((b) => BoardSchema.parse(b)) : []
      );
    } catch (err) {
      opts.onFallbackToMock?.(
        err instanceof Error ? err.message : "Backend API unreachable"
      );
      return mockApi.listBoards();
    }
  },

  async getBoardSummaries(opts: ApiClientOptions): Promise<BoardSummary[]> {
    if (opts.useMock) {
      return mockApi.getBoardSummaries();
    }
    try {
      const workspaces = await this.getWorkspaces(opts);
      return workspaces.flatMap((w) => w.boards);
    } catch {
      return mockApi.getBoardSummaries();
    }
  },

  async getAutomations(
    boardId: string,
    opts: ApiClientOptions
  ): Promise<AutomationRule[]> {
    if (opts.useMock) {
      return mockApi.getAutomations(boardId);
    }
    try {
      return await fetchJson(
        `/api/v1/boards/${boardId}/automations`,
        { method: "GET" },
        (raw) =>
          Array.isArray(raw)
            ? raw.map((r) => AutomationRuleSchema.parse(r))
            : []
      );
    } catch (err) {
      opts.onFallbackToMock?.(
        err instanceof Error ? err.message : "Backend API unreachable"
      );
      return mockApi.getAutomations(boardId);
    }
  },

  async createAutomation(
    boardId: string,
    payload: CreateAutomationRuleRequest,
    opts: ApiClientOptions
  ): Promise<AutomationRule> {
    if (opts.useMock) {
      return mockApi.createAutomation(boardId, payload);
    }
    try {
      return await fetchJson(
        `/api/v1/boards/${boardId}/automations`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
        (raw) => AutomationRuleSchema.parse(raw)
      );
    } catch (err) {
      opts.onFallbackToMock?.(
        err instanceof Error ? err.message : "Backend API unreachable"
      );
      return mockApi.createAutomation(boardId, payload);
    }
  },

  async updateAutomation(
    ruleId: string,
    payload: UpdateAutomationRuleRequest,
    opts: ApiClientOptions
  ): Promise<AutomationRule> {
    if (opts.useMock) {
      return mockApi.updateAutomation(ruleId, payload);
    }
    try {
      return await fetchJson(
        `/api/v1/automations/${ruleId}`,
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        },
        (raw) => AutomationRuleSchema.parse(raw)
      );
    } catch (err) {
      opts.onFallbackToMock?.(
        err instanceof Error ? err.message : "Backend API unreachable"
      );
      return mockApi.updateAutomation(ruleId, payload);
    }
  },

  async deleteAutomation(
    ruleId: string,
    opts: ApiClientOptions
  ): Promise<{ id: string; deleted: boolean }> {
    if (opts.useMock) {
      return mockApi.deleteAutomation(ruleId);
    }
    try {
      return await fetchJson(
        `/api/v1/automations/${ruleId}`,
        { method: "DELETE" },
        () => ({ id: ruleId, deleted: true })
      );
    } catch (err) {
      opts.onFallbackToMock?.(
        err instanceof Error ? err.message : "Backend API unreachable"
      );
      return mockApi.deleteAutomation(ruleId);
    }
  },

  async aiGenerateAutomation(
    boardId: string,
    prompt: string,
    opts: ApiClientOptions
  ): Promise<AIParseAutomationResponse & Partial<AutomationRule>> {
    if (opts.useMock) {
      return mockApi.parseAutomationWithAi(boardId, prompt);
    }
    try {
      return await fetchJson(
        `/api/v1/boards/${boardId}/automations/ai-generate`,
        {
          method: "POST",
          body: JSON.stringify({ prompt }),
        },
        (raw) => {
          const fullRule = AutomationRuleSchema.safeParse(raw);
          if (fullRule.success) {
            return fullRule.data;
          }
          return AIParseAutomationResponseSchema.parse(raw);
        }
      );
    } catch (err) {
      opts.onFallbackToMock?.(
        err instanceof Error ? err.message : "AI Automation builder unreachable"
      );
      return mockApi.parseAutomationWithAi(boardId, prompt);
    }
  },

  async getBoardAnalytics(
    boardId: string,
    opts: ApiClientOptions
  ): Promise<BoardAnalytics> {
    if (opts.useMock) {
      return mockApi.getBoardAnalytics(boardId);
    }
    try {
      return await fetchJson(
        `/api/v1/boards/${boardId}/analytics`,
        { method: "GET" },
        (raw) => BoardAnalyticsSchema.parse(raw)
      );
    } catch (err) {
      opts.onFallbackToMock?.(
        err instanceof Error ? err.message : "Analytics API unreachable"
      );
      return mockApi.getBoardAnalytics(boardId);
    }
  },

  async generateAIAnalyticsReport(
    boardId: string,
    opts: ApiClientOptions
  ): Promise<AIAnalyticsReport> {
    if (opts.useMock) {
      return mockApi.generateAIAnalyticsReport(boardId);
    }
    try {
      return await fetchJson(
        `/api/v1/boards/${boardId}/analytics/ai-report`,
        {
          method: "POST",
          body: JSON.stringify({}),
        },
        (raw) => AIAnalyticsReportSchema.parse(raw)
      );
    } catch (err) {
      opts.onFallbackToMock?.(
        err instanceof Error ? err.message : "AI Analytics API unreachable"
      );
      return mockApi.generateAIAnalyticsReport(boardId);
    }
  },

  async importBoard(
    payload: TrelloImportRequest,
    opts: ApiClientOptions
  ): Promise<TrelloImportResult> {
    if (opts.useMock) {
      return mockApi.importBoard(payload);
    }
    try {
      return await fetchJson(
        "/api/v1/boards/import",
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
        (raw) => TrelloImportResultSchema.parse(raw)
      );
    } catch (err) {
      opts.onFallbackToMock?.(
        err instanceof Error ? err.message : "Board Import API unreachable"
      );
      return mockApi.importBoard(payload);
    }
  },

  async exportBoardCsv(
    boardId: string,
    opts: ApiClientOptions
  ): Promise<BoardExportCsvResponse> {
    if (opts.useMock) {
      return mockApi.exportBoardCsv(boardId);
    }
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/v1/boards/${boardId}/export?format=csv`,
          {
            method: "GET",
            signal: controller.signal,
          }
        );
        if (!res.ok) {
          throw new Error(`API Error (${res.status}): ${res.statusText}`);
        }
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("text/csv")) {
          const text = await res.text();
          return {
            filename: `board-${boardId.slice(0, 8)}-export.csv`,
            content_type: "text/csv",
            csv_data: text,
          };
        }
        const data = await res.json();
        return BoardExportCsvResponseSchema.parse(data);
      } finally {
        clearTimeout(timeout);
      }
    } catch (err) {
      opts.onFallbackToMock?.(
        err instanceof Error ? err.message : "Board Export API unreachable"
      );
      return mockApi.exportBoardCsv(boardId);
    }
  },

  async exportBoardJson(
    boardId: string,
    opts: ApiClientOptions
  ): Promise<Board> {
    if (opts.useMock) {
      return mockApi.exportBoardJson(boardId);
    }
    try {
      return await fetchJson(
        `/api/v1/boards/${boardId}/export?format=json`,
        { method: "GET" },
        (raw) => BoardSchema.parse(raw)
      );
    } catch (err) {
      opts.onFallbackToMock?.(
        err instanceof Error ? err.message : "Board Export API unreachable"
      );
      return mockApi.exportBoardJson(boardId);
    }
  },
};
