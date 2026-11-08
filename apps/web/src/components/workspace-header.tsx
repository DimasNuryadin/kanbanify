"use client";

import React from "react";
import {
  AlertTriangle,
  Command,
  Kanban,
  Laptop,
  Moon,
  Plus,
  Radio,
  RotateCcw,
  Search,
  Sparkles,
  Sun,
  Table2,
  X,
} from "lucide-react";
import { Priority } from "@kinetix/contracts";
import { ThemeMode, useWorkspaceStore } from "@/store/workspace-store";

interface WorkspaceHeaderProps {
  onToggleMockMode: (nextUseMock: boolean) => void;
  onResetMockData: () => void;
}

const PRIORITIES: Array<{ label: string; value: Priority | "ALL" }> = [
  { label: "All", value: "ALL" },
  { label: "Urgent", value: "URGENT" },
  { label: "High", value: "HIGH" },
  { label: "Medium", value: "MEDIUM" },
  { label: "Low", value: "LOW" },
];

export function WorkspaceHeader({
  onToggleMockMode,
  onResetMockData,
}: WorkspaceHeaderProps) {
  const board = useWorkspaceStore((s) => s.board);
  const viewMode = useWorkspaceStore((s) => s.viewMode);
  const setViewMode = useWorkspaceStore((s) => s.setViewMode);
  const themeMode = useWorkspaceStore((s) => s.themeMode);
  const setThemeMode = useWorkspaceStore((s) => s.setThemeMode);
  const useMockMode = useWorkspaceStore((s) => s.useMockMode);
  const wsStatus = useWorkspaceStore((s) => s.wsStatus);
  const fallbackNotice = useWorkspaceStore((s) => s.fallbackNotice);
  const setFallbackNotice = useWorkspaceStore((s) => s.setFallbackNotice);

  const priorityFilter = useWorkspaceStore((s) => s.priorityFilter);
  const setPriorityFilter = useWorkspaceStore((s) => s.setPriorityFilter);
  const searchQuery = useWorkspaceStore((s) => s.searchQuery);
  const setSearchQuery = useWorkspaceStore((s) => s.setSearchQuery);
  const onlyBlockedFilter = useWorkspaceStore((s) => s.onlyBlockedFilter);
  const setOnlyBlockedFilter = useWorkspaceStore((s) => s.setOnlyBlockedFilter);

  const setCommandPaletteOpen = useWorkspaceStore(
    (s) => s.setCommandPaletteOpen
  );
  const openCreateCardModal = useWorkspaceStore((s) => s.openCreateCardModal);
  const lastMoveMetrics = useWorkspaceStore((s) => s.lastMoveMetrics);

  const blockedCount = board.cards.filter(
    (c) => c.blocked_by_card_ids.length > 0
  ).length;
  const totalPoints = board.cards.reduce(
    (acc, c) => acc + (c.story_points ?? 0),
    0
  );

  const themeOptions: Array<{
    mode: ThemeMode;
    label: string;
    icon: React.ReactNode;
  }> = [
    { mode: "light", label: "Light", icon: <Sun className="h-3.5 w-3.5" /> },
    { mode: "dark", label: "Dark", icon: <Moon className="h-3.5 w-3.5" /> },
    {
      mode: "system",
      label: "System",
      icon: <Laptop className="h-3.5 w-3.5" />,
    },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200/80 bg-white/85 backdrop-blur-xl transition-colors duration-150 dark:border-zinc-800/80 dark:bg-zinc-950/85">
      {/* Top Primary Bar */}
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        {/* Left: Brand & Board Title */}
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-indigo-500/30 bg-gradient-to-br from-indigo-500/20 via-violet-500/15 to-transparent text-indigo-600 shadow-xs dark:border-indigo-400/30 dark:text-indigo-400">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold tracking-wider text-zinc-400 uppercase dark:text-zinc-500">
                Kinetix Workspace
              </span>
              <span className="text-zinc-300 dark:text-zinc-700">/</span>
              <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                {board.cards.length} issues · {totalPoints} pts
              </span>
            </div>
            <h1 className="text-sm font-semibold tracking-tight text-zinc-900 sm:text-base dark:text-zinc-100">
              {board.title}
            </h1>
          </div>

          {/* Live O(1) Fractional Index Telemetry Pill */}
          {lastMoveMetrics && (
            <div
              title="Last O(1) Fractional Index calculation"
              className="hidden items-center gap-1.5 rounded-md border border-zinc-200/80 bg-zinc-50 px-2.5 py-1 text-[11px] text-zinc-600 xl:flex dark:border-zinc-800/80 dark:bg-zinc-900/80 dark:text-zinc-400"
            >
              <span className="font-medium text-zinc-500 dark:text-zinc-400">
                O(1) Index:
              </span>
              <code className="font-mono text-zinc-700 dark:text-zinc-300">
                ({lastMoveMetrics.prevPos ?? "∅"},{" "}
                {lastMoveMetrics.nextPos ?? "∅"})
              </code>
              <span className="text-zinc-400">→</span>
              <code className="rounded bg-indigo-500/10 px-1.5 py-0.5 font-mono font-semibold text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300">
                &quot;{lastMoveMetrics.computedPos}&quot;
              </code>
            </div>
          )}
        </div>

        {/* Right: Mode Controls, Command Palette, Theme Switcher, New Issue */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Mock Mode / Live API Toggle Switch + Connection Pill */}
          <div className="flex items-center gap-1.5 rounded-lg border border-zinc-200/80 bg-zinc-50 p-1 dark:border-zinc-800/80 dark:bg-zinc-900/90">
            <button
              type="button"
              onClick={() => onToggleMockMode(true)}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all duration-150 ${
                useMockMode
                  ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  useMockMode ? "bg-amber-500" : "bg-zinc-400"
                }`}
              />
              Mock Mode
            </button>
            <button
              type="button"
              onClick={() => onToggleMockMode(false)}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all duration-150 ${
                !useMockMode
                  ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              <Radio
                className={`h-3 w-3 ${
                  !useMockMode && wsStatus === "connected"
                    ? "text-emerald-500"
                    : !useMockMode
                      ? "text-indigo-500"
                      : "text-zinc-400"
                }`}
              />
              Live API
            </button>

            <span className="hidden border-l border-zinc-200/80 pl-2 pr-1.5 font-mono text-[10px] text-zinc-500 sm:inline-flex items-center gap-1 dark:border-zinc-800 dark:text-zinc-400">
              {useMockMode ? (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  Standalone
                </>
              ) : wsStatus === "connected" ? (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Sync
                </>
              ) : (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
                  WS {wsStatus}
                </>
              )}
            </span>

            {useMockMode && (
              <button
                type="button"
                onClick={onResetMockData}
                title="Reset Mock Board to initial 9 seed cards"
                className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-200/60 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Command Palette Button (Cmd+K) */}
          <button
            type="button"
            onClick={() => setCommandPaletteOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-zinc-200/80 bg-zinc-50 px-2.5 py-1.5 text-xs text-zinc-600 transition-all duration-150 hover:border-zinc-300 hover:bg-white dark:border-zinc-800/80 dark:bg-zinc-900/90 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
          >
            <Command className="h-3.5 w-3.5 text-zinc-400" />
            <span className="hidden sm:inline">Command</span>
            <kbd className="rounded border border-zinc-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-medium text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
              ⌘K
            </kbd>
          </button>

          {/* Theme Switcher (Light / Dark / System) */}
          <div
            role="group"
            aria-label="Theme Mode Toggle"
            className="flex items-center rounded-lg border border-zinc-200/80 bg-zinc-50 p-0.5 dark:border-zinc-800/80 dark:bg-zinc-900/90"
          >
            {themeOptions.map((opt) => {
              const active = themeMode === opt.mode;
              return (
                <button
                  key={opt.mode}
                  type="button"
                  onClick={() => setThemeMode(opt.mode)}
                  title={`${opt.label} Mode`}
                  className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-all duration-150 ${
                    active
                      ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100"
                      : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                  }`}
                >
                  {opt.icon}
                  <span className="hidden md:inline">{opt.label}</span>
                </button>
              );
            })}
          </div>

          {/* Primary CTA: New Card */}
          <button
            type="button"
            onClick={() => openCreateCardModal(null)}
            className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white shadow-xs transition-all duration-150 hover:bg-zinc-800 active:scale-[0.99] dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Issue</span>
          </button>
        </div>
      </div>

      {/* Sub-navigation Bar: View Switcher & Filters */}
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 border-t border-zinc-200/60 px-4 py-2 sm:px-6 dark:border-zinc-800/60">
        {/* Left: Multi-View Switcher (Kanban vs Table) */}
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-lg border border-zinc-200/80 bg-zinc-50 p-0.5 dark:border-zinc-800/80 dark:bg-zinc-900/90">
            <button
              type="button"
              onClick={() => setViewMode("kanban")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all duration-150 ${
                viewMode === "kanban"
                  ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              <Kanban className="h-3.5 w-3.5" />
              <span>Kanban Board</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all duration-150 ${
                viewMode === "table"
                  ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              <Table2 className="h-3.5 w-3.5" />
              <span>Table View</span>
            </button>
          </div>

          {/* Priority Filter Pills */}
          <div className="hidden items-center gap-1 sm:flex">
            {PRIORITIES.map((p) => {
              const active = priorityFilter === p.value;
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriorityFilter(p.value)}
                  className={`rounded-md px-2 py-1 text-[11px] font-medium transition-all duration-150 ${
                    active
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950"
                      : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Blocker Radar Filter Toggle */}
          <button
            type="button"
            onClick={() => setOnlyBlockedFilter(!onlyBlockedFilter)}
            className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-all duration-150 ${
              onlyBlockedFilter
                ? "border-red-500/40 bg-red-500/10 text-red-600 dark:border-red-500/40 dark:bg-red-500/15 dark:text-red-300"
                : "border-zinc-200/80 bg-zinc-50 text-zinc-600 hover:border-zinc-300 dark:border-zinc-800/80 dark:bg-zinc-900/80 dark:text-zinc-400"
            }`}
          >
            <AlertTriangle className="h-3 w-3 text-red-500" />
            <span>Blocker Radar</span>
            <span className="rounded bg-red-500/15 px-1 font-mono text-[10px] font-semibold text-red-600 dark:text-red-400">
              {blockedCount}
            </span>
          </button>
        </div>

        {/* Right: Quick Search */}
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter issues by title or tag..."
            className="w-full rounded-lg border border-zinc-200/80 bg-zinc-50 py-1 pr-7 pl-8 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-zinc-800/80 dark:bg-zinc-900/90 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-indigo-400 dark:focus:bg-zinc-900"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute top-1/2 right-2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Automatic Fallback Notice Banner (if Live API was unreachable) */}
      {fallbackNotice && (
        <div className="flex items-center justify-between border-t border-amber-500/20 bg-amber-500/10 px-4 py-1.5 text-xs text-amber-800 sm:px-6 dark:text-amber-300">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            <span>
              <strong>Graceful Mock Fallback Active:</strong> {fallbackNotice}.
              All changes are persisted locally in Mock Mode.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setFallbackNotice(null)}
            className="rounded p-0.5 hover:bg-amber-500/20"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </header>
  );
}
