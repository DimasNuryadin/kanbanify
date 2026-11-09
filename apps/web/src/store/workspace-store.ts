import { create } from "zustand";
import {
  AutomationRule,
  Board,
  BoardSummary,
  Card,
  CardMovedEventData,
  Column,
  ColumnMovedEventData,
  Comment,
  DEFAULT_WORKSPACE,
  Priority,
  UserPresence,
  WebhookConfig,
  WorkspaceWithBoards,
} from "@kinetix/contracts";
import {
  INITIAL_SEED_BOARD,
  INITIAL_SEED_BOARDS,
  SEED_BOARD_ID,
  SEED_WORKSPACE_ID,
} from "@/lib/mock-data";
import { DEFAULT_USE_MOCK } from "@/lib/api-client";
import { WSConnectionStatus } from "@/lib/ws-client";
import { comparePositions } from "@/lib/fractional-index";
import { ButlerExecutionToast } from "@/lib/automation-engine";

export type ViewMode = "kanban" | "table" | "calendar" | "analytics";
export type ThemeMode = "light" | "dark" | "system";
export type DueFilter = "ALL" | "OVERDUE" | "DUE_SOON" | "COMPLETED" | "NO_DATE";

export interface LastMoveMetrics {
  cardTitle: string;
  prevPos?: string;
  nextPos?: string;
  computedPos: string;
  timestamp: string;
}

interface WorkspaceState {
  // Active Board & Canvas
  board: Board;
  activeBoardId: string;
  viewMode: ViewMode;
  themeMode: ThemeMode;
  useMockMode: boolean;
  wsStatus: WSConnectionStatus;
  fallbackNotice: string | null;

  // Workspace Navigation & Summaries
  workspaces: WorkspaceWithBoards[];
  currentWorkspaceId: string;
  boardSummaries: BoardSummary[];
  isSidebarOpen: boolean;

  // Trello Board-Wide Label Expansion Toggle
  areLabelsExpanded: boolean;

  // Filters
  priorityFilter: Priority | "ALL";
  searchQuery: string;
  onlyBlockedFilter: boolean;
  memberFilterId: string | null;
  labelFilterIds: string[];
  dueFilter: DueFilter;

  // Modals / Drawers
  selectedCardId: string | null;
  isCommandPaletteOpen: boolean;
  isCreateCardModalOpen: boolean;
  createCardDefaultColumnId: string | null;
  isArchivedDrawerOpen: boolean;
  isBoardMenuOpen: boolean;
  isAutomationModalOpen: boolean;
  isTemplatesModalOpen: boolean;
  isCreateBoardModalOpen: boolean;
  isCreateWorkspaceModalOpen: boolean;
  isImportExportModalOpen: boolean;
  isWebhooksModalOpen: boolean;

  // Real-Time Co-Presence & Live Typing Indicators
  presences: UserPresence[];
  isSimulatingCollaborator: boolean;

  // Butler Active Rules & Execution Toasts
  automationRules: AutomationRule[];
  toasts: ButlerExecutionToast[];

  // O(1) Fractional Index Telemetry pill
  lastMoveMetrics: LastMoveMetrics | null;

  // Actions
  setBoard: (board: Board) => void;
  setActiveBoardId: (id: string) => void;
  setViewMode: (view: ViewMode) => void;
  setThemeMode: (theme: ThemeMode) => void;
  setUseMockMode: (useMock: boolean, fallbackNotice?: string | null) => void;
  setWsStatus: (status: WSConnectionStatus) => void;
  setFallbackNotice: (notice: string | null) => void;

  // Sidebar & Workspaces
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setWorkspaces: (workspaces: WorkspaceWithBoards[]) => void;
  setCurrentWorkspaceId: (id: string) => void;
  setBoardSummaries: (summaries: BoardSummary[]) => void;

  toggleLabelsExpanded: () => void;

  setPriorityFilter: (priority: Priority | "ALL") => void;
  setSearchQuery: (query: string) => void;
  setOnlyBlockedFilter: (onlyBlocked: boolean) => void;
  setMemberFilterId: (memberId: string | null) => void;
  toggleLabelFilterId: (labelId: string) => void;
  setDueFilter: (due: DueFilter) => void;
  clearAllFilters: () => void;

