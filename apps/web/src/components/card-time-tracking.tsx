"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  Clock,
  History,
  Play,
  Plus,
  Square,
  Timer,
  Trash2,
} from "lucide-react";
import {
  Card,
  TimeEntry,
  TimeEntrySource,
  UpdateCardRequest,
} from "@kinetix/contracts";
import { useWorkspaceStore } from "@/store/workspace-store";
import { apiClient } from "@/lib/api-client";
import { formatHoursOrMinutes, formatSecondsToHMS } from "./kanban-board";

export function parseDurationToSeconds(str: string): number {
  const trimmed = str.trim().toLowerCase();
  if (!trimmed) return 0;

  // Pure digits -> assume minutes
  if (/^\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10) * 60;
  }

  // Decimal hours e.g. "1.5h" or "0.5 hr"
  const decimalHoursMatch = trimmed.match(/^([\d.]+)\s*(?:h|hr|hour|hours)$/);
  if (decimalHoursMatch) {
    return Math.round(parseFloat(decimalHoursMatch[1]) * 3600);
  }

  // Combined format e.g. "1h 30m" or "2 hours 15 mins" or "45m"
  let totalSeconds = 0;
  const hoursMatch = trimmed.match(/(\d+)\s*(?:h|hr|hour|hours)/);
  if (hoursMatch) {
    totalSeconds += parseInt(hoursMatch[1], 10) * 3600;
  }
  const minutesMatch = trimmed.match(/(\d+)\s*(?:m|min|minute|minutes)/);
  if (minutesMatch) {
    totalSeconds += parseInt(minutesMatch[1], 10) * 60;
  }
  const secondsMatch = trimmed.match(/(\d+)\s*(?:s|sec|second|seconds)/);
  if (secondsMatch) {
    totalSeconds += parseInt(secondsMatch[1], 10);
  }

  return totalSeconds;
}

export function formatDurationSummary(totalSeconds: number): string {
  if (totalSeconds <= 0) return "0m";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  if (minutes > 0) {
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }
  return `${seconds}s`;
}

interface CardTimeTrackingSectionProps {
  card: Card;
  isViewer: boolean;
  onUpdateCard: (cardId: string, payload: UpdateCardRequest) => Promise<void>;
  onOpenPomodoro: (cardId: string) => void;
}

