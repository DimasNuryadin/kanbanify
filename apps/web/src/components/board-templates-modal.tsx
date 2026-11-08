"use client";

import React, { useState } from "react";
import {
  ArrowRight,
  Briefcase,
  Check,
  Compass,
  Cpu,
  Layers,
  LayoutTemplate,
  Rocket,
  Sparkles,
  User,
  X,
  Zap,
} from "lucide-react";
import { BoardTemplate, CreateBoardRequest } from "@kinetix/contracts";
import { useWorkspaceStore } from "@/store/workspace-store";

interface BoardTemplatesModalProps {
  templates: BoardTemplate[];
  onCreateBoardFromTemplate: (payload: CreateBoardRequest) => Promise<void>;
}

export function BoardTemplatesModal({
  templates,
  onCreateBoardFromTemplate,
}: BoardTemplatesModalProps) {
  const isOpen = useWorkspaceStore((s) => s.isTemplatesModalOpen);
  const setOpen = useWorkspaceStore((s) => s.setTemplatesModalOpen);
  const currentWorkspaceId = useWorkspaceStore((s) => s.currentWorkspaceId);

  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [isSubmittingId, setIsSubmittingId] = useState<string | null>(null);

  if (!isOpen) return null;

  const categories = ["ALL", "ENGINEERING", "MARKETING", "PRODUCT", "PERSONAL"];

  const filteredTemplates = templates.filter((t) =>
    selectedCategory === "ALL" ? true : t.category === selectedCategory
  );

  const handleUseTemplate = async (tmpl: BoardTemplate) => {
    try {
      setIsSubmittingId(tmpl.id);
      await onCreateBoardFromTemplate({
        workspace_id: currentWorkspaceId,
        title: tmpl.name,
        description: tmpl.description,
        is_starred: false,
        background: tmpl.background,
        template_id: tmpl.id,
      });
      setOpen(false);
    } finally {
      setIsSubmittingId(null);
    }
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case "ENGINEERING":
        return <Cpu className="h-3.5 w-3.5 text-blue-500" />;
      case "MARKETING":
        return <Rocket className="h-3.5 w-3.5 text-pink-500" />;
      case "PRODUCT":
        return <Compass className="h-3.5 w-3.5 text-emerald-500" />;
      case "PERSONAL":
        return <User className="h-3.5 w-3.5 text-amber-500" />;
      default:
        return <LayoutTemplate className="h-3.5 w-3.5 text-indigo-500" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in-0">
      <div className="flex h-[90vh] max-h-[720px] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200/80 p-5 dark:border-zinc-800/80">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-600 dark:bg-indigo-500/25 dark:text-indigo-400">
              <LayoutTemplate className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Curated Board Templates Gallery
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                  <Zap className="h-2.5 w-2.5 fill-amber-400" />
                  Butler Automated
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Kickstart your workflow with pre-configured lists, default tags, and active automation rules
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-1.5 border-b border-zinc-200/60 bg-zinc-50 px-5 py-2.5 dark:border-zinc-850 dark:bg-zinc-900/60">
          {categories.map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-lg px-3 py-1 text-xs font-medium transition-all ${
                  isActive
                    ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                }`}
              >
                {cat.charAt(0) + cat.slice(1).toLowerCase()}
              </button>
            );
          })}
        </div>

        {/* Templates Grid */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {filteredTemplates.map((tmpl) => {
              const isSubmitting = isSubmittingId === tmpl.id;
              const bgStyle =
                tmpl.background.type === "gradient"
                  ? { background: tmpl.background.value }
                  : { backgroundColor: tmpl.background.value };

              return (
                <div
                  key={tmpl.id}
                  className="group flex flex-col justify-between overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-xs transition-all hover:border-zinc-300 hover:shadow-md dark:border-zinc-800/80 dark:bg-zinc-900/80 dark:hover:border-zinc-700"
                >
                  {/* Card Cover Banner */}
                  <div
                    className="relative flex h-24 w-full items-end justify-between p-3.5 transition-transform group-hover:scale-[1.01]"
                    style={bgStyle}
                  >
                    <div className="flex items-center gap-1.5 rounded-md bg-black/50 px-2 py-0.5 backdrop-blur-md">
                      {getCategoryIcon(tmpl.category)}
                      <span className="text-[10px] font-bold tracking-wider text-white uppercase">
                        {tmpl.category}
                      </span>
                    </div>

                    <div className="rounded-md bg-black/50 px-2 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-md">
                      {tmpl.sample_cards_count} sample cards
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="flex flex-1 flex-col justify-between p-4">
                    <div>
                      <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                        {tmpl.name}
                      </h3>
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {tmpl.description}
                      </p>

                      {/* Default Column Chips */}
                      <div className="mt-3">
                        <p className="text-[10px] font-semibold tracking-wider text-zinc-400 uppercase dark:text-zinc-500">
                          Included Lists
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {tmpl.default_columns.map((col, idx) => (
                            <span
                              key={col}
                              className="rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-[10px] font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                            >
                              {col}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => handleUseTemplate(tmpl)}
                        className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white shadow-xs transition-all hover:bg-zinc-800 active:scale-[0.99] disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>
                          {isSubmitting ? "Creating Board..." : "Use This Template (1-Click)"}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
