"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  BarChart3,
  Bot,
  CheckCircle2,
  CheckSquare,
  Download,
  Flame,
  Gauge,
  Layers,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import {
  AIAnalyticsReport,
  BoardAnalytics,
  LabelColor,
  Priority,
  SprintHealthStatus,
} from "@kinetix/contracts";
import { useWorkspaceStore } from "@/store/workspace-store";
import {
  computeBoardAnalyticsFromBoard,
  synthesizeAIAnalyticsReport,
} from "@/lib/mock-data";
import { apiClient } from "@/lib/api-client";
import { LABEL_COLOR_MAP } from "@/lib/trello-theme";

interface AnalyticsViewProps {
  onOpenImportExport: () => void;
}

const PRIORITY_COLORS: Record<
  Priority,
  { bar: string; badge: string; dot: string; label: string }
> = {
  URGENT: {
    bar: "bg-rose-500",
    badge:
      "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    dot: "bg-rose-500",
    label: "Urgent",
  },
  HIGH: {
    bar: "bg-amber-500",
    badge:
      "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
    label: "High",
  },
  MEDIUM: {
    bar: "bg-indigo-500",
    badge:
      "border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
    dot: "bg-indigo-500",
    label: "Medium",
  },
  LOW: {
    bar: "bg-emerald-500",
    badge:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
    label: "Low",
  },
};

const HEALTH_STATUS_STYLES: Record<
  SprintHealthStatus,
  {
    badge: string;
    ringStroke: string;
    label: string;
    glow: string;
  }
> = {
  EXCELLENT: {
    badge:
      "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    ringStroke: "#10b981",
    label: "EXCELLENT",
    glow: "from-emerald-500/15 via-teal-500/5 to-transparent",
  },
  ON_TRACK: {
    badge:
      "border-indigo-500/40 bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
    ringStroke: "#6366f1",
    label: "ON_TRACK",
    glow: "from-indigo-500/15 via-violet-500/5 to-transparent",
  },
  AT_RISK: {
    badge:
      "border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-amber-300",
    ringStroke: "#f59e0b",
    label: "AT_RISK",
    glow: "from-amber-500/15 via-orange-500/5 to-transparent",
  },
  CRITICAL: {
    badge:
      "border-rose-500/40 bg-rose-500/15 text-rose-700 dark:text-rose-300",
    ringStroke: "#ef4444",
    label: "CRITICAL",
    glow: "from-rose-500/15 via-red-500/5 to-transparent",
  },
};