export function CardTimeTrackingSection({
  card,
  isViewer,
  onUpdateCard,
  onOpenPomodoro,
}: CardTimeTrackingSectionProps) {
  const activeTimer = card.time_tracking?.active_timer;
  const totalLoggedSec = card.time_tracking?.total_logged_seconds ?? 0;
  const estimatedSec = card.time_tracking?.estimated_seconds ?? 0;
  const entries: TimeEntry[] = card.time_tracking?.entries ?? [];
  const pomodoroCount = card.time_tracking?.pomodoro_completed_count ?? 0;

  const currentUser = useWorkspaceStore((s) => s.currentUser);
  const useMockMode = useWorkspaceStore((s) => s.useMockMode);
  const upsertCard = useWorkspaceStore((s) => s.upsertCard);

  // Estimate inline edit state (in hours)
  const initialEstHours = estimatedSec > 0 ? (estimatedSec / 3600).toString() : "";
  const [estimateInput, setEstimateInput] = useState(initialEstHours);
  const [isSavingEstimate, setIsSavingEstimate] = useState(false);

  useEffect(() => {
    setEstimateInput(estimatedSec > 0 ? (estimatedSec / 3600).toString() : "");
  }, [estimatedSec]);

  // Stopwatch action state
  const [isTimerLoading, setIsTimerLoading] = useState(false);

  // Live ticking seconds for running timer
  const [elapsedSec, setElapsedSec] = useState(() => {
    if (!activeTimer) return 0;
    const startMs = new Date(activeTimer.started_at).getTime();
    return Math.max(0, Math.floor((Date.now() - startMs) / 1000));
  });

  useEffect(() => {
    if (!activeTimer) return;
    const tick = () => {
      const startMs = new Date(activeTimer.started_at).getTime();
      setElapsedSec(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeTimer?.started_at, activeTimer]);

  // Manual worklog state
  const [isAddingWorklog, setIsAddingWorklog] = useState(false);
  const [manualDurationInput, setManualDurationInput] = useState("");
  const [manualNoteInput, setManualNoteInput] = useState("");
  const [worklogError, setWorklogError] = useState<string | null>(null);
  const [isSubmittingLog, setIsSubmittingLog] = useState(false);

  // Toggle Stopwatch (Start / Stop)
  const handleToggleStopwatch = async () => {
    if (isViewer || isTimerLoading) return;
    setIsTimerLoading(true);
    try {
      if (activeTimer) {
        const updated = await apiClient.stopCardTimer(card.id, undefined, {
          useMock: useMockMode,
        });
        upsertCard(updated);
      } else {
        const updated = await apiClient.startCardTimer(
          card.id,
          { user_id: currentUser.id, user_name: currentUser.name },
          { useMock: useMockMode }
        );
        upsertCard(updated);
      }
    } catch (err) {
      console.error("Failed to toggle stopwatch:", err);
    } finally {
      setIsTimerLoading(false);
    }
  };

  // Save Estimated Hours
  const handleSaveEstimate = async () => {
    if (isViewer) return;
    const num = parseFloat(estimateInput);
    const newEstSec = isNaN(num) || num <= 0 ? 0 : Math.round(num * 3600);
    if (newEstSec === estimatedSec) return;

    setIsSavingEstimate(true);
    try {
      await onUpdateCard(card.id, {
        time_tracking: {
          ...(card.time_tracking ?? {
            estimated_seconds: 0,
            total_logged_seconds: 0,
            active_timer: null,
            entries: [],
            pomodoro_completed_count: 0,
          }),
          estimated_seconds: newEstSec,
        },
      });
    } catch (err) {
      console.error("Failed to update estimated seconds:", err);
    } finally {
      setIsSavingEstimate(false);
    }
  };

  // Submit Manual Worklog Entry
  const handleAddManualWorklog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewer || isSubmittingLog) return;
    setWorklogError(null);

    const parsedSec = parseDurationToSeconds(manualDurationInput);
    if (parsedSec <= 0) {
      setWorklogError("Please enter a valid duration (e.g. 1h 30m, 45m, 2h).");
      return;
    }

    setIsSubmittingLog(true);
    try {
      const updated = await apiClient.logTimeEntry(
        card.id,
        {
          duration_seconds: parsedSec,
          note: manualNoteInput.trim(),
          source: "MANUAL",
        },
        { useMock: useMockMode }
      );
      upsertCard(updated);
      setManualDurationInput("");
      setManualNoteInput("");
      setIsAddingWorklog(false);
    } catch (err) {
      console.error("Failed to log time entry:", err);
      setWorklogError("Failed to log time entry. Please try again.");
    } finally {
      setIsSubmittingLog(false);
    }
  };

  // Delete Worklog Entry
  const handleDeleteEntry = async (entryId: string) => {
    if (isViewer) return;
    try {
      const updated = await apiClient.deleteTimeEntry(card.id, entryId, {
        useMock: useMockMode,
      });
      upsertCard(updated);
    } catch (err) {
      console.error("Failed to delete time entry:", err);
    }
  };

  // Progress Bar Calculations
  const isOverBudget = estimatedSec > 0 && totalLoggedSec > estimatedSec;
  const progressPct =
    estimatedSec > 0
      ? Math.min(100, Math.round((totalLoggedSec / estimatedSec) * 100))
      : 0;

  return (
    <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-4 dark:border-zinc-800/80 dark:bg-zinc-900/40">
      {/* Header */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-xs font-bold tracking-wider text-zinc-800 uppercase dark:text-zinc-200">
          <Clock className="h-4 w-4 text-indigo-500" />
          <span>Time Tracking & Worklog</span>
          {pomodoroCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-300">
              🍅 {pomodoroCount} completed
            </span>
          )}
        </h4>

        {activeTimer && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/60 bg-emerald-500/15 px-2.5 py-0.5 font-mono text-[11px] font-bold text-emerald-700 shadow-xs dark:bg-emerald-500/20 dark:text-emerald-300 animate-pulse">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>⏱️ Active: {formatSecondsToHMS(elapsedSec)}</span>
            <span className="text-zinc-500 dark:text-zinc-400">
              • {activeTimer.user_name}
            </span>
          </span>
        )}
      </div>

      {/* Visual Time Progress Bar & Inline Estimate Setting */}
      <div className="mb-4 rounded-xl border border-zinc-200/80 bg-white p-3.5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-950/70">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-sm font-bold text-zinc-900 dark:text-zinc-100">
              {formatDurationSummary(totalLoggedSec)}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              logged
            </span>
            {estimatedSec > 0 && (
              <>
                <span className="text-zinc-400 dark:text-zinc-600">/</span>
                <span className="font-mono text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  {formatDurationSummary(estimatedSec)}
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  estimated
                </span>
              </>
            )}
          </div>

          {/* Estimate Input */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-zinc-500 dark:text-zinc-400">Estimate (hrs):</span>
            <input
              type="number"
              step="0.5"
              min="0"
              disabled={isViewer || isSavingEstimate}
              value={estimateInput}
              onChange={(e) => setEstimateInput(e.target.value)}
              onBlur={handleSaveEstimate}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.currentTarget.blur();
                }
              }}
              placeholder="e.g. 4"
              className="h-7 w-18 rounded-lg border border-zinc-200/80 bg-zinc-50 px-2 font-mono text-xs text-zinc-900 focus:border-indigo-500 focus:bg-white focus:outline-none disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>
        </div>

        {/* Progress Bar */}
        {estimatedSec > 0 ? (
          <div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div
                className={`h-full transition-all duration-300 ${
                  isOverBudget
                    ? "bg-rose-500 dark:bg-rose-600"
                    : progressPct >= 80
                      ? "bg-amber-500 dark:bg-amber-600"
                      : "bg-indigo-600 dark:bg-indigo-500"
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            {isOverBudget && (
              <p className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                <AlertTriangle className="h-3 w-3" />
                Over estimated budget by{" "}
                {formatDurationSummary(totalLoggedSec - estimatedSec)}!
              </p>
            )}
          </div>
        ) : (
          <div className="h-2 w-full rounded-full bg-zinc-100 dark:bg-zinc-800" />
        )}
      </div>

      {/* Action Controls: Stopwatch + Pomodoro + Add Manual Log */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {/* Big Stopwatch Start / Stop */}
        {!isViewer && (
          <button
            type="button"
            disabled={isTimerLoading}
            onClick={handleToggleStopwatch}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold shadow-xs transition-all ${
              activeTimer
                ? "border border-rose-500/50 bg-rose-600 text-white hover:bg-rose-700 dark:bg-rose-600"
                : "border border-emerald-500/40 bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600"
            }`}
          >
            {activeTimer ? (
              <>
                <Square className="h-3.5 w-3.5 fill-current" />
                <span>⏹️ Stop & Log Time ({formatSecondsToHMS(elapsedSec)})</span>
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>▶️ Start Timer</span>
              </>
            )}
          </button>
        )}

        {/* Start Pomodoro on this Card */}
        <button
          type="button"
          onClick={() => onOpenPomodoro(card.id)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700 shadow-2xs transition-colors hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/50"
        >
          <span>🍅</span>
          <span>Start Pomodoro on Card</span>
        </button>

        {/* Toggle Manual Log Form */}
        {!isViewer && (
          <button
            type="button"
            onClick={() => setIsAddingWorklog(!isAddingWorklog)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200/80 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 shadow-2xs transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Log Work Manually</span>
          </button>
        )}
      </div>

      {/* Manual Worklog Entry Form */}
      {isAddingWorklog && !isViewer && (
        <form
          onSubmit={handleAddManualWorklog}
          className="mb-4 rounded-xl border border-indigo-500/30 bg-indigo-50/40 p-3.5 dark:border-indigo-500/20 dark:bg-indigo-950/20"
        >
          <h5 className="mb-2 text-xs font-bold text-zinc-800 dark:text-zinc-200">
            Log Time Manually
          </h5>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-[10px] font-semibold text-zinc-500 uppercase dark:text-zinc-400">
                Duration (e.g. 1h 30m, 45m)
              </label>
              <input
                type="text"
                required
                autoFocus
                placeholder="1h 30m"
                value={manualDurationInput}
                onChange={(e) => setManualDurationInput(e.target.value)}
                className="h-8 w-full rounded-lg border border-zinc-200/80 bg-white px-2.5 font-mono text-xs text-zinc-900 focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-[10px] font-semibold text-zinc-500 uppercase dark:text-zinc-400">
                Work Note (Optional)
              </label>
              <input
                type="text"
                placeholder="Implemented API schema validation & unit tests"
                value={manualNoteInput}
                onChange={(e) => setManualNoteInput(e.target.value)}
                className="h-8 w-full rounded-lg border border-zinc-200/80 bg-white px-2.5 text-xs text-zinc-900 focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
          </div>

          {worklogError && (
            <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">
              {worklogError}
            </p>
          )}

          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setIsAddingWorklog(false);
                setWorklogError(null);
              }}
              className="rounded-lg px-3 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-200/60 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingLog || !manualDurationInput.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              <Check className="h-3 w-3" />
              Save Worklog
            </button>
          </div>
        </form>
      )}

      {/* Worklog History List */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h5 className="flex items-center gap-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
            <History className="h-3.5 w-3.5" />
            <span>Worklog History ({entries.length})</span>
          </h5>
        </div>

        {entries.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-200/80 p-3 text-center text-xs text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
            No work logs recorded yet. Start the stopwatch or log time manually.
          </p>
        ) : (
          <div className="space-y-1.5">
            {entries.map((entry) => {
              const isPomodoro = entry.source === "POMODORO";
              const isStopwatch = entry.source === "STOPWATCH";

              const badgeColor = isPomodoro
                ? "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/15 dark:text-rose-300"
                : isStopwatch
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-300"
                  : "border-zinc-200/80 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";

              return (
                <div
                  key={entry.id}
                  className="group flex items-center justify-between gap-3 rounded-lg border border-zinc-200/70 bg-white p-2.5 shadow-2xs transition-colors hover:border-zinc-300 dark:border-zinc-800/80 dark:bg-zinc-950/60 dark:hover:border-zinc-700"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    {/* User Avatar Initials */}
                    <span
                      title={entry.user_name}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white"
                    >
                      {entry.user_initials ||
                        entry.user_name.slice(0, 2).toUpperCase()}
                    </span>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100">
                          {formatDurationSummary(entry.duration_seconds)}
                        </span>
                        <span
                          className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.2 text-[9px] font-semibold tracking-wide uppercase ${badgeColor}`}
                        >
                          {isPomodoro && "🍅 "}
                          {isStopwatch && "⏱️ "}
                          {entry.source}
                        </span>
                        <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          by {entry.user_name}
                        </span>
                        <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
                          •{" "}
                          {new Date(entry.created_at).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      {entry.note && (
                        <p className="mt-0.5 truncate text-xs text-zinc-600 dark:text-zinc-300">
                          {entry.note}
                        </p>
                      )}
                    </div>
                  </div>

                  {!isViewer && (
                    <button
                      type="button"
                      title="Delete worklog entry"
                      onClick={() => handleDeleteEntry(entry.id)}
                      className="shrink-0 rounded p-1 text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-rose-500/10 hover:text-rose-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
