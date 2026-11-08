"use client";

import React, { useMemo, useState } from "react";
import {
  AlertCircle,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
} from "lucide-react";
import { Card, UpdateCardRequest } from "@kinetix/contracts";
import { useWorkspaceStore } from "@/store/workspace-store";
import { getDueDateStatus, LABEL_COLOR_MAP } from "@/lib/trello-theme";

interface CalendarViewProps {
  filteredCards: Card[];
  onUpdateCard: (cardId: string, payload: UpdateCardRequest) => Promise<void>;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarView({
  filteredCards,
  onUpdateCard,
}: CalendarViewProps) {
  const board = useWorkspaceStore((s) => s.board);
  const setSelectedCardId = useWorkspaceStore((s) => s.setSelectedCardId);

  // Default to November 2026 (where seed cards are scheduled) or current month
  const initialDate = useMemo(() => {
    const firstWithDue = filteredCards.find((c) => c.due_date);
    return firstWithDue?.due_date
      ? new Date(firstWithDue.due_date)
      : new Date();
  }, [filteredCards]);

  const [currentMonth, setCurrentMonth] = useState(
    new Date(initialDate.getFullYear(), initialDate.getMonth(), 1)
  );

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const calendarDays = useMemo(() => {
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: Array<{ date: Date | null; key: string }> = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push({ date: null, key: `empty-start-${i}` });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      cells.push({
        date: d,
        key: `${year}-${String(month + 1).padStart(2, "0")}-${String(
          day
        ).padStart(2, "0")}`,
      });
    }
    while (cells.length % 7 !== 0) {
      cells.push({ date: null, key: `empty-end-${cells.length}` });
    }
    return cells;
  }, [year, month]);

