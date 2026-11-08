"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  Calendar,
  Command,
  Filter,
  Kanban,
  Laptop,
  Moon,
  Palette,
  Plus,
  Radio,
  Search,
  Sun,
  Table2,
  Tag,
  X,
} from "lucide-react";
import { useWorkspaceStore } from "@/store/workspace-store";

interface CommandItem {
  id: string;
  group: string;
  label: string;
  shortcut?: string;
  icon: React.ReactNode;
  action: () => void;
}

export function CommandPalette({
  onToggleMockMode,
}: {
  onToggleMockMode: (next: boolean) => void;
}) {
  const isOpen = useWorkspaceStore((s) => s.isCommandPaletteOpen);
  const setOpen = useWorkspaceStore((s) => s.setCommandPaletteOpen);
  const board = useWorkspaceStore((s) => s.board);

  const setViewMode = useWorkspaceStore((s) => s.setViewMode);
  const setThemeMode = useWorkspaceStore((s) => s.setThemeMode);
  const setPriorityFilter = useWorkspaceStore((s) => s.setPriorityFilter);
  const setOnlyBlockedFilter = useWorkspaceStore((s) => s.setOnlyBlockedFilter);
  const onlyBlockedFilter = useWorkspaceStore((s) => s.onlyBlockedFilter);
  const openCreateCardModal = useWorkspaceStore((s) => s.openCreateCardModal);
  const setSelectedCardId = useWorkspaceStore((s) => s.setSelectedCardId);
  const setArchivedDrawerOpen = useWorkspaceStore(
    (s) => s.setArchivedDrawerOpen
  );
  const setBoardMenuOpen = useWorkspaceStore((s) => s.setBoardMenuOpen);
  const toggleLabelsExpanded = useWorkspaceStore((s) => s.toggleLabelsExpanded);
  const clearAllFilters = useWorkspaceStore((s) => s.clearAllFilters);
  const useMockMode = useWorkspaceStore((s) => s.useMockMode);

  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setActiveIndex(0);
    }
  }, [isOpen]);

  const commands: CommandItem[] = useMemo(() => {
    const run = (fn: () => void) => () => {
      fn();
      setOpen(false);
    };

    const base: CommandItem[] = [
      {
        id: "create-card",
        group: "Actions",
        label: "Create New Trello Card",
        shortcut: "C",
        icon: <Plus className="h-4 w-4 text-indigo-500" />,
        action: run(() => openCreateCardModal(null)),
      },
      {
        id: "toggle-labels-expanded",
        group: "Actions",
        label: "Toggle Label Text Visibility Across All Cards",
        shortcut: "L",
        icon: <Tag className="h-4 w-4 text-emerald-500" />,
        action: run(() => toggleLabelsExpanded()),
      },
      {
        id: "open-board-menu",
        group: "Actions",
        label: "Open Board Menu & Background Picker",
        shortcut: "B M",
        icon: <Palette className="h-4 w-4 text-violet-500" />,
        action: run(() => setBoardMenuOpen(true)),
      },
      {
        id: "open-archived-drawer",
        group: "Actions",
        label: "Open Archived Cards & Lists Drawer",
        shortcut: "A",
        icon: <Archive className="h-4 w-4 text-amber-500" />,
        action: run(() => setArchivedDrawerOpen(true)),
      },
      {
        id: "view-kanban",
        group: "Workspace Views",
        label: "Switch to Trello Board View",
        shortcut: "V B",
        icon: <Kanban className="h-4 w-4 text-zinc-500" />,
        action: run(() => setViewMode("kanban")),
      },
      {
        id: "view-table",
        group: "Workspace Views",
        label: "Switch to High-Density Table View",
        shortcut: "V T",
        icon: <Table2 className="h-4 w-4 text-zinc-500" />,
        action: run(() => setViewMode("table")),
      },
      {
        id: "view-calendar",
        group: "Workspace Views",
        label: "Switch to Calendar / Due Date View",
        shortcut: "V C",
        icon: <Calendar className="h-4 w-4 text-zinc-500" />,
        action: run(() => setViewMode("calendar")),
      },
      {
        id: "theme-light",
        group: "Appearance",
        label: "Switch Theme to Light Mode",
        shortcut: "T L",
        icon: <Sun className="h-4 w-4 text-amber-500" />,
        action: run(() => setThemeMode("light")),
      },
      {
        id: "theme-dark",
        group: "Appearance",
        label: "Switch Theme to Dark Mode",
        shortcut: "T D",
        icon: <Moon className="h-4 w-4 text-indigo-400" />,
        action: run(() => setThemeMode("dark")),
      },
      {
        id: "theme-system",
        group: "Appearance",
        label: "Switch Theme to System Preference",
        shortcut: "T S",
        icon: <Laptop className="h-4 w-4 text-zinc-400" />,
        action: run(() => setThemeMode("system")),
      },
      {
        id: "filter-urgent",
        group: "Filters",
        label: "Filter Priority: URGENT only",
        shortcut: "F U",
        icon: <Filter className="h-4 w-4 text-rose-500" />,
        action: run(() => setPriorityFilter("URGENT")),
      },
      {
        id: "filter-reset",
        group: "Filters",
        label: "Reset All Board Filters",
        shortcut: "F R",
        icon: <Filter className="h-4 w-4 text-emerald-500" />,
        action: run(() => clearAllFilters()),
      },
      {
        id: "toggle-blockers",
        group: "Blocker Radar",
        label: onlyBlockedFilter
          ? "Show All Cards (Disable Blocker Radar Filter)"
          : "Filter Blocked Cards Only (Blocker Radar)",
        icon: <AlertTriangle className="h-4 w-4 text-red-500" />,
        action: run(() => setOnlyBlockedFilter(!onlyBlockedFilter)),
      },
      {
        id: "toggle-api-mode",
        group: "Data Source",
        label: useMockMode
          ? "Switch to Live API Mode (http://localhost:8000)"
          : "Switch to Standalone Mock Mode",
        icon: <Radio className="h-4 w-4 text-emerald-500" />,
        action: run(() => onToggleMockMode(!useMockMode)),
      },
    ];

    const cardItems: CommandItem[] = board.cards
      .filter((c) => !c.is_archived)
      .map((card) => ({
        id: `card-${card.id}`,
        group: "Jump to Card",
        label: `${card.title} (${card.priority})`,
        shortcut: card.position,
        icon: <ArrowRight className="h-4 w-4 text-zinc-400" />,
        action: run(() => setSelectedCardId(card.id)),
      }));

    return [...base, ...cardItems];
  }, [
    board.cards,
    clearAllFilters,
    onToggleMockMode,
    onlyBlockedFilter,
    openCreateCardModal,
    setArchivedDrawerOpen,
    setBoardMenuOpen,
    setOnlyBlockedFilter,
    setOpen,
    setPriorityFilter,
    setSelectedCardId,
    setThemeMode,
    setViewMode,
    toggleLabelsExpanded,
    useMockMode,
  ]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.group.toLowerCase().includes(q)
    );
  }, [commands, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) =>
          filtered.length > 0 ? (prev + 1) % filtered.length : 0
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) =>
          filtered.length > 0
            ? (prev - 1 + filtered.length) % filtered.length
            : 0
        );
      } else if (e.key === "Enter" && filtered[activeIndex]) {
        e.preventDefault();
        filtered[activeIndex].action();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, filtered, activeIndex, setOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4">
      <div
        onClick={() => setOpen(false)}
        className="fixed inset-0 bg-zinc-950/50 backdrop-blur-xs"
      />

      <div className="relative z-10 w-full max-w-xl overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center border-b border-zinc-200/80 px-4 py-3 dark:border-zinc-800">
          <Search className="mr-3 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search cards (e.g., 'calendar', 'background', 'archive')..."
            className="flex-1 bg-transparent text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-100"
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto p-2">
          {filtered.map((item, idx) => {
            const active = idx === activeIndex;
            const prevGroup = idx > 0 ? filtered[idx - 1].group : null;
            const showGroupHeader = item.group !== prevGroup;

            return (
              <React.Fragment key={item.id}>
                {showGroupHeader && (
                  <div className="px-3 pt-2.5 pb-1 text-[10px] font-semibold tracking-wider text-zinc-400 uppercase dark:text-zinc-500">
                    {item.group}
                  </div>
                )}
                <button
                  type="button"
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={item.action}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition-colors ${
                    active
                      ? "bg-indigo-500/10 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200"
                      : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800/70"
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    {item.icon}
                    <span className="truncate font-medium">{item.label}</span>
                  </div>
                  {item.shortcut && (
                    <kbd className="ml-2 shrink-0 rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                      {item.shortcut}
                    </kbd>
                  )}
                </button>
              </React.Fragment>
            );
          })}

          {filtered.length === 0 && (
            <div className="py-10 text-center text-xs text-zinc-400">
              No matching commands or cards found.
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-zinc-200/80 bg-zinc-50 px-4 py-2 text-[11px] text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-400">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="font-mono">↑↓</kbd> Navigate
            </span>
            <span>
              <kbd className="font-mono">↵</kbd> Execute
            </span>
            <span>
              <kbd className="font-mono">ESC</kbd> Close
            </span>
          </div>
          <span className="flex items-center gap-1 font-mono text-[10px]">
            <Command className="h-3 w-3" /> Kinetix Command
          </span>
        </div>
      </div>
    </div>
  );
}
