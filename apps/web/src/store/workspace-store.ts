import { create } from "zustand";
import {
  AuthUser,
  AutomationRule,
  Board,
  BoardInviteLink,
  BoardRole,
  BoardSummary,
  BoardThemeConfig,
  Card,
  CardMovedEventData,
  Column,
  ColumnMovedEventData,
  Comment,
  CustomFieldDefinition,
  DEFAULT_THEME_CONFIG,
  DEFAULT_WORKSPACE,
  Member,
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

export type ViewMode = "kanban" | "table" | "calendar" | "analytics" | "graph";
export type ThemeMode = "light" | "dark" | "system";
export type DueFilter = "ALL" | "OVERDUE" | "DUE_SOON" | "COMPLETED" | "NO_DATE";

export interface LastMoveMetrics {
  cardTitle: string;
  prevPos?: string;
  nextPos?: string;
  computedPos: string;
  timestamp: string;
}

export const DEMO_USERS: AuthUser[] = [
  {
    id: "88888888-8888-4888-8888-888888888881",
    name: "Alex Rivera",
    email: "alex@kinetix.dev",
    avatar_url: null,
    initials: "AR",
    color: "#6366f1",
    default_role: "ADMIN",
  },
  {
    id: "88888888-8888-4888-8888-888888888882",
    name: "Sarah Connor",
    email: "sarah@kinetix.dev",
    avatar_url: null,
    initials: "SC",
    color: "#10b981",
    default_role: "EDITOR",
  },
  {
    id: "88888888-8888-4888-8888-888888888884",
    name: "Budi Santoso",
    email: "budi@kinetix.dev",
    avatar_url: null,
    initials: "BS",
    color: "#f59e0b",
    default_role: "VIEWER",
  },
];

const STORAGE_KEY_AUTH_TOKEN = "kanbanify_auth_token";
const STORAGE_KEY_AUTH_USER = "kanbanify_auth_user";
const STORAGE_KEY_ACTIVE_ROLE = "kanbanify_active_role";

export function getStoredAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY_AUTH_TOKEN) ?? "kb_sess_alex_admin_token";
}

export function getStoredActiveRole(): BoardRole | null {
  if (typeof window === "undefined") return "ADMIN";
  return (window.localStorage.getItem(STORAGE_KEY_ACTIVE_ROLE) as BoardRole) ?? "ADMIN";
}

