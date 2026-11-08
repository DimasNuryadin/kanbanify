"use client";

import React, { useMemo, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  Columns3,
  CreditCard,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { UpdateCardRequest, UpdateColumnRequest } from "@kinetix/contracts";
import { useWorkspaceStore } from "@/store/workspace-store";
import { LABEL_COLOR_MAP } from "@/lib/trello-theme";

interface ArchivedItemsDrawerProps {
  onUpdateCard: (cardId: string, payload: UpdateCardRequest) => Promise<void>;
  onDeleteCard: (cardId: string) => Promise<void>;
  onUpdateColumn: (
    columnId: string,
    payload: UpdateColumnRequest
  ) => Promise<void>;
}

export function ArchivedItemsDrawer({
  onUpdateCard,
  onDeleteCard,
  onUpdateColumn,
}: ArchivedItemsDrawerProps) {
  const isOpen = useWorkspaceStore((s) => s.isArchivedDrawerOpen);
  const setOpen = useWorkspaceStore((s) => s.setArchivedDrawerOpen);
  const board = useWorkspaceStore((s) => s.board);
  const setSelectedCardId = useWorkspaceStore((s) => s.setSelectedCardId);

  const [activeTab, setActiveTab] = useState<"cards" | "lists">("cards");
  const [query, setQuery] = useState("");

  const archivedCards = useMemo(() => {
    const q = query.trim().toLowerCase();
    return board.cards.filter(
      (c) =>
        c.is_archived &&
        (!q ||
          c.title.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q))
    );
  }, [board.cards, query]);

  const archivedColumns = useMemo(() => {
    const q = query.trim().toLowerCase();
    return board.columns.filter(
      (col) => col.is_archived && (!q || col.title.toLowerCase().includes(q))
    );
  }, [board.columns, query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        onClick={() => setOpen(false)}
        className="fixed inset-0 bg-zinc-950/40 backdrop-blur-xs transition-opacity"
      />

      <aside className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-zinc-200/80 bg-white shadow-2xl dark:border-zinc-800/80 dark:bg-zinc-950">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200/80 px-5 py-4 dark:border-zinc-800/80">
          <div className="flex items-center gap-2">
            <Archive className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              Archived Items
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search & Tabs */}
        <div className="space-y-3 border-b border-zinc-200/80 p-4 dark:border-zinc-800/80">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search archived items..."
              className="w-full rounded-xl border border-zinc-200/80 bg-zinc-50 py-1.5 pr-3 pl-8 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-1 rounded-xl border border-zinc-200/80 bg-zinc-100/70 p-1 dark:border-zinc-800 dark:bg-zinc-900">
            <button
              type="button"
              onClick={() => setActiveTab("cards")}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-all ${
                activeTab === "cards"
                  ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              <CreditCard className="h-3.5 w-3.5" />
              <span>Cards ({archivedCards.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("lists")}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-all ${
                activeTab === "lists"
                  ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              <Columns3 className="h-3.5 w-3.5" />
              <span>Lists ({archivedColumns.length})</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === "cards" ? (
            <div className="space-y-3">
              {archivedCards.map((card) => {
                const col = board.columns.find((c) => c.id === card.column_id);
                const cardLabels = board.labels.filter((l) =>
                  card.label_ids.includes(l.id)
                );

                return (
                  <div
                    key={card.id}
                    className="rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-3.5 shadow-2xs dark:border-zinc-800/80 dark:bg-zinc-900/60"
                  >
                    {cardLabels.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-1">
                        {cardLabels.map((lbl) => {
                          const style = LABEL_COLOR_MAP[lbl.color];
                          return (
                            <span
                              key={lbl.id}
                              className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium border ${style.pillBg} ${style.pillText}`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${style.dot}`}
                              />
                              {lbl.name || style.name}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCardId(card.id);
                        setOpen(false);
                      }}
                      className="text-left text-xs font-semibold text-zinc-900 hover:text-indigo-600 dark:text-zinc-100 dark:hover:text-indigo-400"
                    >
                      {card.title}
                    </button>
                    <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                      Originally in list{" "}
                      <strong className="text-zinc-700 dark:text-zinc-300">
                        {col?.title ?? "Unknown"}
                      </strong>
                    </p>

                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateCard(card.id, { is_archived: false })
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200/80 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                      >
                        <ArchiveRestore className="h-3 w-3 text-emerald-500" />
                        Restore to Board
                      </button>

                      <button
                        type="button"
                        onClick={() => onDeleteCard(card.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[11px] font-medium text-rose-600 transition-colors hover:bg-rose-500/20 dark:text-rose-300"
                      >
                        <Trash2 className="h-3 w-3" />
                        Delete Permanently
                      </button>
                    </div>
                  </div>
                );
              })}

              {archivedCards.length === 0 && (
                <div className="rounded-xl border border-dashed border-zinc-200/80 py-12 text-center dark:border-zinc-800">
                  <Archive className="mx-auto mb-2 h-6 w-6 text-zinc-400" />
                  <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                    No archived cards
                  </p>
                  <p className="mt-0.5 text-[11px] text-zinc-400">
                    Cards you archive from the board or modal appear here.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {archivedColumns.map((col) => {
                const count = board.cards.filter(
                  (c) => c.column_id === col.id && !c.is_archived
                ).length;

                return (
                  <div
                    key={col.id}
                    className="flex items-center justify-between rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-3.5 dark:border-zinc-800/80 dark:bg-zinc-900/60"
                  >
                    <div className="flex items-center gap-2.5">
                      {col.color && (
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: col.color }}
                        />
                      )}
                      <div>
                        <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                          {col.title}
                        </p>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          {count} card(s)
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        onUpdateColumn(col.id, { is_archived: false })
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200/80 bg-white px-2.5 py-1.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                    >
                      <ArchiveRestore className="h-3.5 w-3.5 text-emerald-500" />
                      Send to Board
                    </button>
                  </div>
                );
              })}

              {archivedColumns.length === 0 && (
                <div className="rounded-xl border border-dashed border-zinc-200/80 py-12 text-center dark:border-zinc-800">
                  <Columns3 className="mx-auto mb-2 h-6 w-6 text-zinc-400" />
                  <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                    No archived lists
                  </p>
                  <p className="mt-0.5 text-[11px] text-zinc-400">
                    Lists archived via the list header menu appear here.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
