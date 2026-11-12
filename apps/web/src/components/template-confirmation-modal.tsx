"use client";

import React, { useState } from "react";
import {
  Check,
  Globe,
  Layers,
  Lock,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import {
  BoardBackground,
  BoardTemplate,
  BoardVisibility,
  CreateBoardRequest,
} from "@kinetix/contracts";
import {
  CURATED_BOARD_BACKGROUNDS,
  CuratedBackgroundOption,
} from "@/lib/trello-theme";

interface TemplateConfirmationModalProps {
  template: BoardTemplate;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (payload: CreateBoardRequest) => Promise<void>;
}

const CURATED_8_SWATCHES = CURATED_BOARD_BACKGROUNDS.slice(0, 8);

export function TemplateConfirmationModal({
  template,
  isOpen,
  onClose,
  onConfirm,
}: TemplateConfirmationModalProps) {
  const [title, setTitle] = useState(template.name);
  const [visibility, setVisibility] = useState<BoardVisibility>("WORKSPACE");
  const [selectedBackground, setSelectedBackground] = useState<BoardBackground>(
    template.background || CURATED_8_SWATCHES[0].background
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await onConfirm({
        title: trimmed,
        description: template.description,
        is_starred: false,
        background: selectedBackground,
        template_id: template.id,
        visibility,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md animate-in fade-in-0 duration-200">
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Banner with Template Preview */}
        <div
          className="relative flex h-36 w-full flex-col justify-between p-4 transition-all duration-300"
          style={
            selectedBackground.type === "gradient"
              ? { background: selectedBackground.value }
              : selectedBackground.value.startsWith("#") ||
                selectedBackground.value.startsWith("rgb")
              ? { backgroundColor: selectedBackground.value }
              : { background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)" }
          }
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 rounded-lg bg-black/40 px-2.5 py-1 backdrop-blur-md border border-white/10">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              <span className="text-xs font-bold text-white tracking-wide">
                Create from Template
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-black/40 p-1.5 text-white/80 transition-colors hover:bg-black/60 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="rounded-lg bg-black/30 p-2 backdrop-blur-xs border border-white/10">
            <p className="truncate text-sm font-extrabold text-white drop-shadow-sm">
              {title.trim() || template.name}
            </p>
            <p className="text-[11px] text-white/80 line-clamp-1 mt-0.5">
              {template.description}
            </p>
          </div>
        </div>

        {/* Form Body */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-5 space-y-4 text-zinc-900 dark:text-zinc-100"
        >
          {/* Pre-populated Columns Pill List */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
              Starter Columns Included ({template.default_columns.length})
            </label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {template.default_columns.map((col, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-100/80 px-2.5 py-1 text-xs font-semibold text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                  {col}
                </span>
              ))}
            </div>
          </div>

          {/* Title Customization */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
              Board Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm font-medium text-zinc-900 placeholder-zinc-400 transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>

          {/* Visibility Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
              Visibility
            </label>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setVisibility("WORKSPACE")}
                className={`flex flex-col items-start p-2 rounded-xl border text-left transition-all ${
                  visibility === "WORKSPACE"
                    ? "border-indigo-600 bg-indigo-50/70 font-semibold text-indigo-950 dark:border-indigo-500 dark:bg-indigo-950/40 dark:text-indigo-200 ring-2 ring-indigo-500/20"
                    : "border-zinc-200 bg-zinc-50/50 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:bg-zinc-800/80"
                }`}
              >
                <div className="flex items-center gap-1 text-xs">
                  <Users className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                  <span>Workspace</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setVisibility("PRIVATE")}
                className={`flex flex-col items-start p-2 rounded-xl border text-left transition-all ${
                  visibility === "PRIVATE"
                    ? "border-indigo-600 bg-indigo-50/70 font-semibold text-indigo-950 dark:border-indigo-500 dark:bg-indigo-950/40 dark:text-indigo-200 ring-2 ring-indigo-500/20"
                    : "border-zinc-200 bg-zinc-50/50 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:bg-zinc-800/80"
                }`}
              >
                <div className="flex items-center gap-1 text-xs">
                  <Lock className="h-3 w-3 text-amber-500" />
                  <span>Private</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setVisibility("PUBLIC_READ")}
                className={`flex flex-col items-start p-2 rounded-xl border text-left transition-all ${
                  visibility === "PUBLIC_READ"
                    ? "border-indigo-600 bg-indigo-50/70 font-semibold text-indigo-950 dark:border-indigo-500 dark:bg-indigo-950/40 dark:text-indigo-200 ring-2 ring-indigo-500/20"
                    : "border-zinc-200 bg-zinc-50/50 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:bg-zinc-800/80"
                }`}
              >
                <div className="flex items-center gap-1 text-xs">
                  <Globe className="h-3 w-3 text-emerald-500" />
                  <span>Public Read</span>
                </div>
              </button>
            </div>
          </div>

          {/* Background Gradient & Color Swatches */}
          <div>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                Customize Background Style
              </label>
              <span className="text-[11px] text-zinc-400">
                {CURATED_8_SWATCHES.find((s) => s.background.value === selectedBackground.value)?.name || "Selected"}
              </span>
            </div>

            <div className="mt-2 grid grid-cols-4 sm:grid-cols-8 gap-2">
              {CURATED_8_SWATCHES.map((preset: CuratedBackgroundOption) => {
                const isSelected =
                  selectedBackground.value === preset.background.value;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setSelectedBackground(preset.background)}
                    title={preset.name}
                    className={`group relative flex h-10 w-full items-center justify-center rounded-xl border transition-all duration-150 ${
                      isSelected
                        ? "scale-105 border-white ring-2 ring-indigo-600 shadow-md ring-offset-2 ring-offset-white dark:ring-offset-zinc-950"
                        : "border-transparent opacity-80 hover:opacity-100 hover:scale-102"
                    }`}
                    style={
                      preset.background.type === "gradient"
                        ? { background: preset.background.value }
                        : preset.background.value.startsWith("#") ||
                          preset.background.value.startsWith("rgb")
                        ? { backgroundColor: preset.background.value }
                        : { background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)" }
                    }
                  >
                    {isSelected && (
                      <Check className="h-4 w-4 text-white drop-shadow-md stroke-[3]" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || isSubmitting}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-indigo-600/30 transition-all hover:bg-indigo-500 hover:shadow-indigo-600/50 disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              <span>{isSubmitting ? "Creating Board..." : "Use Template & Open"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
