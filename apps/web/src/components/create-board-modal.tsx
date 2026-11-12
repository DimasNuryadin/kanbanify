"use client";

import React, { useState } from "react";
import {
  Check,
  Globe,
  LayoutTemplate,
  Lock,
  Palette,
  Shield,
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
import { useWorkspaceStore } from "@/store/workspace-store";
import {
  CURATED_BOARD_BACKGROUNDS,
  CuratedBackgroundOption,
} from "@/lib/trello-theme";

interface CreateBoardModalProps {
  templates?: BoardTemplate[];
  onCreateBoard: (payload: CreateBoardRequest) => Promise<void>;
  isOpen?: boolean;
  onClose?: () => void;
}

const STARTER_TEMPLATES: Array<{
  id: string;
  name: string;
  desc: string;
  columns: string[];
}> = [
  {
    id: "blank",
    name: "Blank Board",
    desc: "Start fresh with standard To Do, In Progress, Done",
    columns: ["To Do", "In Progress", "Done"],
  },
  {
    id: "kanban-default",
    name: "Kanban Default",
    desc: "Classic flow with Backlog, In Progress, Review, and Done",
    columns: ["Backlog", "In Progress", "Review", "Done"],
  },
  {
    id: "agile-sprint",
    name: "Agile Sprint",
    desc: "Sprint Ready, In Progress, Code Review, Done with story points",
    columns: ["Backlog", "Sprint Ready", "In Progress", "Code Review", "Done"],
  },
  {
    id: "bug-tracker",
    name: "Bug Tracker",
    desc: "Reported, Reproducing, Fixing, QA Verification, Resolved",
    columns: ["Reported", "Reproducing", "Fixing", "QA Verification", "Resolved"],
  },
];

const CURATED_8_SWATCHES = CURATED_BOARD_BACKGROUNDS.slice(0, 8);

export function CreateBoardModal({
  templates = [],
  onCreateBoard,
  isOpen: propIsOpen,
  onClose: propOnClose,
}: CreateBoardModalProps) {
  const storeIsOpen = useWorkspaceStore((s) => s.isCreateBoardModalOpen);
  const storeSetOpen = useWorkspaceStore((s) => s.setCreateBoardModalOpen);
  const currentWorkspaceId = useWorkspaceStore((s) => s.currentWorkspaceId);

  const isOpen = propIsOpen !== undefined ? propIsOpen : storeIsOpen;
  const handleClose = () => {
    if (propOnClose) {
      propOnClose();
    } else {
      storeSetOpen(false);
    }
  };

  const [title, setTitle] = useState("");
  const [visibility, setVisibility] = useState<BoardVisibility>("WORKSPACE");
  const [selectedStarterId, setSelectedStarterId] = useState<string>("agile-sprint");
  const [selectedBackground, setSelectedBackground] = useState<BoardBackground>(
    CURATED_8_SWATCHES[0]?.background || {
      type: "gradient",
      value: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #311042 100%)",
    }
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const currentTemplate =
    STARTER_TEMPLATES.find((t) => t.id === selectedStarterId) ||
    STARTER_TEMPLATES[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await onCreateBoard({
        workspace_id: currentWorkspaceId,
        title: trimmed,
        description: currentTemplate.desc,
        is_starred: false,
        background: selectedBackground,
        template_id: selectedStarterId,
        visibility,
      });
      setTitle("");
      handleClose();
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
        {/* Live Mini-Board Preview Banner */}
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
                Live Board Preview
              </span>
            </div>

            <button
              type="button"
              onClick={handleClose}
              className="rounded-full bg-black/40 p-1.5 text-white/80 transition-colors hover:bg-black/60 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Mini Kanban Columns Mockup in Preview */}
          <div className="flex items-end justify-between gap-2 overflow-hidden pt-2">
            <div className="min-w-0 flex-1 rounded-lg bg-black/30 p-2 backdrop-blur-xs border border-white/10">
              <p className="truncate text-sm font-extrabold text-white drop-shadow-sm">
                {title.trim() || "Untitled Workspace Board"}
              </p>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-medium text-white/90">
                  {visibility}
                </span>
                <span className="text-[10px] text-white/70 truncate">
                  {currentTemplate.columns.length} Starter Columns
                </span>
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 shrink-0 opacity-80">
              {currentTemplate.columns.slice(0, 3).map((col, idx) => (
                <div
                  key={idx}
                  className="w-16 rounded bg-white/15 p-1 border border-white/10"
                >
                  <p className="truncate text-[9px] font-semibold text-white/80">
                    {col}
                  </p>
                  <div className="mt-1 h-3 rounded bg-white/20" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-5 space-y-4 text-zinc-900 dark:text-zinc-100"
        >
          {/* Board Title Input */}
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
              placeholder="e.g., 🚀 Kanbanify Core Platform Sprint..."
              className="mt-1.5 w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm font-medium text-zinc-900 placeholder-zinc-400 transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>

          {/* Visibility Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
              Visibility & Permissions
            </label>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setVisibility("WORKSPACE")}
                className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all ${
                  visibility === "WORKSPACE"
                    ? "border-indigo-600 bg-indigo-50/70 font-semibold text-indigo-950 dark:border-indigo-500 dark:bg-indigo-950/40 dark:text-indigo-200 ring-2 ring-indigo-500/20"
                    : "border-zinc-200 bg-zinc-50/50 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:bg-zinc-800/80"
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs">
                  <Users className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Workspace</span>
                </div>
                <span className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400 leading-tight">
                  All workspace members can view & edit
                </span>
              </button>

              <button
                type="button"
                onClick={() => setVisibility("PRIVATE")}
                className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all ${
                  visibility === "PRIVATE"
                    ? "border-indigo-600 bg-indigo-50/70 font-semibold text-indigo-950 dark:border-indigo-500 dark:bg-indigo-950/40 dark:text-indigo-200 ring-2 ring-indigo-500/20"
                    : "border-zinc-200 bg-zinc-50/50 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:bg-zinc-800/80"
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs">
                  <Lock className="h-3.5 w-3.5 text-amber-500" />
                  <span>Private</span>
                </div>
                <span className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400 leading-tight">
                  Only invited board members can access
                </span>
              </button>

              <button
                type="button"
                onClick={() => setVisibility("PUBLIC_READ")}
                className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all ${
                  visibility === "PUBLIC_READ"
                    ? "border-indigo-600 bg-indigo-50/70 font-semibold text-indigo-950 dark:border-indigo-500 dark:bg-indigo-950/40 dark:text-indigo-200 ring-2 ring-indigo-500/20"
                    : "border-zinc-200 bg-zinc-50/50 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:bg-zinc-800/80"
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs">
                  <Globe className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Public Read</span>
                </div>
                <span className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400 leading-tight">
                  Anyone with link can view board
                </span>
              </button>
            </div>
          </div>

          {/* Starter Template Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
              Starter Template Selector
            </label>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {STARTER_TEMPLATES.map((tmpl) => {
                const isSelected = selectedStarterId === tmpl.id;
                return (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => {
                      setSelectedStarterId(tmpl.id);
                      if (!title) {
                        setTitle(tmpl.name);
                      }
                    }}
                    className={`flex flex-col p-2.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? "border-indigo-600 bg-indigo-50/80 dark:border-indigo-500 dark:bg-indigo-950/50 ring-2 ring-indigo-500/20"
                        : "border-zinc-200 bg-zinc-50/50 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:bg-zinc-800/80"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                        {tmpl.name}
                      </span>
                      {isSelected && (
                        <Check className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                      )}
                    </div>
                    <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug line-clamp-2">
                      {tmpl.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 8 Curated Gradient & Color Swatches */}
          <div>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                8 Curated Background Swatches
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

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || isSubmitting}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-indigo-600/30 transition-all hover:bg-indigo-500 hover:shadow-indigo-600/50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles className="h-4 w-4" />
              <span>{isSubmitting ? "Creating Board..." : "Create Board"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
