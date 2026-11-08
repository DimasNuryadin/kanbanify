"use client";

import React, { useState } from "react";
import {
  AlertOctagon,
  Calendar,
  Check,
  CheckCircle2,
  Circle,
  Hash,
  Layers,
  Link2,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Card, Priority, Subtask, UpdateCardRequest } from "@kinetix/contracts";
import { PRIORITY_STYLES } from "./kanban-board";
import { useWorkspaceStore } from "@/store/workspace-store";
import { comparePositions, generatePositionBetween } from "@/lib/fractional-index";
import { createDeterministicUuid } from "@/lib/mock-data";

interface CardDetailDrawerProps {
  onUpdateCard: (cardId: string, payload: UpdateCardRequest) => Promise<void>;
  onAiDecompose: (cardId: string) => Promise<void>;
}

const STORY_POINT_OPTIONS = [1, 2, 3, 5, 8, 13, 21];

export function CardDetailDrawer({
  onUpdateCard,
  onAiDecompose,
}: CardDetailDrawerProps) {
  const board = useWorkspaceStore((s) => s.board);
  const selectedCardId = useWorkspaceStore((s) => s.selectedCardId);
  const setSelectedCardId = useWorkspaceStore((s) => s.setSelectedCardId);

  const [isDecomposing, setIsDecomposing] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [newTagInput, setNewTagInput] = useState("");

  const card: Card | null =
    board.cards.find((c) => c.id === selectedCardId) ?? null;

  if (!card) return null;

  const isBlocked = card.blocked_by_card_ids.length > 0;
  const blockingCards = board.cards.filter((c) =>
    card.blocked_by_card_ids.includes(c.id)
  );
  const otherCards = board.cards.filter((c) => c.id !== card.id);

  const sortedSubtasks = [...card.subtasks].sort((a, b) =>
    comparePositions(a.position, b.position)
  );
  const completedCount = sortedSubtasks.filter((s) => s.is_completed).length;
  const totalCount = sortedSubtasks.length;
  const progressPercent =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const handleToggleSubtask = async (subtaskId: string) => {
    const nextSubtasks = sortedSubtasks.map((s) =>
      s.id === subtaskId ? { ...s, is_completed: !s.is_completed } : s
    );
    await onUpdateCard(card.id, { subtasks: nextSubtasks });
  };

  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newSubtaskTitle.trim();
    if (!trimmed) return;
    const lastPos =
      sortedSubtasks.length > 0
        ? sortedSubtasks[sortedSubtasks.length - 1].position
        : undefined;
    const newSubtask: Subtask = {
      id: createDeterministicUuid(),
      title: trimmed,
      is_completed: false,
      position: generatePositionBetween(lastPos, undefined),
    };
    setNewSubtaskTitle("");
    await onUpdateCard(card.id, {
      subtasks: [...sortedSubtasks, newSubtask],
    });
  };

  const handleDeleteSubtask = async (subtaskId: string) => {
    const nextSubtasks = sortedSubtasks.filter((s) => s.id !== subtaskId);
    await onUpdateCard(card.id, { subtasks: nextSubtasks });
  };

  const handleTriggerAiDecompose = async () => {
    if (isDecomposing) return;
    setIsDecomposing(true);
    try {
      await onAiDecompose(card.id);
    } finally {
      setIsDecomposing(false);
    }
  };

  const handleToggleBlocker = async (blockerCardId: string) => {
    const exists = card.blocked_by_card_ids.includes(blockerCardId);
    const nextIds = exists
      ? card.blocked_by_card_ids.filter((id) => id !== blockerCardId)
      : [...card.blocked_by_card_ids, blockerCardId];
    await onUpdateCard(card.id, { blocked_by_card_ids: nextIds });
  };

  const handleAddTag = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newTagInput
      .trim()
      .toLowerCase()
      .replace(/^#/, "")
      .replace(/\s+/g, "-");
    if (!cleaned || card.tags.includes(cleaned)) {
      setNewTagInput("");
      return;
    }
    setNewTagInput("");
    await onUpdateCard(card.id, { tags: [...card.tags, cleaned] });
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    await onUpdateCard(card.id, {
      tags: card.tags.filter((t) => t !== tagToRemove),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        onClick={() => setSelectedCardId(null)}
        className="fixed inset-0 bg-zinc-950/40 backdrop-blur-xs transition-opacity"
      />

      {/* Slide-over Panel */}
      <aside className="relative z-10 flex h-full w-full max-w-xl flex-col border-l border-zinc-200/80 bg-white shadow-2xl dark:border-zinc-800/80 dark:bg-zinc-950">
        {/* Top Bar */}
        <div className="flex items-center justify-between border-b border-zinc-200/80 px-6 py-4 dark:border-zinc-800/80">
          <div className="flex items-center gap-2">
            <span className="rounded border border-zinc-200/80 bg-zinc-50 px-2 py-0.5 font-mono text-[11px] text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
              pos: {card.position}
            </span>
            <span className="font-mono text-[11px] text-zinc-400">
              #{card.id.slice(0, 8)}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setSelectedCardId(null)}
            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {/* Blocker Radar Alert Banner */}
          {isBlocked && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3.5 text-xs text-red-700 dark:bg-red-500/15 dark:text-red-300">
              <div className="flex items-center gap-2 font-semibold">
                <AlertOctagon className="h-4 w-4 shrink-0 text-red-500" />
                <span>
                  Blocker Radar Active — Blocked by {blockingCards.length}{" "}
                  upstream issue(s)
                </span>
              </div>
              <ul className="mt-2 space-y-1 pl-6 list-disc">
                {blockingCards.map((b) => (
                  <li key={b.id} className="font-medium">
                    {b.title}{" "}
                    <span className="font-mono text-[10px] opacity-80">
                      (pos: {b.position})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Title & Description */}
          <div>
            <input
              type="text"
              value={card.title}
              onChange={(e) =>
                onUpdateCard(card.id, { title: e.target.value })
              }
              className="w-full bg-transparent text-lg font-semibold tracking-tight text-zinc-900 focus:outline-none dark:text-zinc-100"
            />
            <textarea
              rows={3}
              value={card.description}
              onChange={(e) =>
                onUpdateCard(card.id, { description: e.target.value })
              }
              placeholder="Add technical specification or acceptance criteria..."
              className="mt-2 w-full resize-none rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-3 text-xs leading-relaxed text-zinc-700 placeholder:text-zinc-400 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-zinc-800/80 dark:bg-zinc-900/70 dark:text-zinc-300 dark:focus:border-indigo-400 dark:focus:bg-zinc-900"
            />
          </div>

          {/* Metadata Controls Grid */}
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-3.5 sm:grid-cols-3 dark:border-zinc-800/80 dark:bg-zinc-900/50">
            {/* Priority */}
            <div>
              <label className="mb-1 block text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">
                Priority
              </label>
              <select
                value={card.priority}
                onChange={(e) =>
                  onUpdateCard(card.id, {
                    priority: e.target.value as Priority,
                  })
                }
                className="w-full rounded-lg border border-zinc-200/80 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-800 focus:border-indigo-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
              >
                {(Object.keys(PRIORITY_STYLES) as Priority[]).map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_STYLES[p].label}
                  </option>
                ))}
              </select>
            </div>

            {/* Story Points */}
            <div>
              <label className="mb-1 block text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">
                Story Points
              </label>
              <select
                value={card.story_points ?? ""}
                onChange={(e) =>
                  onUpdateCard(card.id, {
                    story_points:
                      e.target.value === "" ? null : Number(e.target.value),
                  })
                }
                className="w-full rounded-lg border border-zinc-200/80 bg-white px-2.5 py-1.5 font-mono text-xs font-medium text-zinc-800 focus:border-indigo-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
              >
                <option value="">Unestimated</option>
                {STORY_POINT_OPTIONS.map((pts) => (
                  <option key={pts} value={pts}>
                    {pts} pts
                  </option>
                ))}
              </select>
            </div>

            {/* Due Date */}
            <div className="col-span-2 sm:col-span-1">
              <label className="mb-1 flex items-center gap-1 text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">
                <Calendar className="h-3 w-3" />
                Due Date
              </label>
              <input
                type="date"
                value={
                  card.due_date
                    ? new Date(card.due_date).toISOString().split("T")[0]
                    : ""
                }
                onChange={(e) =>
                  onUpdateCard(card.id, {
                    due_date: e.target.value
                      ? new Date(e.target.value).toISOString()
                      : null,
                  })
                }
                className="w-full rounded-lg border border-zinc-200/80 bg-white px-2.5 py-1 font-mono text-xs text-zinc-800 focus:border-indigo-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
              />
            </div>
          </div>

          {/* Prominent ✨ AI Decompose Task Section */}
          <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/10 via-violet-500/5 to-transparent p-4 dark:border-indigo-400/25 dark:from-indigo-500/15 dark:via-violet-500/10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="flex items-center gap-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  <Sparkles className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />
                  Kinetix AI Task Decomposer
                </h4>
                <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                  Synthesize actionable engineering subtasks, story points, and
                  priority automatically.
                </p>
              </div>

              <button
                type="button"
                disabled={isDecomposing}
                onClick={handleTriggerAiDecompose}
                className={`relative overflow-hidden rounded-xl px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all duration-150 ${
                  isDecomposing
                    ? "cursor-wait bg-indigo-600/80"
                    : "bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 active:scale-[0.99]"
                }`}
              >
                <span className="relative z-10 flex items-center gap-1.5">
                  <Sparkles
                    className={`h-3.5 w-3.5 ${
                      isDecomposing ? "animate-spin" : ""
                    }`}
                  />
                  {isDecomposing
                    ? "Synthesizing Subtasks..."
                    : "✨ AI Decompose Task"}
                </span>
              </button>
            </div>

            {isDecomposing && (
              <div className="mt-3 space-y-2">
                <div className="h-7 w-full animate-pulse rounded-lg bg-indigo-500/20 dark:bg-indigo-400/20" />
                <div className="h-7 w-4/5 animate-pulse rounded-lg bg-indigo-500/15 dark:bg-indigo-400/15" />
                <div className="h-7 w-3/5 animate-pulse rounded-lg bg-indigo-500/10 dark:bg-indigo-400/10" />
              </div>
            )}
          </div>

          {/* Interactive Subtasks Checklist + Progress Bar */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="flex items-center gap-1.5 text-xs font-semibold tracking-tight text-zinc-900 uppercase dark:text-zinc-100">
                <Layers className="h-3.5 w-3.5 text-indigo-500" />
                Subtasks Checklist
              </h4>
              <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
                {completedCount}/{totalCount} completed ({progressPercent}%)
              </span>
            </div>

            {/* Progress Bar */}
            <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Subtask Items */}
            <div className="space-y-1.5">
              {sortedSubtasks.map((sub) => (
                <div
                  key={sub.id}
                  className="group flex items-center justify-between gap-2 rounded-xl border border-zinc-200/70 bg-zinc-50/60 px-3 py-2 text-xs transition-colors hover:border-zinc-300 dark:border-zinc-800/70 dark:bg-zinc-900/60 dark:hover:border-zinc-700"
                >
                  <button
                    type="button"
                    onClick={() => handleToggleSubtask(sub.id)}
                    className="flex flex-1 items-center gap-2.5 text-left"
                  >
                    {sub.is_completed ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                    ) : (
                      <Circle className="h-4 w-4 shrink-0 text-zinc-400" />
                    )}
                    <span
                      className={
                        sub.is_completed
                          ? "line-through text-zinc-400 dark:text-zinc-500"
                          : "text-zinc-800 dark:text-zinc-200"
                      }
                    >
                      {sub.title}
                    </span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    <code className="font-mono text-[10px] text-zinc-400">
                      {sub.position}
                    </code>
                    <button
                      type="button"
                      onClick={() => handleDeleteSubtask(sub.id)}
                      className="rounded p-1 text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add New Subtask Input */}
            <form onSubmit={handleAddSubtask} className="mt-2.5 flex gap-2">
              <input
                type="text"
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                placeholder="Add a subtask step..."
                className="flex-1 rounded-xl border border-zinc-200/80 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1 rounded-xl border border-zinc-200/80 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </button>
            </form>
          </div>

          {/* Tags Manager */}
          <div>
            <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-tight text-zinc-900 uppercase dark:text-zinc-100">
              <Hash className="h-3.5 w-3.5 text-zinc-400" />
              Tags
            </h4>
            <div className="flex flex-wrap items-center gap-1.5">
              {card.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-lg border border-zinc-200/80 bg-zinc-100 px-2 py-1 font-mono text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <form onSubmit={handleAddTag} className="inline-flex">
                <input
                  type="text"
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  placeholder="+ add tag..."
                  className="w-28 rounded-lg border border-dashed border-zinc-300 bg-transparent px-2 py-1 font-mono text-xs text-zinc-700 placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:text-zinc-300"
                />
              </form>
            </div>
          </div>

          {/* Blocker Radar Dependency Linker */}
          <div>
            <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold tracking-tight text-zinc-900 uppercase dark:text-zinc-100">
              <Link2 className="h-3.5 w-3.5 text-red-500" />
              Blocker Radar (Upstream Dependencies)
            </h4>
            <p className="mb-2.5 text-[11px] text-zinc-500 dark:text-zinc-400">
              Select issues that block this card (`blocked_by_card_ids`).
            </p>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-2 dark:border-zinc-800/80 dark:bg-zinc-900/40">
              {otherCards.map((other) => {
                const isSelected = card.blocked_by_card_ids.includes(other.id);
                return (
                  <button
                    key={other.id}
                    type="button"
                    onClick={() => handleToggleBlocker(other.id)}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors ${
                      isSelected
                        ? "bg-red-500/10 font-medium text-red-700 dark:bg-red-500/20 dark:text-red-300"
                        : "text-zinc-600 hover:bg-zinc-200/50 dark:text-zinc-400 dark:hover:bg-zinc-800/60"
                    }`}
                  >
                    <span className="truncate">{other.title}</span>
                    {isSelected && (
                      <span className="inline-flex items-center gap-1 font-mono text-[10px] text-red-600 dark:text-red-400">
                        <Check className="h-3 w-3" />
                        Blocking
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
