"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Briefcase,
  Check,
  ChevronDown,
  Compass,
  FolderPlus,
  LayoutGrid,
  LayoutTemplate,
  PanelLeftClose,
  Plus,
  Sparkles,
  Star,
  Zap,
} from "lucide-react";
import { BoardSummary, WorkspaceWithBoards } from "@kinetix/contracts";
import { useWorkspaceStore } from "@/store/workspace-store";

interface WorkspaceSidebarProps {
  onSelectBoard: (boardId: string) => void;
  onToggleStarBoard: (boardId: string, currentStarred: boolean) => void;
}

export function WorkspaceSidebar({
  onSelectBoard,
  onToggleStarBoard,
}: WorkspaceSidebarProps) {
  const isSidebarOpen = useWorkspaceStore((s) => s.isSidebarOpen);
  const toggleSidebar = useWorkspaceStore((s) => s.toggleSidebar);
  const activeBoardId = useWorkspaceStore((s) => s.activeBoardId);
  const currentWorkspaceId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const setCurrentWorkspaceId = useWorkspaceStore((s) => s.setCurrentWorkspaceId);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const boardSummaries = useWorkspaceStore((s) => s.boardSummaries);

  const setTemplatesModalOpen = useWorkspaceStore(
    (s) => s.setTemplatesModalOpen
  );
  const setCreateBoardModalOpen = useWorkspaceStore(
    (s) => s.setCreateBoardModalOpen
  );
  const setCreateWorkspaceModalOpen = useWorkspaceStore(
    (s) => s.setCreateWorkspaceModalOpen
  );
  const setAutomationModalOpen = useWorkspaceStore(
    (s) => s.setAutomationModalOpen
  );

  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false);
  const workspaceDropdownRef = useRef<HTMLDivElement>(null);

  // Close workspace dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        workspaceDropdownRef.current &&
        !workspaceDropdownRef.current.contains(e.target as Node)
      ) {
        setIsWorkspaceMenuOpen(false);
      }
    };
    if (isWorkspaceMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isWorkspaceMenuOpen]);

  const currentWorkspace =
    workspaces.find((w) => w.id === currentWorkspaceId) || workspaces[0];

  const currentBoards = boardSummaries.filter(
    (b) => !b.workspace_id || b.workspace_id === currentWorkspace?.id
  );

  const starredBoards = currentBoards.filter((b) => b.is_starred);

  return (
    <aside
      aria-label="Workspace Navigation Sidebar"
      className={`relative z-20 flex shrink-0 flex-col border-r border-zinc-200/80 bg-zinc-50/95 transition-all duration-300 ease-in-out dark:border-zinc-800/80 dark:bg-zinc-950/95 ${
        isSidebarOpen
          ? "w-72 opacity-100"
          : "w-0 overflow-hidden border-r-0 p-0 opacity-0 pointer-events-none"
      }`}
    >
      <div className="flex h-full w-72 flex-col justify-between">
        {/* Top: Workspace Switcher Header */}
        <div className="flex flex-col border-b border-zinc-200/80 p-3.5 dark:border-zinc-800/80">
          <div className="relative" ref={workspaceDropdownRef}>
            <button
              type="button"
              onClick={() => setIsWorkspaceMenuOpen(!isWorkspaceMenuOpen)}
              className="group flex w-full items-center justify-between gap-2.5 rounded-xl border border-zinc-200/80 bg-white p-2.5 text-left shadow-2xs transition-all hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800/80 dark:bg-zinc-900/90 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/80"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white shadow-xs"
                  style={{
                    backgroundColor: currentWorkspace?.logo_color || "#6366f1",
                  }}
                >
                  {(currentWorkspace?.name || "K").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    {currentWorkspace?.name || "Kinetix Workspace"}
                  </p>
                  <p className="truncate text-[10px] text-zinc-500 dark:text-zinc-400">
                    @{currentWorkspace?.slug || "kinetix"}
                  </p>
                </div>
              </div>

              <ChevronDown
                className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform duration-200 ${
                  isWorkspaceMenuOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* Workspace Dropdown Menu */}
            {isWorkspaceMenuOpen && (
              <div className="absolute top-full left-0 z-50 mt-1.5 w-full rounded-xl border border-zinc-200 bg-white p-1.5 shadow-xl backdrop-blur-xl animate-in fade-in-0 zoom-in-95 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="px-2 py-1 text-[10px] font-semibold tracking-wider text-zinc-400 uppercase dark:text-zinc-500">
                  Switch Workspace
                </div>

                <div className="max-h-48 space-y-0.5 overflow-y-auto">
                  {workspaces.map((ws) => {
                    const isSelected = ws.id === currentWorkspace?.id;
                    return (
                      <button
                        key={ws.id}
                        type="button"
                        onClick={() => {
                          setCurrentWorkspaceId(ws.id);
                          setIsWorkspaceMenuOpen(false);
                          if (ws.boards.length > 0) {
                            onSelectBoard(ws.boards[0].id);
                          }
                        }}
                        className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                          isSelected
                            ? "bg-indigo-50 font-medium text-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-200"
                            : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: ws.logo_color || "#6366f1" }}
                          />
                          <span className="truncate">{ws.name}</span>
                        </div>
                        {isSelected && (
                          <Check className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-1 border-t border-zinc-100 pt-1 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => {
                      setIsWorkspaceMenuOpen(false);
                      setCreateWorkspaceModalOpen(true);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Create New Workspace</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Quick Hub Buttons: Templates & Automation */}
          <div className="mt-2.5 grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setTemplatesModalOpen(true)}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-zinc-200/80 bg-white px-2 py-1.5 text-[11px] font-medium text-zinc-700 shadow-2xs transition-all hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800/80 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-700"
            >
              <LayoutTemplate className="h-3.5 w-3.5 text-indigo-500" />
              <span>Templates</span>
            </button>

            <button
              type="button"
              onClick={() => setAutomationModalOpen(true)}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-zinc-200/80 bg-white px-2 py-1.5 text-[11px] font-medium text-zinc-700 shadow-2xs transition-all hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800/80 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-700"
            >
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              <span>Butler AI</span>
            </button>
          </div>
        </div>

        {/* Scrollable Navigation Body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-3.5 py-3">
          {/* Starred Boards Section */}
          {starredBoards.length > 0 && (
            <div>
              <div className="flex items-center justify-between px-1.5 text-[10px] font-semibold tracking-wider text-zinc-400 uppercase dark:text-zinc-500">
                <span className="flex items-center gap-1">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  Starred Boards ({starredBoards.length})
                </span>
              </div>

              <div className="mt-1.5 space-y-0.5">
                {starredBoards.map((b) => (
                  <BoardNavItem
                    key={`starred-${b.id}`}
                    board={b}
                    isActive={b.id === activeBoardId}
                    onSelect={() => onSelectBoard(b.id)}
                    onToggleStar={(e) => {
                      e.stopPropagation();
                      onToggleStarBoard(b.id, b.is_starred);
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* All Workspace Boards Section */}
          <div>
            <div className="flex items-center justify-between px-1.5 text-[10px] font-semibold tracking-wider text-zinc-400 uppercase dark:text-zinc-500">
              <span className="flex items-center gap-1">
                <LayoutGrid className="h-3 w-3 text-zinc-400" />
                Workspace Boards ({currentBoards.length})
              </span>
              <button
                type="button"
                onClick={() => setCreateBoardModalOpen(true)}
                title="Create New Board"
                className="rounded p-0.5 text-zinc-400 hover:bg-zinc-200/60 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-1.5 space-y-0.5">
              {currentBoards.map((b) => (
                <BoardNavItem
                  key={b.id}
                  board={b}
                  isActive={b.id === activeBoardId}
                  onSelect={() => onSelectBoard(b.id)}
                  onToggleStar={(e) => {
                    e.stopPropagation();
                    onToggleStarBoard(b.id, b.is_starred);
                  }}
                />
              ))}
            </div>

            {/* "+ Create New Board" Action Row */}
            <button
              type="button"
              onClick={() => setCreateBoardModalOpen(true)}
              className="mt-2 flex w-full items-center gap-2 rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-600 transition-colors hover:border-zinc-400 hover:bg-white hover:text-zinc-900 dark:border-zinc-700/80 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
            >
              <Plus className="h-3.5 w-3.5 text-indigo-500" />
              <span>Create New Board...</span>
            </button>
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="border-t border-zinc-200/80 p-3 dark:border-zinc-800/80">
          <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-zinc-200 bg-white px-1.5 py-0.5 font-mono text-[9px] font-semibold dark:border-zinc-700 dark:bg-zinc-800">
                [
              </kbd>
              <span>Toggle Sidebar</span>
            </span>
            <button
              type="button"
              onClick={toggleSidebar}
              title="Collapse Sidebar ([)"
              className="rounded-md p-1 transition-colors hover:bg-zinc-200/60 dark:hover:bg-zinc-800"
            >
              <PanelLeftClose className="h-4 w-4 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

function BoardNavItem({
  board,
  isActive,
  onSelect,
  onToggleStar,
}: {
  board: BoardSummary;
  isActive: boolean;
  onSelect: () => void;
  onToggleStar: (e: React.MouseEvent) => void;
}) {
  const bgStyle =
    board.background?.type === "gradient"
      ? { background: board.background.value }
      : board.background?.type === "solid" &&
          !board.background.value.startsWith("adaptive")
        ? { backgroundColor: board.background.value }
        : {
            background:
              "linear-gradient(135deg, #3b82f6 0%, #1e1b4b 100%)",
          };

  return (
    <div
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`group flex w-full cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-left transition-all ${
        isActive
          ? "bg-zinc-200/80 font-semibold text-zinc-900 shadow-2xs dark:bg-zinc-800/90 dark:text-white"
          : "text-zinc-700 hover:bg-zinc-100/90 dark:text-zinc-300 dark:hover:bg-zinc-900/80"
      }`}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <div
          className="h-5 w-5 shrink-0 rounded-md border border-white/20 shadow-xs"
          style={bgStyle}
        />
        <span className="truncate text-xs">{board.title}</span>
      </div>

      <div className="flex items-center gap-1.5">
        {board.card_count !== undefined && (
          <span
            className={`rounded-full px-1.5 py-0.2 font-mono text-[10px] ${
              isActive
                ? "bg-white/80 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200"
                : "bg-zinc-200/60 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
            }`}
          >
            {board.card_count}
          </span>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleStar(e);
          }}
          title={board.is_starred ? "Unstar board" : "Star board"}
          className={`rounded p-0.5 transition-colors ${
            board.is_starred
              ? "text-amber-400 opacity-100"
              : "text-zinc-400 opacity-0 hover:text-amber-400 group-hover:opacity-100"
          }`}
        >
          <Star
            className={`h-3.5 w-3.5 ${
              board.is_starred ? "fill-amber-400" : ""
            }`}
          />
        </button>
      </div>
    </div>
  );
}
