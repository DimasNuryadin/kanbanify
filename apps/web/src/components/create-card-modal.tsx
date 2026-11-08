"use client";

import React, { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { CreateCardRequest, Priority } from "@kinetix/contracts";
import { useWorkspaceStore } from "@/store/workspace-store";
import { comparePositions, generatePositionBetween } from "@/lib/fractional-index";

interface CreateCardModalProps {
  onCreateCard: (payload: CreateCardRequest) => Promise<void>;
}

export function CreateCardModal({ onCreateCard }: CreateCardModalProps) {
  const isOpen = useWorkspaceStore((s) => s.isCreateCardModalOpen);
  const defaultColumnId = useWorkspaceStore((s) => s.createCardDefaultColumnId);
  const closeCreateCardModal = useWorkspaceStore((s) => s.closeCreateCardModal);
  const board = useWorkspaceStore((s) => s.board);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [columnId, setColumnId] = useState("");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [storyPoints, setStoryPoints] = useState<string>("3");
  const [tagsInput, setTagsInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTitle("");
      setDescription("");
      setPriority("MEDIUM");
      setStoryPoints("3");
      setTagsInput("");
      const firstColId = board.columns[0]?.id ?? "";
      setColumnId(defaultColumnId || firstColId);
    }
  }, [isOpen, defaultColumnId, board.columns]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle || !columnId || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const colCards = board.cards
        .filter((c) => c.column_id === columnId)
        .sort((a, b) => comparePositions(a.position, b.position));
      const lastPos =
        colCards.length > 0 ? colCards[colCards.length - 1].position : undefined;
      const position = generatePositionBetween(lastPos, undefined);

      const tags = tagsInput
        .split(",")
        .map((t) => t.trim().toLowerCase().replace(/^#/, ""))
        .filter(Boolean);

      await onCreateCard({
        column_id: columnId,
        title: trimmedTitle,
        description: description.trim(),
        position,
        priority,
        story_points: storyPoints ? Number(storyPoints) : null,
        tags,
        subtasks: [],
        blocked_by_card_ids: [],
        due_date: null,
      });

      closeCreateCardModal();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        onClick={closeCreateCardModal}
        className="fixed inset-0 bg-zinc-950/50 backdrop-blur-xs"
      />

      <form
        onSubmit={handleSubmit}
        className="relative z-10 w-full max-w-lg rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Create New Issue
          </h3>
          <button
            type="button"
            onClick={closeCreateCardModal}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3.5">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Issue Title
            </label>
            <input
              type="text"
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Implement zero-downtime WebSocket reconnection..."
              className="w-full rounded-xl border border-zinc-200/80 bg-zinc-50 px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe context, technical scope, or acceptance criteria..."
              className="w-full resize-none rounded-xl border border-zinc-200/80 bg-zinc-50 px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Column
              </label>
              <select
                value={columnId}
                onChange={(e) => setColumnId(e.target.value)}
                className="w-full rounded-xl border border-zinc-200/80 bg-zinc-50 px-2.5 py-2 text-xs text-zinc-900 focus:border-indigo-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              >
                {board.columns.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="w-full rounded-xl border border-zinc-200/80 bg-zinc-50 px-2.5 py-2 text-xs text-zinc-900 focus:border-indigo-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Story Points
              </label>
              <select
                value={storyPoints}
                onChange={(e) => setStoryPoints(e.target.value)}
                className="w-full rounded-xl border border-zinc-200/80 bg-zinc-50 px-2.5 py-2 font-mono text-xs text-zinc-900 focus:border-indigo-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              >
                <option value="">None</option>
                <option value="1">1 pt</option>
                <option value="2">2 pts</option>
                <option value="3">3 pts</option>
                <option value="5">5 pts</option>
                <option value="8">8 pts</option>
                <option value="13">13 pts</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g., frontend, perf, api"
              className="w-full rounded-xl border border-zinc-200/80 bg-zinc-50 px-3 py-2 font-mono text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={closeCreateCardModal}
            className="rounded-xl border border-zinc-200/80 px-3.5 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
          >
            <Plus className="h-3.5 w-3.5" />
            {isSubmitting ? "Creating..." : "Create Issue"}
          </button>
        </div>
      </form>
    </div>
  );
}