  const cardsByDateKey = useMemo(() => {
    const map = new Map<string, Card[]>();
    for (const card of filteredCards) {
      if (!card.due_date) continue;
      const d = new Date(card.due_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(d.getDate()).padStart(2, "0")}`;
      const list = map.get(key) ?? [];
      list.push(card);
      map.set(key, list);
    }
    return map;
  }, [filteredCards]);

  const overdueCards = useMemo(
    () =>
      filteredCards.filter(
        (c) => getDueDateStatus(c.due_date, c.is_due_complete) === "overdue"
      ),
    [filteredCards]
  );

  const dueSoonCards = useMemo(
    () =>
      filteredCards.filter(
        (c) => getDueDateStatus(c.due_date, c.is_due_complete) === "due-soon"
      ),
    [filteredCards]
  );

  const unscheduledCards = useMemo(
    () => filteredCards.filter((c) => !c.due_date),
    [filteredCards]
  );

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    const now = new Date();
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-4">
      {/* Main Monthly Calendar Grid */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/95 shadow-xs backdrop-blur-md lg:col-span-3 dark:border-zinc-800/80 dark:bg-zinc-900/90">
        {/* Calendar Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200/80 px-5 py-3.5 dark:border-zinc-800/80">
          <div className="flex items-center gap-2.5">
            <CalendarIcon className="h-4 w-4 text-indigo-500" />
            <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              {currentMonth.toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </h2>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="rounded-lg border border-zinc-200/80 bg-zinc-50 p-1.5 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleToday}
              className="rounded-lg border border-zinc-200/80 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            >
              Today
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              className="rounded-lg border border-zinc-200/80 bg-zinc-50 p-1.5 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Weekday Headers */}
        <div className="grid grid-cols-7 border-b border-zinc-200/80 bg-zinc-50/80 text-center text-[11px] font-semibold tracking-wider text-zinc-500 uppercase dark:border-zinc-800/80 dark:bg-zinc-950/50 dark:text-zinc-400">
          {WEEKDAYS.map((day) => (
            <div key={day} className="py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 divide-x divide-y divide-zinc-200/60 dark:divide-zinc-800/60">
          {calendarDays.map((cell) => {
            if (!cell.date) {
              return (
                <div
                  key={cell.key}
                  className="min-h-[120px] bg-zinc-50/40 dark:bg-zinc-950/30"
                />
              );
            }

            const dayCards = cardsByDateKey.get(cell.key) ?? [];
            const isToday =
              new Date().toDateString() === cell.date.toDateString();

            return (
              <div
                key={cell.key}
                className="flex min-h-[120px] flex-col p-2 transition-colors hover:bg-zinc-50/60 dark:hover:bg-zinc-800/20"
              >
                <div className="mb-1.5 flex items-center justify-between">
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full font-mono text-xs font-semibold ${
                      isToday
                        ? "bg-indigo-600 text-white"
                        : "text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    {cell.date.getDate()}
                  </span>
                  {dayCards.length > 0 && (
                    <span className="font-mono text-[10px] text-zinc-400">
                      {dayCards.length}
                    </span>
                  )}
                </div>

                <div className="space-y-1.5">
                  {dayCards.map((card) => {
                    const status = getDueDateStatus(
                      card.due_date,
                      card.is_due_complete
                    );
                    const cardLabels = board.labels.filter((l) =>
                      card.label_ids.includes(l.id)
                    );

                    return (
                      <div
                        key={card.id}
                        onClick={() => setSelectedCardId(card.id)}
                        className={`group cursor-pointer rounded-lg border p-1.5 text-left text-[11px] shadow-2xs transition-all hover:shadow-sm ${
                          status === "complete"
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200"
                            : status === "overdue"
                              ? "border-rose-500/40 bg-rose-500/10 text-rose-900 dark:text-rose-200"
                              : status === "due-soon"
                                ? "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200"
                                : "border-zinc-200/80 bg-white text-zinc-800 dark:border-zinc-700/80 dark:bg-zinc-800 dark:text-zinc-200"
                        }`}
                      >
                        {cardLabels.length > 0 && (
                          <div className="mb-1 flex gap-1">
                            {cardLabels.map((lbl) => (
                              <span
                                key={lbl.id}
                                className="h-1.5 w-5 rounded-full"
                                style={{
                                  backgroundColor:
                                    LABEL_COLOR_MAP[lbl.color].swatch,
                                }}
                              />
                            ))}
                          </div>
                        )}
                        <div className="flex items-start gap-1.5">
                          <input
                            type="checkbox"
                            checked={card.is_due_complete}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              e.stopPropagation();
                              onUpdateCard(card.id, {
                                is_due_complete: e.target.checked,
                              });
                            }}
                            className="mt-0.5 h-3 w-3 cursor-pointer rounded accent-emerald-600"
                          />
                          <span
                            className={`line-clamp-2 leading-tight font-medium ${
                              card.is_due_complete
                                ? "line-through opacity-75"
                                : ""
                            }`}
                          >
                            {card.title}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Sidebar: Due Date Radar & Unscheduled Cards */}
      <div className="space-y-4">
        {/* Overdue */}
        <div className="rounded-2xl border border-rose-500/30 bg-white/95 p-4 shadow-xs backdrop-blur-md dark:border-rose-500/25 dark:bg-zinc-900/90">
          <h3 className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold tracking-wider text-rose-600 uppercase dark:text-rose-400">
            <AlertCircle className="h-3.5 w-3.5" />
            Overdue ({overdueCards.length})
          </h3>
          <div className="space-y-2">
            {overdueCards.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCardId(c.id)}
                className="flex w-full items-center justify-between rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-left text-xs font-medium text-rose-900 hover:bg-rose-500/15 dark:text-rose-200"
              >
                <span className="truncate">{c.title}</span>
                {c.due_date && (
                  <span className="ml-2 shrink-0 font-mono text-[10px]">
                    {new Date(c.due_date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                )}
              </button>
            ))}
            {overdueCards.length === 0 && (
              <p className="text-xs text-zinc-400">Zero overdue cards.</p>
            )}
          </div>
        </div>

        {/* Due Soon */}
        <div className="rounded-2xl border border-amber-500/30 bg-white/95 p-4 shadow-xs backdrop-blur-md dark:border-amber-500/25 dark:bg-zinc-900/90">
          <h3 className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold tracking-wider text-amber-600 uppercase dark:text-amber-400">
            <Clock className="h-3.5 w-3.5" />
            Due Soon ({dueSoonCards.length})
          </h3>
          <div className="space-y-2">
            {dueSoonCards.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCardId(c.id)}
                className="flex w-full items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-left text-xs font-medium text-amber-900 hover:bg-amber-500/15 dark:text-amber-200"
              >
                <span className="truncate">{c.title}</span>
                {c.due_date && (
                  <span className="ml-2 shrink-0 font-mono text-[10px]">
                    {new Date(c.due_date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                )}
              </button>
            ))}
            {dueSoonCards.length === 0 && (
              <p className="text-xs text-zinc-400">
                No cards due in the next 48h.
              </p>
            )}
          </div>
        </div>

        {/* Unscheduled Cards */}
        <div className="rounded-2xl border border-zinc-200/80 bg-white/95 p-4 shadow-xs backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-900/90">
          <h3 className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold tracking-wider text-zinc-600 uppercase dark:text-zinc-300">
            <CheckCircle2 className="h-3.5 w-3.5 text-zinc-400" />
            No Due Date ({unscheduledCards.length})
          </h3>
          <div className="space-y-2">
            {unscheduledCards.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCardId(c.id)}
                className="flex w-full items-center justify-between rounded-xl border border-zinc-200/70 bg-zinc-50/70 px-3 py-2 text-left text-xs font-medium text-zinc-700 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-200"
              >
                <span className="truncate">{c.title}</span>
                <span className="ml-2 shrink-0 text-[10px] text-indigo-500">
                  Set date →
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