function renderFormattedSummary(markdownText: string) {
  const parts = markdownText.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong
          key={idx}
          className="font-semibold text-zinc-950 dark:text-white"
        >
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

export function AnalyticsView({ onOpenImportExport }: AnalyticsViewProps) {
  const board = useWorkspaceStore((s) => s.board);
  const useMockMode = useWorkspaceStore((s) => s.useMockMode);

  // Instant real-time computation from current board state + optional live API sync
  const localAnalytics = useMemo(
    () => computeBoardAnalyticsFromBoard(board),
    [board]
  );

  const [remoteAnalytics, setRemoteAnalytics] =
    useState<BoardAnalytics | null>(null);
  const [aiReport, setAiReport] = useState<AIAnalyticsReport | null>(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [checkedRecs, setCheckedRecs] = useState<Record<number, boolean>>({});
  const [hoveredBurndownIdx, setHoveredBurndownIdx] = useState<number | null>(
    null
  );
  const [hoveredColId, setHoveredColId] = useState<string | null>(null);

  // Sync analytics from backend when in Live API mode
  useEffect(() => {
    let cancelled = false;
    if (useMockMode) {
      setRemoteAnalytics(null);
      return;
    }
    apiClient
      .getBoardAnalytics(board.id, { useMock: false })
      .then((res) => {
        if (!cancelled) setRemoteAnalytics(res);
      })
      .catch(() => {
        if (!cancelled) setRemoteAnalytics(null);
      });
    return () => {
      cancelled = true;
    };
  }, [board.id, board.cards, board.columns, useMockMode]);

  const analytics = useMemo(
    () => (useMockMode || !remoteAnalytics ? localAnalytics : remoteAnalytics),
    [useMockMode, remoteAnalytics, localAnalytics]
  );

  // Pre-populate initial AI Sprint Report when board changes so user sees executive insights immediately, and can click "✨ Generate AI Sprint Insights" anytime to refresh/re-analyze
  useEffect(() => {
    setAiReport(synthesizeAIAnalyticsReport(board.title, localAnalytics));
    setCheckedRecs({});
  }, [board.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGenerateAiReport = async () => {
    setIsGeneratingAi(true);
    try {
      const report = await apiClient.generateAIAnalyticsReport(board.id, {
        useMock: useMockMode,
      });
      setAiReport(report);
      setCheckedRecs({});
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const remainingStoryPoints = Math.max(
    0,
    analytics.total_story_points - analytics.completed_story_points
  );
  const pointsVelocityPct =
    analytics.total_story_points > 0
      ? Math.round(
          (analytics.completed_story_points / analytics.total_story_points) *
            100
        )
      : 0;

  // SVG Burndown Chart Geometry
  const burndownSeries =
    analytics.burndown_series.length > 0
      ? analytics.burndown_series
      : localAnalytics.burndown_series;
  const svgWidth = 640;
  const svgHeight = 250;
  const padLeft = 44;
  const padRight = 24;
  const padTop = 24;
  const padBottom = 38;
  const plotW = svgWidth - padLeft - padRight;
  const plotH = svgHeight - padTop - padBottom;

  const maxPoints = Math.max(
    10,
    ...burndownSeries.map((d) =>
      Math.max(d.ideal_remaining_points, d.actual_remaining_points)
    )
  );
  const maxCompletedCards = Math.max(
    5,
    ...burndownSeries.map((d) => d.completed_cards_count)
  );

  const getX = (idx: number) =>
    burndownSeries.length <= 1
      ? padLeft + plotW / 2
      : padLeft + (idx / (burndownSeries.length - 1)) * plotW;

  const getY = (pts: number) =>
    padTop + plotH - (Math.min(pts, maxPoints) / maxPoints) * plotH;

  const idealPointsPath = burndownSeries
    .map((d, i) => `${i === 0 ? "M" : "L"} ${getX(i).toFixed(1)} ${getY(d.ideal_remaining_points).toFixed(1)}`)
    .join(" ");

  const actualPointsPath = burndownSeries
    .map((d, i) => `${i === 0 ? "M" : "L"} ${getX(i).toFixed(1)} ${getY(d.actual_remaining_points).toFixed(1)}`)
    .join(" ");

  const actualAreaPath =
    burndownSeries.length > 0
      ? `${actualPointsPath} L ${getX(burndownSeries.length - 1).toFixed(1)} ${(padTop + plotH).toFixed(1)} L ${getX(0).toFixed(1)} ${(padTop + plotH).toFixed(1)} Z`
      : "";

  const maxColCards = Math.max(
    1,
    ...analytics.cards_by_column.map((c) =>
      Math.max(c.card_count, c.wip_limit ?? 0)
    )
  );

  const totalPriorityCards = Math.max(
    1,
    analytics.cards_by_priority.reduce((acc, p) => acc + p.count, 0)
  );

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 pb-12">
      {/* Analytics Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-200/80 bg-white/95 px-5 py-4 shadow-xs backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-900/90">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                Team Productivity &amp; Sprint Telemetry
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Real-Time Sync
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Live metrics computed across{" "}
              <span className="font-semibold text-zinc-700 dark:text-zinc-200">
                {analytics.total_cards} active cards
              </span>
              ,{" "}
              <span className="font-semibold text-zinc-700 dark:text-zinc-200">
                {analytics.cards_by_column.length} workflow lists
              </span>
              , and{" "}
              <span className="font-semibold text-zinc-700 dark:text-zinc-200">
                {analytics.workload_by_member.length} team members
              </span>
              .
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenImportExport}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200/80 bg-zinc-50 px-3.5 py-2 text-xs font-semibold text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-white dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-200 dark:hover:border-zinc-700"
          >
            <Download className="h-3.5 w-3.5 text-indigo-500" />
            <span>📥 Import / 📤 Export Data</span>
          </button>

          <button
            type="button"
            onClick={handleGenerateAiReport}
            disabled={isGeneratingAi}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:from-indigo-500 hover:to-violet-500 disabled:opacity-60"
          >
            {isGeneratingAi ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            <span>✨ Generate AI Sprint Insights</span>
          </button>
        </div>
      </div>

      {/* 1. TOP KPI METRIC CARDS (5 CARDS) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* Card 1: Completion Rate (Progress Ring + Bar) */}
        <div className="relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/95 p-4 shadow-xs backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-900/90">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
                Completion Rate
              </p>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="font-mono text-2xl font-bold text-zinc-900 dark:text-white">
                  {analytics.completion_rate.toFixed(1)}%
                </span>
                <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                  {analytics.completed_cards}/{analytics.total_cards} cards
                </span>
              </div>
            </div>

            {/* Crisp SVG Progress Ring */}
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
              <svg className="h-12 w-12 -rotate-90" viewBox="0 0 44 44">
                <circle
                  cx="22"
                  cy="22"
                  r="17"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4.5"
                  className="text-zinc-200 dark:text-zinc-800"
                />
                <circle
                  cx="22"
                  cy="22"
                  r="17"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="4.5"
                  strokeLinecap="round"
                  strokeDasharray={`${(analytics.completion_rate / 100) * 106.8} 106.8`}
                />
              </svg>
              <CheckCircle2 className="absolute h-4 w-4 text-emerald-500" />
            </div>
          </div>

          <div className="mt-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                style={{
                  width: `${Math.min(100, analytics.completion_rate)}%`,
                }}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
              {analytics.archived_cards} archived card(s) excluded
            </p>
          </div>
        </div>

        {/* Card 2: Sprint Velocity (Story Points) */}
        <div className="relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/95 p-4 shadow-xs backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-900/90">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
                Sprint Velocity (Pts)
              </p>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="font-mono text-2xl font-bold text-zinc-900 dark:text-white">
                  {analytics.completed_story_points}
                  <span className="text-sm font-normal text-zinc-400">
                    /{analytics.total_story_points}
                  </span>
                </span>
                <span className="rounded-md bg-indigo-500/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-indigo-700 dark:text-indigo-300">
                  {pointsVelocityPct}% burned
                </span>
              </div>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
                style={{ width: `${Math.min(100, pointsVelocityPct)}%` }}
              />
            </div>
            <p className="mt-1.5 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
              <span>Remaining Story Points:</span>
              <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-200">
                {remainingStoryPoints} pts
              </span>
            </p>
          </div>
        </div>

        {/* Card 3: Checklist Completion */}
        <div className="relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/95 p-4 shadow-xs backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-900/90">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
                Checklist Completion
              </p>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="font-mono text-2xl font-bold text-zinc-900 dark:text-white">
                  {analytics.checklist_completion_rate.toFixed(1)}%
                </span>
                <span className="rounded-md bg-sky-500/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-sky-700 dark:text-sky-300">
                  Subtasks
                </span>
              </div>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <CheckSquare className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-400 transition-all duration-500"
                style={{
                  width: `${Math.min(100, analytics.checklist_completion_rate)}%`,
                }}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
              Across all active Trello checklists
            </p>
          </div>
        </div>

        {/* Card 4: Risk & Bottlenecks */}
        <div className="relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/95 p-4 shadow-xs backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-900/90">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
                Risk &amp; Bottlenecks
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 font-mono text-sm font-bold ${
                    analytics.overdue_cards_count > 0
                      ? "border-rose-500/40 bg-rose-500/15 text-rose-700 dark:text-rose-300"
                      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  }`}
                >
                  {analytics.overdue_cards_count} Overdue
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 font-mono text-sm font-bold ${
                    analytics.blocked_cards_count > 0
                      ? "border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-amber-300"
                      : "border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                  }`}
                >
                  {analytics.blocked_cards_count} Blocked
                </span>
              </div>
            </div>
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                analytics.overdue_cards_count > 0 ||
                analytics.blocked_cards_count > 0
                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              }`}
            >
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
            <span>WIP Bottleneck Lists:</span>
            <span
              className={`font-mono font-semibold ${
                analytics.cards_by_column.some((c) => c.is_bottleneck)
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {analytics.cards_by_column.filter((c) => c.is_bottleneck).length}{" "}
              flagged
            </span>
          </div>
        </div>

        {/* Card 5: Butler Efficiency */}
        <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/5 via-white/95 to-white/95 p-4 shadow-xs backdrop-blur-md dark:border-amber-500/25 dark:from-amber-500/10 dark:via-zinc-900/90 dark:to-zinc-900/90">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold tracking-wider text-amber-700 uppercase dark:text-amber-300">
                Butler Efficiency
              </p>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="font-mono text-2xl font-bold text-zinc-900 dark:text-white">
                  {analytics.automation_executions_total}
                </span>
                <span className="rounded-md bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-200">
                  ⚡ Automated Actions Saved
                </span>
              </div>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-300">
              <Zap className="h-5 w-5 fill-amber-500" />
            </div>
          </div>

          <p className="mt-4 text-[11px] text-zinc-600 dark:text-zinc-400">
            Zero-touch rule triggers across{" "}
            <span className="font-semibold text-zinc-900 dark:text-zinc-200">
              {(board.automation_rules ?? []).filter((r) => r.is_enabled).length}{" "}
              enabled rules
            </span>
          </p>
        </div>
      </div>

      {/* 2. INTERACTIVE SVG CHARTS ROW 1: BURNDOWN & COLUMN WIP BOTTLENECKS */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left 7 Cols: Sprint Burndown & Velocity Chart (burndown_series) */}
        <div className="flex flex-col justify-between rounded-2xl border border-zinc-200/80 bg-white/95 p-5 shadow-xs backdrop-blur-md lg:col-span-7 dark:border-zinc-800/80 dark:bg-zinc-900/90">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-zinc-100">
                <Activity className="h-4 w-4 text-indigo-500" />
                Sprint Burndown &amp; Velocity Chart
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Ideal vs. Actual Remaining Story Points + Daily Completed Cards
              </p>
            </div>

            {/* Chart Legend */}
            <div className="flex flex-wrap items-center gap-3 text-[11px]">
              <span className="inline-flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
                <span className="h-0.5 w-4 border-t-2 border-dashed border-slate-400" />
                Ideal Remaining
              </span>
              <span className="inline-flex items-center gap-1.5 font-medium text-indigo-600 dark:text-indigo-400">
                <span className="h-2 w-2 rounded-full bg-indigo-500" />
                Actual Remaining
              </span>
              <span className="inline-flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
                <span className="h-2.5 w-2.5 rounded-xs bg-emerald-500/50" />
                Completed Cards
              </span>
            </div>
          </div>

          {/* Responsive Custom SVG Chart */}
          <div className="relative w-full">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="h-64 w-full overflow-visible select-none"
              role="img"
              aria-label="Sprint Burndown Dual-Line Chart"
            >
              <defs>
                <linearGradient
                  id="actualBurndownGrad"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#6366f1" stopOpacity="0.32" />
                  <stop offset="65%" stopColor="#10b981" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Horizontal Grid Lines & Y-Axis Labels */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                const y = padTop + plotH * ratio;
                const val = Math.round(maxPoints * (1 - ratio));
                return (
                  <g key={idx}>
                    <line
                      x1={padLeft}
                      y1={y}
                      x2={svgWidth - padRight}
                      y2={y}
                      stroke="currentColor"
                      strokeDasharray="3 3"
                      className="text-zinc-200 dark:text-zinc-800"
                    />
                    <text
                      x={padLeft - 8}
                      y={y + 4}
                      textAnchor="end"
                      className="fill-zinc-400 font-mono text-[10px] dark:fill-zinc-500"
                    >
                      {val}p
                    </text>
                  </g>
                );
              })}

              {/* Daily Completed Cards Bar Indicator */}
              {burndownSeries.map((d, i) => {
                const x = getX(i);
                const maxBarH = plotH * 0.42;
                const barH =
                  (d.completed_cards_count / maxCompletedCards) * maxBarH;
                const barW = 20;
                return (
                  <g key={`bar-${d.date}`}>
                    <rect
                      x={x - barW / 2}
                      y={padTop + plotH - barH}
                      width={barW}
                      height={Math.max(2, barH)}
                      rx={4}
                      className="fill-emerald-500/25 transition-all duration-300 dark:fill-emerald-400/25"
                    />
                  </g>
                );
              })}

              {/* Area under Actual Remaining Points */}
              {actualAreaPath && (
                <path d={actualAreaPath} fill="url(#actualBurndownGrad)" />
              )}

              {/* Ideal Remaining Points Line (Dashed Slate) */}
              {idealPointsPath && (
                <path
                  d={idealPointsPath}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="2"
                  strokeDasharray="6 4"
                />
              )}

              {/* Actual Remaining Points Line (Solid Indigo) */}
              {actualPointsPath && (
                <path
                  d={actualPointsPath}
                  fill="none"
                  stroke="#6366f1"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Interactive Data Points & Hover Targets */}
              {burndownSeries.map((d, i) => {
                const x = getX(i);
                const yActual = getY(d.actual_remaining_points);
                const yIdeal = getY(d.ideal_remaining_points);
                const isHovered = hoveredBurndownIdx === i;

                return (
                  <g
                    key={d.date}
                    onMouseEnter={() => setHoveredBurndownIdx(i)}
                    onMouseLeave={() => setHoveredBurndownIdx(null)}
                    className="cursor-pointer"
                  >
                    {isHovered && (
                      <line
                        x1={x}
                        y1={padTop}
                        x2={x}
                        y2={padTop + plotH}
                        stroke="#6366f1"
                        strokeWidth="1.5"
                        strokeDasharray="2 2"
                      />
                    )}

                    {/* Ideal Dot */}
                    <circle
                      cx={x}
                      cy={yIdeal}
                      r={isHovered ? 4.5 : 3}
                      className="fill-slate-400 stroke-white dark:stroke-zinc-900"
                      strokeWidth="1.5"
                    />

                    {/* Actual Dot */}
                    <circle
                      cx={x}
                      cy={yActual}
                      r={isHovered ? 6 : 4.5}
                      className="fill-indigo-600 stroke-white transition-transform dark:fill-indigo-400 dark:stroke-zinc-900"
                      strokeWidth="2"
                    />

                    {/* X-Axis Day Label */}
                    <text
                      x={x}
                      y={svgHeight - 10}
                      textAnchor="middle"
                      className={`font-mono text-[11px] ${
                        isHovered
                          ? "fill-indigo-600 font-bold dark:fill-indigo-400"
                          : "fill-zinc-500 dark:fill-zinc-400"
                      }`}
                    >
                      {d.date}
                    </text>

                    {/* Invisible wide hover target column */}
                    <rect
                      x={x - plotW / (burndownSeries.length * 2)}
                      y={padTop}
                      width={plotW / burndownSeries.length}
                      height={plotH}
                      fill="transparent"
                    />
                  </g>
                );
              })}
            </svg>

            {/* Hover Tooltip Overlay */}
            {hoveredBurndownIdx !== null &&
              burndownSeries[hoveredBurndownIdx] && (
                <div className="pointer-events-none absolute top-2 right-3 z-10 rounded-xl border border-zinc-200/90 bg-white/95 px-3.5 py-2.5 text-xs shadow-lg backdrop-blur-md dark:border-zinc-700 dark:bg-zinc-900/95">
                  <div className="mb-1 flex items-center justify-between gap-4 border-b border-zinc-100 pb-1 font-mono font-bold text-zinc-900 dark:border-zinc-800 dark:text-white">
                    <span>{burndownSeries[hoveredBurndownIdx].date}</span>
                    <span className="text-[10px] text-indigo-500">
                      Sprint Telemetry
                    </span>
                  </div>
                  <div className="space-y-1 font-mono text-[11px]">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-zinc-500">Ideal Remaining:</span>
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                        {
                          burndownSeries[hoveredBurndownIdx]
                            .ideal_remaining_points
                        }{" "}
                        pts
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-indigo-600 dark:text-indigo-400">
                        Actual Remaining:
                      </span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">
                        {
                          burndownSeries[hoveredBurndownIdx]
                            .actual_remaining_points
                        }{" "}
                        pts
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-emerald-600 dark:text-emerald-400">
                        Completed Cards:
                      </span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {
                          burndownSeries[hoveredBurndownIdx]
                            .completed_cards_count
                        }{" "}
                        cards
                      </span>
                    </div>
                  </div>
                </div>
              )}
          </div>
        </div>

        {/* Right 5 Cols: Column Distribution & WIP Bottleneck Chart (cards_by_column) */}
        <div className="flex flex-col justify-between rounded-2xl border border-zinc-200/80 bg-white/95 p-5 shadow-xs backdrop-blur-md lg:col-span-5 dark:border-zinc-800/80 dark:bg-zinc-900/90">
          <div>
            <div className="mb-4 flex items-center justify-between gap-2">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  <Layers className="h-4 w-4 text-violet-500" />
                  Column Distribution &amp; WIP Bottlenecks
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Card count &amp; story points per list with WIP breach alerts
                </p>
              </div>
            </div>

            <div className="space-y-3.5">
              {analytics.cards_by_column.map((col) => {
                const isBottleneck =
                  col.is_bottleneck ||
                  (col.wip_limit !== null && col.card_count > col.wip_limit);
                const widthPct = Math.min(
                  100,
                  Math.max(6, Math.round((col.card_count / maxColCards) * 100))
                );
                const wipMarkerPct =
                  col.wip_limit !== null
                    ? Math.min(
                        100,
                        Math.round((col.wip_limit / maxColCards) * 100)
                      )
                    : null;

                return (
                  <div
                    key={col.column_id}
                    onMouseEnter={() => setHoveredColId(col.column_id)}
                    onMouseLeave={() => setHoveredColId(null)}
                    className={`rounded-xl border p-3 transition-all ${
                      isBottleneck
                        ? "border-rose-500/40 bg-rose-500/5 dark:border-rose-500/35 dark:bg-rose-500/10"
                        : "border-zinc-200/70 bg-zinc-50/60 dark:border-zinc-800/70 dark:bg-zinc-800/40"
                    }`}
                  >
                    <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                          {col.column_title}
                        </span>
                        {isBottleneck && (
                          <span className="inline-flex items-center gap-1 rounded-md border border-rose-500/40 bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 dark:text-rose-300">
                            <Flame className="h-3 w-3 text-rose-500" />
                            WIP Bottleneck
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 font-mono text-[11px]">
                        <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                          {col.card_count} card{col.card_count === 1 ? "" : "s"}
                        </span>
                        {col.wip_limit !== null && (
                          <span
                            className={`rounded px-1.5 py-0.2 text-[10px] font-semibold ${
                              col.card_count >= col.wip_limit
                                ? "bg-rose-500/20 text-rose-700 dark:text-rose-300"
                                : "bg-zinc-200/80 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
                            }`}
                          >
                            WIP {col.card_count}/{col.wip_limit}
                          </span>
                        )}
                        <span className="rounded bg-indigo-500/10 px-1.5 py-0.2 text-[10px] font-semibold text-indigo-600 dark:text-indigo-300">
                          {col.total_story_points} pts
                        </span>
                      </div>
                    </div>

                    {/* Horizontal Bar with Optional WIP Limit Threshold Line */}
                    <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-zinc-200/70 dark:bg-zinc-800">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isBottleneck
                            ? "bg-gradient-to-r from-rose-500 to-amber-500"
                            : "bg-gradient-to-r from-indigo-500 to-violet-500"
                        }`}
                        style={{ width: `${widthPct}%` }}
                      />
                      {wipMarkerPct !== null && (
                        <div
                          title={`WIP Limit: ${col.wip_limit}`}
                          className="absolute top-0 bottom-0 w-0.5 bg-rose-600 dark:bg-rose-400"
                          style={{ left: `${wipMarkerPct}%` }}
                        />
                      )}
                    </div>

                    {hoveredColId === col.column_id && (
                      <p className="mt-1.5 text-[10px] text-zinc-500 dark:text-zinc-400">
                        {isBottleneck
                          ? `⚠️ Bottleneck alert: ${col.card_count} active cards (${col.total_story_points} pts) in ${col.column_title}.`
                          : `Healthy flow: ${col.card_count} cards (${col.total_story_points} story points).`}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-zinc-200/60 pt-3 text-[11px] text-zinc-500 dark:border-zinc-800/60 dark:text-zinc-400">
            <span>Total Active Story Points</span>
            <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
              {analytics.total_story_points} pts across {analytics.total_cards}{" "}
              cards
            </span>
          </div>
        </div>
      </div>

      {/* 3. ROW 2: TEAM MEMBER WORKLOAD DISTRIBUTION & PRIORITY / LABEL BREAKDOWN */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left 7 Cols: Team Member Workload Distribution (workload_by_member) */}
        <div className="rounded-2xl border border-zinc-200/80 bg-white/95 p-5 shadow-xs backdrop-blur-md lg:col-span-7 dark:border-zinc-800/80 dark:bg-zinc-900/90">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-zinc-100">
                <Users className="h-4 w-4 text-emerald-500" />
                Team Member Workload Distribution
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Assigned vs. completed cards, active story points, and overdue
                alerts per teammate
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {analytics.workload_by_member.map((member) => {
              const completionPct =
                member.assigned_cards_count > 0
                  ? Math.round(
                      (member.completed_cards_count /
                        member.assigned_cards_count) *
                        100
                    )
                  : 0;
              const isOverloaded =
                member.active_story_points >= 12 ||
                member.overdue_cards_count > 0;

              return (
                <div
                  key={member.member_id}
                  className={`flex flex-col gap-2.5 rounded-xl border p-3.5 transition-all sm:flex-row sm:items-center sm:justify-between ${
                    isOverloaded
                      ? "border-amber-500/35 bg-amber-500/5 dark:border-amber-500/30 dark:bg-amber-500/10"
                      : "border-zinc-200/70 bg-zinc-50/60 dark:border-zinc-800/70 dark:bg-zinc-800/40"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-xs"
                      style={{ backgroundColor: member.member_color }}
                    >
                      {member.member_initials}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                          {member.member_name}
                        </span>
                        {member.active_story_points >= 12 && (
                          <span className="rounded-md bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300">
                            High Load
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                        <span>
                          Assigned:{" "}
                          <strong className="font-mono text-zinc-800 dark:text-zinc-200">
                            {member.assigned_cards_count}
                          </strong>
                        </span>
                        <span>·</span>
                        <span>
                          Completed:{" "}
                          <strong className="font-mono text-emerald-600 dark:text-emerald-400">
                            {member.completed_cards_count}
                          </strong>
                        </span>
                        <span>·</span>
                        <span>
                          Completion:{" "}
                          <strong className="font-mono text-zinc-800 dark:text-zinc-200">
                            {completionPct}%
                          </strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-right font-mono text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                      {member.active_story_points} active pts
                    </div>

                    {member.overdue_cards_count > 0 ? (
                      <div className="inline-flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-500/15 px-2.5 py-1 font-mono text-xs font-bold text-rose-700 dark:text-rose-300">
                        <AlertOctagon className="h-3.5 w-3.5" />
                        {member.overdue_cards_count} overdue
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-mono text-xs font-medium text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 className="h-3.5 w-3.5" />0 overdue
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 5 Cols: Priority & Trello Label Breakdown (cards_by_priority & cards_by_label) */}
        <div className="flex flex-col justify-between space-y-5 rounded-2xl border border-zinc-200/80 bg-white/95 p-5 shadow-xs backdrop-blur-md lg:col-span-5 dark:border-zinc-800/80 dark:bg-zinc-900/90">
          {/* Priority Segmented Bar & Breakdown */}
          <div>
            <h3 className="mb-1 text-sm font-bold text-zinc-900 dark:text-zinc-100">
              Priority Breakdown
            </h3>
            <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
              Card count &amp; story point distribution by priority tier
            </p>

            {/* Segmented Multi-Color Bar */}
            <div className="mb-3 flex h-3 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
              {analytics.cards_by_priority.map((pm) => {
                if (pm.count === 0) return null;
                const pct = (pm.count / totalPriorityCards) * 100;
                const style = PRIORITY_COLORS[pm.priority];
                return (
                  <div
                    key={pm.priority}
                    title={`${style.label}: ${pm.count} cards (${pm.story_points} pts)`}
                    className={`${style.bar} h-full transition-all duration-500`}
                    style={{ width: `${pct}%` }}
                  />
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-2">
              {analytics.cards_by_priority.map((pm) => {
                const style = PRIORITY_COLORS[pm.priority];
                return (
                  <div
                    key={pm.priority}
                    className="flex items-center justify-between rounded-xl border border-zinc-200/70 bg-zinc-50/70 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-800/40"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${style.dot}`}
                      />
                      <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                        {style.label}
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-zinc-600 dark:text-zinc-400">
                      <strong>{pm.count}</strong> ({pm.story_points}p)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Trello Label Color Pill Distribution */}
          <div className="border-t border-zinc-200/70 pt-4 dark:border-zinc-800/70">
            <h4 className="mb-2.5 text-xs font-bold tracking-wider text-zinc-700 uppercase dark:text-zinc-300">
              Trello Color Label Distribution
            </h4>
            <div className="flex flex-wrap gap-2">
              {analytics.cards_by_label.map((lbl) => {
                const colorKey = (
                  lbl.label_color in LABEL_COLOR_MAP ? lbl.label_color : "blue"
                ) as LabelColor;
                const theme = LABEL_COLOR_MAP[colorKey];

                return (
                  <div
                    key={lbl.label_id}
                    className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold ${theme.pillBg} ${theme.pillText}`}
                  >
                    <span className={`h-2 w-2 rounded-full ${theme.dot}`} />
                    <span>{lbl.label_name || theme.name}</span>
                    <span className="rounded-md bg-black/10 px-1.5 py-0.2 font-mono text-[11px] font-bold dark:bg-white/10">
                      {lbl.count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 4. ✨ AI EXECUTIVE SPRINT REPORT PANEL */}
      <div className="relative overflow-hidden rounded-2xl border border-indigo-500/30 bg-white/95 p-6 shadow-md backdrop-blur-md dark:border-indigo-400/25 dark:bg-zinc-900/95">
        <div
          className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${
            aiReport
              ? HEALTH_STATUS_STYLES[aiReport.health_status].glow
              : "from-indigo-500/10 via-transparent to-transparent"
          }`}
        />

        <div className="relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200/80 pb-4 dark:border-zinc-800/80">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-sm">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                    ✨ AI Executive Sprint Report Panel
                  </h3>
                  {aiReport && (
                    <span
                      className={`rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-bold ${
                        HEALTH_STATUS_STYLES[aiReport.health_status].badge
                      }`}
                    >
                      {aiReport.health_status}
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Automated sprint health diagnostics, bottleneck detection, and
                  concrete engineering recommendations
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGenerateAiReport}
              disabled={isGeneratingAi}
              className="inline-flex items-center gap-2 rounded-xl border border-indigo-500/40 bg-indigo-500/10 px-4 py-2 text-xs font-semibold text-indigo-700 transition-all hover:bg-indigo-500/20 disabled:opacity-60 dark:text-indigo-300"
            >
              {isGeneratingAi ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              <span>
                {isGeneratingAi
                  ? "Analyzing Board Telemetry..."
                  : "✨ Generate AI Sprint Insights"}
              </span>
            </button>
          </div>

          {aiReport && (
            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* Circular Health Score Gauge (0-100) + Executive Summary */}
              <div className="flex flex-col items-center gap-5 rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-5 sm:flex-row lg:col-span-5 dark:border-zinc-800/80 dark:bg-zinc-950/60">
                <div className="relative flex h-32 w-32 shrink-0 items-center justify-center">
                  <svg className="h-32 w-32 -rotate-90" viewBox="0 0 120 120">
                    <circle
                      cx="60"
                      cy="60"
                      r="50"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="10"
                      className="text-zinc-200 dark:text-zinc-800"
                    />
                    <circle
                      cx="60"
                      cy="60"
                      r="50"
                      fill="none"
                      stroke={
                        HEALTH_STATUS_STYLES[aiReport.health_status].ringStroke
                      }
                      strokeWidth="10"
                      strokeLinecap="round"
                      strokeDasharray={`${(aiReport.health_score / 100) * 314.16} 314.16`}
                      className="transition-all duration-700"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center">
                    <span className="font-mono text-3xl font-extrabold text-zinc-900 dark:text-white">
                      {Math.round(aiReport.health_score)}
                    </span>
                    <span className="text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">
                      / 100 Health
                    </span>
                  </div>
                </div>

                <div className="flex-1 space-y-2.5 text-center sm:text-left">
                  <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                    <span className="inline-flex items-center gap-1 text-xs font-bold tracking-wider text-zinc-400 uppercase">
                      <Gauge className="h-3.5 w-3.5 text-indigo-500" />
                      Executive Summary
                    </span>
                    <span
                      className={`rounded-md border px-2 py-0.5 font-mono text-[10px] font-bold ${
                        HEALTH_STATUS_STYLES[aiReport.health_status].badge
                      }`}
                    >
                      {aiReport.health_status}
                    </span>
                  </div>

                  <p className="text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
                    {renderFormattedSummary(aiReport.executive_summary)}
                  </p>

                  <p className="font-mono text-[10px] text-zinc-400">
                    Generated{" "}
                    {new Date(aiReport.generated_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </p>
                </div>
              </div>

              {/* 🚨 Detected Bottlenecks List */}
              <div className="rounded-2xl border border-rose-500/25 bg-rose-500/5 p-5 lg:col-span-3 dark:border-rose-500/20 dark:bg-rose-500/10">
                <h4 className="mb-3 flex items-center gap-1.5 text-xs font-bold tracking-wider text-rose-700 uppercase dark:text-rose-300">
                  <ShieldAlert className="h-4 w-4 text-rose-500" />
                  🚨 Detected Bottlenecks ({aiReport.bottlenecks.length})
                </h4>
                <ul className="space-y-2.5">
                  {aiReport.bottlenecks.map((item, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2 rounded-xl border border-rose-500/20 bg-white/80 p-2.5 text-xs leading-snug text-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-200"
                    >
                      <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-rose-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* ✅ Actionable Recommendations Checklist */}
              <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-5 lg:col-span-4 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                <h4 className="mb-3 flex items-center gap-1.5 text-xs font-bold tracking-wider text-emerald-700 uppercase dark:text-emerald-300">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />✅
                  Actionable Recommendations (
                  {aiReport.actionable_recommendations.length})
                </h4>
                <div className="space-y-2">
                  {aiReport.actionable_recommendations.map((rec, idx) => {
                    const checked = Boolean(checkedRecs[idx]);
                    return (
                      <label
                        key={idx}
                        className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-2.5 text-xs leading-snug transition-all ${
                          checked
                            ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-900 line-through opacity-75 dark:text-emerald-200"
                            : "border-emerald-500/20 bg-white/85 text-zinc-800 hover:border-emerald-500/40 dark:bg-zinc-900/85 dark:text-zinc-200"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setCheckedRecs((prev) => ({
                              ...prev,
                              [idx]: !prev[idx],
                            }))
                          }
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 cursor-pointer rounded accent-emerald-600"
                        />
                        <span>{rec}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
