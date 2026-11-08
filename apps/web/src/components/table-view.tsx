"use client";

import React, { useMemo, useState } from "react";
import {
  AlertOctagon,
  ArrowUpDown,
  Calendar,
  CheckSquare,
  Sparkles,
} from "lucide-react";
import { Card, Priority } from "@kinetix/contracts";
import { PRIORITY_STYLES } from "./kanban-board";
import { useWorkspaceStore } from "@/store/workspace-store";
import { comparePositions, generatePositionBetween } from "@/lib/fractional-index";

type SortField =
  | "position"
  | "title"
  | "priority"
  | "story_points"
  | "column"
  | "due_date";

const PRIORITY_WEIGHT: Record<Priority, number> = {
  URGENT: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

interface TableViewProps {
  filteredCards: Card[];
  onPersistCardMove: (
    cardId: string,
    targetColumnId: string,
    newPosition: string,
    prevPos?: string,
    nextPos?: string
  ) => void;
}

export function TableView({
  filteredCards,
  onPersistCardMove,
}: TableViewProps) {
  const board = useWorkspaceStore((s) => s.board);
  const setSelectedCardId = useWorkspaceStore((s) => s.setSelectedCardId);

  const [sortField, setSortField] = useState<SortField>("priority");
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const columnMap = useMemo(() => {
    const map = new Map<string, { title: string; position: string }>();
    board.columns.forEach((col) => {
      map.set(col.id, { title: col.title, position: col.position });
    });
    return map;
  }, [board.columns]);

  const sortedCards = useMemo(() => {
    const copy = [...filteredCards];
    copy.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "title":
          cmp = a.title.localeCompare(b.title);
          break;
        case "priority":
          cmp = PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
          break;
        case "story_points":
          cmp = (a.story_points ?? -1) - (b.story_points ?? -1);
          break;
        case "column": {
          const colA = columnMap.get(a.column_id)?.position ?? "";
          const colB = columnMap.get(b.column_id)?.position ?? "";
          cmp = comparePositions(colA, colB);
          if (cmp === 0) cmp = comparePositions(a.position, b.position);
          break;
        }
        case "due_date": {
          const timeA = a.due_date ? new Date(a.due_date).getTime() : Infinity;
          const timeB = b.due_date ? new Date(b.due_date).getTime() : Infinity;
          cmp = timeA - timeB;
          break;
        }
        case "position":
        default:
          cmp = comparePositions(a.position, b.position);
          break;
      }
      return sortAsc ? cmp : -cmp;
    });
    return copy;
  }, [filteredCards, sortField, sortAsc, columnMap]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(field === "title" || field === "column");
    }
  };

  const handleInlineColumnChange = (card: Card, targetColumnId: string) => {
    if (card.column_id === targetColumnId) return;
    const targetColCards = board.cards
      .filter((c) => c.column_id === targetColumnId && c.id !== card.id)
      .sort((a, b) => comparePositions(a.position, b.position));
    const prevPos =
      targetColCards.length > 0
        ? targetColCards[targetColCards.length - 1].position
        : undefined;
    const newPos = generatePositionBetween(prevPos, undefined);
    onPersistCardMove(card.id, targetColumnId, newPos, prevPos, undefined);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-xs dark:border-zinc-800/80 dark:bg-zinc-900/90">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-200/80 bg-zinc-50/90 text-[11px] font-semibold tracking-wider text-zinc-500 uppercase dark:border-zinc-800/80 dark:bg-zinc-950/60 dark:text-zinc-400">
              <th className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => toggleSort("title")}
                  className="inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  Issue
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="px-3 py-3">
                <button
                  type="button"
                  onClick={() => toggleSort("column")}
                  className="inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  Status
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="px-3 py-3">
                <button
                  type="button"
                  onClick={() => toggleSort("priority")}
                  className="inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  Priority
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="px-3 py-3">
                <button
                  type="button"
                  onClick={() => toggleSort("story_points")}
                  className="inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  Points
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="px-3 py-3">Subtasks</th>
              <th className="px-3 py-3">Blocker Radar</th>
              <th className="px-3 py-3">
                <button
                  type="button"
                  onClick={() => toggleSort("position")}
                  className="inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  Key
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="px-4 py-3 text-right">
                <button
                  type="button"
                  onClick={() => toggleSort("due_date")}
                  className="inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  Due Date
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200/60 dark:divide-zinc-800/60">
            {sortedCards.map((card) => {
              const priorityMeta = PRIORITY_STYLES[card.priority];
              const isBlocked = card.blocked_by_card_ids.length > 0;
              const completedSubtasks = card.subtasks.filter(
                (s) => s.is_completed
              ).length;
              const totalSubtasks = card.subtasks.length;
              const hasAiTag = card.tags.includes("ai-decomposed");

              return (
                <tr
                  key={card.id}
                  onClick={() => setSelectedCardId(card.id)}
                  className="group cursor-pointer transition-colors duration-150 hover:bg-zinc-50/90 dark:hover:bg-zinc-800/40"
                >
                  {/* Issue Title & Tags */}
                  <td className="max-w-md px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-zinc-900 group-hover:text-indigo-600 dark:text-zinc-100 dark:group-hover:text-indigo-400">
                        {card.title}
                      </span>
                      {hasAiTag && (
                        <span className="inline-flex items-center gap-0.5 rounded border border-violet-500/30 bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-medium text-violet-600 dark:text-violet-300">
                          <Sparkles className="h-2.5 w-2.5" />
                          AI
                        </span>
                      )}
                    </div>
                    {card.tags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {card.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>

                  {/* Status Column Selector */}
                  <td
                    className="px-3 py-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <select
                      aria-label={`Change column for ${card.title}`}
                      value={card.column_id}
                      onChange={(e) =>
                        handleInlineColumnChange(card, e.target.value)
                      }
                      className="rounded-md border border-zinc-200/80 bg-zinc-50 px-2 py-1 text-xs font-medium text-zinc-800 focus:border-indigo-500 focus:outline-none dark:border-zinc-700/80 dark:bg-zinc-800 dark:text-zinc-200"
                    >
                      {board.columns.map((col) => (
                        <option key={col.id} value={col.id}>
                          {col.title}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Priority */}
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium ${priorityMeta.badge}`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${priorityMeta.dot}`}
                      />
                      {priorityMeta.label}
                    </span>
                  </td>

                  {/* Story Points */}
                  <td className="px-3 py-3">
                    {card.story_points !== null ? (
                      <span className="rounded border border-zinc-200/80 bg-zinc-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-zinc-700 dark:border-zinc-700/80 dark:bg-zinc-800 dark:text-zinc-200">
                        {card.story_points} pts
                      </span>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>

                  {/* Subtasks */}
                  <td className="px-3 py-3">
                    {totalSubtasks > 0 ? (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] text-zinc-600 dark:text-zinc-300">
                          <CheckSquare className="h-3 w-3 text-indigo-500" />
                          {completedSubtasks}/{totalSubtasks}
                        </span>
                        <div className="h-1.5 w-14 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                          <div
                            className="h-full rounded-full bg-indigo-500"
                            style={{
                              width: `${Math.round(
                                (completedSubtasks / totalSubtasks) * 100
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>

                  {/* Blocker Radar */}
                  <td className="px-3 py-3">
                    {isBlocked ? (
                      <span className="inline-flex items-center gap-1 rounded-md border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold text-red-600 dark:bg-red-500/20 dark:text-red-300">
                        <AlertOctagon className="h-3 w-3" />
                        Blocked ({card.blocked_by_card_ids.length})
                      </span>
                    ) : (
                      <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400">
                        Clear
                      </span>
                    )}
                  </td>

                  {/* Fractional Index Position Key */}
                  <td className="px-3 py-3">
                    <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      {card.position}
                    </code>
                  </td>

                  {/* Due Date */}
                  <td className="px-4 py-3 text-right">
                    {card.due_date ? (
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                        <Calendar className="h-3 w-3" />
                        {new Date(card.due_date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}

            {sortedCards.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-6 py-12 text-center text-sm text-zinc-500 dark:text-zinc-400"
                >
                  No issues match your current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
