"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Check,
  ChevronDown,
  Columns,
  FolderKanban,
  Globe,
  Grid,
  History,
  LayoutGrid,
  LayoutTemplate,
  Lock,
  LogOut,
  Moon,
  PanelLeft,
  Plus,
  Search,
  Shield,
  Sparkles,
  Star,
  Sun,
  Users,
  X,
  Zap,
} from "lucide-react";
import {
  Board,
  BoardRole,
  BoardTemplate,
  BoardVisibility,
  CreateBoardRequest,
  TrelloImportResult,
} from "@kinetix/contracts";
import {
  DEMO_USERS,
  hasValidAuthSession,
  useWorkspaceStore,
} from "@/store/workspace-store";
import { apiClient } from "@/lib/api-client";
import { AuthGuard } from "@/components/auth-guard";
import { getRecentBoards, recordRecentBoard } from "@/lib/recent-boards";
import { CreateBoardModal } from "@/components/create-board-modal";
import { TemplateConfirmationModal } from "@/components/template-confirmation-modal";
import { WorkspacePulseModal } from "@/components/workspace-pulse-modal";

const POPULAR_TEMPLATES: BoardTemplate[] = [
  {
    id: "template-agile-sprint",
    name: "🚀 Agile Sprint & Engineering Roadmap",
    description:
      "Pre-populates columns (Backlog, Sprint Ready, In Progress, Code Review, Done), sample cards, story points, and custom fields.",
    category: "ENGINEERING",
    background: {
      type: "gradient",
      value: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #311042 100%)",
    },
    default_columns: [
      "Backlog",
      "Sprint Ready",
      "In Progress",
      "Code Review",
      "Done",
    ],
    sample_cards_count: 5,
  },
  {
    id: "template-marketing-campaign",
    name: "📣 Marketing Campaign & Content Calendar",
    description:
      "Pre-populates columns (Ideas, Drafting, Design & Assets, Scheduled, Published).",
    category: "MARKETING",
    background: {
      type: "gradient",
      value: "linear-gradient(135deg, #1e1b4b 0%, #4c1d95 50%, #831843 100%)",
    },
    default_columns: [
      "Ideas",
      "Drafting",
      "Design & Assets",
      "Scheduled",
      "Published",
    ],
    sample_cards_count: 5,
  },
  {
    id: "template-bug-tracker",
    name: "🐛 Bug Triage & QA Tracker",
    description:
      "Pre-populates columns (Reported, Reproducing, Fixing, QA Verification, Resolved).",
    category: "ENGINEERING",
    background: {
      type: "gradient",
      value: "linear-gradient(135deg, #7c2d12 0%, #b91c1c 50%, #701a75 100%)",
    },
    default_columns: [
      "Reported",
      "Reproducing",
      "Fixing",
      "QA Verification",
      "Resolved",
    ],
    sample_cards_count: 5,
  },
  {
    id: "template-product-discovery",
    name: "🎯 Product Discovery & OKR Tracker",
    description:
      "Pre-populates columns (Objectives, Key Results, Validating, Shipped).",
    category: "PRODUCT",
    background: {
      type: "gradient",
      value: "linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)",
    },
    default_columns: ["Objectives", "Key Results", "Validating", "Shipped"],
    sample_cards_count: 4,
  },
];

type VisibilityFilter = "ALL" | "STARRED" | "WORKSPACE" | "PRIVATE";

