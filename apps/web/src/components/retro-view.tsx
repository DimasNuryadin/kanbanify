"use client";

import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  Award,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Flame,
  Lightbulb,
  MessageSquare,
  Plus,
  RefreshCw,
  Rocket,
  RotateCcw,
  Sparkles,
  Star,
  ThumbsUp,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import {
  AIRetroActionItem,
  AIRetroAnalysisResponse,
  Priority,
  PriorityEnum,
  RetroCategory,
  RetroCategoryEnum,
  RetroItem,
} from "@kinetix/contracts";
import { useWorkspaceStore } from "@/store/workspace-store";
import { apiClient } from "@/lib/api-client";
import { createDeterministicUuid } from "@/lib/mock-data";
import { PRIORITY_STYLES } from "./kanban-board";

const RETRO_COLUMNS: {
  category: RetroCategory;
  title: string;
  icon: string;
  description: string;
  badgeStyle: string;
  headerBorder: string;
  columnBg: string;
  composerFocus: string;
}[] = [
  {
    category: "WENT_WELL",
    title: "🌟 Went Well",
    icon: "🌟",
    description: "What helped us succeed, deliver value, and work effectively?",
    badgeStyle:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300",
    headerBorder: "border-emerald-500/50",
    columnBg: "bg-emerald-500/[0.02] dark:bg-emerald-500/[0.04]",
    composerFocus: "focus:border-emerald-500",
  },
  {
    category: "TO_IMPROVE",
    title: "⚠️ To Improve",
    icon: "⚠️",
    description: "What slowed us down, caused friction, or needs refactoring?",
    badgeStyle:
      "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300",
    headerBorder: "border-amber-500/50",
    columnBg: "bg-amber-500/[0.02] dark:bg-amber-500/[0.04]",
    composerFocus: "focus:border-amber-500",
  },
  {
    category: "KUDOS",
    title: "💡 Kudos & Ideas",
    icon: "💡",
    description: "Teammate recognitions, innovative ideas, and hypotheses.",
    badgeStyle:
      "border-purple-500/30 bg-purple-500/10 text-purple-700 dark:border-purple-500/30 dark:bg-purple-500/15 dark:text-purple-300",
    headerBorder: "border-purple-500/50",
    columnBg: "bg-purple-500/[0.02] dark:bg-purple-500/[0.04]",
    composerFocus: "focus:border-purple-500",
  },
  {
    category: "ACTION_ITEMS",
    title: "🚀 Action Items",
    icon: "🚀",
    description: "Concrete agile commitments to carry into the next sprint.",
    badgeStyle:
      "border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/15 dark:text-indigo-300",
    headerBorder: "border-indigo-500/50",
    columnBg: "bg-indigo-500/[0.02] dark:bg-indigo-500/[0.04]",
    composerFocus: "focus:border-indigo-500",
  },
];

