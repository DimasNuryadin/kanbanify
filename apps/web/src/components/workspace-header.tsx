"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Archive,
  Calendar,
  Check,
  Command,
  Filter,
  Kanban,
  Laptop,
  Moon,
  Palette,
  Plus,
  Radio,
  RotateCcw,
  Search,
  Sparkles,
  Star,
  Sun,
  Table2,
  X,
} from "lucide-react";
import { Priority, UpdateBoardRequest } from "@kinetix/contracts";
import {
  DueFilter,
  ThemeMode,
  useWorkspaceStore,
} from "@/store/workspace-store";
import { LABEL_COLOR_MAP } from "@/lib/trello-theme";

interface WorkspaceHeaderProps {
  onToggleMockMode: (nextUseMock: boolean) => void;
  onResetMockData: () => void;
  onUpdateBoard: (payload: UpdateBoardRequest) => Promise<void>;
}

const PRIORITIES: Array<{ label: string; value: Priority | "ALL" }> = [
  { label: "All", value: "ALL" },
  { label: "Urgent", value: "URGENT" },
  { label: "High", value: "HIGH" },
  { label: "Medium", value: "MEDIUM" },
  { label: "Low", value: "LOW" },
];

const DUE_FILTERS: Array<{ label: string; value: DueFilter }> = [
  { label: "Any Date", value: "ALL" },
  { label: "Overdue", value: "OVERDUE" },
  { label: "Due Soon (48h)", value: "DUE_SOON" },
  { label: "Completed", value: "COMPLETED" },
  { label: "No Due Date", value: "NO_DATE" },
];

