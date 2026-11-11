"use client";

import React, { useCallback, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Board,
  Card,
  CopyCardRequest,
  CopyColumnRequest,
  CreateAutomationRuleRequest,
  CreateBoardRequest,
  CreateCardRequest,
  CreateColumnRequest,
  CreateCommentRequest,
  CreateWebhookRequest,
  CreateWorkspaceRequest,
  UpdateAutomationRuleRequest,
  UpdateBoardRequest,
  UpdateCardRequest,
  UpdateColumnRequest,
  UpdateWebhookRequest,
  WebhookConfig,
  WorkspaceWithBoards,
} from "@kinetix/contracts";
import { apiClient } from "@/lib/api-client";
import {
  createDeterministicUuid,
  INITIAL_SEED_BOARDS,
  mockApi,
  SEED_BOARD_ID,
} from "@/lib/mock-data";
import { boardWsClient } from "@/lib/ws-client";
import { useWorkspaceStore } from "@/store/workspace-store";
import {
  getDueDateStatus,
  resolveBoardCanvasClasses,
} from "@/lib/trello-theme";
import {
  ButlerExecutionToast,
  evaluateAndExecuteAutomations,
} from "@/lib/automation-engine";

import { WorkspaceHeader } from "./workspace-header";
import { WorkspaceSidebar } from "./workspace-sidebar";
import { KanbanBoard } from "./kanban-board";
import { TableView } from "./table-view";
import { CalendarView } from "./calendar-view";
import { AnalyticsView } from "./analytics-view";
import { DependencyGraphView } from "./dependency-graph-view";
import { RetroView } from "./retro-view";
import { PomodoroDock } from "./pomodoro-dock";
import { CustomFieldsManagerModal } from "./custom-fields-manager-modal";
import { ThemeStudioDrawer } from "./theme-studio-drawer";
import { TrelloImportExportModal } from "./trello-import-export-modal";
import { CardDetailDrawer } from "./card-detail-drawer";
import { ArchivedItemsDrawer } from "./archived-items-drawer";
import { BoardMenuDrawer } from "./board-menu-drawer";
import { CommandPalette } from "./command-palette";
import { CreateCardModal } from "./create-card-modal";
import { CreateBoardModal } from "./create-board-modal";
import { CreateWorkspaceModal } from "./create-workspace-modal";
import { BoardTemplatesModal } from "./board-templates-modal";
import { ButlerAutomationModal } from "./butler-automation-modal";
import { WebhooksModal } from "./webhooks-modal";
import { ButlerToastContainer } from "./butler-toast";
import { AuthModal } from "./auth-modal";
import { ShareBoardModal } from "./share-board-modal";
import { InviteBanner } from "./invite-banner";

