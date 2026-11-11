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
import { getCustomFieldOptionColor } from "./custom-fields-manager-modal";
import { useWorkspaceStore } from "@/store/workspace-store";
import {
  comparePositions,
  generatePositionBetween,
} from "@/lib/fractional-index";
import { getDueDateStatus, LABEL_COLOR_MAP } from "@/lib/trello-theme";

type SortField =
  | "position"
  | "title"
  | "priority"
  | "story_points"
  | "column"
  | "due_date"
  | `custom_${string}`;

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
      if (sortField.startsWith("custom_")) {
        const fieldId = sortField.replace("custom_", "");
        const cf = board.custom_fields?.find((f) => f.id === fieldId);
        const valA = a.custom_field_values?.find(
          (v) => v.field_id === fieldId
        )?.value;
        const valB = b.custom_field_values?.find(
          (v) => v.field_id === fieldId
        )?.value;

        if (valA === undefined || valA === null || valA === "") {
          cmp = valB === undefined || valB === null || valB === "" ? 0 : 1;
        } else if (valB === undefined || valB === null || valB === "") {
          cmp = -1;
        } else if (cf?.type === "NUMBER") {
          cmp = Number(valA) - Number(valB);
        } else if (cf?.type === "CHECKBOX") {
          cmp = (valA ? 1 : 0) - (valB ? 1 : 0);
        } else if (cf?.type === "DATE") {
          cmp =
            new Date(String(valA)).getTime() - new Date(String(valB)).getTime();
        } else {
          cmp = String(valA).localeCompare(String(valB));
        }
      } else {
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
      }
      return sortAsc ? cmp : -cmp;
    });
    return copy;
  }, [filteredCards, sortField, sortAsc, columnMap, board.custom_fields]);

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
      .filter(
        (c) =>
          c.column_id === targetColumnId &&
          c.id !== card.id &&
          !c.is_archived
      )
      .sort((a, b) => comparePositions(a.position, b.position));
    const prevPos =
      targetColCards.length > 0
        ? targetColCards[targetColCards.length - 1].position
        : undefined;
    const newPos = generatePositionBetween(prevPos, undefined);
    onPersistCardMove(card.id, targetColumnId, newPos, prevPos, undefined);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/95 shadow-xs backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-900/90">
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
                  Card
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="px-3 py-3">Labels</th>
              <th className="px-3 py-3">
                <button
                  type="button"
                  onClick={() => toggleSort("column")}
                  className="inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  List
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="px-3 py-3">Members</th>
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
              <th className="px-3 py-3">Checklists</th>
              <th className="px-3 py-3">Blocker Radar</th>
              {board.custom_fields?.map((field) => (
                <th key={field.id} className="px-3 py-3">
                  <button
                    type="button"
                    onClick={() => toggleSort(`custom_${field.id}`)}
                    className="inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-100"
                  >
                    <span>{field.name}</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
              ))}
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
              const cardLabels = board.labels.filter((l) =>
                card.label_ids.includes(l.id)
              );
              const cardMembers = board.members.filter((m) =>
                card.member_ids.includes(m.id)
              );
              const dueStatus = getDueDateStatus(
                card.due_date,
                card.is_due_complete
              );

              return (
                <tr
                  key={card.id}
                  onClick={() => setSelectedCardId(card.id)}
                  className="group cursor-pointer transition-colors duration-150 hover:bg-zinc-50/90 dark:hover:bg-zinc-800/40"
                >
                  {/* Card Title */}
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
                  </td>

                  {/* Color Labels */}
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      {cardLabels.map((lbl) => {
                        const style = LABEL_COLOR_MAP[lbl.color];
                        return (
                          <span
                            key={lbl.id}
                            className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${style.pillBg} ${style.pillText}`}
                          >
                            {lbl.name || style.name}
                          </span>
                        );
                      })}
                      {cardLabels.length === 0 && (
                        <span className="text-zinc-400">—</span>
                      )}
                    </div>
                  </td>

                  {/* List Column Selector */}
                  <td
                    className="px-3 py-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <select
                      aria-label={`Change list for ${card.title}`}
                      value={card.column_id}
                      onChange={(e) =>
                        handleInlineColumnChange(card, e.target.value)
                      }
                      className="rounded-md border border-zinc-200/80 bg-zinc-50 px-2 py-1 text-xs font-medium text-zinc-800 focus:border-indigo-500 focus:outline-none dark:border-zinc-700/80 dark:bg-zinc-800 dark:text-zinc-200"
                    >
                      {board.columns
                        .filter((col) => !col.is_archived)
                        .map((col) => (
                          <option key={col.id} value={col.id}>
                            {col.title}
                          </option>
                        ))}
                    </select>
                  </td>

                  {/* Assigned Members */}
                  <td className="px-3 py-3">
                    {cardMembers.length > 0 ? (
                      <div className="flex -space-x-1.5">
                        {cardMembers.map((m) => (
                          <span
                            key={m.id}
                            title={m.name}
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white dark:border-zinc-900"
                            style={{ backgroundColor: m.color }}
                          >
                            {m.initials}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
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

                  {/* Checklists */}
                  <td className="px-3 py-3">
                    {totalSubtasks > 0 ? (
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold ${
                            completedSubtasks === totalSubtasks
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                              : "text-zinc-600 dark:text-zinc-300"
                          }`}
                        >
                          <CheckSquare className="h-3 w-3" />
                          {completedSubtasks}/{totalSubtasks}
                        </span>
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

                  {/* Custom Field Columns */}
                  {board.custom_fields?.map((field) => {
                    const valObj = card.custom_field_values?.find(
                      (v) => v.field_id === field.id
                    );
                    const hasVal =
                      valObj &&
                      valObj.value !== null &&
                      valObj.value !== undefined &&
                      valObj.value !== "";

                    return (
                      <td key={field.id} className="px-3 py-3">
                        {!hasVal ? (
                          <span className="font-mono text-[11px] text-zinc-400">
                            —
                          </span>
                        ) : field.type === "DROPDOWN" ? (
                          (() => {
                            const opt = field.options?.find(
                              (o) =>
                                o.id === valObj.value ||
                                o.label.toLowerCase() ===
                                  String(valObj.value).toLowerCase()
                            );
                            const colorStyle = opt
                              ? getCustomFieldOptionColor(opt.color)
                              : null;
                            return (
                              <span
                                className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${
                                  colorStyle
                                    ? colorStyle.bg
                                    : "border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                                }`}
                              >
                                {opt?.label ?? String(valObj.value)}
                              </span>
                            );
                          })()
                        ) : field.type === "CHECKBOX" ? (
                          valObj.value ? (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                              ☑️ Yes
                            </span>
                          ) : (
                            <span className="font-mono text-[11px] text-zinc-400">
                              No
                            </span>
                          )
                        ) : field.type === "NUMBER" ? (
                          <span className="font-mono text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                            {valObj.value}
                            {field.name.toLowerCase().includes("hour") ||
                            field.name.toLowerCase().includes("est")
                              ? "h"
                              : ""}
                          </span>
                        ) : field.type === "DATE" ? (
                          <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300">
                            {new Date(String(valObj.value)).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                timeZone: "UTC",
                              }
                            )}
                          </span>
                        ) : (
                          <span className="block max-w-[140px] truncate text-xs text-zinc-700 dark:text-zinc-300">
                            {String(valObj.value)}
                          </span>
                        )}
                      </td>
                    );
                  })}

                  {/* Due Date */}
                  <td className="px-4 py-3 text-right">
                    {card.due_date ? (
                      <span
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[11px] font-medium ${
                          dueStatus === "complete"
                            ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                            : dueStatus === "overdue"
                              ? "border-rose-500/40 bg-rose-500/15 text-rose-700 dark:text-rose-300"
                              : dueStatus === "due-soon"
                                ? "border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-amber-300"
                                : "border-zinc-200/80 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400"
                        }`}
                      >
                        <Calendar className="h-3 w-3" />
                        {new Date(card.due_date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          timeZone: "UTC",
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
                  colSpan={8 + (board.custom_fields?.length ?? 0)}
                  className="px-6 py-12 text-center text-sm text-zinc-500 dark:text-zinc-400"
                >
                  No cards match your current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
