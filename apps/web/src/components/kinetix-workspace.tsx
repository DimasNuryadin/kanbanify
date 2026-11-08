"use client";

import React, { useCallback, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CopyCardRequest,
  CopyColumnRequest,
  CreateCardRequest,
  CreateColumnRequest,
  CreateCommentRequest,
  UpdateBoardRequest,
  UpdateCardRequest,
  UpdateColumnRequest,
} from "@kinetix/contracts";
import { apiClient } from "@/lib/api-client";
import { createDeterministicUuid, mockApi, SEED_BOARD_ID } from "@/lib/mock-data";
import { boardWsClient } from "@/lib/ws-client";
import { useWorkspaceStore } from "@/store/workspace-store";
import {
  getDueDateStatus,
  resolveBoardCanvasClasses,
} from "@/lib/trello-theme";
import { WorkspaceHeader } from "./workspace-header";
import { KanbanBoard } from "./kanban-board";
import { TableView } from "./table-view";
import { CalendarView } from "./calendar-view";
import { CardDetailDrawer } from "./card-detail-drawer";
import { ArchivedItemsDrawer } from "./archived-items-drawer";
import { BoardMenuDrawer } from "./board-menu-drawer";
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
  const memberFilterId = useWorkspaceStore((s) => s.memberFilterId);
  const labelFilterIds = useWorkspaceStore((s) => s.labelFilterIds);
  const dueFilter = useWorkspaceStore((s) => s.dueFilter);

  const setBoard = useWorkspaceStore((s) => s.setBoard);
  const setUseMockMode = useWorkspaceStore((s) => s.setUseMockMode);
  const setWsStatus = useWorkspaceStore((s) => s.setWsStatus);
  const optimisticMoveCard = useWorkspaceStore((s) => s.optimisticMoveCard);
  const optimisticMoveColumn = useWorkspaceStore((s) => s.optimisticMoveColumn);
  const applyRemoteCardMove = useWorkspaceStore((s) => s.applyRemoteCardMove);
  const applyRemoteColumnMove = useWorkspaceStore(
    (s) => s.applyRemoteColumnMove
  );
  const upsertCard = useWorkspaceStore((s) => s.upsertCard);
  const removeCard = useWorkspaceStore((s) => s.removeCard);
  const upsertColumn = useWorkspaceStore((s) => s.upsertColumn);
  const removeColumn = useWorkspaceStore((s) => s.removeColumn);
  const appendCardComment = useWorkspaceStore((s) => s.appendCardComment);

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
      onCardArchived: (cardOrId) => {
        if ("deleted" in cardOrId && cardOrId.deleted) {
          removeCard(cardOrId.id);
        } else if ("title" in cardOrId) {
          upsertCard(cardOrId);
        }
        queryClient.invalidateQueries({ queryKey: ["board"] });
      },
      onColumnCreated: (col) => {
        upsertColumn(col);
        queryClient.invalidateQueries({ queryKey: ["board"] });
      },
      onColumnMoved: (data) => {
        applyRemoteColumnMove(data);
        queryClient.invalidateQueries({ queryKey: ["board"] });
      },
      onColumnUpdated: (col) => {
        upsertColumn(col);
        queryClient.invalidateQueries({ queryKey: ["board"] });
      },
      onCommentAdded: (comment) => {
        appendCardComment(comment);
        queryClient.invalidateQueries({ queryKey: ["board"] });
      },
      onBoardUpdated: (updatedBoard) => {
        setBoard(updatedBoard);
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
    applyRemoteColumnMove,
    upsertCard,
    removeCard,
    upsertColumn,
    appendCardComment,
    setBoard,
    queryClient,
  ]);

  // Filter active cards by Priority, Member, Labels, Due Date, Blockers, and Search Query
  const filteredCards = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const archivedColIds = new Set(
      board.columns.filter((col) => col.is_archived).map((col) => col.id)
    );

    return board.cards.filter((card) => {
      if (card.is_archived || archivedColIds.has(card.column_id)) {
        return false;
      }
      if (priorityFilter !== "ALL" && card.priority !== priorityFilter) {
        return false;
      }
      if (onlyBlockedFilter && card.blocked_by_card_ids.length === 0) {
        return false;
      }
      if (memberFilterId && !card.member_ids.includes(memberFilterId)) {
        return false;
      }
      if (
        labelFilterIds.length > 0 &&
        !labelFilterIds.some((id) => card.label_ids.includes(id))
      ) {
        return false;
      }
      if (dueFilter !== "ALL") {
        const status = getDueDateStatus(card.due_date, card.is_due_complete);
        if (dueFilter === "OVERDUE" && status !== "overdue") return false;
        if (dueFilter === "DUE_SOON" && status !== "due-soon") return false;
        if (dueFilter === "COMPLETED" && status !== "complete") return false;
        if (dueFilter === "NO_DATE" && card.due_date !== null) return false;
      }
      if (q) {
        const matchesTitle = card.title.toLowerCase().includes(q);
        const matchesDesc = card.description.toLowerCase().includes(q);
        const matchesTag = card.tags.some((t) => t.toLowerCase().includes(q));
        const cardLabelNames = board.labels
          .filter((l) => card.label_ids.includes(l.id))
          .map((l) => l.name.toLowerCase());
        const matchesLabel = cardLabelNames.some((n) => n.includes(q));
        if (!matchesTitle && !matchesDesc && !matchesTag && !matchesLabel) {
          return false;
        }
      }
      return true;
    });
  }, [
    board.cards,
    board.columns,
    board.labels,
    priorityFilter,
    onlyBlockedFilter,
    memberFilterId,
    labelFilterIds,
    dueFilter,
    searchQuery,
  ]);

  // Board Customization Handler
  const handleUpdateBoard = useCallback(
    async (payload: UpdateBoardRequest) => {
      setBoard({
        ...board,
        ...(payload.title !== undefined ? { title: payload.title } : {}),
        ...(payload.description !== undefined
          ? { description: payload.description }
          : {}),
        ...(payload.is_starred !== undefined
          ? { is_starred: payload.is_starred }
          : {}),
        ...(payload.background !== undefined
          ? { background: payload.background }
          : {}),
        ...(payload.labels !== undefined ? { labels: payload.labels } : {}),
        ...(payload.members !== undefined ? { members: payload.members } : {}),
      });

      const updated = await apiClient.updateBoard(board.id, payload, {
        useMock: useMockMode,
        onFallbackToMock: handleFallbackToMock,
      });
      setBoard(updated);
    },
    [board, setBoard, useMockMode, handleFallbackToMock]
  );

  // Column (List) Handlers
  const handleCreateColumn = useCallback(
    async (payload: CreateColumnRequest) => {
      const tempId = createDeterministicUuid();
      upsertColumn({
        id: tempId,
        board_id: board.id,
        title: payload.title,
        position: payload.position,
        wip_limit: payload.wip_limit ?? null,
        color: payload.color ?? null,
        is_archived: false,
      });
      const created = await apiClient.createColumn(board.id, payload, {
        useMock: useMockMode,
        onFallbackToMock: handleFallbackToMock,
      });
      if (created.id !== tempId) {
        removeColumn(tempId);
      }
      upsertColumn(created);
    },
    [board.id, useMockMode, handleFallbackToMock, upsertColumn, removeColumn]
  );

  const handleUpdateColumn = useCallback(
    async (columnId: string, payload: UpdateColumnRequest) => {
      const existing = board.columns.find((c) => c.id === columnId);
      if (existing) {
        upsertColumn({ ...existing, ...payload });
      }
      const updated = await apiClient.updateColumn(columnId, payload, {
        useMock: useMockMode,
        onFallbackToMock: handleFallbackToMock,
      });
      upsertColumn(updated);
    },
    [board.columns, upsertColumn, useMockMode, handleFallbackToMock]
  );

  const handlePersistColumnMove = useCallback(
    async (
      columnId: string,
      newPosition: string,
      prevPos?: string,
      nextPos?: string
    ) => {
      optimisticMoveColumn(columnId, newPosition, prevPos, nextPos);
      const updated = await apiClient.moveColumn(
        columnId,
        { new_position: newPosition },
        {
          useMock: useMockMode,
          onFallbackToMock: handleFallbackToMock,
        }
      );
      upsertColumn(updated);
    },
    [optimisticMoveColumn, useMockMode, handleFallbackToMock, upsertColumn]
  );

  const handleCopyColumn = useCallback(
    async (columnId: string, payload?: CopyColumnRequest) => {
      const sourceCol = board.columns.find((c) => c.id === columnId);
      const tempColId = createDeterministicUuid();
      if (sourceCol) {
        upsertColumn({
          ...sourceCol,
          id: tempColId,
          title: payload?.title ?? `${sourceCol.title} (Copy)`,
          position: payload?.position ?? `${sourceCol.position}V`,
          is_archived: false,
        });
      }
      const res = await apiClient.copyColumn(columnId, payload, {
        useMock: useMockMode,
        onFallbackToMock: handleFallbackToMock,
      });
      if (res.column.id !== tempColId) {
        removeColumn(tempColId);
      }
      upsertColumn(res.column);
      for (const c of res.cards) {
        upsertCard(c);
      }
    },
    [
      board.columns,
      useMockMode,
      handleFallbackToMock,
      upsertColumn,
      removeColumn,
      upsertCard,
    ]
  );

  // Card Handlers
  const handlePersistCardMove = useCallback(
    async (
      cardId: string,
      targetColumnId: string,
      newPosition: string,
      prevPos?: string,
      nextPos?: string
    ) => {
      optimisticMoveCard(cardId, targetColumnId, newPosition, prevPos, nextPos);
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

  const handleCopyCard = useCallback(
    async (cardId: string, payload: CopyCardRequest) => {
      const copied = await apiClient.copyCard(cardId, payload, {
        useMock: useMockMode,
        onFallbackToMock: handleFallbackToMock,
      });
      upsertCard(copied);
    },
    [useMockMode, handleFallbackToMock, upsertCard]
  );

  const handleDeleteCard = useCallback(
    async (cardId: string) => {
      removeCard(cardId);
      await apiClient.deleteCard(cardId, {
        useMock: useMockMode,
        onFallbackToMock: handleFallbackToMock,
      });
    },
    [removeCard, useMockMode, handleFallbackToMock]
  );

  const handleAddComment = useCallback(
    async (cardId: string, payload: CreateCommentRequest) => {
      const comment = await apiClient.addComment(cardId, payload, {
        useMock: useMockMode,
        onFallbackToMock: handleFallbackToMock,
      });
      appendCardComment(comment);
      queryClient.invalidateQueries({ queryKey: ["board"] });
    },
    [useMockMode, handleFallbackToMock, appendCardComment, queryClient]
  );

  const handleDeleteComment = useCallback(
    async (cardId: string, commentId: string) => {
      const existing = board.cards.find((c) => c.id === cardId);
      if (existing) {
        upsertCard({
          ...existing,
          comments: existing.comments.filter((cm) => cm.id !== commentId),
        });
      }
      await apiClient.deleteComment(cardId, commentId, {
        useMock: useMockMode,
        onFallbackToMock: handleFallbackToMock,
      });
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

  const canvasSurface = resolveBoardCanvasClasses(board.background);

  return (
    <div
      className={`min-h-screen transition-colors duration-200 ${canvasSurface.className}`}
      style={canvasSurface.style}
    >
      <WorkspaceHeader
        onToggleMockMode={handleToggleMockMode}
        onResetMockData={handleResetMockData}
        onUpdateBoard={handleUpdateBoard}
      />

      <main className="mx-auto max-w-[1640px] px-4 py-5 sm:px-6">
        {viewMode === "kanban" ? (
          <KanbanBoard
            filteredCards={filteredCards}
            onPersistCardMove={handlePersistCardMove}
            onPersistColumnMove={handlePersistColumnMove}
            onCreateCard={handleCreateCard}
            onUpdateCard={handleUpdateCard}
            onCreateColumn={handleCreateColumn}
            onUpdateColumn={handleUpdateColumn}
            onCopyColumn={handleCopyColumn}
          />
        ) : viewMode === "table" ? (
          <TableView
            filteredCards={filteredCards}
            onPersistCardMove={handlePersistCardMove}
          />
        ) : (
          <CalendarView
            filteredCards={filteredCards}
            onUpdateCard={handleUpdateCard}
          />
        )}
      </main>

      <CardDetailDrawer
        onUpdateCard={handleUpdateCard}
        onMoveCard={handlePersistCardMove}
        onCopyCard={handleCopyCard}
        onDeleteCard={handleDeleteCard}
        onAddComment={handleAddComment}
        onDeleteComment={handleDeleteComment}
        onAiDecompose={handleAiDecompose}
        onUpdateBoard={handleUpdateBoard}
      />

      <ArchivedItemsDrawer
        onUpdateCard={handleUpdateCard}
        onDeleteCard={handleDeleteCard}
        onUpdateColumn={handleUpdateColumn}
      />

      <BoardMenuDrawer onUpdateBoard={handleUpdateBoard} />

      <CommandPalette onToggleMockMode={handleToggleMockMode} />

      <CreateCardModal onCreateCard={handleCreateCard} />
    </div>
  );
}