export function KinetixWorkspace() {
  const queryClient = useQueryClient();

  const board = useWorkspaceStore((s) => s.board);
  const activeBoardId = useWorkspaceStore((s) => s.activeBoardId);
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
  const upsertRetroItem = useWorkspaceStore((s) => s.upsertRetroItem);
  const removeRetroItem = useWorkspaceStore((s) => s.removeRetroItem);
  const setCardActiveTimer = useWorkspaceStore((s) => s.setCardActiveTimer);

  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const setWorkspaces = useWorkspaceStore((s) => s.setWorkspaces);
  const currentWorkspaceId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const setCurrentWorkspaceId = useWorkspaceStore(
    (s) => s.setCurrentWorkspaceId
  );
  const boardSummaries = useWorkspaceStore((s) => s.boardSummaries);
  const setBoardSummaries = useWorkspaceStore((s) => s.setBoardSummaries);
  const toggleSidebar = useWorkspaceStore((s) => s.toggleSidebar);

  const setAutomationRules = useWorkspaceStore((s) => s.setAutomationRules);
  const upsertAutomationRule = useWorkspaceStore((s) => s.upsertAutomationRule);
  const removeAutomationRule = useWorkspaceStore((s) => s.removeAutomationRule);

  const toasts = useWorkspaceStore((s) => s.toasts);
  const addToast = useWorkspaceStore((s) => s.addToast);
  const removeToast = useWorkspaceStore((s) => s.removeToast);
  const setImportExportModalOpen = useWorkspaceStore(
    (s) => s.setImportExportModalOpen
  );

  const setPresences = useWorkspaceStore((s) => s.setPresences);
  const upsertPresence = useWorkspaceStore((s) => s.upsertPresence);
  const removePresence = useWorkspaceStore((s) => s.removePresence);
  const isSimulatingCollaborator = useWorkspaceStore(
    (s) => s.isSimulatingCollaborator
  );

  const upsertWebhook = useWorkspaceStore((s) => s.upsertWebhook);
  const removeWebhook = useWorkspaceStore((s) => s.removeWebhook);

  const handleFallbackToMock = useCallback(
    (reason: string) => {
      setUseMockMode(
        true,
        `Backend API (http://localhost:8000) unreachable (${reason})`
      );
    },
    [setUseMockMode]
  );

  // Fetch active board via TanStack Query
  const { data: fetchedBoard } = useQuery({
    queryKey: ["board", activeBoardId || SEED_BOARD_ID, useMockMode],
    queryFn: () =>
      apiClient.getBoard(activeBoardId || SEED_BOARD_ID, {
        useMock: useMockMode,
        onFallbackToMock: handleFallbackToMock,
      }),
  });

  useEffect(() => {
    if (fetchedBoard) {
      setBoard(fetchedBoard);
    }
  }, [fetchedBoard, setBoard]);

  // Fetch Board Templates
  const { data: templates = [] } = useQuery({
    queryKey: ["board-templates", useMockMode],
    queryFn: () =>
      apiClient.getBoardTemplates({
        useMock: useMockMode,
        onFallbackToMock: handleFallbackToMock,
      }),
  });

  // Fetch Workspaces
  const { data: fetchedWorkspaces } = useQuery({
    queryKey: ["workspaces", useMockMode],
    queryFn: () =>
      apiClient.getWorkspaces({
        useMock: useMockMode,
        onFallbackToMock: handleFallbackToMock,
      }),
  });

  useEffect(() => {
    if (fetchedWorkspaces && fetchedWorkspaces.length > 0) {
      setWorkspaces(fetchedWorkspaces);
    }
  }, [fetchedWorkspaces, setWorkspaces]);

  // Fetch Board Summaries
  const { data: fetchedSummaries } = useQuery({
    queryKey: ["board-summaries", currentWorkspaceId, useMockMode],
    queryFn: () =>
      apiClient.getBoardSummaries({
        useMock: useMockMode,
        onFallbackToMock: handleFallbackToMock,
      }),
  });

  useEffect(() => {
    if (fetchedSummaries && fetchedSummaries.length > 0) {
      setBoardSummaries(fetchedSummaries);
    }
  }, [fetchedSummaries, setBoardSummaries]);

  // Keyboard shortcut: '[' to toggle sidebar (unless focus is on an input/textarea)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === "[") {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar]);

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
      onAutomationTriggered: (data) => {
        const liveState = useWorkspaceStore.getState();
        const cardTitle = data.card_id
          ? liveState.board.cards.find((c) => c.id === data.card_id)?.title ||
            "Card"
          : "Card";
        addToast({
          id: createDeterministicUuid(),
          ruleName: data.rule_name || "Butler Automation",
          cardTitle,
          actionSummary: data.action_types
            .map((t) => t.toLowerCase().replace(/_/g, " "))
            .join(" • "),
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
        });

        const updatedRules = liveState.automationRules.map((r) =>
          r.id === data.rule_id
            ? {
                ...r,
                execution_count: data.execution_count,
                last_triggered_at: data.triggered_at,
              }
            : r
        );
        setAutomationRules(updatedRules);

        const activityEntry = {
          id: createDeterministicUuid(),
          board_id: liveState.board.id,
          card_id: data.card_id ?? null,
          actor_name: "🤖 Butler Bot",
          action_type: "AUTOMATION_TRIGGERED" as const,
          description: `🤖 Butler executed rule: [${data.rule_name}]`,
          created_at: data.triggered_at,
          is_automated: true,
        };
        setBoard({
          ...liveState.board,
          automation_rules: updatedRules,
          activities: [activityEntry, ...liveState.board.activities],
        });

        queryClient.invalidateQueries({ queryKey: ["board"] });
      },
      onAutomationRuleCreated: (rule) => {
        upsertAutomationRule(rule);
      },
      onAutomationRuleUpdated: (rule) => {
        upsertAutomationRule(rule);
      },
      onAutomationRuleDeleted: (data) => {
        removeAutomationRule(data.id);
      },
      onBoardImported: (importedBoard) => {
        setBoard(importedBoard);
        queryClient.invalidateQueries({ queryKey: ["board-summaries"] });
        queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      },
      onPresenceSync: (presences) => {
        setPresences(presences);
      },
      onUserJoined: (presence) => {
        upsertPresence(presence);
      },
      onUserLeft: (userId) => {
        removePresence(userId);
      },
      onUserTyping: (presence) => {
        upsertPresence(presence);
      },
      onTimerUpdated: (data) => {
        setCardActiveTimer(data.card_id, data.active_timer);
        queryClient.invalidateQueries({ queryKey: ["board"] });
      },
      onRetroItemCreated: (item) => {
        upsertRetroItem(item);
        queryClient.invalidateQueries({ queryKey: ["board"] });
      },
      onRetroItemUpdated: (item) => {
        upsertRetroItem(item);
        queryClient.invalidateQueries({ queryKey: ["board"] });
      },
      onRetroItemDeleted: (data) => {
        removeRetroItem(data.id);
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
    upsertRetroItem,
    removeRetroItem,
    setCardActiveTimer,
    setBoard,
    setAutomationRules,
    upsertAutomationRule,
    removeAutomationRule,
    addToast,
    setPresences,
    upsertPresence,
    removePresence,
    queryClient,
  ]);

  // Simulated Collaborator Loop (Phase 5 Live Testing)
  useEffect(() => {
    if (!isSimulatingCollaborator) return;

    const currentBoardCards = board.cards.filter((c) => !c.is_archived);
    if (currentBoardCards.length === 0) return;

    // Initial collaborators joined
    const initialCollaborators = [
      {
        user_id: "88888888-8888-4888-8888-888888888881",
        user_name: "Alex Rivera",
        avatar_url: null,
        initials: "AR",
        color: "#3b82f6",
        status: "ACTIVE" as const,
        active_card_id: null,
        last_seen: new Date().toISOString(),
      },
      {
        user_id: "88888888-8888-4888-8888-888888888882",
        user_name: "Maya Lin",
        avatar_url: null,
        initials: "ML",
        color: "#8b5cf6",
        status: "EDITING" as const,
        active_card_id: currentBoardCards[0]?.id ?? null,
        last_seen: new Date().toISOString(),
      },
      {
        user_id: "88888888-8888-4888-8888-888888888883",
        user_name: "Samir Patel",
        avatar_url: null,
        initials: "SP",
        color: "#10b981",
        status: "ACTIVE" as const,
        active_card_id: null,
        last_seen: new Date().toISOString(),
      },
      {
        user_id: "88888888-8888-4888-8888-888888888884",
        user_name: "Elena Rostova",
        avatar_url: null,
        initials: "ER",
        color: "#f59e0b",
        status: "IDLE" as const,
        active_card_id: null,
        last_seen: new Date().toISOString(),
      },
    ];

    setPresences(initialCollaborators);

    let step = 0;
    const interval = setInterval(() => {
      step++;
      const currentCards = useWorkspaceStore
        .getState()
        .board.cards.filter((c) => !c.is_archived);
      if (currentCards.length === 0) return;

      const cardA =
        currentCards[Math.floor(Math.random() * currentCards.length)];
      const cardB =
        currentCards[Math.floor(Math.random() * currentCards.length)];

      const nextTeam = [
        {
          user_id: "88888888-8888-4888-8888-888888888881",
          user_name: "Alex Rivera",
          avatar_url: null,
          initials: "AR",
          color: "#3b82f6",
          status: "ACTIVE" as const,
          active_card_id: null,
          last_seen: new Date().toISOString(),
        },
        {
          user_id: "88888888-8888-4888-8888-888888888882",
          user_name: "Maya Lin",
          avatar_url: null,
          initials: "ML",
          color: "#8b5cf6",
          status: step % 3 === 0 ? ("ACTIVE" as const) : ("EDITING" as const),
          active_card_id: step % 3 === 0 ? null : cardA.id,
          last_seen: new Date().toISOString(),
        },
        {
          user_id: "88888888-8888-4888-8888-888888888883",
          user_name: "Samir Patel",
          avatar_url: null,
          initials: "SP",
          color: "#10b981",
          status: step % 2 === 0 ? ("EDITING" as const) : ("ACTIVE" as const),
          active_card_id: step % 2 === 0 ? cardB.id : null,
          last_seen: new Date().toISOString(),
        },
        {
          user_id: "88888888-8888-4888-8888-888888888884",
          user_name: "Elena Rostova",
          avatar_url: null,
          initials: "ER",
          color: "#f59e0b",
          status: step % 4 === 0 ? ("IDLE" as const) : ("ACTIVE" as const),
          active_card_id: null,
          last_seen: new Date().toISOString(),
        },
      ];

      setPresences(nextTeam);
    }, 3800);

    return () => {
      clearInterval(interval);
      setPresences([
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
      ]);
    };
  }, [isSimulatingCollaborator, board.cards, setPresences]);

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

  // Board Switching Handler
  const handleSelectBoard = useCallback(
    async (boardId: string) => {
      try {
        const target = await apiClient.getBoard(boardId, {
          useMock: useMockMode,
          onFallbackToMock: handleFallbackToMock,
        });
        setBoard(target);
      } catch (err) {
        console.error("Failed to switch board:", err);
      }
    },
    [useMockMode, handleFallbackToMock, setBoard]
  );

  // Board Star Toggle Handler
  const handleToggleStarBoard = useCallback(
    async (boardId: string, currentStarred: boolean) => {
      const nextStarred = !currentStarred;
      if (board.id === boardId) {
        setBoard({ ...board, is_starred: nextStarred });
        await apiClient.updateBoard(
          boardId,
          { is_starred: nextStarred },
          {
            useMock: useMockMode,
            onFallbackToMock: handleFallbackToMock,
          }
        );
      } else {
        await apiClient.updateBoard(
          boardId,
          { is_starred: nextStarred },
          {
            useMock: useMockMode,
            onFallbackToMock: handleFallbackToMock,
          }
        );
        setBoardSummaries(
          boardSummaries.map((s) =>
            s.id === boardId ? { ...s, is_starred: nextStarred } : s
          )
        );
      }
    },
    [
      board,
      useMockMode,
      handleFallbackToMock,
      setBoard,
      boardSummaries,
      setBoardSummaries,
    ]
  );

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

  // Create New Board
  const handleCreateBoard = useCallback(
    async (payload: CreateBoardRequest) => {
      const created = await apiClient.createBoard(payload, {
        useMock: useMockMode,
        onFallbackToMock: handleFallbackToMock,
      });
      setBoard(created);
      queryClient.invalidateQueries({ queryKey: ["board-summaries"] });
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
    [useMockMode, handleFallbackToMock, setBoard, queryClient]
  );

  // Create New Workspace
  const handleCreateWorkspace = useCallback(
    async (payload: CreateWorkspaceRequest) => {
      const created = await apiClient.createWorkspace(payload, {
        useMock: useMockMode,
        onFallbackToMock: handleFallbackToMock,
      });
      const wsWithBoards: WorkspaceWithBoards = {
        ...created,
        boards: [],
      };
      setWorkspaces([...workspaces, wsWithBoards]);
      setCurrentWorkspaceId(created.id);
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
    [
      useMockMode,
      handleFallbackToMock,
      workspaces,
      setWorkspaces,
      setCurrentWorkspaceId,
      queryClient,
    ]
  );

  // Butler Automation CRUD & AI Generation Handlers
  const handleCreateAutomationRule = useCallback(
    async (payload: CreateAutomationRuleRequest) => {
      const created = await apiClient.createAutomation(board.id, payload, {
        useMock: useMockMode,
        onFallbackToMock: handleFallbackToMock,
      });
      upsertAutomationRule(created);
    },
    [board.id, useMockMode, handleFallbackToMock, upsertAutomationRule]
  );

  const handleUpdateAutomationRule = useCallback(
    async (ruleId: string, payload: UpdateAutomationRuleRequest) => {
      const updated = await apiClient.updateAutomation(ruleId, payload, {
        useMock: useMockMode,
        onFallbackToMock: handleFallbackToMock,
      });
      upsertAutomationRule(updated);
    },
    [useMockMode, handleFallbackToMock, upsertAutomationRule]
  );

  const handleDeleteAutomationRule = useCallback(
    async (ruleId: string) => {
      removeAutomationRule(ruleId);
      await apiClient.deleteAutomation(ruleId, {
        useMock: useMockMode,
        onFallbackToMock: handleFallbackToMock,
      });
    },
    [useMockMode, handleFallbackToMock, removeAutomationRule]
  );

  const handleAiGenerateAutomationRule = useCallback(
    async (prompt: string) => {
      const parsed = await apiClient.aiGenerateAutomation(board.id, prompt, {
        useMock: useMockMode,
        onFallbackToMock: handleFallbackToMock,
      });
      if ("id" in parsed && parsed.id && parsed.board_id) {
        upsertAutomationRule(parsed as any);
      }
      return parsed;
    },
    [board.id, useMockMode, handleFallbackToMock, upsertAutomationRule]
  );

  // Webhook CRUD, Test Ping, and AI Standup Summary Handlers
  const handleCreateWebhook = useCallback(
    async (payload: CreateWebhookRequest) => {
      const created = await apiClient.createWebhook(board.id, payload, {
        useMock: useMockMode,
        onFallbackToMock: handleFallbackToMock,
      });
      upsertWebhook(created);
    },
    [board.id, useMockMode, handleFallbackToMock, upsertWebhook]
  );

  const handleUpdateWebhook = useCallback(
    async (webhookId: string, payload: UpdateWebhookRequest) => {
      const updated = await apiClient.updateWebhook(webhookId, payload, {
        useMock: useMockMode,
        onFallbackToMock: handleFallbackToMock,
      });
      upsertWebhook(updated);
    },
    [useMockMode, handleFallbackToMock, upsertWebhook]
  );

  const handleDeleteWebhook = useCallback(
    async (webhookId: string) => {
      removeWebhook(webhookId);
      await apiClient.deleteWebhook(webhookId, {
        useMock: useMockMode,
        onFallbackToMock: handleFallbackToMock,
      });
    },
    [useMockMode, handleFallbackToMock, removeWebhook]
  );

  const handleTestWebhook = useCallback(
    async (webhookId: string) => {
      return await apiClient.testWebhook(webhookId, {
        useMock: useMockMode,
        onFallbackToMock: handleFallbackToMock,
      });
    },
    [useMockMode, handleFallbackToMock]
  );

  const handleGenerateAISummary = useCallback(
    async () => {
      return await apiClient.generateAISummaryNotification(
        board.title,
        board.activities ?? [],
        {
          useMock: useMockMode,
          onFallbackToMock: handleFallbackToMock,
        }
      );
    },
    [board.title, board.activities, useMockMode, handleFallbackToMock]
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

  // Card Handlers with Runtime Automation Evaluation
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

      // Evaluate active Butler automations for card move
      const targetCol = board.columns.find((c) => c.id === targetColumnId);
      const card = board.cards.find((c) => c.id === cardId);
      if (card) {
        const movedCard: Card = {
          ...card,
          column_id: targetColumnId,
          position: newPosition,
        };
        const autoResult = evaluateAndExecuteAutomations({
          board,
          card: movedCard,
          event: {
            type: "WHEN_CARD_MOVED_TO_COLUMN",
            targetColumnId,
            targetColumnTitle: targetCol?.title,
          },
        });
        if (autoResult.toasts.length > 0) {
          const isLiveConnected =
            !useMockMode && useWorkspaceStore.getState().wsStatus === "connected";
          if (!isLiveConnected) {
            for (const t of autoResult.toasts) {
              addToast(t);
            }
          }
          if (useMockMode) {
            upsertCard(autoResult.updatedCard);
            setAutomationRules(autoResult.updatedRules);
            if (autoResult.newActivities.length > 0) {
              setBoard({
                ...board,
                cards: board.cards.map((c) =>
                  c.id === autoResult.updatedCard.id ? autoResult.updatedCard : c
                ),
                activities: [...autoResult.newActivities, ...board.activities],
                automation_rules: autoResult.updatedRules,
              });
            }
            mockApi.updateCard(cardId, autoResult.updatedCard);
          } else {
            queryClient.invalidateQueries({ queryKey: ["board"] });
          }
        }
      }
    },
    [
      optimisticMoveCard,
      useMockMode,
      handleFallbackToMock,
      upsertCard,
      board,
      addToast,
      setAutomationRules,
      setBoard,
    ]
  );

  const handleCreateCard = useCallback(
    async (payload: CreateCardRequest) => {
      const created = await apiClient.createCard(board.id, payload, {
        useMock: useMockMode,
        onFallbackToMock: handleFallbackToMock,
      });
      upsertCard(created);

      // Evaluate active Butler automations for card creation
      const autoResult = evaluateAndExecuteAutomations({
        board,
        card: created,
        event: { type: "WHEN_CARD_CREATED" },
      });
      if (autoResult.toasts.length > 0) {
        const isLiveConnected =
          !useMockMode && useWorkspaceStore.getState().wsStatus === "connected";
        if (!isLiveConnected) {
          for (const t of autoResult.toasts) {
            addToast(t);
          }
        }
        if (useMockMode) {
          upsertCard(autoResult.updatedCard);
          setAutomationRules(autoResult.updatedRules);
          if (autoResult.newActivities.length > 0) {
            setBoard({
              ...board,
              cards: [
                ...board.cards.filter((c) => c.id !== autoResult.updatedCard.id),
                autoResult.updatedCard,
              ],
              activities: [...autoResult.newActivities, ...board.activities],
              automation_rules: autoResult.updatedRules,
            });
          }
          mockApi.updateCard(autoResult.updatedCard.id, autoResult.updatedCard);
        } else {
          queryClient.invalidateQueries({ queryKey: ["board"] });
        }
      }
    },
    [
      board,
      useMockMode,
      handleFallbackToMock,
      upsertCard,
      addToast,
      setAutomationRules,
      setBoard,
    ]
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

      if (existing) {
        let currentCard = updated;
        const allToasts: ButlerExecutionToast[] = [];
        let finalRules = board.automation_rules ?? [];
        const newActivities: Board["activities"] = [];

        // 1. Checklist completed trigger check
        if (payload.checklists) {
          const wasCompleted = (existing.checklists ?? []).some(
            (cl) => cl.items.length > 0 && cl.items.every((i) => i.is_completed)
          );
          const isNowCompleted = (payload.checklists ?? []).some(
            (cl) => cl.items.length > 0 && cl.items.every((i) => i.is_completed)
          );
          if (!wasCompleted && isNowCompleted) {
            const autoRes = evaluateAndExecuteAutomations({
              board,
              card: currentCard,
              event: { type: "WHEN_CHECKLIST_COMPLETED" },
            });
            if (autoRes.toasts.length > 0) {
              currentCard = autoRes.updatedCard;
              finalRules = autoRes.updatedRules;
              newActivities.push(...autoRes.newActivities);
              allToasts.push(...autoRes.toasts);
            }
          }
        }

        // 2. Priority changed trigger check
        if (payload.priority && payload.priority !== existing.priority) {
          const autoRes = evaluateAndExecuteAutomations({
            board,
            card: currentCard,
            event: {
              type: "WHEN_PRIORITY_CHANGED",
              priority: payload.priority,
            },
          });
          if (autoRes.toasts.length > 0) {
            currentCard = autoRes.updatedCard;
            finalRules = autoRes.updatedRules;
            newActivities.push(...autoRes.newActivities);
            allToasts.push(...autoRes.toasts);
          }
        }

        // 3. Label added trigger check
        if (payload.label_ids) {
          const addedLabelIds = payload.label_ids.filter(
            (id) => !(existing.label_ids ?? []).includes(id)
          );
          for (const labelId of addedLabelIds) {
            const autoRes = evaluateAndExecuteAutomations({
              board,
              card: currentCard,
              event: {
                type: "WHEN_LABEL_ADDED",
                labelId,
              },
            });
            if (autoRes.toasts.length > 0) {
              currentCard = autoRes.updatedCard;
              finalRules = autoRes.updatedRules;
              newActivities.push(...autoRes.newActivities);
              allToasts.push(...autoRes.toasts);
            }
          }
        }

        if (allToasts.length > 0) {
          const isLiveConnected =
            !useMockMode && useWorkspaceStore.getState().wsStatus === "connected";
          if (!isLiveConnected) {
            for (const t of allToasts) {
              addToast(t);
            }
          }
          if (useMockMode) {
            upsertCard(currentCard);
            setAutomationRules(finalRules);
            if (newActivities.length > 0) {
              setBoard({
                ...board,
                cards: board.cards.map((c) =>
                  c.id === currentCard.id ? currentCard : c
                ),
                activities: [...newActivities, ...board.activities],
                automation_rules: finalRules,
              });
            }
            mockApi.updateCard(cardId, currentCard);
          } else {
            queryClient.invalidateQueries({ queryKey: ["board"] });
          }
        }
      }
    },
    [
      board,
      upsertCard,
      useMockMode,
      handleFallbackToMock,
      addToast,
      setAutomationRules,
      setBoard,
    ]
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
        const mockBoard = await mockApi.getBoard(board.id || SEED_BOARD_ID);
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
    [board.id, setUseMockMode, setBoard]
  );

  const handleResetMockData = useCallback(() => {
    const fresh = mockApi.resetToSeed();
    setBoard(fresh);
    setBoardSummaries(
      INITIAL_SEED_BOARDS.map((b) => ({
        id: b.id,
        workspace_id: b.workspace_id,
        title: b.title,
        is_starred: b.is_starred,
        background: b.background,
        card_count: b.cards.filter((c) => !c.is_archived).length,
        updated_at: b.created_at,
        created_at: b.created_at,
        description: b.description,
      }))
    );
  }, [setBoard, setBoardSummaries]);

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

      <InviteBanner />

      <div className="flex min-h-[calc(100vh-65px)]">
        {/* Collapsible Trello Multi-Board Sidebar */}
        <WorkspaceSidebar
          onSelectBoard={handleSelectBoard}
          onToggleStarBoard={handleToggleStarBoard}
        />

        {/* Main Board View Canvas */}
        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6">
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
          ) : viewMode === "calendar" ? (
            <CalendarView
              filteredCards={filteredCards}
              onUpdateCard={handleUpdateCard}
            />
          ) : viewMode === "graph" ? (
            <DependencyGraphView />
          ) : viewMode === "retro" ? (
            <RetroView />
          ) : (
            <AnalyticsView
              onOpenImportExport={() => setImportExportModalOpen(true)}
            />
          )}
        </main>
      </div>

      {/* Drawers & Modals */}
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

      <CommandPalette
        onToggleMockMode={handleToggleMockMode}
        onSelectBoard={handleSelectBoard}
      />

      <CreateCardModal onCreateCard={handleCreateCard} />

      <CreateBoardModal
        templates={templates}
        onCreateBoard={handleCreateBoard}
      />

      <CreateWorkspaceModal onCreateWorkspace={handleCreateWorkspace} />

      <BoardTemplatesModal
        templates={templates}
        onCreateBoardFromTemplate={handleCreateBoard}
      />

      <ButlerAutomationModal
        board={board}
        onCreateRule={handleCreateAutomationRule}
        onUpdateRule={handleUpdateAutomationRule}
        onDeleteRule={handleDeleteAutomationRule}
        onAiGenerateRule={handleAiGenerateAutomationRule}
      />

      <WebhooksModal
        boardId={board.id}
        boardTitle={board.title}
        webhooks={board.webhooks ?? []}
        onCreateWebhook={handleCreateWebhook}
        onUpdateWebhook={handleUpdateWebhook}
        onDeleteWebhook={handleDeleteWebhook}
        onTestWebhook={handleTestWebhook}
        onGenerateAISummary={handleGenerateAISummary}
      />

      <TrelloImportExportModal
        onImportSuccess={(result) => {
          setBoard(result.board);
          queryClient.invalidateQueries({ queryKey: ["board-summaries"] });
          queryClient.invalidateQueries({ queryKey: ["workspaces"] });
          addToast({
            id: createDeterministicUuid(),
            ruleName: "Trello Board Imported",
            cardTitle: result.board.title,
            actionSummary: `${result.imported_lists_count} lists • ${result.imported_cards_count} cards • ${result.imported_checklists_count} checklists`,
            timestamp: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            }),
          });
        }}
      />

      <AuthModal />
      <ShareBoardModal />
      <CustomFieldsManagerModal />
      <ThemeStudioDrawer />
      <PomodoroDock />

      <ButlerToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