  // Modals
  setSelectedCardId: (cardId: string | null) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  openCreateCardModal: (columnId?: string | null) => void;
  closeCreateCardModal: () => void;
  setArchivedDrawerOpen: (open: boolean) => void;
  setBoardMenuOpen: (open: boolean) => void;
  setAutomationModalOpen: (open: boolean) => void;
  setTemplatesModalOpen: (open: boolean) => void;
  setCreateBoardModalOpen: (open: boolean) => void;
  setCreateWorkspaceModalOpen: (open: boolean) => void;
  setImportExportModalOpen: (open: boolean) => void;
  setWebhooksModalOpen: (open: boolean) => void;

  // Real-Time Co-Presence Actions
  setPresences: (presences: UserPresence[]) => void;
  upsertPresence: (presence: UserPresence) => void;
  removePresence: (userId: string) => void;
  setSimulatingCollaborator: (simulating: boolean) => void;

  // Outbound Webhook Integrations
  setWebhooks: (webhooks: WebhookConfig[]) => void;
  upsertWebhook: (webhook: WebhookConfig) => void;
  removeWebhook: (webhookId: string) => void;

  // Butler Automation Rules
  setAutomationRules: (rules: AutomationRule[]) => void;
  upsertAutomationRule: (rule: AutomationRule) => void;
  removeAutomationRule: (ruleId: string) => void;

  // Butler Execution Toasts
  addToast: (toast: ButlerExecutionToast) => void;
  removeToast: (id: string) => void;

  // Optimistic & WebSocket Mutations
  optimisticMoveCard: (
    cardId: string,
    targetColumnId: string,
    newPosition: string,
    prevPos?: string,
    nextPos?: string
  ) => void;
  optimisticMoveColumn: (
    columnId: string,
    newPosition: string,
    prevPos?: string,
    nextPos?: string
  ) => void;
  applyRemoteCardMove: (data: CardMovedEventData) => void;
  applyRemoteColumnMove: (data: ColumnMovedEventData) => void;
  upsertCard: (card: Card) => void;
  removeCard: (cardId: string) => void;
  upsertColumn: (column: Column) => void;
  removeColumn: (columnId: string) => void;
  appendCardComment: (comment: Comment) => void;
}

