import { create } from "zustand";
import {
  Board,
  Card,
  CardMovedEventData,
  Column,
  Priority,
} from "@kinetix/contracts";
import { INITIAL_SEED_BOARD } from "@/lib/mock-data";
import { DEFAULT_USE_MOCK } from "@/lib/api-client";
import { WSConnectionStatus } from "@/lib/ws-client";
import { comparePositions } from "@/lib/fractional-index";

export type ViewMode = "kanban" | "table";
export type ThemeMode = "light" | "dark" | "system";

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

  // Filters
  priorityFilter: Priority | "ALL";
  searchQuery: string;
  onlyBlockedFilter: boolean;

  // Modals / Drawers
  selectedCardId: string | null;
  isCommandPaletteOpen: boolean;
  isCreateCardModalOpen: boolean;
  createCardDefaultColumnId: string | null;

  // O(1) Fractional Index Telemetry pill
  lastMoveMetrics: LastMoveMetrics | null;

  // Actions
  setBoard: (board: Board) => void;
  setViewMode: (view: ViewMode) => void;
  setThemeMode: (theme: ThemeMode) => void;
  setUseMockMode: (useMock: boolean, fallbackNotice?: string | null) => void;
  setWsStatus: (status: WSConnectionStatus) => void;
  setFallbackNotice: (notice: string | null) => void;

  setPriorityFilter: (priority: Priority | "ALL") => void;
  setSearchQuery: (query: string) => void;
  setOnlyBlockedFilter: (onlyBlocked: boolean) => void;

  setSelectedCardId: (cardId: string | null) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  openCreateCardModal: (columnId?: string | null) => void;
  closeCreateCardModal: () => void;

  optimisticMoveCard: (
    cardId: string,
    targetColumnId: string,
    newPosition: string,
    prevPos?: string,
    nextPos?: string
  ) => void;
  applyRemoteCardMove: (data: CardMovedEventData) => void;
  upsertCard: (card: Card) => void;
  upsertColumn: (column: Column) => void;
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

  priorityFilter: "ALL",
  searchQuery: "",
  onlyBlockedFilter: false,

  selectedCardId: null,
  isCommandPaletteOpen: false,
  isCreateCardModalOpen: false,
  createCardDefaultColumnId: null,

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

  setPriorityFilter: (priorityFilter) => set({ priorityFilter }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setOnlyBlockedFilter: (onlyBlockedFilter) => set({ onlyBlockedFilter }),

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
}));