export function getStoredAuthUser(): AuthUser {
  if (typeof window === "undefined") return DEMO_USERS[0];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_AUTH_USER);
    if (raw) return JSON.parse(raw);
  } catch {
    // fallback
  }
  return DEMO_USERS[0];
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

  // Authentication & RBAC (Phase 6)
  currentUser: AuthUser;
  activeRole: BoardRole;
  authToken: string | null;
  isAuthModalOpen: boolean;
  isShareModalOpen: boolean;
  pendingInviteToken: string | null;
  inviteBannerData: {
    boardId: string;
    boardTitle: string;
    inviterName: string;
    grantedRole: BoardRole;
  } | null;

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
  isCustomFieldsModalOpen: boolean;
  isThemeStudioOpen: boolean;

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

  // Authentication & RBAC Actions
  setCurrentUser: (user: AuthUser, token?: string) => void;
  setActiveRole: (role: BoardRole) => void;
  switchDemoUser: (user: AuthUser) => void;
  setAuthModalOpen: (open: boolean) => void;
  setShareModalOpen: (open: boolean) => void;
  setPendingInviteToken: (token: string | null) => void;
  setInviteBannerData: (
    data: {
      boardId: string;
      boardTitle: string;
      inviterName: string;
      grantedRole: BoardRole;
    } | null
  ) => void;

  // Board Member & Invite Link State Sync
  addBoardMember: (member: Member) => void;
  updateBoardMemberRole: (memberId: string, role: BoardRole) => void;
  removeBoardMember: (memberId: string) => void;
  addBoardInviteLink: (link: BoardInviteLink) => void;
  removeBoardInviteLink: (inviteId: string) => void;

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
  setCustomFieldsModalOpen: (open: boolean) => void;
  setThemeStudioOpen: (open: boolean) => void;

  // Phase 7 Custom Fields, Dependencies & Theme Studio Actions
  updateBoardThemeConfig: (config: BoardThemeConfig) => void;
  setCustomFieldDefinitions: (fields: CustomFieldDefinition[]) => void;
  upsertCustomFieldDefinition: (field: CustomFieldDefinition) => void;
  removeCustomFieldDefinition: (fieldId: string) => void;
  setCardCustomFieldValue: (
    cardId: string,
    fieldId: string,
    value: string | number | boolean | null
  ) => void;
  linkCardDependency: (cardId: string, blockerCardId: string) => void;
  unlinkCardDependency: (cardId: string, blockerCardId: string) => void;

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
    invite_links: board.invite_links ?? [],
    visibility: board.visibility ?? "WORKSPACE",
    custom_fields: board.custom_fields ?? [],
    theme_config: board.theme_config ?? { ...DEFAULT_THEME_CONFIG },
  };
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  board: sortBoard(INITIAL_SEED_BOARD),
  activeBoardId: SEED_BOARD_ID,
  viewMode: "kanban",
  themeMode: "dark",
  useMockMode: DEFAULT_USE_MOCK,
  wsStatus: DEFAULT_USE_MOCK ? "mock" : "connecting",
  fallbackNotice: null,

  // Authentication & RBAC Initial State
  currentUser: DEMO_USERS[0],
  activeRole: "ADMIN",
  authToken: "kb_sess_alex_admin_token",
  isAuthModalOpen: false,
  isShareModalOpen: false,
  pendingInviteToken: null,
  inviteBannerData: null,

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
  isCustomFieldsModalOpen: false,
  isThemeStudioOpen: false,

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
    computedPos: "a0V",
    timestamp: new Date().toLocaleTimeString(),
  },

  setBoard: (board) =>
    set({
      board: sortBoard(board),
      activeBoardId: board.id,
      automationRules: [...(board.automation_rules ?? [])],
    }),

  setActiveBoardId: (id) => set({ activeBoardId: id }),
  setViewMode: (viewMode) => set({ viewMode }),
  setThemeMode: (themeMode) => set({ themeMode }),
  setUseMockMode: (useMockMode, fallbackNotice = null) =>
    set({
      useMockMode,
      fallbackNotice,
      wsStatus: useMockMode ? "mock" : "connecting",
    }),
  setWsStatus: (wsStatus) => set({ wsStatus }),
  setFallbackNotice: (fallbackNotice) => set({ fallbackNotice }),

  // Authentication & RBAC Actions
  setCurrentUser: (user, token) => {
    const nextToken = token ?? `kb_sess_${user.id}`;
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(STORAGE_KEY_AUTH_USER, JSON.stringify(user));
        window.localStorage.setItem(STORAGE_KEY_AUTH_TOKEN, nextToken);
        window.localStorage.setItem(STORAGE_KEY_ACTIVE_ROLE, user.default_role);
      } catch {
        // ignore
      }
    }
    set({
      currentUser: user,
      activeRole: user.default_role,
      authToken: nextToken,
    });
  },

  setActiveRole: (role) => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(STORAGE_KEY_ACTIVE_ROLE, role);
      } catch {
        // ignore
      }
    }
    set({ activeRole: role });
  },

  switchDemoUser: (user) => {
    const token = `kb_sess_${user.id}`;
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(STORAGE_KEY_AUTH_USER, JSON.stringify(user));
        window.localStorage.setItem(STORAGE_KEY_AUTH_TOKEN, token);
        window.localStorage.setItem(STORAGE_KEY_ACTIVE_ROLE, user.default_role);
      } catch {
        // ignore
      }
    }
    set({
      currentUser: user,
      activeRole: user.default_role,
      authToken: token,
    });
  },

  setAuthModalOpen: (isAuthModalOpen) => set({ isAuthModalOpen }),
  setShareModalOpen: (isShareModalOpen) => set({ isShareModalOpen }),
  setPendingInviteToken: (pendingInviteToken) => set({ pendingInviteToken }),
  setInviteBannerData: (inviteBannerData) => set({ inviteBannerData }),

  addBoardMember: (member) =>
    set((state) => ({
      board: sortBoard({
        ...state.board,
        members: [...state.board.members.filter((m) => m.id !== member.id), member],
      }),
    })),

  updateBoardMemberRole: (memberId, role) =>
    set((state) => ({
      board: sortBoard({
        ...state.board,
        members: state.board.members.map((m) =>
          m.id === memberId ? { ...m, role } : m
        ),
      }),
    })),

  removeBoardMember: (memberId) =>
    set((state) => ({
      board: sortBoard({
        ...state.board,
        members: state.board.members.filter((m) => m.id !== memberId),
      }),
    })),

  addBoardInviteLink: (link) =>
    set((state) => ({
      board: sortBoard({
        ...state.board,
        invite_links: [link, ...(state.board.invite_links ?? []).filter((l) => l.id !== link.id)],
      }),
    })),

  removeBoardInviteLink: (inviteId) =>
    set((state) => ({
      board: sortBoard({
        ...state.board,
        invite_links: (state.board.invite_links ?? []).filter((l) => l.id !== inviteId),
      }),
    })),

  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setSidebarOpen: (isSidebarOpen) => set({ isSidebarOpen }),
  setWorkspaces: (workspaces) => set({ workspaces }),
  setCurrentWorkspaceId: (currentWorkspaceId) => set({ currentWorkspaceId }),
  setBoardSummaries: (boardSummaries) => set({ boardSummaries }),

  toggleLabelsExpanded: () =>
    set((state) => ({ areLabelsExpanded: !state.areLabelsExpanded })),

  setPriorityFilter: (priorityFilter) => set({ priorityFilter }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setOnlyBlockedFilter: (onlyBlockedFilter) => set({ onlyBlockedFilter }),
  setMemberFilterId: (memberFilterId) => set({ memberFilterId }),
  toggleLabelFilterId: (labelId) =>
    set((state) => {
      const exists = state.labelFilterIds.includes(labelId);
      return {
        labelFilterIds: exists
          ? state.labelFilterIds.filter((id) => id !== labelId)
          : [...state.labelFilterIds, labelId],
      };
    }),
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
    set({ isCreateCardModalOpen: true, createCardDefaultColumnId: columnId }),
  closeCreateCardModal: () =>
    set({ isCreateCardModalOpen: false, createCardDefaultColumnId: null }),
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
  setCustomFieldsModalOpen: (isCustomFieldsModalOpen) =>
    set({ isCustomFieldsModalOpen }),
  setThemeStudioOpen: (isThemeStudioOpen) => set({ isThemeStudioOpen }),

  updateBoardThemeConfig: (config) =>
    set((state) => ({
      board: {
        ...state.board,
        theme_config: { ...state.board.theme_config, ...config },
      },
    })),

  setCustomFieldDefinitions: (custom_fields) =>
    set((state) => ({
      board: {
        ...state.board,
        custom_fields,
      },
    })),

  upsertCustomFieldDefinition: (field) =>
    set((state) => {
      const existing = state.board.custom_fields ?? [];
      const index = existing.findIndex((f) => f.id === field.id);
      const next =
        index >= 0
          ? existing.map((f, i) => (i === index ? field : f))
          : [...existing, field];
      return {
        board: {
          ...state.board,
          custom_fields: next,
        },
      };
    }),

  removeCustomFieldDefinition: (fieldId) =>
    set((state) => {
      const nextFields = (state.board.custom_fields ?? []).filter(
        (f) => f.id !== fieldId
      );
      const nextCards = state.board.cards.map((c) => ({
        ...c,
        custom_field_values: (c.custom_field_values ?? []).filter(
          (v) => v.field_id !== fieldId
        ),
      }));
      return {
        board: {
          ...state.board,
          custom_fields: nextFields,
          cards: nextCards,
        },
      };
    }),

  setCardCustomFieldValue: (cardId, fieldId, value) =>
    set((state) => {
      const nextCards = state.board.cards.map((c) => {
        if (c.id !== cardId) return c;
        const filtered = (c.custom_field_values ?? []).filter(
          (v) => v.field_id !== fieldId
        );
        if (value !== null && value !== undefined && value !== "") {
          filtered.push({ field_id: fieldId, value });
        }
        return { ...c, custom_field_values: filtered };
      });
      return {
        board: {
          ...state.board,
          cards: nextCards,
        },
      };
    }),

  linkCardDependency: (cardId, blockerCardId) =>
    set((state) => {
      const nextCards = state.board.cards.map((c) => {
        if (c.id !== cardId) return c;
        if (c.blocked_by_card_ids.includes(blockerCardId)) return c;
        return {
          ...c,
          blocked_by_card_ids: [...c.blocked_by_card_ids, blockerCardId],
        };
      });
      return {
        board: {
          ...state.board,
          cards: nextCards,
        },
      };
    }),

  unlinkCardDependency: (cardId, blockerCardId) =>
    set((state) => {
      const nextCards = state.board.cards.map((c) => {
        if (c.id !== cardId) return c;
        return {
          ...c,
          blocked_by_card_ids: c.blocked_by_card_ids.filter(
            (id) => id !== blockerCardId
          ),
        };
      });
      return {
        board: {
          ...state.board,
          cards: nextCards,
        },
      };
    }),

  setPresences: (presences) => set({ presences }),
  upsertPresence: (presence) =>
    set((state) => {
      const index = state.presences.findIndex(
        (p) => p.user_id === presence.user_id
      );
      if (index === -1) {
        return { presences: [...state.presences, presence] };
      }
      const updated = [...state.presences];
      updated[index] = presence;
      return { presences: updated };
    }),
  removePresence: (userId) =>
    set((state) => ({
      presences: state.presences.filter((p) => p.user_id !== userId),
    })),
  setSimulatingCollaborator: (isSimulatingCollaborator) =>
    set({ isSimulatingCollaborator }),

  setWebhooks: (webhooks) =>
    set((state) => ({
      board: sortBoard({
        ...state.board,
        webhooks,
      }),
    })),

  upsertWebhook: (webhook) =>
    set((state) => {
      const existing = state.board.webhooks ?? [];
      const index = existing.findIndex((w) => w.id === webhook.id);
      const next =
        index === -1
          ? [webhook, ...existing]
          : existing.map((w) => (w.id === webhook.id ? webhook : w));
      return {
        board: sortBoard({
          ...state.board,
          webhooks: next,
        }),
      };
    }),

  removeWebhook: (webhookId) =>
    set((state) => ({
      board: sortBoard({
        ...state.board,
        webhooks: (state.board.webhooks ?? []).filter((w) => w.id !== webhookId),
      }),
    })),

  setAutomationRules: (rules) =>
    set((state) => ({
      automationRules: rules,
      board: sortBoard({
        ...state.board,
        automation_rules: rules,
      }),
    })),

  upsertAutomationRule: (rule) =>
    set((state) => {
      const nextRules = [...state.automationRules];
      const index = nextRules.findIndex((r) => r.id === rule.id);
      if (index === -1) {
        nextRules.push(rule);
      } else {
        nextRules[index] = rule;
      }
      return {
        automationRules: nextRules,
        board: sortBoard({
          ...state.board,
          automation_rules: nextRules,
        }),
      };
    }),

  removeAutomationRule: (ruleId) =>
    set((state) => {
      const nextRules = state.automationRules.filter((r) => r.id !== ruleId);
      return {
        automationRules: nextRules,
        board: sortBoard({
          ...state.board,
          automation_rules: nextRules,
        }),
      };
    }),

  addToast: (toast) =>
    set((state) => ({
      toasts: [toast, ...state.toasts].slice(0, 5),
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
      const targetCol = state.board.columns.find(
        (c) => c.id === targetColumnId
      );
      const metrics: LastMoveMetrics = {
        cardTitle: targetCard?.title ?? "Card",
        prevPos,
        nextPos,
        computedPos: newPosition,
        timestamp: new Date().toLocaleTimeString(),
      };

      const updatedCards = state.board.cards.map((c) =>
        c.id === cardId
          ? {
              ...c,
              column_id: targetColumnId,
              position: newPosition,
              updated_at: new Date().toISOString(),
            }
          : c
      );

      const isCrossColumn = targetCard && targetCard.column_id !== targetColumnId;
      const activityDescription = isCrossColumn
        ? `moved ${targetCard.title} to ${targetCol?.title ?? "another list"}`
        : `reordered ${targetCard?.title ?? "card"}`;

      const newActivity = {
        id: `act-${cardId}-${Date.now()}`,
        board_id: state.board.id,
        card_id: cardId,
        actor_name: state.currentUser.name,
        action_type: "CARD_MOVED" as const,
        description: activityDescription,
        created_at: new Date().toISOString(),
        is_automated: false,
      };

      return {
        lastMoveMetrics: metrics,
        board: sortBoard({
          ...state.board,
          cards: updatedCards,
          activities: [newActivity, ...state.board.activities],
        }),
      };
    }),

  optimisticMoveColumn: (columnId, newPosition, prevPos, nextPos) =>
    set((state) => {
      const targetCol = state.board.columns.find((c) => c.id === columnId);
      const metrics: LastMoveMetrics = {
        cardTitle: `List: ${targetCol?.title ?? ""}`,
        prevPos,
        nextPos,
        computedPos: newPosition,
        timestamp: new Date().toLocaleTimeString(),
      };

      const updatedColumns = state.board.columns.map((col) =>
        col.id === columnId
          ? { ...col, position: newPosition }
          : col
      );

      return {
        lastMoveMetrics: metrics,
        board: sortBoard({
          ...state.board,
          columns: updatedColumns,
        }),
      };
    }),

  applyRemoteCardMove: (data) =>
    set((state) => {
      const cardExists = state.board.cards.some((c) => c.id === data.card_id);
      if (!cardExists) return state;

      const updatedCards = state.board.cards.map((c) =>
        c.id === data.card_id
          ? {
              ...c,
              column_id: data.target_column_id,
              position: data.new_position,
              updated_at: data.updated_at,
            }
          : c
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
      const colExists = state.board.columns.some((c) => c.id === data.column_id);
      if (!colExists) return state;

      const updatedColumns = state.board.columns.map((c) =>
        c.id === data.column_id
          ? { ...c, position: data.new_position }
          : c
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
      const existing = state.board.cards.findIndex((c) => c.id === card.id);
      const nextCards =
        existing === -1
          ? [...state.board.cards, card]
          : state.board.cards.map((c) => (c.id === card.id ? card : c));

      return {
        board: sortBoard({
          ...state.board,
          cards: nextCards,
        }),
      };
    }),

  removeCard: (cardId) =>
    set((state) => ({
      board: sortBoard({
        ...state.board,
        cards: state.board.cards.filter((c) => c.id !== cardId),
      }),
      selectedCardId:
        state.selectedCardId === cardId ? null : state.selectedCardId,
    })),

  upsertColumn: (column) =>
    set((state) => {
      const existing = state.board.columns.findIndex(
        (c) => c.id === column.id
      );
      const nextCols =
        existing === -1
          ? [...state.board.columns, column]
          : state.board.columns.map((c) =>
              c.id === column.id ? column : c
            );

      return {
        board: sortBoard({
          ...state.board,
          columns: nextCols,
        }),
      };
    }),

  removeColumn: (columnId) =>
    set((state) => ({
      board: sortBoard({
        ...state.board,
        columns: state.board.columns.filter((c) => c.id !== columnId),
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
