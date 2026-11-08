"use client";

import React, { useState } from "react";
import { Check, Sparkles, X } from "lucide-react";
import { CreateWorkspaceRequest } from "@kinetix/contracts";
import { useWorkspaceStore } from "@/store/workspace-store";

const WORKSPACE_COLORS = [
  "#6366f1", // Indigo
  "#3b82f6", // Blue
  "#10b981", // Emerald
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#f59e0b", // Amber
  "#ef4444", // Red
  "#06b6d4", // Cyan
];

interface CreateWorkspaceModalProps {
  onCreateWorkspace: (payload: CreateWorkspaceRequest) => Promise<void>;
}

export function CreateWorkspaceModal({
  onCreateWorkspace,
}: CreateWorkspaceModalProps) {
  const isOpen = useWorkspaceStore((s) => s.isCreateWorkspaceModalOpen);
  const setOpen = useWorkspaceStore((s) => s.setCreateWorkspaceModalOpen);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [logoColor, setLogoColor] = useState(WORKSPACE_COLORS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const generatedSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await onCreateWorkspace({
        name: trimmed,
        slug: generatedSlug,
        description: description.trim(),
        logo_color: logoColor,
      });
      setName("");
      setDescription("");
      setOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in-0">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-850">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white shadow-xs"
              style={{ backgroundColor: logoColor }}
            >
              {(name || "W").charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Create New Workspace
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Group boards, automations, and teammates together
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Workspace Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Design Systems, Platform Core..."
              className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
            {name && (
              <p className="mt-1 font-mono text-[11px] text-zinc-400">
                Slug: @{generatedSlug}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this workspace's mission..."
              className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 placeholder-zinc-400 focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Workspace Brand Color
            </label>
            <div className="mt-2 flex items-center gap-2">
              {WORKSPACE_COLORS.map((c) => {
                const isSelected = logoColor === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setLogoColor(c)}
                    className={`flex h-7 w-7 items-center justify-center rounded-lg transition-transform ${
                      isSelected ? "scale-110 ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-zinc-950" : "hover:scale-105"
                    }`}
                    style={{ backgroundColor: c }}
                  >
                    {isSelected && <Check className="h-4 w-4 text-white drop-shadow" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isSubmitting}
              className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>{isSubmitting ? "Creating..." : "Create Workspace"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
