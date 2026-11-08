"use client";

import React, { useState } from "react";
import { Check, LayoutTemplate, Palette, Sparkles, X } from "lucide-react";
import { BoardBackground, BoardTemplate, CreateBoardRequest } from "@kinetix/contracts";
import { useWorkspaceStore } from "@/store/workspace-store";
import {
  CURATED_BOARD_BACKGROUNDS,
  CuratedBackgroundOption,
} from "@/lib/trello-theme";

interface CreateBoardModalProps {
  templates: BoardTemplate[];
  onCreateBoard: (payload: CreateBoardRequest) => Promise<void>;
}

export function CreateBoardModal({
  templates,
  onCreateBoard,
}: CreateBoardModalProps) {
  const isOpen = useWorkspaceStore((s) => s.isCreateBoardModalOpen);
  const setOpen = useWorkspaceStore((s) => s.setCreateBoardModalOpen);
  const currentWorkspaceId = useWorkspaceStore((s) => s.currentWorkspaceId);

  const [title, setTitle] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedBackground, setSelectedBackground] = useState<BoardBackground>({
    type: "gradient",
    value: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #311042 100%)",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSelectTemplate = (tmpl: BoardTemplate | null) => {
    if (!tmpl) {
      setSelectedTemplateId(null);
      return;
    }
    setSelectedTemplateId(tmpl.id);
    if (!title) {
      setTitle(tmpl.name);
    }
    if (tmpl.background) {
      setSelectedBackground(tmpl.background);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await onCreateBoard({
        workspace_id: currentWorkspaceId,
        title: trimmed,
        description: "",
        is_starred: false,
        background: selectedBackground,
        template_id: selectedTemplateId ?? undefined,
      });
      setTitle("");
      setSelectedTemplateId(null);
      setOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in-0">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
        {/* Preview Banner */}
        <div
          className="relative flex h-28 w-full items-center justify-center p-4 transition-all"
          style={
            selectedBackground.type === "gradient"
              ? { background: selectedBackground.value }
              : { backgroundColor: selectedBackground.value }
          }
        >
          <div className="rounded-lg bg-black/40 px-3 py-1.5 backdrop-blur-md">
            <p className="text-center text-xs font-semibold text-white">
              {title.trim() || "Board Preview"}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute top-3 right-3 rounded-full bg-black/40 p-1 text-white/80 transition-colors hover:bg-black/60 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          {/* Title Input */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Board Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q1 Growth Sprint, Core Infrastructure..."
              className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>

          {/* Quick Template Picker */}
          <div>
            <label className="flex items-center justify-between text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              <span>Start from Template (Optional)</span>
              {selectedTemplateId && (
                <button
                  type="button"
                  onClick={() => handleSelectTemplate(null)}
                  className="text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                >
                  Clear
                </button>
              )}
            </label>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              {templates.map((tmpl) => {
                const isSelected = selectedTemplateId === tmpl.id;
                return (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => handleSelectTemplate(tmpl)}
                    className={`flex items-center gap-2 rounded-lg border p-2 text-left text-xs transition-all ${
                      isSelected
                        ? "border-indigo-500 bg-indigo-50/80 font-medium text-indigo-900 dark:border-indigo-400 dark:bg-indigo-950/40 dark:text-indigo-200"
                        : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700 text-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    <LayoutTemplate className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
                    <span className="truncate">{tmpl.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Background Presets */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Pick Background Style
            </label>
            <div className="mt-1.5 grid grid-cols-5 gap-2">
              {CURATED_BOARD_BACKGROUNDS.slice(0, 10).map((preset: CuratedBackgroundOption) => {
                const isSelected = selectedBackground.value === preset.background.value;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() =>
                      setSelectedBackground(preset.background)
                    }
                    title={preset.name}
                    className={`relative flex h-8 w-full items-center justify-center rounded-lg border transition-all ${
                      isSelected
                        ? "border-white ring-2 ring-indigo-500 shadow-sm"
                        : "border-transparent opacity-80 hover:opacity-100"
                    }`}
                    style={
                      preset.background.type === "gradient"
                        ? { background: preset.background.value }
                        : { backgroundColor: preset.background.value }
                    }
                  >
                    {isSelected && <Check className="h-4 w-4 text-white drop-shadow" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || isSubmitting}
              className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>{isSubmitting ? "Creating..." : "Create Board"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