function BoardsDashboard() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const currentUser = useWorkspaceStore((s) => s.currentUser);
  const activeRole = useWorkspaceStore((s) => s.activeRole);
  const setActiveRole = useWorkspaceStore((s) => s.setActiveRole);
  const switchDemoUser = useWorkspaceStore((s) => s.switchDemoUser);
  const logout = useWorkspaceStore((s) => s.logout);
  const themeMode = useWorkspaceStore((s) => s.themeMode);
  const setThemeMode = useWorkspaceStore((s) => s.setThemeMode);
  const useMockMode = useWorkspaceStore((s) => s.useMockMode);
  const currentWorkspaceId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const setActiveBoardId = useWorkspaceStore((s) => s.setActiveBoardId);

  // Local State
  const [searchQuery, setSearchQuery] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>("ALL");
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isCreateBoardOpen, setIsCreateBoardOpen] = useState(false);
  const [isPulseOpen, setIsPulseOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<BoardTemplate | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const userMenuRef = useRef<HTMLDivElement>(null);

  // Sync theme
  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setIsDarkMode(isDark);
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDarkMode;
    setIsDarkMode(nextDark);
    if (nextDark) {
      document.documentElement.classList.add("dark");
      setThemeMode("dark");
    } else {
      document.documentElement.classList.remove("dark");
      setThemeMode("light");
    }
  };

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target as Node)
      ) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch Boards
  const { data: boards = [], isLoading } = useQuery<Board[]>({
    queryKey: ["boards", useMockMode],
    queryFn: () => apiClient.listBoards({ useMock: useMockMode }),
  });

  // Recent boards history from localStorage
  const [recentBoardIds, setRecentBoardIds] = useState<string[]>([]);
  useEffect(() => {
    const records = getRecentBoards();
    setRecentBoardIds(records.map((r) => r.boardId));
  }, []);

  const handleOpenBoard = (boardId: string) => {
    recordRecentBoard(boardId);
    setActiveBoardId(boardId);
    router.push(`/?boardId=${boardId}`);
  };

  const handleToggleStar = async (
    e: React.MouseEvent,
    boardId: string,
    currentStarred: boolean
  ) => {
    e.stopPropagation();
    const nextStarred = !currentStarred;

    // Optimistically update query cache
    queryClient.setQueryData<Board[]>(["boards", useMockMode], (old) => {
      if (!old) return old;
      return old.map((b) =>
        b.id === boardId ? { ...b, is_starred: nextStarred } : b
      );
    });

    try {
      await apiClient.updateBoard(
        boardId,
        { is_starred: nextStarred },
        { useMock: useMockMode }
      );
      queryClient.invalidateQueries({ queryKey: ["boards"] });
      queryClient.invalidateQueries({ queryKey: ["board-summaries"] });
    } catch (err) {
      console.error("Failed to toggle star:", err);
      queryClient.invalidateQueries({ queryKey: ["boards"] });
    }
  };

  const handleCreateBoard = async (payload: CreateBoardRequest) => {
    try {
      const newBoard = await apiClient.createBoard(payload, {
        useMock: useMockMode,
      });
      recordRecentBoard(newBoard.id);
      setActiveBoardId(newBoard.id);
      queryClient.invalidateQueries({ queryKey: ["boards"] });
      queryClient.invalidateQueries({ queryKey: ["board-summaries"] });
      router.push(`/?boardId=${newBoard.id}`);
    } catch (err) {
      console.error("Failed to create board:", err);
    }
  };

  // Filtered boards for main grid
  const filteredBoards = useMemo(() => {
    return boards.filter((b) => {
      // Visibility filter
      if (visibilityFilter === "STARRED" && !b.is_starred) return false;
      if (visibilityFilter === "WORKSPACE" && b.visibility !== "WORKSPACE")
        return false;
      if (visibilityFilter === "PRIVATE" && b.visibility !== "PRIVATE")
        return false;

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesTitle = b.title.toLowerCase().includes(query);
        const matchesDesc = (b.description || "").toLowerCase().includes(query);
        const matchesLabel = (b.labels || []).some((l) =>
          l.name.toLowerCase().includes(query)
        );
        return matchesTitle || matchesDesc || matchesLabel;
      }
      return true;
    });
  }, [boards, visibilityFilter, searchQuery]);

  // Starred boards section
  const starredBoards = useMemo(() => {
    return boards.filter((b) => b.is_starred);
  }, [boards]);

  // Recently viewed boards section (up to 4)
  const recentlyViewedBoards = useMemo(() => {
    if (recentBoardIds.length === 0) return [];
    const map = new Map(boards.map((b) => [b.id, b]));
    const list: Board[] = [];
    for (const id of recentBoardIds) {
      const found = map.get(id);
      if (found && !list.some((b) => b.id === found.id)) {
        list.push(found);
      }
      if (list.length >= 4) break;
    }
    return list;
  }, [boards, recentBoardIds]);

  const handleScrollToTemplates = () => {
    const el = document.getElementById("popular-templates");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  const isViewer = activeRole === "VIEWER";

  return (
    <div className="min-h-screen w-full flex bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 transition-colors">
      {/* ------------------------------------------------------------- */}
      {/* LEFT WORKSPACE SIDEBAR                                         */}
      {/* ------------------------------------------------------------- */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 flex-col border-r border-zinc-200/90 bg-white/95 backdrop-blur-xl dark:border-zinc-800/90 dark:bg-zinc-950/95 transition-transform duration-300 ease-in-out lg:static lg:flex lg:translate-x-0 ${
          isMobileSidebarOpen ? "translate-x-0 flex shadow-2xl" : "-translate-x-full hidden"
        }`}
      >
        <div className="flex h-full flex-col justify-between">
          {/* Top: Workspace Switcher Header */}
          <div className="border-b border-zinc-200/80 p-4 dark:border-zinc-800/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-600 text-white font-black text-lg shadow-md shadow-indigo-600/30">
                  K
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-xs font-black tracking-tight text-zinc-900 dark:text-white uppercase">
                    Kanbanify Enterprise Workspace
                  </h2>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                      Enterprise Online
                    </span>
                  </div>
                </div>
              </div>

              {/* Close Mobile Button */}
              <button
                type="button"
                onClick={() => setIsMobileSidebarOpen(false)}
                className="lg:hidden rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Active User Role Pill */}
            <div className="mt-3.5 flex items-center justify-between rounded-xl border border-zinc-200/80 bg-zinc-50/80 px-3 py-1.5 dark:border-zinc-800/80 dark:bg-zinc-900/60">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                <Shield className="h-3.5 w-3.5 text-indigo-500" />
                <span>Your Role:</span>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                  activeRole === "ADMIN"
                    ? "bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-300/40"
                    : activeRole === "EDITOR"
                    ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-300/40"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300/40"
                }`}
              >
                {activeRole === "ADMIN"
                  ? "👑 Admin"
                  : activeRole === "EDITOR"
                  ? "✏️ Editor"
                  : "👁️ Viewer"}
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="flex-1 space-y-1.5 overflow-y-auto p-3">
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Workspace Navigation
            </div>

            {/* 📋 Boards (Active view) */}
            <button
              type="button"
              onClick={() => {
                window.scrollTo({ top: 0, behavior: "smooth" });
                setIsMobileSidebarOpen(false);
              }}
              className="flex w-full items-center justify-between rounded-xl bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-900 shadow-2xs dark:bg-indigo-950/60 dark:text-indigo-200 border border-indigo-200/60 dark:border-indigo-800/60"
            >
              <div className="flex items-center gap-2.5">
                <FolderKanban className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                <span>📋 Boards</span>
              </div>
              <span className="rounded-full bg-indigo-200/70 px-2 py-0.5 text-[10px] font-bold text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300">
                {boards.length}
              </span>
            </button>

            {/* ✨ Templates Link */}
            <button
              type="button"
              onClick={() => {
                handleScrollToTemplates();
                setIsMobileSidebarOpen(false);
              }}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <LayoutTemplate className="h-4 w-4 text-amber-500" />
                <span>✨ Templates</span>
              </div>
              <span className="text-[10px] font-semibold text-zinc-400">
                4 Available
              </span>
            </button>

            {/* 📊 Workspace Pulse Link */}
            <button
              type="button"
              onClick={() => {
                setIsPulseOpen(true);
                setIsMobileSidebarOpen(false);
              }}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <Activity className="h-4 w-4 text-emerald-500" />
                <span>📊 Workspace Pulse</span>
              </div>
              <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
            </button>

            {/* ⚙️ Workspace Members & Role Switcher Section */}
            <div className="pt-4">
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                ⚙️ Workspace Members & Roles
              </div>

              {/* Members Avatar List */}
              <div className="mt-1 space-y-1">
                {DEMO_USERS.map((demo) => {
                  const isCurrent = currentUser?.id === demo.id;
                  return (
                    <div
                      key={demo.id}
                      className={`flex items-center justify-between rounded-xl px-2.5 py-1.5 text-xs transition-colors ${
                        isCurrent
                          ? "bg-zinc-100 dark:bg-zinc-900 font-semibold"
                          : "text-zinc-600 dark:text-zinc-400"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <div
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-2xs"
                          style={{ backgroundColor: demo.color }}
                        >
                          {demo.initials}
                        </div>
                        <span className="truncate">{demo.name}</span>
                      </div>
                      <span className="text-[10px] font-bold text-zinc-400">
                        {demo.default_role}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* 1-Click Demo Role Switcher Buttons */}
              <div className="mt-2.5 rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-2.5 dark:border-zinc-800/80 dark:bg-zinc-900/40">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                  1-Click Role Switcher
                </p>
                <div className="grid grid-cols-3 gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveRole("ADMIN")}
                    className={`rounded-lg px-2 py-1 text-[11px] font-bold transition-all ${
                      activeRole === "ADMIN"
                        ? "bg-purple-600 text-white shadow-xs"
                        : "bg-white text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    }`}
                  >
                    👑 Admin
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveRole("EDITOR")}
                    className={`rounded-lg px-2 py-1 text-[11px] font-bold transition-all ${
                      activeRole === "EDITOR"
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "bg-white text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    }`}
                  >
                    ✏️ Editor
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveRole("VIEWER")}
                    className={`rounded-lg px-2 py-1 text-[11px] font-bold transition-all ${
                      activeRole === "VIEWER"
                        ? "bg-amber-600 text-white shadow-xs"
                        : "bg-white text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    }`}
                  >
                    👁️ Viewer
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Sidebar: User Status & Trello Ingestion Callout */}
          <div className="border-t border-zinc-200/80 p-3.5 dark:border-zinc-800/80">
            <button
              type="button"
              onClick={() => setIsPulseOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-2 text-xs font-bold text-white shadow-md shadow-indigo-600/25 transition-all hover:from-indigo-500 hover:to-violet-500"
            >
              <Activity className="h-4 w-4" />
              <span>Workspace Pulse & Import</span>
            </button>
          </div>
        </div>
      </aside>

      {/* ------------------------------------------------------------- */}
      {/* MAIN CONTENT AREA                                              */}
      {/* ------------------------------------------------------------- */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* TOP BAR: Search, Filter, Mode & User Profile */}
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-zinc-200/90 bg-white/90 px-4 sm:px-6 backdrop-blur-xl dark:border-zinc-800/90 dark:bg-zinc-950/90">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* Mobile Hamburger Button */}
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="lg:hidden rounded-lg p-2 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <PanelLeft className="h-5 w-5" />
            </button>

            {/* Instant Search Input */}
            <div className="relative max-w-md w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="🔍 Search boards by title or tag..."
                className="w-full rounded-xl border border-zinc-300 bg-zinc-50/80 py-1.5 pl-9 pr-8 text-xs font-medium text-zinc-900 placeholder-zinc-400 transition-all focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:bg-zinc-900"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Visibility Filters (Desktop) */}
            <div className="hidden md:flex items-center gap-1 rounded-xl border border-zinc-200 bg-zinc-100/80 p-0.5 dark:border-zinc-800 dark:bg-zinc-900">
              {(["ALL", "STARRED", "WORKSPACE", "PRIVATE"] as VisibilityFilter[]).map(
                (filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setVisibilityFilter(filter)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${
                      visibilityFilter === filter
                        ? "bg-white text-zinc-900 shadow-2xs dark:bg-zinc-800 dark:text-white"
                        : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                    }`}
                  >
                    {filter === "ALL"
                      ? "All"
                      : filter === "STARRED"
                      ? "⭐ Starred"
                      : filter === "WORKSPACE"
                      ? "Workspace"
                      : "Private"}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Right Controls: Theme Toggle & User Menu */}
          <div className="flex items-center gap-3 shrink-0 ml-4">
            {/* Light / Dark Mode Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle light and dark theme"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 shadow-2xs hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-all"
            >
              {isDarkMode ? (
                <Sun className="h-4 w-4 text-amber-400" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>

            {/* User Profile Dropdown */}
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white p-1.5 shadow-2xs hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 transition-all"
              >
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold text-white shadow-2xs"
                  style={{
                    backgroundColor: currentUser?.color || "#6366f1",
                  }}
                >
                  {currentUser?.initials || "U"}
                </div>
                <div className="hidden sm:block text-left pr-1">
                  <p className="truncate text-xs font-bold text-zinc-900 dark:text-zinc-100 max-w-[100px]">
                    {currentUser?.name || "User"}
                  </p>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
              </button>

              {/* Dropdown Menu */}
              {isUserMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl border border-zinc-200 bg-white p-2 shadow-2xl backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900 animate-in fade-in-0 zoom-in-95 z-50">
                  <div className="border-b border-zinc-100 p-2.5 dark:border-zinc-800">
                    <p className="text-xs font-bold text-zinc-900 dark:text-white">
                      {currentUser?.name}
                    </p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                      {currentUser?.email}
                    </p>
                    <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400">
                      <span>Active Role:</span>
                      <strong>{activeRole}</strong>
                    </div>
                  </div>

                  {/* Switch Demo Persona */}
                  <div className="p-1.5">
                    <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      Switch Persona
                    </p>
                    <div className="space-y-0.5">
                      {DEMO_USERS.map((demo) => (
                        <button
                          key={demo.id}
                          type="button"
                          onClick={() => {
                            switchDemoUser(demo);
                            setIsUserMenuOpen(false);
                          }}
                          className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs transition-colors ${
                            currentUser?.id === demo.id
                              ? "bg-indigo-50 font-bold text-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-200"
                              : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: demo.color }}
                            />
                            <span>{demo.name}</span>
                          </div>
                          <span className="text-[10px] text-zinc-400">
                            {demo.default_role}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Log Out Button */}
                  <div className="border-t border-zinc-100 p-1.5 dark:border-zinc-800">
                    <button
                      type="button"
                      onClick={() => {
                        logout();
                        router.push("/login");
                      }}
                      className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-bold text-rose-600 transition-colors hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Log Out of Workspace</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* DASHBOARD CONTENT BODY */}
        <div className="flex-1 space-y-9 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {/* --------------------------------------------------------- */}
          {/* 1. 🔥 MOST POPULAR BOARD TEMPLATES SECTION                */}
          {/* --------------------------------------------------------- */}
          <section id="popular-templates" className="scroll-mt-20">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 dark:bg-amber-400/15">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-zinc-900 dark:text-white">
                    🔥 Most Popular Board Templates
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Get started in seconds with pre-seeded columns, starter cards & automations
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {POPULAR_TEMPLATES.map((tmpl) => (
                <div
                  key={tmpl.id}
                  onClick={() => setSelectedTemplate(tmpl)}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-indigo-400/50 hover:shadow-xl dark:border-zinc-800/90 dark:bg-zinc-900 cursor-pointer"
                >
                  {/* Gradient Preview Header */}
                  <div
                    className="relative -mx-4 -mt-4 mb-3 h-20 w-[calc(100%+2rem)] p-3 transition-transform duration-300 group-hover:scale-102"
                    style={{ background: tmpl.background?.value }}
                  >
                    <span className="rounded-md bg-black/40 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-xs">
                      {tmpl.category}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {tmpl.name}
                    </h3>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                      {tmpl.description}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-zinc-400">
                      {tmpl.default_columns.length} columns
                    </span>

                    {/* "Use Template" Button visible on hover */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTemplate(tmpl);
                      }}
                      className="flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-xs transition-all hover:bg-indigo-500 group-hover:shadow-md"
                    >
                      <span>Use Template</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* --------------------------------------------------------- */}
          {/* 2. ⭐ STARRED BOARDS SECTION (If 1 or more exist)           */}
          {/* --------------------------------------------------------- */}
          {starredBoards.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                <h2 className="text-base font-extrabold text-zinc-900 dark:text-white">
                  ⭐ Starred Boards ({starredBoards.length})
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {starredBoards.map((b) => (
                  <BoardCard
                    key={`starred-${b.id}`}
                    board={b}
                    onOpen={() => handleOpenBoard(b.id)}
                    onToggleStar={(e) => handleToggleStar(e, b.id, b.is_starred)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* --------------------------------------------------------- */}
          {/* 3. 🕒 RECENTLY VIEWED BOARDS SECTION                      */}
          {/* --------------------------------------------------------- */}
          {recentlyViewedBoards.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <History className="h-4 w-4 text-indigo-500" />
                <h2 className="text-base font-extrabold text-zinc-900 dark:text-white">
                  🕒 Recently Viewed Boards
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {recentlyViewedBoards.map((b) => (
                  <BoardCard
                    key={`recent-${b.id}`}
                    board={b}
                    badgeLabel="Recent"
                    onOpen={() => handleOpenBoard(b.id)}
                    onToggleStar={(e) => handleToggleStar(e, b.id, b.is_starred)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* --------------------------------------------------------- */}
          {/* 4. 🏢 YOUR WORKSPACE BOARDS GRID + "➕ CREATE NEW BOARD"   */}
          {/* --------------------------------------------------------- */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <LayoutGrid className="h-4 w-4 text-indigo-500" />
                <h2 className="text-base font-extrabold text-zinc-900 dark:text-white">
                  🏢 Your Workspace Boards ({filteredBoards.length})
                </h2>
              </div>

              {visibilityFilter !== "ALL" && (
                <button
                  type="button"
                  onClick={() => setVisibilityFilter("ALL")}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Clear filter ({visibilityFilter})
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredBoards.map((b) => (
                <BoardCard
                  key={`all-${b.id}`}
                  board={b}
                  onOpen={() => handleOpenBoard(b.id)}
                  onToggleStar={(e) => handleToggleStar(e, b.id, b.is_starred)}
                />
              ))}

              {/* Signature Trello "➕ Create new board" Tile */}
              <div
                onClick={() => {
                  if (!isViewer) {
                    setIsCreateBoardOpen(true);
                  }
                }}
                className={`group relative flex h-36 flex-col items-center justify-center rounded-2xl border-2 border-dashed p-4 text-center transition-all ${
                  isViewer
                    ? "border-zinc-200/80 bg-zinc-100/50 dark:border-zinc-800 dark:bg-zinc-900/30 opacity-60 cursor-not-allowed"
                    : "border-zinc-300/90 bg-zinc-50/50 hover:border-indigo-500 hover:bg-indigo-50/40 dark:border-zinc-800 dark:bg-zinc-900/40 dark:hover:border-indigo-400/80 dark:hover:bg-indigo-950/20 cursor-pointer shadow-xs hover:shadow-md"
                }`}
                title={
                  isViewer
                    ? "Creating boards is restricted to Admins and Editors"
                    : "Click to create a new board"
                }
              >
                {isViewer ? (
                  <>
                    <Lock className="h-6 w-6 text-zinc-400 mb-1.5" />
                    <p className="text-xs font-bold text-zinc-500">
                      Create Restricted
                    </p>
                    <span className="text-[10px] text-zinc-400">
                      Viewer Role Active
                    </span>
                  </>
                ) : (
                  <>
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-200 text-zinc-700 transition-transform group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white dark:bg-zinc-800 dark:text-zinc-200 shadow-2xs">
                      <Plus className="h-5 w-5" />
                    </div>
                    <p className="mt-2 text-xs font-bold text-zinc-700 group-hover:text-indigo-600 dark:text-zinc-300 dark:group-hover:text-indigo-400">
                      ➕ Create new board
                    </p>
                    <span className="text-[10px] text-zinc-400">
                      Pick template & background
                    </span>
                  </>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* ------------------------------------------------------------- */}
      {/* MODALS: Create Board, Template Confirmation, Pulse & Trello    */}
      {/* ------------------------------------------------------------- */}
      {/* Create Board Modal */}
      <CreateBoardModal
        isOpen={isCreateBoardOpen}
        onClose={() => setIsCreateBoardOpen(false)}
        onCreateBoard={handleCreateBoard}
      />

      {/* 1-Click Template Confirmation Modal */}
      {selectedTemplate && (
        <TemplateConfirmationModal
          template={selectedTemplate}
          isOpen={Boolean(selectedTemplate)}
          onClose={() => setSelectedTemplate(null)}
          onConfirm={handleCreateBoard}
        />
      )}

      {/* Workspace Pulse & Direct Trello Ingestion Modal */}
      <WorkspacePulseModal
        boards={boards}
        isOpen={isPulseOpen}
        onClose={() => setIsPulseOpen(false)}
        onImportSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["boards"] });
          queryClient.invalidateQueries({ queryKey: ["board-summaries"] });
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Board Card Component
// ---------------------------------------------------------------------------
interface BoardCardProps {
  board: Board;
  badgeLabel?: string;
  onOpen: () => void;
  onToggleStar: (e: React.MouseEvent) => void;
}

function BoardCard({
  board,
  badgeLabel,
  onOpen,
  onToggleStar,
}: BoardCardProps) {
  const activeCardsCount = (board.cards || []).filter((c) => !c.is_archived).length;
  const columnsCount = (board.columns || []).filter((col) => !col.is_archived).length;
  const members = board.members || [];

  return (
    <div
      onClick={onOpen}
      className="group relative flex h-36 flex-col justify-between overflow-hidden rounded-2xl p-4 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-xl cursor-pointer select-none border border-black/10 dark:border-white/10"
      style={
        board.background?.type === "gradient"
          ? { background: board.background.value }
          : board.background?.value.startsWith("#") ||
            board.background?.value.startsWith("rgb")
          ? { backgroundColor: board.background.value }
          : { background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)" }
      }
    >
      {/* Subtle overlay for contrast */}
      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />

      {/* Top row: Title & Star Toggle */}
      <div className="relative z-10 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-extrabold text-white drop-shadow-sm">
            {board.title}
          </h3>
          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
            {badgeLabel && (
              <span className="rounded bg-indigo-500/80 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-2xs backdrop-blur-xs">
                {badgeLabel}
              </span>
            )}
            <span className="rounded bg-white/20 px-1.5 py-0.5 text-[9px] font-bold text-white backdrop-blur-xs">
              {board.visibility || "WORKSPACE"}
            </span>
          </div>
        </div>

        {/* Interactive Star Toggle Button (stops propagation) */}
        <button
          type="button"
          onClick={onToggleStar}
          title={board.is_starred ? "Unstar board" : "Star board"}
          className={`rounded-lg p-1.5 transition-transform duration-150 hover:scale-120 ${
            board.is_starred
              ? "bg-black/40 text-amber-400"
              : "bg-black/20 text-white/70 hover:text-white"
          }`}
        >
          <Star
            className={`h-4 w-4 ${
              board.is_starred ? "fill-amber-400 text-amber-400" : ""
            }`}
          />
        </button>
      </div>

      {/* Bottom row: Metrics Badges & Member Avatar Stack */}
      <div className="relative z-10 flex items-center justify-between text-[11px] text-white/90">
        <div className="flex items-center gap-1.5 font-bold">
          <span className="rounded-md bg-black/40 px-2 py-0.5 backdrop-blur-xs">
            {activeCardsCount} cards
          </span>
          <span className="rounded-md bg-black/40 px-2 py-0.5 backdrop-blur-xs">
            {columnsCount} lists
          </span>
        </div>

        {/* Member Avatar Stack */}
        {members.length > 0 && (
          <div className="flex items-center -space-x-1.5 overflow-hidden">
            {members.slice(0, 3).map((m, idx) => (
              <div
                key={m.id || idx}
                title={m.name}
                className="flex h-5 w-5 items-center justify-center rounded-full border border-white text-[9px] font-bold text-white shadow-xs"
                style={{
                  backgroundColor:
                    idx === 0 ? "#6366f1" : idx === 1 ? "#10b981" : "#f59e0b",
                }}
              >
                {(m.name || "U").charAt(0).toUpperCase()}
              </div>
            ))}
            {members.length > 3 && (
              <div className="flex h-5 w-5 items-center justify-center rounded-full border border-white bg-zinc-800 text-[8px] font-bold text-white shadow-xs">
                +{members.length - 3}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function BoardsPage() {
  return (
    <AuthGuard>
      <Suspense fallback={<div className="min-h-screen bg-zinc-950" />}>
        <BoardsDashboard />
      </Suspense>
    </AuthGuard>
  );
}
