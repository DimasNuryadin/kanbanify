"use client";

import React, { useEffect, useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { CreateCardRequest, Priority } from "@kinetix/contracts";
import { useWorkspaceStore } from "@/store/workspace-store";
import {
  comparePositions,
  generatePositionBetween,
} from "@/lib/fractional-index";
import { CARD_COVER_COLORS, LABEL_COLOR_MAP } from "@/lib/trello-theme";

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
  const [dueDate, setDueDate] = useState("");
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [coverColor, setCoverColor] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const visibleColumns = board.columns.filter((col) => !col.is_archived);

  useEffect(() => {
    if (isOpen) {
      setTitle("");
      setDescription("");
      setPriority("MEDIUM");
      setStoryPoints("3");
      setDueDate("");
      setSelectedLabelIds([]);
      setSelectedMemberIds([]);
      setCoverColor(null);
      const firstColId = visibleColumns[0]?.id ?? "";
      setColumnId(defaultColumnId || firstColId);
    }
  }, [isOpen, defaultColumnId, visibleColumns.length]);

  if (!isOpen) return null;

  const toggleLabel = (id: string) => {
    setSelectedLabelIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleMember = (id: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle || !columnId || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const colCards = board.cards
        .filter((c) => c.column_id === columnId && !c.is_archived)
        .sort((a, b) => comparePositions(a.position, b.position));
      const lastPos =
        colCards.length > 0 ? colCards[colCards.length - 1].position : undefined;
      const position = generatePositionBetween(lastPos, undefined);

      await onCreateCard({
        column_id: columnId,
        title: trimmedTitle,
        description: description.trim(),
        position,
        priority,
        story_points: storyPoints ? Number(storyPoints) : null,
        tags: [],
        subtasks: [],
        blocked_by_card_ids: [],
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        cover: coverColor
          ? { type: "color", value: coverColor, size: "normal" }
          : { type: "none", value: null, size: "normal" },
        label_ids: selectedLabelIds,
        member_ids: selectedMemberIds,
        checklists: [],
        comments: [],
        attachments: [],
        start_date: null,
        is_due_complete: false,
        is_archived: false,
        is_watching: false,
        custom_field_values: [],
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
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        {coverColor && (
          <div
            className="h-8 w-full transition-colors"
            style={{ backgroundColor: coverColor }}
          />
        )}

        <div className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              Create New Trello Card
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
                Card Title
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
                Description (Markdown supported)
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe context, technical scope, or acceptance criteria..."
                className="w-full resize-none rounded-xl border border-zinc-200/80 bg-zinc-50 px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  List
                </label>
                <select
                  value={columnId}
                  onChange={(e) => setColumnId(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200/80 bg-zinc-50 px-2.5 py-2 text-xs text-zinc-900 focus:border-indigo-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                >
                  {visibleColumns.map((col) => (
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
                  Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200/80 bg-zinc-50 px-2.5 py-1.5 font-mono text-xs text-zinc-900 focus:border-indigo-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </div>
            </div>

            {/* Color Labels */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Color Labels
              </label>
              <div className="flex flex-wrap gap-1.5">
                {board.labels.map((lbl) => {
                  const style = LABEL_COLOR_MAP[lbl.color];
                  const active = selectedLabelIds.includes(lbl.id);
                  return (
                    <button
                      key={lbl.id}
                      type="button"
                      onClick={() => toggleLabel(lbl.id)}
                      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition-all ${
                        active ? "ring-2 ring-indigo-500 " : "opacity-80 "
                      } ${style.pillBg} ${style.pillText}`}
                    >
                      <span className={`h-2 w-2 rounded-full ${style.dot}`} />
                      <span>{lbl.name || style.name}</span>
                      {active && <Check className="h-3 w-3" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Assign Members & Cover Color */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Assign Members
                </label>
                <div className="flex gap-1.5">
                  {board.members.map((m) => {
                    const active = selectedMemberIds.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => toggleMember(m.id)}
                        title={m.name}
                        className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white transition-transform ${
                          active
                            ? "scale-110 ring-2 ring-indigo-500"
                            : "opacity-75 hover:opacity-100"
                        }`}
                        style={{ backgroundColor: m.color }}
                      >
                        {m.initials}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Card Cover
                </label>
                <div className="flex flex-wrap items-center gap-1.5">
                  {CARD_COVER_COLORS.slice(0, 6).map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() =>
                        setCoverColor(coverColor === c.value ? null : c.value)
                      }
                      className={`h-5 w-5 rounded-full transition-transform ${
                        coverColor === c.value
                          ? "scale-110 ring-2 ring-indigo-500"
                          : ""
                      }`}
                      style={{ backgroundColor: c.value }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>
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
              {isSubmitting ? "Creating..." : "Create Card"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
