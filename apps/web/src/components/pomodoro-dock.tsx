"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import { PomodoroMode, PomodoroModeEnum } from "@kinetix/contracts";
import { useWorkspaceStore } from "@/store/workspace-store";
import { apiClient } from "@/lib/api-client";
import { createDeterministicUuid } from "@/lib/mock-data";

const MODE_DURATIONS: Record<PomodoroMode, number> = {
  FOCUS: 25 * 60, // 1500s
  SHORT_BREAK: 5 * 60, // 300s
  LONG_BREAK: 15 * 60, // 900s
};

export function PomodoroDock() {
  const isPomodoroOpen = useWorkspaceStore((s) => s.isPomodoroOpen);
  const setPomodoroOpen = useWorkspaceStore((s) => s.setPomodoroOpen);
  const pomodoroTargetCardId = useWorkspaceStore((s) => s.pomodoroTargetCardId);
  const board = useWorkspaceStore((s) => s.board);
  const currentUser = useWorkspaceStore((s) => s.currentUser);
  const useMockMode = useWorkspaceStore((s) => s.useMockMode);
  const upsertCard = useWorkspaceStore((s) => s.upsertCard);
  const addToast = useWorkspaceStore((s) => s.addToast);

  const [mode, setMode] = useState<PomodoroMode>("FOCUS");
  const [timeLeft, setTimeLeft] = useState<number>(MODE_DURATIONS.FOCUS);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [selectedCardId, setSelectedCardId] = useState<string>("");
  const [isCompleting, setIsCompleting] = useState<boolean>(false);
  const [completedSessionsCount, setCompletedSessionsCount] = useState<number>(0);

  // Sync selected card if triggered from card modal
  useEffect(() => {
    if (pomodoroTargetCardId) {
      setSelectedCardId(pomodoroTargetCardId);
    } else if (!selectedCardId && board.cards.length > 0) {
      setSelectedCardId(board.cards[0].id);
    }
  }, [pomodoroTargetCardId, board.cards]);

  // Reset timer duration when mode changes
  const switchMode = (newMode: PomodoroMode) => {
    setMode(newMode);
    setTimeLeft(MODE_DURATIONS[newMode]);
    setIsRunning(false);
  };

  // Timer tick effect
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleSessionFinished();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, mode, selectedCardId]);

  // Complete a session (Auto-log work & celebration)
  const handleSessionFinished = async () => {
    setIsRunning(false);
    if (mode === "FOCUS" && selectedCardId) {
      await logPomodoroCompletion(1500);
    } else {
      addToast({
        id: createDeterministicUuid(),
        ruleName: "Break Finished! 🔔",
        cardTitle: "Pomodoro Timer",
        actionSummary: "Ready to focus on your next task?",
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      });
      switchMode("FOCUS");
    }
  };

  // Log Pomodoro completion helper
  const logPomodoroCompletion = async (durationSeconds: number) => {
    if (!selectedCardId || isCompleting) return;
    setIsCompleting(true);
    try {
      const updated = await apiClient.completePomodoro(
        {
          card_id: selectedCardId,
          mode: "FOCUS",
          duration_seconds: durationSeconds,
          note: "Completed 25m Pomodoro focus session",
        },
        { useMock: useMockMode }
      );
      upsertCard(updated);
      setCompletedSessionsCount((c) => c + 1);

      const targetCard = board.cards.find((c) => c.id === selectedCardId);
      addToast({
        id: createDeterministicUuid(),
        ruleName: "🍅 Pomodoro Completed!",
        cardTitle: targetCard?.title ?? "Card",
        actionSummary: "Logged 25m work to task card. Great focus!",
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      });

      // Suggest short break
      switchMode("SHORT_BREAK");
    } catch (err) {
      console.error("Failed to complete Pomodoro session:", err);
      addToast({
        id: createDeterministicUuid(),
        ruleName: "Pomodoro Completion Error",
        cardTitle: "Pomodoro Timer",
        actionSummary: "Failed to log Pomodoro to card. Please try again.",
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      });
    } finally {
      setIsCompleting(false);
    }
  };

  // 1-Click Fast Demo Complete handler
  const handleFastDemoComplete = async () => {
    if (!selectedCardId) {
      addToast({
        id: createDeterministicUuid(),
        ruleName: "No Card Selected",
        cardTitle: "Pomodoro Timer",
        actionSummary: "Please select a card to link this Pomodoro session to.",
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      });
      return;
    }
    await logPomodoroCompletion(1500);
  };

  if (!isPomodoroOpen) return null;

  const totalDuration = MODE_DURATIONS[mode];
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  const targetCard = board.cards.find((c) => c.id === selectedCardId);

  // SVG Progress Ring calculations
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset =
    circumference - (timeLeft / totalDuration) * circumference;

  const ringColor =
    mode === "FOCUS"
      ? "text-rose-500 dark:text-rose-400"
      : mode === "SHORT_BREAK"
        ? "text-sky-500 dark:text-sky-400"
        : "text-purple-500 dark:text-purple-400";

  // Minimized Floating Pill Dock
  if (isMinimized) {
    return (
      <aside
        aria-label="Pomodoro Focus Timer Dock"
        className="fixed right-6 bottom-6 z-50 flex items-center gap-3 rounded-full border border-rose-500/40 bg-white/95 px-4 py-2.5 shadow-2xl backdrop-blur-md transition-all hover:scale-105 dark:border-rose-500/30 dark:bg-zinc-900/95"
      >
        <button
          type="button"
          onClick={() => setIsRunning(!isRunning)}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-600 text-white shadow-xs hover:bg-rose-500"
        >
          {isRunning ? (
            <Pause className="h-3.5 w-3.5 fill-current" />
          ) : (
            <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
          )}
        </button>

        <div
          onClick={() => setIsMinimized(false)}
          className="flex cursor-pointer items-center gap-2"
        >
          <span className="font-mono text-sm font-bold text-zinc-900 dark:text-zinc-100">
            🍅 {formattedTime}
          </span>
          {targetCard && (
            <span className="max-w-[120px] truncate text-xs text-zinc-500 dark:text-zinc-400">
              • {targetCard.title}
            </span>
          )}
        </div>

        <button
          type="button"
          title="Expand Pomodoro Timer"
          onClick={() => setIsMinimized(false)}
          className="rounded p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title="Close Dock"
          onClick={() => setPomodoroOpen(false)}
          className="rounded p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </aside>
    );
  }

  // Expanded Floating Dock Window
  return (
    <aside
      aria-label="Pomodoro Focus Timer Dock"
      className="fixed right-6 bottom-6 z-50 w-88 rounded-2xl border border-zinc-200/90 bg-white/95 p-5 shadow-2xl backdrop-blur-lg transition-all dark:border-zinc-800/90 dark:bg-zinc-900/95"
    >
      {/* Dock Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🍅</span>
          <div>
            <h3 className="text-xs font-bold tracking-wider text-zinc-900 uppercase dark:text-zinc-100">
              Pomodoro Focus Timer
            </h3>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
              {completedSessionsCount} session(s) completed today
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            title="Minimize Dock"
            onClick={() => setIsMinimized(true)}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <Minimize2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="Close Timer"
            onClick={() => setPomodoroOpen(false)}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="mb-4 flex rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800/80">
        <button
          type="button"
          onClick={() => switchMode("FOCUS")}
          className={`flex-1 rounded-lg py-1.5 text-center text-[11px] font-semibold transition-all ${
            mode === "FOCUS"
              ? "bg-white text-rose-600 shadow-xs dark:bg-zinc-900 dark:text-rose-400"
              : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          }`}
        >
          Focus (25m)
        </button>
        <button
          type="button"
          onClick={() => switchMode("SHORT_BREAK")}
          className={`flex-1 rounded-lg py-1.5 text-center text-[11px] font-semibold transition-all ${
            mode === "SHORT_BREAK"
              ? "bg-white text-sky-600 shadow-xs dark:bg-zinc-900 dark:text-sky-400"
              : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          }`}
        >
          Short (5m)
        </button>
        <button
          type="button"
          onClick={() => switchMode("LONG_BREAK")}
          className={`flex-1 rounded-lg py-1.5 text-center text-[11px] font-semibold transition-all ${
            mode === "LONG_BREAK"
              ? "bg-white text-purple-600 shadow-xs dark:bg-zinc-900 dark:text-purple-400"
              : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          }`}
        >
          Long (15m)
        </button>
      </div>

      {/* Target Card Selector Dropdown */}
      <div className="mb-5">
        <label className="mb-1 block text-[10px] font-semibold text-zinc-500 uppercase dark:text-zinc-400">
          Linked Task Card:
        </label>
        <select
          value={selectedCardId}
          onChange={(e) => setSelectedCardId(e.target.value)}
          className="h-8 w-full truncate rounded-xl border border-zinc-200/80 bg-zinc-50 px-2.5 text-xs text-zinc-900 focus:border-rose-500 focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        >
          <option value="">— Select a card on this board —</option>
          {board.cards.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </div>

      {/* Circular SVG Countdown Progress Ring */}
      <div className="relative my-2 flex items-center justify-center">
        <svg className="h-36 w-36 -rotate-90 transform">
          <circle
            cx="72"
            cy="72"
            r={radius}
            stroke="currentColor"
            strokeWidth="8"
            className="text-zinc-100 dark:text-zinc-800"
            fill="transparent"
          />
          <circle
            cx="72"
            cy="72"
            r={radius}
            stroke="currentColor"
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className={`${ringColor} transition-all duration-500 ease-linear`}
            fill="transparent"
          />
        </svg>

        {/* Center Digital Countdown Display */}
        <div className="absolute flex flex-col items-center">
          <span className="font-mono text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
            {formattedTime}
          </span>
          <span className="text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">
            {mode === "FOCUS" ? "Focusing" : "Resting"}
          </span>
        </div>
      </div>

      {/* Primary Play/Pause & Reset Controls */}
      <div className="mt-4 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setIsRunning(!isRunning)}
          className={`flex h-11 w-11 items-center justify-center rounded-full text-white shadow-md transition-all hover:scale-105 ${
            mode === "FOCUS"
              ? "bg-rose-600 hover:bg-rose-700"
              : mode === "SHORT_BREAK"
                ? "bg-sky-600 hover:bg-sky-700"
                : "bg-purple-600 hover:bg-purple-700"
          }`}
        >
          {isRunning ? (
            <Pause className="h-5 w-5 fill-current" />
          ) : (
            <Play className="h-5 w-5 fill-current ml-0.5" />
          )}
        </button>

        <button
          type="button"
          title="Reset timer"
          onClick={() => {
            setIsRunning(false);
            setTimeLeft(MODE_DURATIONS[mode]);
          }}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

      {/* Fast Demo Complete Button */}
      <div className="mt-4 border-t border-zinc-100 pt-3 dark:border-zinc-800">
        <button
          type="button"
          disabled={isCompleting || !selectedCardId}
          onClick={handleFastDemoComplete}
          title="Instantly complete 25m Focus session and log work to the selected card"
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-700 shadow-2xs transition-all hover:bg-amber-500/20 disabled:opacity-50 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300 dark:hover:bg-amber-400/20"
        >
          <Zap className="h-3.5 w-3.5 fill-current" />
          <span>⚡ Fast Demo Complete (Log 25m Now)</span>
        </button>
      </div>
    </aside>
  );
}
