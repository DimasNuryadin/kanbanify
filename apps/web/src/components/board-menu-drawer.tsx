"use client";

import React, { useState } from "react";
import {
  Activity as ActivityIcon,
  Bell,
  Check,
  FileText,
  Palette,
  Plus,
  Sparkles,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import {
  Label,
  LabelColor,
  LabelColorEnum,
  UpdateBoardRequest,
} from "@kinetix/contracts";
import { useWorkspaceStore } from "@/store/workspace-store";
import {
  CURATED_BOARD_BACKGROUNDS,
  LABEL_COLOR_MAP,
} from "@/lib/trello-theme";
import { createDeterministicUuid } from "@/lib/mock-data";

interface BoardMenuDrawerProps {
  onUpdateBoard: (payload: UpdateBoardRequest) => Promise<void>;
}

const ALL_LABEL_COLORS = LabelColorEnum.options;

export function BoardMenuDrawer({ onUpdateBoard }: BoardMenuDrawerProps) {
  const isOpen = useWorkspaceStore((s) => s.isBoardMenuOpen);
  const setOpen = useWorkspaceStore((s) => s.setBoardMenuOpen);
  const board = useWorkspaceStore((s) => s.board);
  const setSelectedCardId = useWorkspaceStore((s) => s.setSelectedCardId);
  const setWebhooksModalOpen = useWorkspaceStore((s) => s.setWebhooksModalOpen);

  const [section, setSection] = useState<
    "background" | "labels" | "about" | "activity"
  >("background");
  const [descDraft, setDescDraft] = useState(board.description);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState<LabelColor>("blue");

  if (!isOpen) return null;

  const gradients = CURATED_BOARD_BACKGROUNDS.filter(
    (b) => b.category === "gradient"
  );
  const solids = CURATED_BOARD_BACKGROUNDS.filter(
    (b) => b.category === "solid"
  );

  const handleCreateLabel = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newLabelName.trim();
    if (!trimmed) return;
    const nextLabel: Label = {
      id: createDeterministicUuid(),
      board_id: board.id,
      name: trimmed,
      color: newLabelColor,
    };
    setNewLabelName("");
    await onUpdateBoard({
      labels: [...board.labels, nextLabel],
    });
  };

  const handleRenameLabel = async (labelId: string, name: string) => {
    const nextLabels = board.labels.map((l) =>
      l.id === labelId ? { ...l, name } : l
    );
    await onUpdateBoard({ labels: nextLabels });
  };

  const handleDeleteLabel = async (labelId: string) => {
    const nextLabels = board.labels.filter((l) => l.id !== labelId);
    await onUpdateBoard({ labels: nextLabels });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        onClick={() => setOpen(false)}
        className="fixed inset-0 bg-zinc-950/40 backdrop-blur-xs transition-opacity"
      />

      <aside className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-zinc-200/80 bg-white shadow-2xl dark:border-zinc-800/80 dark:bg-zinc-950">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200/80 px-5 py-4 dark:border-zinc-800/80">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-indigo-500" />
            <h3 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              Board Menu & Customization
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-4 gap-1 border-b border-zinc-200/80 bg-zinc-50/70 p-2 dark:border-zinc-800/80 dark:bg-zinc-900/60">
          <button
            type="button"
            onClick={() => setSection("background")}
            className={`flex flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-medium transition-all ${
              section === "background"
                ? "bg-white text-indigo-600 shadow-xs dark:bg-zinc-800 dark:text-indigo-400"
                : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            <Palette className="h-3.5 w-3.5" />
            <span>Background</span>
          </button>

          <button
            type="button"
            onClick={() => setSection("labels")}
            className={`flex flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-medium transition-all ${
              section === "labels"
                ? "bg-white text-indigo-600 shadow-xs dark:bg-zinc-800 dark:text-indigo-400"
                : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            <Tag className="h-3.5 w-3.5" />
            <span>Labels</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setDescDraft(board.description);
              setSection("about");
            }}
            className={`flex flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-medium transition-all ${
              section === "about"
                ? "bg-white text-indigo-600 shadow-xs dark:bg-zinc-800 dark:text-indigo-400"
                : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>About</span>
          </button>

          <button
            type="button"
            onClick={() => setSection("activity")}
            className={`flex flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-medium transition-all ${
              section === "activity"
                ? "bg-white text-indigo-600 shadow-xs dark:bg-zinc-800 dark:text-indigo-400"
                : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            <ActivityIcon className="h-3.5 w-3.5" />
            <span>Activity</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {section === "background" && (
            <div className="space-y-6">
              {/* 6 Curated Gradients */}
              <div>
                <div className="mb-2.5 flex items-center justify-between">
                  <h4 className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-zinc-700 uppercase dark:text-zinc-300">
                    <Sparkles className="h-3.5 w-3.5 text-indigo-500" />6
                    Curated Gradients
                  </h4>
                  <span className="text-[11px] text-zinc-400">
                    Cinema Atmosphere
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {gradients.map((opt) => {
                    const isSelected =
                      board.background.type === opt.background.type &&
                      board.background.value === opt.background.value;

                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          onUpdateBoard({ background: opt.background })
                        }
                        className={`group relative flex h-20 flex-col justify-end overflow-hidden rounded-xl border p-2.5 text-left transition-all ${
                          isSelected
                            ? "border-indigo-500 ring-2 ring-indigo-500/30"
                            : "border-zinc-200/80 hover:border-zinc-400 dark:border-zinc-800"
                        }`}
                        style={{ background: opt.previewStyle }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="rounded bg-black/45 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-xs">
                            {opt.name}
                          </span>
                          {isSelected && (
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500 text-white shadow-sm">
                              <Check className="h-3 w-3" />
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 6 Solid Clean Surfaces */}
              <div>
                <div className="mb-2.5 flex items-center justify-between">
                  <h4 className="text-xs font-semibold tracking-wider text-zinc-700 uppercase dark:text-zinc-300">
                    6 Solid Clean Surfaces
                  </h4>
                  <span className="text-[11px] text-zinc-400">
                    Light / Dark Adaptive
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {solids.map((opt) => {
                    const isSelected =
                      board.background.type === opt.background.type &&
                      board.background.value === opt.background.value;

                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          onUpdateBoard({ background: opt.background })
                        }
                        className={`flex items-center justify-between rounded-xl border p-3 text-left transition-all ${
                          isSelected
                            ? "border-indigo-500 bg-indigo-500/5 ring-2 ring-indigo-500/20 dark:bg-indigo-500/10"
                            : "border-zinc-200/80 bg-zinc-50/70 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/60"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className="h-6 w-6 rounded-lg border border-black/10 shadow-2xs"
                            style={{ background: opt.previewStyle }}
                          />
                          <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
                            {opt.name}
                          </span>
                        </div>
                        {isSelected && (
                          <Check className="h-4 w-4 text-indigo-500" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {section === "labels" && (
            <div className="space-y-5">
              <div>
                <h4 className="mb-2 text-xs font-semibold tracking-wider text-zinc-700 uppercase dark:text-zinc-300">
                  Board Color Labels ({board.labels.length})
                </h4>
                <div className="space-y-2">
                  {board.labels.map((lbl) => {
                    const style = LABEL_COLOR_MAP[lbl.color];
                    return (
                      <div
                        key={lbl.id}
                        className="flex items-center gap-2 rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-2 dark:border-zinc-800 dark:bg-zinc-900/60"
                      >
                        <span
                          className="h-6 w-8 shrink-0 rounded-md"
                          style={{ backgroundColor: style.swatch }}
                        />
                        <input
                          type="text"
                          value={lbl.name}
                          onChange={(e) =>
                            handleRenameLabel(lbl.id, e.target.value)
                          }
                          placeholder={style.name}
                          className="flex-1 rounded-lg bg-transparent px-2 py-1 text-xs font-medium text-zinc-800 focus:bg-white focus:outline-none dark:text-zinc-100 dark:focus:bg-zinc-800"
                        />
                        <button
                          type="button"
                          onClick={() => handleDeleteLabel(lbl.id)}
                          title="Delete label"
                          className="rounded p-1 text-zinc-400 hover:bg-rose-500/10 hover:text-rose-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <form
                onSubmit={handleCreateLabel}
                className="space-y-3 rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-3.5 dark:border-zinc-800 dark:bg-zinc-900/50"
              >
                <h5 className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  Create New Label
                </h5>
                <input
                  type="text"
                  value={newLabelName}
                  onChange={(e) => setNewLabelName(e.target.value)}
                  placeholder="Label name (e.g. Design Review)..."
                  className="w-full rounded-lg border border-zinc-200/80 bg-white px-3 py-1.5 text-xs text-zinc-900 focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
                <div className="flex flex-wrap gap-1.5">
                  {ALL_LABEL_COLORS.map((color) => {
                    const style = LABEL_COLOR_MAP[color];
                    const active = newLabelColor === color;
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setNewLabelColor(color)}
                        className={`flex h-6 w-8 items-center justify-center rounded-md transition-transform ${
                          active ? "scale-110 ring-2 ring-indigo-500" : ""
                        }`}
                        style={{ backgroundColor: style.swatch }}
                        title={style.name}
                      >
                        {active && <Check className="h-3 w-3 text-white" />}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-zinc-900 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create Label
                </button>
              </form>
            </div>
          )}

          {section === "about" && (
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold tracking-wider text-zinc-700 uppercase dark:text-zinc-300">
                  Board Description
                </label>
                <textarea
                  rows={4}
                  value={descDraft}
                  onChange={(e) => setDescDraft(e.target.value)}
                  placeholder="Describe what this board is for and team conventions..."
                  className="w-full rounded-xl border border-zinc-200/80 bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-800 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                />
                <button
                  type="button"
                  onClick={() => onUpdateBoard({ description: descDraft })}
                  className="mt-2 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
                >
                  Save Description
                </button>
              </div>

              <div className="border-t border-zinc-200/80 pt-4 dark:border-zinc-800">
                <h4 className="mb-2.5 text-xs font-semibold tracking-wider text-zinc-700 uppercase dark:text-zinc-300">
                  Workspace Members ({board.members.length})
                </h4>
                <div className="space-y-2">
                  {board.members.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center gap-2.5 rounded-xl border border-zinc-200/70 bg-zinc-50/50 p-2.5 dark:border-zinc-800/70 dark:bg-zinc-900/50"
                    >
                      <span
                        className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white"
                        style={{ backgroundColor: m.color }}
                      >
                        {m.initials}
                      </span>
                      <div>
                        <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                          {m.name}
                        </p>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          {m.email}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-zinc-200/80 pt-4 dark:border-zinc-800">
                <h4 className="mb-2.5 text-xs font-semibold tracking-wider text-zinc-700 uppercase dark:text-zinc-300">
                  Integrations
                </h4>
                <button
                  type="button"
                  onClick={() => {
                    setWebhooksModalOpen(true);
                    setOpen(false);
                  }}
                  className="flex w-full items-center justify-between rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-3 text-left transition hover:border-indigo-400 dark:border-zinc-800 dark:bg-zinc-900/60"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                      <Bell className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                        Slack & Discord Webhooks
                      </p>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        Live board activity notifications & AI digest
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-indigo-500">
                    Open →
                  </span>
                </button>
              </div>
            </div>
          )}

          {section === "activity" && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold tracking-wider text-zinc-700 uppercase dark:text-zinc-300">
                Chronological Board Activity
              </h4>

              {board.activities.map((act) => (
                <div
                  key={act.id}
                  className="rounded-xl border border-zinc-200/70 bg-zinc-50/60 p-3 text-xs dark:border-zinc-800/70 dark:bg-zinc-900/50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {act.actor_name}
                    </span>
                    <span className="font-mono text-[10px] text-zinc-400">
                      {new Date(act.created_at).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="mt-1 text-zinc-600 dark:text-zinc-300">
                    {act.description}
                  </p>
                  {act.card_id && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCardId(act.card_id);
                        setOpen(false);
                      }}
                      className="mt-1.5 text-[11px] font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      Open card →
                    </button>
                  )}
                </div>
              ))}

              {board.activities.length === 0 && (
                <p className="py-8 text-center text-xs text-zinc-400">
                  No board activity recorded yet.
                </p>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