export function RetroView() {
  const board = useWorkspaceStore((s) => s.board);
  const activeRole = useWorkspaceStore((s) => s.activeRole);
  const isViewer = activeRole === "VIEWER";
  const currentUser = useWorkspaceStore((s) => s.currentUser);
  const useMockMode = useWorkspaceStore((s) => s.useMockMode);

  const retroItems = board.retro_items ?? [];
  const upsertRetroItem = useWorkspaceStore((s) => s.upsertRetroItem);
  const removeRetroItem = useWorkspaceStore((s) => s.removeRetroItem);
  const toggleRetroVote = useWorkspaceStore((s) => s.toggleRetroVote);
  const upsertCard = useWorkspaceStore((s) => s.upsertCard);
  const setSelectedCardId = useWorkspaceStore((s) => s.setSelectedCardId);
  const addToast = useWorkspaceStore((s) => s.addToast);

  // Composer states per category
  const [activeComposerCat, setActiveComposerCat] = useState<RetroCategory | null>(null);
  const [composerContent, setComposerContent] = useState<string>("");
  const [isSubmittingNote, setIsSubmittingNote] = useState<boolean>(false);

  // AI Facilitator states
  const [isSynthesizingAI, setIsSynthesizingAI] = useState<boolean>(false);
  const [aiAnalysis, setAiAnalysis] = useState<AIRetroAnalysisResponse | null>(null);
  const [isAiPanelOpen, setIsAiPanelOpen] = useState<boolean>(true);
  const [convertingItemId, setConvertingItemId] = useState<string | null>(null);

  // Group items by category
  const groupedItems = useMemo(() => {
    const map: Record<RetroCategory, RetroItem[]> = {
      WENT_WELL: [],
      TO_IMPROVE: [],
      KUDOS: [],
      ACTION_ITEMS: [],
    };
    for (const item of retroItems) {
      if (map[item.category]) {
        map[item.category].push(item);
      }
    }
    // Sort each by votes descending
    for (const key of Object.keys(map) as RetroCategory[]) {
      map[key].sort((a, b) => b.votes - a.votes);
    }
    return map;
  }, [retroItems]);

  // Handle Add Retro Item
  const handleAddRetroItem = async (cat: RetroCategory) => {
    const trimmed = composerContent.trim();
    if (!trimmed || isViewer || isSubmittingNote) return;

    setIsSubmittingNote(true);
    try {
      const created = await apiClient.createRetroItem(
        board.id,
        {
          category: cat,
          content: trimmed,
          author_id: currentUser.id,
          author_name: currentUser.name,
          author_initials: currentUser.name
            .split(" ")
            .map((p) => p[0])
            .join("")
            .toUpperCase()
            .slice(0, 2),
        },
        { useMock: useMockMode }
      );
      upsertRetroItem(created);
      setComposerContent("");
      setActiveComposerCat(null);
      addToast({
        id: createDeterministicUuid(),
        ruleName: "Retro Note Added",
        cardTitle: "Retrospective Board",
        actionSummary: `Posted note in ${cat.replace("_", " ").toLowerCase()}.`,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      });
    } catch (err) {
      console.error("Failed to create retro item:", err);
      addToast({
        id: createDeterministicUuid(),
        ruleName: "Error Creating Note",
        cardTitle: "Retrospective Board",
        actionSummary: "Failed to post retro item. Please try again.",
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      });
    } finally {
      setIsSubmittingNote(false);
    }
  };

  // Handle Vote Retro Item
  const handleVote = async (item: RetroItem) => {
    // Optimistic store update
    toggleRetroVote(item.id, currentUser.id);

    try {
      const res = await apiClient.voteRetroItem(item.id, { useMock: useMockMode });
      upsertRetroItem(res.retro_item);
    } catch (err) {
      console.error("Failed to vote on retro item:", err);
      // Revert optimistic update on error
      toggleRetroVote(item.id, currentUser.id);
    }
  };

  // Handle Toggle Resolved
  const handleToggleResolved = async (item: RetroItem) => {
    if (isViewer) return;
    const nextResolved = !item.is_resolved;
    upsertRetroItem({ ...item, is_resolved: nextResolved });

    try {
      const updated = await apiClient.updateRetroItem(
        item.id,
        { is_resolved: nextResolved },
        { useMock: useMockMode }
      );
      upsertRetroItem(updated);
    } catch (err) {
      console.error("Failed to update retro item resolved state:", err);
      upsertRetroItem(item);
    }
  };

  // Handle Delete Retro Item
  const handleDeleteItem = async (itemId: string) => {
    if (isViewer) return;
    removeRetroItem(itemId);

    try {
      await apiClient.deleteRetroItem(itemId, { useMock: useMockMode });
    } catch (err) {
      console.error("Failed to delete retro item:", err);
    }
  };

  // 1-Click "Convert to Kanban Card"
  const handleConvertToCard = async (item: RetroItem) => {
    if (isViewer || item.linked_card_id || convertingItemId) return;
    setConvertingItemId(item.id);

    try {
      const defaultColumn = board.columns[0];
      const res = await apiClient.convertRetroItemToCard(
        item.id,
        {
          target_column_id: defaultColumn?.id,
          priority: item.category === "TO_IMPROVE" ? "HIGH" : "MEDIUM",
          story_points: 2,
        },
        { useMock: useMockMode }
      );

      upsertRetroItem(res.retro_item);
      upsertCard(res.card);

      addToast({
        id: createDeterministicUuid(),
        ruleName: "📌 Converted to Kanban Card!",
        cardTitle: res.card.title,
        actionSummary: `Created card in "${defaultColumn?.title ?? "Board"}".`,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      });
    } catch (err) {
      console.error("Failed to convert retro item to card:", err);
      addToast({
        id: createDeterministicUuid(),
        ruleName: "Conversion Error",
        cardTitle: "Retrospective Board",
        actionSummary: "Failed to convert retro note to task card.",
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      });
    } finally {
      setConvertingItemId(null);
    }
  };

  // Trigger AI Sprint Retrospective Synthesizer
  const handleSynthesizeAI = async () => {
    setIsSynthesizingAI(true);
    setIsAiPanelOpen(true);
    try {
      const res = await apiClient.synthesizeRetroAI(board.id, {
        useMock: useMockMode,
      });
      setAiAnalysis(res);
      addToast({
        id: createDeterministicUuid(),
        ruleName: "✨ AI Retrospective Synthesized!",
        cardTitle: "Sprint Retrospective",
        actionSummary: `Computed Morale Score (${res.sprint_morale_score}/100) & extracted key sprint themes.`,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      });
    } catch (err) {
      console.error("Failed to synthesize retrospective with AI:", err);
      addToast({
        id: createDeterministicUuid(),
        ruleName: "AI Synthesis Error",
        cardTitle: "Sprint Retrospective",
        actionSummary: "Failed to analyze retrospective. Please try again.",
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      });
    } finally {
      setIsSynthesizingAI(false);
    }
  };

  // 1-Click Add Recommended Action Item to Board
  const handleAddRecommendedAction = async (action: AIRetroActionItem) => {
    try {
      // 1. Add as a Retro Action Item
      const retroNote = await apiClient.createRetroItem(
        board.id,
        {
          category: "ACTION_ITEMS",
          content: action.title,
          author_id: currentUser.id,
          author_name: "AI Agile Coach",
          author_initials: "AI",
        },
        { useMock: useMockMode }
      );
      upsertRetroItem(retroNote);

      // 2. Also convert/create as a real Kanban Card
      const defaultColumn = board.columns[0];
      const res = await apiClient.convertRetroItemToCard(
        retroNote.id,
        {
          target_column_id: defaultColumn?.id,
          priority: action.priority ?? "MEDIUM",
          story_points: action.story_points ?? null,
        },
        { useMock: useMockMode }
      );
      upsertRetroItem(res.retro_item);
      upsertCard(res.card);

      addToast({
        id: createDeterministicUuid(),
        ruleName: "➕ Action Item Added to Board!",
        cardTitle: action.title,
        actionSummary: `Created card with priority ${action.priority ?? "MEDIUM"}.`,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      });
    } catch (err) {
      console.error("Failed to add recommended action item:", err);
      addToast({
        id: createDeterministicUuid(),
        ruleName: "Action Item Error",
        cardTitle: "Action Item",
        actionSummary: "Failed to add recommended action item to board.",
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header Banner & AI Synthesize Trigger */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-200/90 bg-white/80 p-5 shadow-xs backdrop-blur-md dark:border-zinc-800/90 dark:bg-zinc-900/80">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🔄</span>
            <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Interactive Sprint Retrospective Board
            </h2>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-300">
              {retroItems.length} Notes Total
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Collaborate in real time to reflect on successes, address bottlenecks,
            and automatically turn insights into actionable Kanban backlog cards.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={isSynthesizingAI}
            onClick={handleSynthesizeAI}
            title="Synthesize retrospective notes and estimation accuracy with AI Agile Coach"
            className="flex items-center gap-2 rounded-xl border border-indigo-500/30 bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-xs font-bold text-white shadow-md transition-all hover:from-indigo-500 hover:to-violet-500 hover:shadow-lg disabled:opacity-60 active:scale-[0.98]"
          >
            {isSynthesizingAI ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Synthesizing Sprint Retro...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 text-amber-300" />
                <span>✨ Synthesize Sprint Retro with AI</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* AI Sprint Retrospective Facilitator Panel (Collapsible) */}
      {aiAnalysis && (
        <div className="overflow-hidden rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-50/70 via-white to-purple-50/70 p-5 shadow-md backdrop-blur-md dark:border-indigo-500/25 dark:from-indigo-950/40 dark:via-zinc-900 dark:to-purple-950/40">
          <div className="flex items-center justify-between pb-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  AI Sprint Retrospective Facilitator Insights
                </h3>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Deterministic agile scoring & LLM retrospective synthesis
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsAiPanelOpen(!isAiPanelOpen)}
                className="flex items-center gap-1 rounded-lg border border-zinc-200/80 bg-white/80 px-2.5 py-1 text-xs font-medium text-zinc-700 shadow-2xs hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                {isAiPanelOpen ? (
                  <>
                    <ChevronUp className="h-3.5 w-3.5" />
                    <span>Hide Panel</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3.5 w-3.5" />
                    <span>View Insights</span>
                  </>
                )}
              </button>
              <button
                type="button"
                title="Dismiss AI Panel"
                onClick={() => setAiAnalysis(null)}
                className="rounded-lg p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {isAiPanelOpen && (
            <div className="mt-4 grid grid-cols-1 gap-6 border-t border-indigo-100 pt-4 lg:grid-cols-12 dark:border-zinc-800">
              {/* Morale Score Gauge & Estimation Summary (4 cols) */}
              <div className="space-y-4 lg:col-span-4">
                <div className="rounded-xl border border-zinc-200/80 bg-white/90 p-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900/90">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                      Sprint Morale Score
                    </span>
                    <span
                      className={`font-mono text-xl font-extrabold ${
                        aiAnalysis.sprint_morale_score >= 70
                          ? "text-emerald-600 dark:text-emerald-400"
                          : aiAnalysis.sprint_morale_score >= 40
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {aiAnalysis.sprint_morale_score} / 100
                    </span>
                  </div>

                  {/* Visual Gauge Bar */}
                  <div className="mt-2.5 h-3 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div
                      className={`h-full transition-all duration-500 ${
                        aiAnalysis.sprint_morale_score >= 70
                          ? "bg-emerald-500"
                          : aiAnalysis.sprint_morale_score >= 40
                            ? "bg-amber-500"
                            : "bg-rose-500"
                      }`}
                      style={{ width: `${aiAnalysis.sprint_morale_score}%` }}
                    />
                  </div>
                  <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                    {aiAnalysis.sprint_morale_score >= 70
                      ? "🌟 High team sentiment! Kudos and positive deliverables heavily outweigh friction."
                      : aiAnalysis.sprint_morale_score >= 40
                        ? "⚖️ Balanced sprint sentiment with actionable improvement areas identified."
                        : "⚠️ Team reported elevated friction and impediment notes."}
                  </p>
                </div>

                {/* Estimation Accuracy Summary */}
                <div className="rounded-xl border border-zinc-200/80 bg-white/90 p-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900/90">
                  <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                    ⏱️ Estimation Accuracy Summary
                  </span>
                  <p className="mt-1.5 text-xs leading-relaxed text-zinc-800 dark:text-zinc-200">
                    {aiAnalysis.estimation_accuracy_summary}
                  </p>
                </div>
              </div>

              {/* Key Themes & Recommended Actions (8 cols) */}
              <div className="space-y-4 lg:col-span-8">
                {/* Key Sprint Themes */}
                {aiAnalysis.key_themes && aiAnalysis.key_themes.length > 0 && (
                  <div className="rounded-xl border border-zinc-200/80 bg-white/90 p-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900/90">
                    <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                      🎯 Key Sprint Themes
                    </span>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {aiAnalysis.key_themes.map((theme, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:border-indigo-400/30 dark:bg-indigo-400/10 dark:text-indigo-300"
                        >
                          <span>•</span>
                          <span>{theme}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommended Action Items */}
                {aiAnalysis.recommended_action_items &&
                  aiAnalysis.recommended_action_items.length > 0 && (
                    <div className="rounded-xl border border-zinc-200/80 bg-white/90 p-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900/90">
                      <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                        🚀 1-Click Recommended Action Items to Backlog
                      </span>
                      <div className="mt-3 space-y-2">
                        {aiAnalysis.recommended_action_items.map((act, idx) => (
                          <div
                            key={idx}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200/70 bg-zinc-50/70 p-3 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950/70 dark:hover:border-zinc-700"
                          >
                            <div className="flex min-w-0 items-center gap-2.5">
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
                                {idx + 1}
                              </span>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                                  {act.title}
                                </p>
                                <div className="mt-0.5 flex items-center gap-2 text-[10px]">
                                  {act.priority && (
                                    <span
                                      className={`rounded px-1.5 py-0.2 font-semibold ${
                                        PRIORITY_STYLES[act.priority].badge
                                      }`}
                                    >
                                      {act.priority}
                                    </span>
                                  )}
                                  {act.story_points !== null &&
                                    act.story_points !== undefined && (
                                      <span className="font-mono text-zinc-500 dark:text-zinc-400">
                                        {act.story_points} pts
                                      </span>
                                    )}
                                </div>
                              </div>
                            </div>

                            {!isViewer && (
                              <button
                                type="button"
                                onClick={() => handleAddRecommendedAction(act)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-indigo-500"
                              >
                                <Plus className="h-3.5 w-3.5" />
                                <span>Add to Board</span>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4-Column Agile Retrospective Canvas */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {RETRO_COLUMNS.map((col) => {
          const items = groupedItems[col.category] ?? [];
          const isComposerOpen = activeComposerCat === col.category;

          return (
            <div
              key={col.category}
              className={`flex flex-col rounded-2xl border border-zinc-200/80 bg-white/70 p-4 shadow-xs backdrop-blur-xs transition-all dark:border-zinc-800/80 dark:bg-zinc-900/60 ${col.columnBg}`}
            >
              {/* Column Header */}
              <div
                className={`flex items-center justify-between border-b pb-3 ${col.headerBorder}`}
              >
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    {col.title}
                  </h3>
                  <span
                    className={`rounded-full border px-2 py-0.2 text-[10px] font-bold ${col.badgeStyle}`}
                  >
                    {items.length}
                  </span>
                </div>

                {!isViewer && (
                  <button
                    type="button"
                    onClick={() => {
                      if (isComposerOpen) {
                        setActiveComposerCat(null);
                        setComposerContent("");
                      } else {
                        setActiveComposerCat(col.category);
                        setComposerContent("");
                      }
                    }}
                    title="Add new retro note to this column"
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-200/80 bg-white text-zinc-600 shadow-2xs hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Column Description */}
              <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                {col.description}
              </p>

              {/* Inline Note Composer */}
              {isComposerOpen && !isViewer && (
                <div className="mt-3 rounded-xl border border-zinc-300 bg-white p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-950">
                  <textarea
                    rows={3}
                    autoFocus
                    value={composerContent}
                    onChange={(e) => setComposerContent(e.target.value)}
                    placeholder={`What's on your mind for ${col.title.toLowerCase()}?`}
                    className={`w-full resize-none bg-transparent text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-100 ${col.composerFocus}`}
                  />
                  <div className="mt-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveComposerCat(null);
                        setComposerContent("");
                      }}
                      className="rounded-lg px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isSubmittingNote || !composerContent.trim()}
                      onClick={() => handleAddRetroItem(col.category)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Note
                    </button>
                  </div>
                </div>
              )}

              {/* Notes List */}
              <div className="mt-3.5 flex-1 space-y-3 overflow-y-auto">
                {items.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-zinc-200/80 p-6 text-center text-xs text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
                    No notes in this column yet.
                    {!isViewer && (
                      <button
                        type="button"
                        onClick={() => setActiveComposerCat(col.category)}
                        className="mt-2 block w-full text-indigo-600 hover:underline dark:text-indigo-400"
                      >
                        + Add the first note
                      </button>
                    )}
                  </div>
                ) : (
                  items.map((item) => {
                    const hasVoted = (item.voted_by_user_ids ?? []).includes(
                      currentUser.id
                    );
                    const isConverting = convertingItemId === item.id;

                    return (
                      <div
                        key={item.id}
                        className={`group rounded-xl border p-3.5 shadow-2xs transition-all duration-150 ${
                          item.is_resolved
                            ? "border-zinc-200/60 bg-zinc-100/60 opacity-65 dark:border-zinc-800/60 dark:bg-zinc-950/40"
                            : "border-zinc-200/90 bg-white hover:border-zinc-300 dark:border-zinc-800/90 dark:bg-zinc-950 dark:hover:border-zinc-700"
                        }`}
                      >
                        {/* Note Header: Author & Controls */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[9px] font-bold text-white shadow-2xs">
                              {item.author_initials ||
                                item.author_name.slice(0, 2).toUpperCase()}
                            </span>
                            <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                              {item.author_name}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {/* Resolved Checkbox */}
                            {!isViewer && (
                              <button
                                type="button"
                                title={
                                  item.is_resolved
                                    ? "Mark as unresolved"
                                    : "Mark as resolved"
                                }
                                onClick={() => handleToggleResolved(item)}
                                className={`rounded p-1 transition-colors ${
                                  item.is_resolved
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                                }`}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              </button>
                            )}

                            {/* Delete Button */}
                            {!isViewer && (
                              <button
                                type="button"
                                title="Delete retro note"
                                onClick={() => handleDeleteItem(item.id)}
                                className="rounded p-1 text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-rose-500/10 hover:text-rose-500"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Note Content */}
                        <p
                          className={`mt-2.5 text-xs leading-relaxed ${
                            item.is_resolved
                              ? "line-through text-zinc-400 dark:text-zinc-500"
                              : "text-zinc-800 dark:text-zinc-200"
                          }`}
                        >
                          {item.content}
                        </p>

                        {/* Linked to Card Badge */}
                        {item.linked_card_id && (
                          <div className="mt-2.5 flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedCardId(item.linked_card_id)}
                              className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-500/20 dark:border-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-300"
                            >
                              <span>✅ Linked to Card</span>
                              <ExternalLink className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        )}

                        {/* Footer Actions: Upvote Button & Convert to Kanban Card */}
                        <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-2.5 dark:border-zinc-800/70">
                          {/* Upvote Button with Live Count */}
                          <button
                            type="button"
                            onClick={() => handleVote(item)}
                            title={hasVoted ? "Remove your upvote" : "Upvote this note"}
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-semibold transition-all ${
                              hasVoted
                                ? "border-indigo-500/40 bg-indigo-500/15 text-indigo-700 shadow-2xs dark:border-indigo-500/30 dark:bg-indigo-500/25 dark:text-indigo-300"
                                : "border-zinc-200/80 bg-zinc-50 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                            }`}
                          >
                            <ThumbsUp
                              className={`h-3 w-3 ${hasVoted ? "fill-current" : ""}`}
                            />
                            <span className="font-mono text-[11px]">{item.votes}</span>
                          </button>

                          {/* 1-Click "Convert to Card" Button */}
                          {!item.linked_card_id && !isViewer && (
                            <button
                              type="button"
                              disabled={isConverting}
                              onClick={() => handleConvertToCard(item)}
                              title="Create a real Kanban task card from this retrospective note"
                              className="inline-flex items-center gap-1 rounded-lg border border-zinc-200/80 bg-zinc-50 px-2.5 py-1 text-[11px] font-semibold text-zinc-700 shadow-2xs transition-colors hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-indigo-500/40 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300"
                            >
                              <span>📌</span>
                              <span>Convert to Card</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