function sortBoard(board: Board): Board {
  return {
    ...board,
    columns: [...board.columns].sort((a, b) =>
      comparePositions(a.position, b.position)
    ),
    cards: [...board.cards]
      .map((c) => ({
        ...c,
        subtasks: [...c.subtasks].sort((a, b) =>
          comparePositions(a.position, b.position)
        ),
        checklists: [...(c.checklists ?? [])]
          .map((cl) => ({
            ...cl,
            items: [...cl.items].sort((a, b) =>
              comparePositions(a.position, b.position)
            ),
          }))
          .sort((a, b) => comparePositions(a.position, b.position)),
      }))
      .sort((a, b) => comparePositions(a.position, b.position)),
    webhooks: board.webhooks ?? [],
  };
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  board: sortBoard(INITIAL_SEED_BOARD),
  activeBoardId: SEED_BOARD_ID,
  viewMode: "kanban",
  themeMode: "dark",
  useMockMode: DEFAULT_USE_MOCK,
  wsStatus: DEFAULT_USE_MOCK ? "mock" : "connecting",
  fallbackNotice: null,

  workspaces: [
    {
      ...DEFAULT_WORKSPACE,
      boards: INITIAL_SEED_BOARDS.map((b) => ({
        id: b.id,
        workspace_id: b.workspace_id,
        title: b.title,
        is_starred: b.is_starred,
        background: b.background,
        card_count: b.cards.filter((c) => !c.is_archived).length,
        updated_at: b.created_at,
        created_at: b.created_at,
        description: b.description,
      })),
    },
  ],
  currentWorkspaceId: SEED_WORKSPACE_ID,
  boardSummaries: INITIAL_SEED_BOARDS.map((b) => ({
    id: b.id,
    workspace_id: b.workspace_id,
    title: b.title,
    is_starred: b.is_starred,
    background: b.background,
    card_count: b.cards.filter((c) => !c.is_archived).length,
    updated_at: b.created_at,
    created_at: b.created_at,
    description: b.description,
  })),
  isSidebarOpen: true,

  areLabelsExpanded: true,

  priorityFilter: "ALL",
  searchQuery: "",
  onlyBlockedFilter: false,
  memberFilterId: null,
  labelFilterIds: [],
  dueFilter: "ALL",

  selectedCardId: null,
  isCommandPaletteOpen: false,
  isCreateCardModalOpen: false,
  createCardDefaultColumnId: null,
  isArchivedDrawerOpen: false,
  isBoardMenuOpen: false,
  isAutomationModalOpen: false,
  isTemplatesModalOpen: false,
  isCreateBoardModalOpen: false,
  isCreateWorkspaceModalOpen: false,
  isImportExportModalOpen: false,
  isWebhooksModalOpen: false,

  presences: [
    {
      user_id: "88888888-8888-4888-8888-888888888881",
      user_name: "Alex Rivera",
      avatar_url: null,
      initials: "AR",
      color: "#3b82f6",
      status: "ACTIVE",
      active_card_id: null,
      last_seen: new Date().toISOString(),
    },
  ],
  isSimulatingCollaborator: false,

  automationRules: [...(INITIAL_SEED_BOARD.automation_rules ?? [])],
  toasts: [],

  lastMoveMetrics: {
    cardTitle: "Real-Time WebSocket Broadcast",
    prevPos: "a0",
    nextPos: "a1",
    computedPos: "a0V",
    timestamp: "Ready",
  },

  setBoard: (board) =>
    set((state) => {
      const exists = state.boardSummaries.some((s) => s.id === board.id);
      const updatedSummaries = exists
        ? state.boardSummaries.map((s) =>
            s.id === board.id
              ? {
                  ...s,
                  title: board.title,
                  is_starred: board.is_starred,
                  background: board.background,
                  card_count: board.cards.filter((c) => !c.is_archived).length,
                }
              : s
          )
        : [
            ...state.boardSummaries,
            {
              id: board.id,
              workspace_id: board.workspace_id,
              title: board.title,
              is_starred: board.is_starred,
              background: board.background,
              card_count: board.cards.filter((c) => !c.is_archived).length,
              updated_at: new Date().toISOString(),
              created_at: board.created_at,
              description: board.description,
            },
          ];

      const updatedWorkspaces = state.workspaces.map((ws) =>
        ws.id === board.workspace_id
          ? {
              ...ws,
              boards: updatedSummaries.filter(
                (s) => s.workspace_id === ws.id
              ),
            }
          : ws
      );

      return {
        board: sortBoard(board),
        activeBoardId: board.id,
        automationRules: board.automation_rules ?? [],
        boardSummaries: updatedSummaries,
        workspaces: updatedWorkspaces,
      };
    }),
  setActiveBoardId: (activeBoardId) => set({ activeBoardId }),
  setViewMode: (viewMode) => set({ viewMode }),
  setThemeMode: (themeMode) => set({ themeMode }),
  setUseMockMode: (useMockMode, fallbackNotice = null) =>
    set({
      useMockMode,
      wsStatus: useMockMode ? "mock" : "connecting",
      fallbackNotice,
    }),
  setWsStatus: (wsStatus) => set({ wsStatus }),
  setFallbackNotice: (fallbackNotice) => set({ fallbackNotice }),

  toggleSidebar: () =>
    set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setSidebarOpen: (isSidebarOpen) => set({ isSidebarOpen }),
  setWorkspaces: (workspaces) => set({ workspaces }),
  setCurrentWorkspaceId: (currentWorkspaceId) =>
    set({ currentWorkspaceId }),
  setBoardSummaries: (boardSummaries) => set({ boardSummaries }),

  toggleLabelsExpanded: () =>
    set((state) => ({ areLabelsExpanded: !state.areLabelsExpanded })),

  setPriorityFilter: (priorityFilter) => set({ priorityFilter }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setOnlyBlockedFilter: (onlyBlockedFilter) => set({ onlyBlockedFilter }),
  setMemberFilterId: (memberFilterId) => set({ memberFilterId }),
  toggleLabelFilterId: (labelId) =>
    set((state) => ({
      labelFilterIds: state.labelFilterIds.includes(labelId)
        ? state.labelFilterIds.filter((id) => id !== labelId)
        : [...state.labelFilterIds, labelId],
    })),
  setDueFilter: (dueFilter) => set({ dueFilter }),
  clearAllFilters: () =>
    set({
      priorityFilter: "ALL",
      searchQuery: "",
      onlyBlockedFilter: false,
      memberFilterId: null,
      labelFilterIds: [],
      dueFilter: "ALL",
    }),

  setSelectedCardId: (selectedCardId) => set({ selectedCardId }),
  setCommandPaletteOpen: (isCommandPaletteOpen) =>
    set({ isCommandPaletteOpen }),
  openCreateCardModal: (columnId = null) =>
    set({
      isCreateCardModalOpen: true,
      createCardDefaultColumnId: columnId,
    }),
  closeCreateCardModal: () =>
    set({
      isCreateCardModalOpen: false,
      createCardDefaultColumnId: null,
    }),
  setArchivedDrawerOpen: (isArchivedDrawerOpen) =>
    set({ isArchivedDrawerOpen }),
  setBoardMenuOpen: (isBoardMenuOpen) => set({ isBoardMenuOpen }),
  setAutomationModalOpen: (isAutomationModalOpen) =>
    set({ isAutomationModalOpen }),
  setTemplatesModalOpen: (isTemplatesModalOpen) =>
    set({ isTemplatesModalOpen }),
  setCreateBoardModalOpen: (isCreateBoardModalOpen) =>
    set({ isCreateBoardModalOpen }),
  setCreateWorkspaceModalOpen: (isCreateWorkspaceModalOpen) =>
    set({ isCreateWorkspaceModalOpen }),
  setImportExportModalOpen: (isImportExportModalOpen) =>
    set({ isImportExportModalOpen }),
  setWebhooksModalOpen: (isWebhooksModalOpen) => set({ isWebhooksModalOpen }),

  setPresences: (presences) => set({ presences }),
  upsertPresence: (presence) =>
    set((state) => {
      const idx = state.presences.findIndex((p) => p.user_id === presence.user_id);
      if (idx !== -1) {
        const next = [...state.presences];
        next[idx] = presence;
        return { presences: next };
      }
      return { presences: [...state.presences, presence] };
    }),
  removePresence: (userId) =>
    set((state) => ({
      presences: state.presences.filter((p) => p.user_id !== userId),
    })),
  setSimulatingCollaborator: (isSimulatingCollaborator) =>
    set({ isSimulatingCollaborator }),

  setWebhooks: (webhooks) =>
    set((state) => ({
      board: {
        ...state.board,
        webhooks,
      },
    })),
  upsertWebhook: (webhook) =>
    set((state) => {
      const existing = state.board.webhooks ?? [];
      const idx = existing.findIndex((w) => w.id === webhook.id);
      const nextWebhooks =
        idx !== -1
          ? existing.map((w) => (w.id === webhook.id ? webhook : w))
          : [...existing, webhook];
      return {
        board: {
          ...state.board,
          webhooks: nextWebhooks,
        },
      };
    }),
  removeWebhook: (webhookId) =>
    set((state) => {
      const existing = state.board.webhooks ?? [];
      return {
        board: {
          ...state.board,
          webhooks: existing.filter((w) => w.id !== webhookId),
        },
      };
    }),

  setAutomationRules: (automationRules) => set({ automationRules }),
  upsertAutomationRule: (rule) =>
    set((state) => {
      const exists = state.automationRules.some((r) => r.id === rule.id);
      const nextRules = exists
        ? state.automationRules.map((r) => (r.id === rule.id ? rule : r))
        : [...state.automationRules, rule];
      return {
        automationRules: nextRules,
        board: {
          ...state.board,
          automation_rules: nextRules,
        },
      };
    }),
  removeAutomationRule: (ruleId) =>
    set((state) => {
      const nextRules = state.automationRules.filter((r) => r.id !== ruleId);
      return {
        automationRules: nextRules,
        board: {
          ...state.board,
          automation_rules: nextRules,
        },
      };
    }),

  addToast: (toast) =>
    set((state) => ({
      toasts: [toast, ...state.toasts.slice(0, 4)],
    })),
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  optimisticMoveCard: (
    cardId,
    targetColumnId,
    newPosition,
    prevPos,
    nextPos
  ) =>
    set((state) => {
      const targetCard = state.board.cards.find((c) => c.id === cardId);
      const updatedCards = state.board.cards.map((card) =>
        card.id === cardId
          ? {
              ...card,
              column_id: targetColumnId,
              position: newPosition,
              updated_at: new Date().toISOString(),
            }
          : card
      );
      return {
        board: sortBoard({
          ...state.board,
          cards: updatedCards,
        }),
        lastMoveMetrics: {
          cardTitle: targetCard?.title ?? "Card",
          prevPos,
          nextPos,
          computedPos: newPosition,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
        },
      };
    }),

  optimisticMoveColumn: (columnId, newPosition, prevPos, nextPos) =>
    set((state) => {
      const targetCol = state.board.columns.find((col) => col.id === columnId);
      const updatedColumns = state.board.columns.map((col) =>
        col.id === columnId ? { ...col, position: newPosition } : col
      );
      return {
        board: sortBoard({
          ...state.board,
          columns: updatedColumns,
        }),
        lastMoveMetrics: {
          cardTitle: `List: ${targetCol?.title ?? "List"}`,
          prevPos,
          nextPos,
          computedPos: newPosition,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
        },
      };
    }),

  applyRemoteCardMove: (data) =>
    set((state) => {
      const updatedCards = state.board.cards.map((card) =>
        card.id === data.card_id
          ? {
              ...card,
              column_id: data.target_column_id,
              position: data.new_position,
              updated_at: data.updated_at,
            }
          : card
      );
      return {
        board: sortBoard({
          ...state.board,
          cards: updatedCards,
        }),
      };
    }),

  applyRemoteColumnMove: (data) =>
    set((state) => {
      const updatedColumns = state.board.columns.map((col) =>
        col.id === data.column_id
          ? { ...col, position: data.new_position }
          : col
      );
      return {
        board: sortBoard({
          ...state.board,
          columns: updatedColumns,
        }),
      };
    }),

  upsertCard: (card) =>
    set((state) => {
      const exists = state.board.cards.some((c) => c.id === card.id);
      const nextCards = exists
        ? state.board.cards.map((c) => (c.id === card.id ? card : c))
        : [...state.board.cards, card];
      return {
        board: sortBoard({
          ...state.board,
          cards: nextCards,
        }),
      };
    }),

  removeCard: (cardId) =>
    set((state) => ({
      selectedCardId:
        state.selectedCardId === cardId ? null : state.selectedCardId,
      board: sortBoard({
        ...state.board,
        cards: state.board.cards.filter((c) => c.id !== cardId),
      }),
    })),

  upsertColumn: (column) =>
    set((state) => {
      const exists = state.board.columns.some((col) => col.id === column.id);
      const nextColumns = exists
        ? state.board.columns.map((col) =>
            col.id === column.id ? column : col
          )
        : [...state.board.columns, column];
      return {
        board: sortBoard({
          ...state.board,
          columns: nextColumns,
        }),
      };
    }),

  removeColumn: (columnId) =>
    set((state) => ({
      board: sortBoard({
        ...state.board,
        columns: state.board.columns.filter((col) => col.id !== columnId),
      }),
    })),

  appendCardComment: (comment) =>
    set((state) => {
      const targetCard = state.board.cards.find(
        (c) => c.id === comment.card_id
      );
      const activityId = `act-${comment.id}`;
      const hasActivity = state.board.activities.some(
        (a) =>
          a.id === activityId ||
          (a.action_type === "COMMENT_ADDED" &&
            a.card_id === comment.card_id &&
            a.created_at === comment.created_at)
      );
      const nextActivities = hasActivity
        ? state.board.activities
        : [
            {
              id: activityId,
              board_id: state.board.id,
              card_id: comment.card_id,
              actor_name: comment.author_name,
              action_type: "COMMENT_ADDED" as const,
              description: `commented on ${targetCard?.title ?? "card"}: "${comment.content.slice(0, 80)}"`,
              created_at: comment.created_at,
              is_automated: false,
            },
            ...state.board.activities,
          ];
      return {
        board: sortBoard({
          ...state.board,
          activities: nextActivities,
          cards: state.board.cards.map((c) => {
            if (c.id !== comment.card_id) return c;
            const alreadyExists = c.comments.some((cm) => cm.id === comment.id);
            return alreadyExists
              ? c
              : { ...c, comments: [...c.comments, comment] };
          }),
        }),
      };
    }),
}));
