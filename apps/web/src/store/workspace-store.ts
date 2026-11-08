import { create } from "zustand";
import {
  Board,
  Card,
  CardMovedEventData,
  Column,
  ColumnMovedEventData,
  Comment,
  Priority,
} from "@kinetix/contracts";
import { INITIAL_SEED_BOARD } from "@/lib/mock-data";
import { DEFAULT_USE_MOCK } from "@/lib/api-client";
import { WSConnectionStatus } from "@/lib/ws-client";
import { comparePositions } from "@/lib/fractional-index";

export type ViewMode = "kanban" | "table" | "calendar";
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
  board: Board;
  viewMode: ViewMode;
  themeMode: ThemeMode;
  useMockMode: boolean;
  wsStatus: WSConnectionStatus;
  fallbackNotice: string | null;

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

  // O(1) Fractional Index Telemetry pill
  lastMoveMetrics: LastMoveMetrics | null;

  // Actions
  setBoard: (board: Board) => void;
  setViewMode: (view: ViewMode) => void;
  setThemeMode: (theme: ThemeMode) => void;
  setUseMockMode: (useMock: boolean, fallbackNotice?: string | null) => void;
  setWsStatus: (status: WSConnectionStatus) => void;
  setFallbackNotice: (notice: string | null) => void;

  toggleLabelsExpanded: () => void;

  setPriorityFilter: (priority: Priority | "ALL") => void;
  setSearchQuery: (query: string) => void;
  setOnlyBlockedFilter: (onlyBlocked: boolean) => void;
  setMemberFilterId: (memberId: string | null) => void;
  toggleLabelFilterId: (labelId: string) => void;
  setDueFilter: (due: DueFilter) => void;
  clearAllFilters: () => void;

  setSelectedCardId: (cardId: string | null) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  openCreateCardModal: (columnId?: string | null) => void;
  closeCreateCardModal: () => void;
  setArchivedDrawerOpen: (open: boolean) => void;
  setBoardMenuOpen: (open: boolean) => void;

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
  };
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  board: sortBoard(INITIAL_SEED_BOARD),
  viewMode: "kanban",
  themeMode: "dark",
  useMockMode: DEFAULT_USE_MOCK,
  wsStatus: DEFAULT_USE_MOCK ? "mock" : "connecting",
  fallbackNotice: null,

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

  lastMoveMetrics: {
    cardTitle: "Real-Time WebSocket Broadcast",
    prevPos: "a0",
    nextPos: "a1",
    computedPos: "a0V",
    timestamp: "Ready",
  },

  setBoard: (board) => set({ board: sortBoard(board) }),
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
