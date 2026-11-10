import {
  Activity,
  AIAnalyticsReport,
  AIAnalyticsReportSchema,
  AIParseAutomationResponse,
  AIParseAutomationResponseSchema,
  AIPermissionAuditResponse,
  AIPermissionAuditResponseSchema,
  AISummaryNotificationResponse,
  AISummaryNotificationResponseSchema,
  AuthSessionResponse,
  AuthSessionResponseSchema,
  AuthUser,
  AuthUserSchema,
  AutomationRule,
  AutomationRuleSchema,
  Board,
  BoardAnalytics,
  BoardAnalyticsSchema,
  BoardExportCsvResponse,
  BoardExportCsvResponseSchema,
  BoardInviteLink,
  BoardInviteLinkSchema,
  BoardRole,
  BoardRoleEnum,
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
  CreateInviteLinkRequest,
  CreateWebhookRequest,
  CreateWorkspaceRequest,
  JoinViaInviteRequest,
  JoinViaInviteResponse,
  JoinViaInviteResponseSchema,
  LoginRequest,
  Member,
  MemberSchema,
  MoveCardRequest,
  MoveColumnRequest,
  RegisterRequest,
  StandardErrorSchema,
  TestWebhookResponse,
  TestWebhookResponseSchema,
  TrelloImportRequest,
  TrelloImportResult,
  TrelloImportResultSchema,
  UpdateAutomationRuleRequest,
  UpdateBoardRequest,
  UpdateCardRequest,
  UpdateColumnRequest,
  UpdateWebhookRequest,
  WebhookConfig,
  WebhookConfigSchema,
  Workspace,
  WorkspaceSchema,
  WorkspaceWithBoards,
  WorkspaceWithBoardsSchema,
} from "@kinetix/contracts";
import { z } from "zod";
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

  const authHeaders: Record<string, string> = {};
  if (typeof window !== "undefined") {
    try {
      const token = window.localStorage.getItem("kanbanify_auth_token") || "kb_sess_alex_admin_token";
      if (token) {
        authHeaders["Authorization"] = `Bearer ${token}`;
      }
      const role = window.localStorage.getItem("kanbanify_active_role") || "ADMIN";
      if (role) {
        authHeaders["X-Kanbanify-Role"] = role;
      }
    } catch {
      // storage unavailable
    }
  }

  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
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

  // --- Phase 5: Outbound Webhook Integration Endpoints ---
  async getWebhooks(
    boardId: string,
    opts: ApiClientOptions
  ): Promise<WebhookConfig[]> {
    if (opts.useMock) {
      return mockApi.getWebhooks(boardId);
    }
    try {
      return await fetchJson(
        `/api/v1/boards/${boardId}/webhooks`,
        { method: "GET" },
        (raw) => z.array(WebhookConfigSchema).parse(raw)
      );
    } catch (err) {
      opts.onFallbackToMock?.(
        err instanceof Error ? err.message : "Webhooks API unreachable"
      );
      return mockApi.getWebhooks(boardId);
    }
  },

  async createWebhook(
    boardId: string,
    payload: CreateWebhookRequest,
    opts: ApiClientOptions
  ): Promise<WebhookConfig> {
    if (opts.useMock) {
      return mockApi.createWebhook(boardId, payload);
    }
    try {
      return await fetchJson(
        `/api/v1/boards/${boardId}/webhooks`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
        (raw) => WebhookConfigSchema.parse(raw)
      );
    } catch (err) {
      opts.onFallbackToMock?.(
        err instanceof Error ? err.message : "Create Webhook API unreachable"
      );
      return mockApi.createWebhook(boardId, payload);
    }
  },

  async updateWebhook(
    webhookId: string,
    payload: UpdateWebhookRequest,
    opts: ApiClientOptions
  ): Promise<WebhookConfig> {
    if (opts.useMock) {
      return mockApi.updateWebhook(webhookId, payload);
    }
    try {
      return await fetchJson(
        `/api/v1/webhooks/${webhookId}`,
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        },
        (raw) => WebhookConfigSchema.parse(raw)
      );
    } catch (err) {
      opts.onFallbackToMock?.(
        err instanceof Error ? err.message : "Update Webhook API unreachable"
      );
      return mockApi.updateWebhook(webhookId, payload);
    }
  },

  async deleteWebhook(
    webhookId: string,
    opts: ApiClientOptions
  ): Promise<void> {
    if (opts.useMock) {
      return mockApi.deleteWebhook(webhookId);
    }
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/webhooks/${webhookId}`, {
          method: "DELETE",
          signal: controller.signal,
        });
        if (!res.ok && res.status !== 204) {
          throw new Error(`API Error (${res.status}): ${res.statusText}`);
        }
      } finally {
        clearTimeout(timeout);
      }
    } catch (err) {
      opts.onFallbackToMock?.(
        err instanceof Error ? err.message : "Delete Webhook API unreachable"
      );
      return mockApi.deleteWebhook(webhookId);
    }
  },

  async testWebhook(
    webhookId: string,
    opts: ApiClientOptions
  ): Promise<TestWebhookResponse> {
    if (opts.useMock) {
      return mockApi.testWebhook(webhookId);
    }
    try {
      return await fetchJson(
        `/api/v1/webhooks/${webhookId}/test`,
        {
          method: "POST",
          body: JSON.stringify({}),
        },
        (raw) => TestWebhookResponseSchema.parse(raw)
      );
    } catch (err) {
      opts.onFallbackToMock?.(
        err instanceof Error ? err.message : "Test Webhook API unreachable"
      );
      return mockApi.testWebhook(webhookId);
    }
  },

  async generateAISummaryNotification(
    boardTitle: string,
    activities: Activity[] = [],
    opts: ApiClientOptions
  ): Promise<AISummaryNotificationResponse> {
    if (opts.useMock) {
      return mockApi.generateAISummaryNotification(boardTitle, activities);
    }
    try {
      return await fetchJson(
        "/internal/v1/format-notification",
        {
          method: "POST",
          body: JSON.stringify({
            board_title: boardTitle,
            recent_activities: activities,
          }),
        },
        (raw) => AISummaryNotificationResponseSchema.parse(raw)
      );
    } catch (err) {
      opts.onFallbackToMock?.(
        err instanceof Error
          ? err.message
          : "AI Summary Notification API unreachable"
      );
      return mockApi.generateAISummaryNotification(boardTitle, activities);
    }
  },

  // ==========================================================================
  // PHASE 6 AUTH, RBAC, MEMBERS, SHAREABLE INVITES & PERMISSION AUDIT
  // ==========================================================================

  async login(
    payload: LoginRequest,
    opts: ApiClientOptions
  ): Promise<AuthSessionResponse> {
    if (opts.useMock) {
      return mockApi.login(payload);
    }
    try {
      return await fetchJson(
        "/api/v1/auth/login",
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
        (raw) => AuthSessionResponseSchema.parse(raw)
      );
    } catch (err) {
      opts.onFallbackToMock?.(
        err instanceof Error ? err.message : "Auth login API unreachable"
      );
      return mockApi.login(payload);
    }
  },

  async register(
    payload: RegisterRequest,
    opts: ApiClientOptions
  ): Promise<AuthSessionResponse> {
    if (opts.useMock) {
      return mockApi.register(payload);
    }
    try {
      return await fetchJson(
        "/api/v1/auth/register",
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
        (raw) => AuthSessionResponseSchema.parse(raw)
      );
    } catch (err) {
      opts.onFallbackToMock?.(
        err instanceof Error ? err.message : "Auth register API unreachable"
      );
      return mockApi.register(payload);
    }
  },

  async getMe(opts: ApiClientOptions): Promise<AuthUser> {
    if (opts.useMock) {
      return mockApi.getMe();
    }
    try {
      return await fetchJson(
        "/api/v1/auth/me",
        { method: "GET" },
        (raw) => AuthUserSchema.parse(raw)
      );
    } catch (err) {
      opts.onFallbackToMock?.(
        err instanceof Error ? err.message : "Auth me API unreachable"
      );
      return mockApi.getMe();
    }
  },

  async getDemoUsers(opts: ApiClientOptions): Promise<AuthUser[]> {
    if (opts.useMock) {
      return mockApi.getDemoUsers();
    }
    try {
      return await fetchJson(
        "/api/v1/auth/demo-users",
        { method: "GET" },
        (raw) => z.array(AuthUserSchema).parse(raw)
      );
    } catch (err) {
      opts.onFallbackToMock?.(
        err instanceof Error ? err.message : "Demo users API unreachable"
      );
      return mockApi.getDemoUsers();
    }
  },

  async addMember(
    boardId: string,
    payload: { name: string; email: string; role: BoardRole },
    opts: ApiClientOptions
  ): Promise<Member> {
    if (opts.useMock) {
      return mockApi.addMember(boardId, payload);
    }
    try {
      return await fetchJson(
        `/api/v1/boards/${boardId}/members`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
        (raw) => MemberSchema.parse(raw)
      );
    } catch (err) {
      opts.onFallbackToMock?.(
        err instanceof Error ? err.message : "Add member API unreachable"
      );
      return mockApi.addMember(boardId, payload);
    }
  },

  async updateMemberRole(
    boardId: string,
    memberId: string,
    role: BoardRole,
    opts: ApiClientOptions
  ): Promise<Member> {
    if (opts.useMock) {
      return mockApi.updateMemberRole(boardId, memberId, role);
    }
    try {
      return await fetchJson(
        `/api/v1/boards/${boardId}/members/${memberId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ role }),
        },
        (raw) => MemberSchema.parse(raw)
      );
    } catch (err) {
      opts.onFallbackToMock?.(
        err instanceof Error ? err.message : "Update member role API unreachable"
      );
      return mockApi.updateMemberRole(boardId, memberId, role);
    }
  },

  async removeMember(
    boardId: string,
    memberId: string,
    opts: ApiClientOptions
  ): Promise<{ id: string; removed: boolean }> {
    if (opts.useMock) {
      return mockApi.removeMember(boardId, memberId);
    }
    try {
      return await fetchJson(
        `/api/v1/boards/${boardId}/members/${memberId}`,
        { method: "DELETE" },
        () => ({ id: memberId, removed: true })
      );
    } catch (err) {
      opts.onFallbackToMock?.(
        err instanceof Error ? err.message : "Remove member API unreachable"
      );
      return mockApi.removeMember(boardId, memberId);
    }
  },

  async getInviteLinks(
    boardId: string,
    opts: ApiClientOptions
  ): Promise<BoardInviteLink[]> {
    if (opts.useMock) {
      return mockApi.getInviteLinks(boardId);
    }
    try {
      return await fetchJson(
        `/api/v1/boards/${boardId}/invites`,
        { method: "GET" },
        (raw) => z.array(BoardInviteLinkSchema).parse(raw)
      );
    } catch (err) {
      opts.onFallbackToMock?.(
        err instanceof Error ? err.message : "Get invite links API unreachable"
      );
      return mockApi.getInviteLinks(boardId);
    }
  },

  async createInviteLink(
    boardId: string,
    payload: CreateInviteLinkRequest,
    opts: ApiClientOptions
  ): Promise<BoardInviteLink> {
    if (opts.useMock) {
      return mockApi.createInviteLink(boardId, payload);
    }
    try {
      return await fetchJson(
        `/api/v1/boards/${boardId}/invites`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
        (raw) => BoardInviteLinkSchema.parse(raw)
      );
    } catch (err) {
      opts.onFallbackToMock?.(
        err instanceof Error ? err.message : "Create invite link API unreachable"
      );
      return mockApi.createInviteLink(boardId, payload);
    }
  },

  async revokeInviteLink(
    inviteId: string,
    opts: ApiClientOptions
  ): Promise<{ id: string; revoked: boolean }> {
    if (opts.useMock) {
      return mockApi.revokeInviteLink(inviteId);
    }
    try {
      return await fetchJson(
        `/api/v1/invites/${inviteId}`,
        { method: "DELETE" },
        () => ({ id: inviteId, revoked: true })
      );
    } catch (err) {
      opts.onFallbackToMock?.(
        err instanceof Error ? err.message : "Revoke invite link API unreachable"
      );
      return mockApi.revokeInviteLink(inviteId);
    }
  },

  async previewInvite(
    token: string,
    opts: ApiClientOptions
  ): Promise<{
    board_id: string;
    board_title: string;
    inviter_name: string;
    granted_role: BoardRole;
    is_valid: boolean;
  }> {
    if (opts.useMock) {
      return mockApi.previewInvite(token);
    }
    try {
      return await fetchJson(
        `/api/v1/invites/${token}`,
        { method: "GET" },
        (raw) => {
          const schema = z.object({
            board_id: z.string(),
            board_title: z.string(),
            inviter_name: z.string(),
            granted_role: BoardRoleEnum,
            is_valid: z.boolean(),
          });
          return schema.parse(raw);
        }
      );
    } catch (err) {
      opts.onFallbackToMock?.(
        err instanceof Error ? err.message : "Preview invite API unreachable"
      );
      return mockApi.previewInvite(token);
    }
  },

  async joinViaInvite(
    token: string,
    payload: JoinViaInviteRequest | undefined,
    opts: ApiClientOptions
  ): Promise<JoinViaInviteResponse> {
    if (opts.useMock) {
      return mockApi.joinViaInvite(token, payload);
    }
    try {
      return await fetchJson(
        `/api/v1/invites/${token}/join`,
        {
          method: "POST",
          body: JSON.stringify(payload ?? {}),
        },
        (raw) => JoinViaInviteResponseSchema.parse(raw)
      );
    } catch (err) {
      opts.onFallbackToMock?.(
        err instanceof Error ? err.message : "Join via invite API unreachable"
      );
      return mockApi.joinViaInvite(token, payload);
    }
  },

  async auditPermissions(
    boardId: string,
    opts: ApiClientOptions
  ): Promise<AIPermissionAuditResponse> {
    if (opts.useMock) {
      return mockApi.auditPermissions(boardId);
    }
    try {
      return await fetchJson(
        `/api/v1/boards/${boardId}/security-audit`,
        {
          method: "POST",
          body: JSON.stringify({}),
        },
        (raw) => AIPermissionAuditResponseSchema.parse(raw)
      );
    } catch (err) {
      opts.onFallbackToMock?.(
        err instanceof Error
          ? err.message
          : "AI Security Audit API unreachable"
      );
      return mockApi.auditPermissions(boardId);
    }
  },
};
