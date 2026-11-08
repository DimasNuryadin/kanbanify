"use client";

import React, { useCallback, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CreateCardRequest, UpdateCardRequest } from "@kinetix/contracts";
import { apiClient } from "@/lib/api-client";
import { mockApi, SEED_BOARD_ID } from "@/lib/mock-data";
import { boardWsClient } from "@/lib/ws-client";
import { useWorkspaceStore } from "@/store/workspace-store";
import { WorkspaceHeader } from "./workspace-header";
import { KanbanBoard } from "./kanban-board";
import { TableView } from "./table-view";
import { CardDetailDrawer } from "./card-detail-drawer";
import { CommandPalette } from "./command-palette";
import { CreateCardModal } from "./create-card-modal";

export function KinetixWorkspace() {
  const queryClient = useQueryClient();

  const board = useWorkspaceStore((s) => s.board);
  const viewMode = useWorkspaceStore((s) => s.viewMode);
  const useMockMode = useWorkspaceStore((s) => s.useMockMode);
  const priorityFilter = useWorkspaceStore((s) => s.priorityFilter);
  const searchQuery = useWorkspaceStore((s) => s.searchQuery);
  const onlyBlockedFilter = useWorkspaceStore((s) => s.onlyBlockedFilter);

  const setBoard = useWorkspaceStore((s) => s.setBoard);
  const setUseMockMode = useWorkspaceStore((s) => s.setUseMockMode);
  const setWsStatus = useWorkspaceStore((s) => s.setWsStatus);
  const optimisticMoveCard = useWorkspaceStore((s) => s.optimisticMoveCard);
  const applyRemoteCardMove = useWorkspaceStore((s) => s.applyRemoteCardMove);
  const upsertCard = useWorkspaceStore((s) => s.upsertCard);
  const upsertColumn = useWorkspaceStore((s) => s.upsertColumn);

  const handleFallbackToMock = useCallback(
    (reason: string) => {
      setUseMockMode(
        true,
        `Backend API (http://localhost:8000) unreachable (${reason})`
      );
    },
    [setUseMockMode]
  );

  // Fetch initial board via TanStack Query
  const { data: fetchedBoard } = useQuery({
    queryKey: ["board", SEED_BOARD_ID, useMockMode],
    queryFn: () =>
      apiClient.getBoard(SEED_BOARD_ID, {
        useMock: useMockMode,
        onFallbackToMock: handleFallbackToMock,
      }),
  });

  useEffect(() => {
    if (fetchedBoard) {
      setBoard(fetchedBoard);
    }
  }, [fetchedBoard, setBoard]);

  // Connect WebSocket client for real-time sync
  useEffect(() => {
    boardWsClient.connect(board.id, useMockMode, {
      onStatusChange: (status) => setWsStatus(status),
      onCardMoved: (data) => {
        applyRemoteCardMove(data);
        queryClient.invalidateQueries({ queryKey: ["board"] });
      },
      onCardUpdated: (card) => {
        upsertCard(card);
        queryClient.invalidateQueries({ queryKey: ["board"] });
      },
      onCardCreated: (card) => {
        upsertCard(card);
        queryClient.invalidateQueries({ queryKey: ["board"] });
      },
      onColumnCreated: (col) => {
        upsertColumn(col);
        queryClient.invalidateQueries({ queryKey: ["board"] });
      },
    });

    return () => {
      boardWsClient.disconnect();
    };
  }, [
    board.id,
    useMockMode,
    setWsStatus,
    applyRemoteCardMove,
    upsertCard,
    upsertColumn,
    queryClient,
  ]);

  // Filter cards by Priority, Search Query, and Blocker Radar
  const filteredCards = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return board.cards.filter((card) => {
      if (priorityFilter !== "ALL" && card.priority !== priorityFilter) {
        return false;
      }
      if (onlyBlockedFilter && card.blocked_by_card_ids.length === 0) {
        return false;
      }
      if (q) {
        const matchesTitle = card.title.toLowerCase().includes(q);
        const matchesDesc = card.description.toLowerCase().includes(q);
        const matchesTag = card.tags.some((t) => t.toLowerCase().includes(q));
        if (!matchesTitle && !matchesDesc && !matchesTag) return false;
      }
      return true;
    });
  }, [board.cards, priorityFilter, onlyBlockedFilter, searchQuery]);

  // Handlers for Optimistic Move, Create, Update, and AI Decompose
  const handlePersistCardMove = useCallback(
    async (
      cardId: string,
      targetColumnId: string,
      newPosition: string,
      prevPos?: string,
      nextPos?: string
    ) => {
      // 1. Immediate O(1) Optimistic UI update
      optimisticMoveCard(cardId, targetColumnId, newPosition, prevPos, nextPos);

      // 2. Persist in background
      const updated = await apiClient.moveCard(
        cardId,
        {
          target_column_id: targetColumnId,
          new_position: newPosition,
        },
        {
          useMock: useMockMode,
          onFallbackToMock: handleFallbackToMock,
        }
      );
      upsertCard(updated);
    },
    [optimisticMoveCard, useMockMode, handleFallbackToMock, upsertCard]
  );

  const handleCreateCard = useCallback(
    async (payload: CreateCardRequest) => {
      const created = await apiClient.createCard(board.id, payload, {
        useMock: useMockMode,
        onFallbackToMock: handleFallbackToMock,
      });
      upsertCard(created);
    },
    [board.id, useMockMode, handleFallbackToMock, upsertCard]
  );

  const handleUpdateCard = useCallback(
    async (cardId: string, payload: UpdateCardRequest) => {
      // Optimistic merge
      const existing = board.cards.find((c) => c.id === cardId);
      if (existing) {
        upsertCard({
          ...existing,
          ...payload,
          updated_at: new Date().toISOString(),
        });
      }

      const updated = await apiClient.updateCard(cardId, payload, {
        useMock: useMockMode,
        onFallbackToMock: handleFallbackToMock,
      });
      upsertCard(updated);
    },
    [board.cards, upsertCard, useMockMode, handleFallbackToMock]
  );

  const handleAiDecompose = useCallback(
    async (cardId: string) => {
      const boardContext = board.cards.map((c) => c.title);
      const updated = await apiClient.aiDecomposeCard(cardId, boardContext, {
        useMock: useMockMode,
        onFallbackToMock: handleFallbackToMock,
      });
      upsertCard(updated);
    },
    [board.cards, useMockMode, handleFallbackToMock, upsertCard]
  );

  const handleToggleMockMode = useCallback(
    async (nextUseMock: boolean) => {
      if (nextUseMock) {
        setUseMockMode(true, null);
        const mockBoard = await mockApi.getBoard(SEED_BOARD_ID);
        setBoard(mockBoard);
        return;
      }

      // Check if live API is reachable before switching
      const isHealthy = await apiClient.checkHealth();
      if (!isHealthy) {
        setUseMockMode(
          true,
          "http://localhost:8000/health did not respond — staying in standalone Mock Mode"
        );
        return;
      }

      setUseMockMode(false, null);
    },
    [setUseMockMode, setBoard]
  );

  const handleResetMockData = useCallback(() => {
    const fresh = mockApi.resetToSeed();
    setBoard(fresh);
  }, [setBoard]);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 transition-colors duration-150 dark:bg-zinc-950 dark:text-zinc-100">
      <WorkspaceHeader
        onToggleMockMode={handleToggleMockMode}
        onResetMockData={handleResetMockData}
      />

      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
        {viewMode === "kanban" ? (
          <KanbanBoard
            filteredCards={filteredCards}
            onPersistCardMove={handlePersistCardMove}
          />
        ) : (
          <TableView
            filteredCards={filteredCards}
            onPersistCardMove={handlePersistCardMove}
          />
        )}
      </main>

      <CardDetailDrawer
        onUpdateCard={handleUpdateCard}
        onAiDecompose={handleAiDecompose}
      />

      <CommandPalette onToggleMockMode={handleToggleMockMode} />

      <CreateCardModal onCreateCard={handleCreateCard} />
    </div>
  );
}