export function WorkspaceHeader({
  onToggleMockMode,
  onResetMockData,
  onUpdateBoard,
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
  const memberFilterId = useWorkspaceStore((s) => s.memberFilterId);
  const setMemberFilterId = useWorkspaceStore((s) => s.setMemberFilterId);
  const labelFilterIds = useWorkspaceStore((s) => s.labelFilterIds);
  const toggleLabelFilterId = useWorkspaceStore((s) => s.toggleLabelFilterId);
  const dueFilter = useWorkspaceStore((s) => s.dueFilter);
  const setDueFilter = useWorkspaceStore((s) => s.setDueFilter);
  const clearAllFilters = useWorkspaceStore((s) => s.clearAllFilters);

  const setCommandPaletteOpen = useWorkspaceStore(
    (s) => s.setCommandPaletteOpen
  );
  const openCreateCardModal = useWorkspaceStore((s) => s.openCreateCardModal);
  const setArchivedDrawerOpen = useWorkspaceStore(
    (s) => s.setArchivedDrawerOpen
  );
  const setBoardMenuOpen = useWorkspaceStore((s) => s.setBoardMenuOpen);
  const lastMoveMetrics = useWorkspaceStore((s) => s.lastMoveMetrics);

  // Inline Board Title Editing
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(board.title);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterPopoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTitleDraft(board.title);
  }, [board.title]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        filterPopoverRef.current &&
        !filterPopoverRef.current.contains(e.target as Node)
      ) {
        setIsFilterOpen(false);
      }
    };
    if (isFilterOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isFilterOpen]);

  const handleSaveBoardTitle = async () => {
    setIsEditingTitle(false);
    const trimmed = titleDraft.trim();
    if (!trimmed || trimmed === board.title) {
      setTitleDraft(board.title);
      return;
    }
    await onUpdateBoard({ title: trimmed });
  };

  const activeCards = board.cards.filter((c) => !c.is_archived);
  const archivedCount =
    board.cards.filter((c) => c.is_archived).length +
    board.columns.filter((col) => col.is_archived).length;
  const blockedCount = activeCards.filter(
    (c) => c.blocked_by_card_ids.length > 0
  ).length;
  const totalPoints = activeCards.reduce(
    (acc, c) => acc + (c.story_points ?? 0),
    0
  );

  const activeFilterCount =
    (priorityFilter !== "ALL" ? 1 : 0) +
    (onlyBlockedFilter ? 1 : 0) +
    (memberFilterId ? 1 : 0) +
    labelFilterIds.length +
    (dueFilter !== "ALL" ? 1 : 0);

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
      <div className="mx-auto flex max-w-[1640px] flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        {/* Left: Brand, Inline-Editable Board Title, Star Toggle & O(1) Telemetry */}
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-indigo-500/30 bg-gradient-to-br from-indigo-500/20 via-violet-500/15 to-transparent text-indigo-600 shadow-xs dark:border-indigo-400/30 dark:text-indigo-400">
            <Sparkles className="h-4 w-4" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold tracking-wider text-zinc-400 uppercase dark:text-zinc-500">
                Kinetix Trello Workspace
              </span>
              <span className="text-zinc-300 dark:text-zinc-700">/</span>
              <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                {activeCards.length} cards · {totalPoints} pts
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {isEditingTitle ? (
                <input
                  type="text"
                  autoFocus
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={handleSaveBoardTitle}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveBoardTitle();
                    if (e.key === "Escape") {
                      setTitleDraft(board.title);
                      setIsEditingTitle(false);
                    }
                  }}
                  className="rounded-md border border-indigo-500 bg-white px-2 py-0.5 text-sm font-semibold tracking-tight text-zinc-900 focus:outline-none sm:text-base dark:bg-zinc-900 dark:text-zinc-100"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditingTitle(true)}
                  title="Click to rename board inline"
                  className="-mx-1.5 rounded-md px-1.5 py-0.5 text-left text-sm font-semibold tracking-tight text-zinc-900 transition-colors hover:bg-zinc-100 sm:text-base dark:text-zinc-100 dark:hover:bg-zinc-800/80"
                >
                  {board.title}
                </button>
              )}

              {/* Star / Favorite Toggle */}
              <button
                type="button"
                onClick={() =>
                  onUpdateBoard({ is_starred: !board.is_starred })
                }
                title={
                  board.is_starred
                    ? "Starred board (Click to unstar)"
                    : "Click to star this board"
                }
                className={`rounded-lg p-1 transition-colors ${
                  board.is_starred
                    ? "text-amber-500 hover:bg-amber-500/10"
                    : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                }`}
              >
                <Star
                  className={`h-4 w-4 ${
                    board.is_starred ? "fill-amber-400 text-amber-500" : ""
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Live O(1) Fractional Index Telemetry Pill */}
          {lastMoveMetrics && (
            <div
              title="Last O(1) Fractional Index calculation"
              className="hidden items-center gap-1.5 rounded-md border border-zinc-200/80 bg-zinc-50 px-2.5 py-1 text-[11px] text-zinc-600 2xl:flex dark:border-zinc-800/80 dark:bg-zinc-900/80 dark:text-zinc-400"
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

        {/* Right: Mode Controls, Command Palette, Theme Switcher, Archived Drawer, Board Menu, New Card */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Mock Mode / Live API Toggle Switch + Connection Pill */}
          <div className="flex items-center gap-1 rounded-lg border border-zinc-200/80 bg-zinc-50 p-1 dark:border-zinc-800/80 dark:bg-zinc-900/90">
            <button
              type="button"
              onClick={() => onToggleMockMode(true)}
              className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-all duration-150 ${
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
              className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-all duration-150 ${
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

            {useMockMode && (
              <button
                type="button"
                onClick={onResetMockData}
                title="Reset Mock Board to initial seed data"
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
            className="flex items-center gap-1.5 rounded-lg border border-zinc-200/80 bg-zinc-50 px-2.5 py-1.5 text-xs text-zinc-600 transition-all duration-150 hover:border-zinc-300 hover:bg-white dark:border-zinc-800/80 dark:bg-zinc-900/90 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
          >
            <Command className="h-3.5 w-3.5 text-zinc-400" />
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
                  <span className="hidden lg:inline">{opt.label}</span>
                </button>
              );
            })}
          </div>

          {/* Archived Items Drawer Button */}
          <button
            type="button"
            onClick={() => setArchivedDrawerOpen(true)}
            title="View archived cards and lists"
            className="flex items-center gap-1.5 rounded-lg border border-zinc-200/80 bg-zinc-50 px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:border-zinc-300 hover:bg-white dark:border-zinc-800/80 dark:bg-zinc-900/90 dark:text-zinc-300 dark:hover:border-zinc-700"
          >
            <Archive className="h-3.5 w-3.5 text-amber-500" />
            <span className="hidden md:inline">Archived</span>
            {archivedCount > 0 && (
              <span className="rounded-full bg-amber-500/15 px-1.5 py-0.2 font-mono text-[10px] font-semibold text-amber-600 dark:text-amber-300">
                {archivedCount}
              </span>
            )}
          </button>

          {/* Board Menu / Background Picker Button */}
          <button
            type="button"
            onClick={() => setBoardMenuOpen(true)}
            title="Board Menu, Backgrounds & Labels"
            className="flex items-center gap-1.5 rounded-lg border border-zinc-200/80 bg-zinc-50 px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:border-zinc-300 hover:bg-white dark:border-zinc-800/80 dark:bg-zinc-900/90 dark:text-zinc-300 dark:hover:border-zinc-700"
          >
            <Palette className="h-3.5 w-3.5 text-indigo-500" />
            <span className="hidden md:inline">Board Menu</span>
          </button>

          {/* Primary CTA: New Card */}
          <button
            type="button"
            onClick={() => openCreateCardModal(null)}
            className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white shadow-xs transition-all duration-150 hover:bg-zinc-800 active:scale-[0.99] dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Card</span>
          </button>
        </div>
      </div>

      {/* Sub-navigation Bar: View Switcher, Member Avatar Stack, Filter Popover & Search */}
      <div className="mx-auto flex max-w-[1640px] flex-wrap items-center justify-between gap-3 border-t border-zinc-200/60 px-4 py-2 sm:px-6 dark:border-zinc-800/60">
        {/* Left: View Switcher (Board / Table / Calendar) + Member Avatar Stack */}
        <div className="flex flex-wrap items-center gap-3">
          {/* 3-Way View Switcher */}
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
              <span>Board</span>
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
              <span>Table</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("calendar")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all duration-150 ${
                viewMode === "calendar"
                  ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>Calendar</span>
            </button>
          </div>

          {/* Member Avatar Stack (Click to filter by member!) */}
          <div className="flex items-center gap-1.5">
            <div className="flex -space-x-1.5">
              {board.members.map((member) => {
                const isSelected = memberFilterId === member.id;
                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() =>
                      setMemberFilterId(isSelected ? null : member.id)
                    }
                    title={`Filter by ${member.name} (${member.email})`}
                    className={`relative inline-flex h-7 w-7 items-center justify-center rounded-full border-2 text-[11px] font-bold text-white transition-transform hover:z-10 hover:scale-110 ${
                      isSelected
                        ? "z-10 scale-110 border-indigo-500 ring-2 ring-indigo-500/40"
                        : "border-white dark:border-zinc-950"
                    }`}
                    style={{ backgroundColor: member.color }}
                  >
                    {member.initials}
                  </button>
                );
              })}
            </div>

            {memberFilterId && (
              <button
                type="button"
                onClick={() => setMemberFilterId(null)}
                className="inline-flex items-center gap-1 rounded-md bg-indigo-500/10 px-2 py-0.5 text-[11px] font-medium text-indigo-600 hover:bg-indigo-500/20 dark:text-indigo-300"
              >
                <span>
                  {
                    board.members.find((m) => m.id === memberFilterId)
                      ?.initials
                  }
                </span>
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Blocker Radar Quick Toggle */}
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
            <span className="hidden sm:inline">Blockers</span>
            <span className="rounded bg-red-500/15 px-1 font-mono text-[10px] font-semibold text-red-600 dark:text-red-400">
              {blockedCount}
            </span>
          </button>
        </div>

        {/* Right: Filter Popover + Quick Search */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Rich Filter Popover */}
          <div className="relative" ref={filterPopoverRef}>
            <button
              type="button"
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                activeFilterCount > 0 || isFilterOpen
                  ? "border-indigo-500/50 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300"
                  : "border-zinc-200/80 bg-zinc-50 text-zinc-600 hover:border-zinc-300 dark:border-zinc-800/80 dark:bg-zinc-900/90 dark:text-zinc-300"
              }`}
            >
              <Filter className="h-3.5 w-3.5" />
              <span>Filter</span>
              {activeFilterCount > 0 && (
                <span className="rounded-full bg-indigo-600 px-1.5 py-0.2 font-mono text-[10px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {isFilterOpen && (
              <div className="absolute right-0 z-50 mt-2 w-80 rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
                <div className="mb-3 flex items-center justify-between border-b border-zinc-100 pb-2 dark:border-zinc-800">
                  <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    Filter Board Cards
                  </span>
                  {activeFilterCount > 0 && (
                    <button
                      type="button"
                      onClick={clearAllFilters}
                      className="text-[11px] font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      Clear all ({activeFilterCount})
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  {/* Labels Filter */}
                  <div>
                    <label className="mb-1.5 block text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">
                      Color Labels
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {board.labels.map((lbl) => {
                        const style = LABEL_COLOR_MAP[lbl.color];
                        const active = labelFilterIds.includes(lbl.id);
                        return (
                          <button
                            key={lbl.id}
                            type="button"
                            onClick={() => toggleLabelFilterId(lbl.id)}
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-medium transition-all ${
                              active
                                ? "ring-2 ring-indigo-500 " +
                                  style.pillBg +
                                  " " +
                                  style.pillText
                                : style.pillBg +
                                  " " +
                                  style.pillText +
                                  " opacity-80 hover:opacity-100"
                            }`}
                          >
                            <span
                              className={`h-2 w-2 rounded-full ${style.dot}`}
                            />
                            <span>{lbl.name || style.name}</span>
                            {active && <Check className="h-3 w-3" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Priority Filter */}
                  <div>
                    <label className="mb-1.5 block text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">
                      Priority
                    </label>
                    <div className="flex flex-wrap gap-1">
                      {PRIORITIES.map((p) => {
                        const active = priorityFilter === p.value;
                        return (
                          <button
                            key={p.value}
                            type="button"
                            onClick={() => setPriorityFilter(p.value)}
                            className={`rounded-lg px-2 py-1 text-[11px] font-medium transition-colors ${
                              active
                                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950"
                                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
                            }`}
                          >
                            {p.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Due Date Status Filter */}
                  <div>
                    <label className="mb-1.5 block text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">
                      Due Date Status
                    </label>
                    <div className="flex flex-wrap gap-1">
                      {DUE_FILTERS.map((df) => {
                        const active = dueFilter === df.value;
                        return (
                          <button
                            key={df.value}
                            type="button"
                            onClick={() => setDueFilter(df.value)}
                            className={`rounded-lg px-2 py-1 text-[11px] font-medium transition-colors ${
                              active
                                ? "bg-indigo-600 text-white"
                                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
                            }`}
                          >
                            {df.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Search Input */}
          <div className="relative w-52 sm:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search cards, labels, tags..."
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
