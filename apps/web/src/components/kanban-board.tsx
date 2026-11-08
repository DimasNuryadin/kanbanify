"use client";

import React, { useMemo, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlertOctagon,
  Calendar,
  CheckSquare,
  GripVertical,
  Plus,
  Sparkles,
} from "lucide-react";
import { Card, Column, Priority } from "@kinetix/contracts";
import { comparePositions, generatePositionBetween } from "@/lib/fractional-index";
import { useWorkspaceStore } from "@/store/workspace-store";

export const PRIORITY_STYLES: Record<
  Priority,
  { badge: string; dot: string; label: string }
> = {
  URGENT: {
    badge:
      "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-300",
    dot: "bg-rose-500",
    label: "Urgent",
  },
  HIGH: {
    badge:
      "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300",
    dot: "bg-amber-500",
    label: "High",
  },
  MEDIUM: {
    badge:
      "border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/15 dark:text-indigo-300",
    dot: "bg-indigo-500",
    label: "Medium",
  },
  LOW: {
    badge:
      "border-zinc-300/80 bg-zinc-100 text-zinc-600 dark:border-zinc-700/80 dark:bg-zinc-800/80 dark:text-zinc-400",
    dot: "bg-zinc-400",
    label: "Low",
  },
};

interface KanbanCardItemProps {
  card: Card;
  onSelect: (cardId: string) => void;
  isOverlay?: boolean;
}

function KanbanCardContent({
  card,
  onSelect,
  isOverlay = false,
  dragHandleProps,
}: KanbanCardItemProps & {
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
}) {
  const priorityMeta = PRIORITY_STYLES[card.priority];
  const isBlocked = card.blocked_by_card_ids.length > 0;
  const completedSubtasks = card.subtasks.filter((s) => s.is_completed).length;
  const totalSubtasks = card.subtasks.length;
  const hasAiTag = card.tags.includes("ai-decomposed");

  return (
    <div
      onClick={() => onSelect(card.id)}
      className={`group relative cursor-pointer rounded-xl border bg-white p-3.5 text-left transition-all duration-150 dark:bg-zinc-900/90 ${
        isOverlay
          ? "rotate-1 scale-[1.02] border-indigo-500/60 shadow-2xl ring-2 ring-indigo-500/20"
          : isBlocked
            ? "border-red-500/40 shadow-xs hover:border-red-500/70 dark:border-red-500/35 dark:hover:border-red-500/60"
            : "border-zinc-200/80 shadow-xs hover:border-zinc-300 hover:shadow-md dark:border-zinc-800/80 dark:hover:border-zinc-700"
      }`}
    >
      {/* Top row: Priority + Position + Story Points + Drag Grip */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${priorityMeta.badge}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${priorityMeta.dot}`} />
            {priorityMeta.label}
          </span>

          {isBlocked && (
            <span
              title={`Blocked by ${card.blocked_by_card_ids.length} upstream issue(s)`}
              className="inline-flex items-center gap-1 rounded-md border border-red-500/40 bg-red-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-red-600 dark:bg-red-500/20 dark:text-red-300"
            >
              <AlertOctagon className="h-2.5 w-2.5" />
              Blocked ({card.blocked_by_card_ids.length})
            </span>
          )}

          {hasAiTag && (
            <span className="inline-flex items-center gap-0.5 rounded-md border border-violet-500/30 bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-medium text-violet-600 dark:text-violet-300">
              <Sparkles className="h-2.5 w-2.5" />
              AI
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <span
            title="Fractional Index Position Key"
            className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
          >
            {card.position}
          </span>
          {card.story_points !== null && (
            <span className="rounded border border-zinc-200/80 bg-zinc-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-zinc-700 dark:border-zinc-700/80 dark:bg-zinc-800 dark:text-zinc-200">
              {card.story_points}pt
            </span>
          )}
          <button
            type="button"
            aria-label="Drag handle"
            onClick={(e) => e.stopPropagation()}
            {...dragHandleProps}
            className="cursor-grab rounded p-0.5 text-zinc-400 opacity-60 transition-opacity group-hover:opacity-100 hover:bg-zinc-100 hover:text-zinc-700 active:cursor-grabbing dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Card Title */}
      <h3 className="mb-1.5 line-clamp-2 text-[13px] leading-snug font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        {card.title}
      </h3>

      {/* Card Description snippet */}
      {card.description && (
        <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          {card.description}
        </p>
      )}

      {/* Tags */}
      {card.tags.length > 0 && (
        <div className="mb-2.5 flex flex-wrap gap-1">
          {card.tags.map((tag) => (
            <span
              key={tag}
              className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-600 dark:bg-zinc-800/90 dark:text-zinc-400"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer: Subtasks Progress & Due Date */}
      {(totalSubtasks > 0 || card.due_date) && (
        <div className="mt-2 flex items-center justify-between border-t border-zinc-100 pt-2 text-[11px] text-zinc-500 dark:border-zinc-800/80 dark:text-zinc-400">
          {totalSubtasks > 0 ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 font-mono text-[11px]">
                <CheckSquare className="h-3 w-3 text-indigo-500 dark:text-indigo-400" />
                {completedSubtasks}/{totalSubtasks}
              </span>
              <div className="h-1.5 w-14 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                <div
                  className="h-full rounded-full bg-indigo-500 transition-all duration-200"
                  style={{
                    width: `${Math.round(
                      (completedSubtasks / totalSubtasks) * 100
                    )}%`,
                  }}
                />
              </div>
            </div>
          ) : (
            <span />
          )}

          {card.due_date && (
            <span className="inline-flex items-center gap-1 font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
              <Calendar className="h-3 w-3" />
              {new Date(card.due_date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function SortableKanbanCard({ card, onSelect }: KanbanCardItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.id,
    data: {
      type: "Card",
      card,
    },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="h-[132px] rounded-xl border-2 border-dashed border-indigo-500/40 bg-indigo-500/5 dark:border-indigo-400/30 dark:bg-indigo-500/10"
      />
    );
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <KanbanCardContent
        card={card}
        onSelect={onSelect}
        dragHandleProps={listeners}
      />
    </div>
  );
}

interface KanbanColumnProps {
  column: Column;
  cards: Card[];
  onSelectCard: (cardId: string) => void;
  onAddCard: (columnId: string) => void;
}

function KanbanColumn({
  column,
  cards,
  onSelectCard,
  onAddCard,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: {
      type: "Column",
      column,
    },
  });

  const cardIds = useMemo(() => cards.map((c) => c.id), [cards]);
  const isWipExceeded =
    column.wip_limit !== null && cards.length > column.wip_limit;
  const colStoryPoints = cards.reduce(
    (sum, c) => sum + (c.story_points ?? 0),
    0
  );

  return (
    <div
      ref={setNodeRef}
      className={`flex h-full min-h-[540px] w-[320px] shrink-0 flex-col rounded-2xl border p-3 transition-colors duration-150 sm:w-[340px] ${
        isOver
          ? "border-indigo-500/50 bg-indigo-50/40 dark:border-indigo-400/50 dark:bg-indigo-950/20"
          : "border-zinc-200/80 bg-zinc-100/65 dark:border-zinc-800/80 dark:bg-zinc-900/45"
      }`}
    >
      {/* Column Header */}
      <div className="mb-3 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold tracking-tight text-zinc-900 uppercase dark:text-zinc-100">
            {column.title}
          </h2>
          <span
            className={`rounded-full px-2 py-0.5 font-mono text-[11px] font-medium ${
              isWipExceeded
                ? "bg-red-500/15 text-red-600 dark:text-red-400"
                : "bg-zinc-200/80 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            }`}
          >
            {cards.length}
            {column.wip_limit ? `/${column.wip_limit}` : ""}
          </span>
          <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
            {colStoryPoints}pt
          </span>
        </div>

        <button
          type="button"
          onClick={() => onAddCard(column.id)}
          title={`Add issue to ${column.title}`}
          className="rounded-md p-1 text-zinc-500 transition-colors hover:bg-zinc-200/70 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Cards Container */}
      <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
        <div className="flex flex-1 flex-col gap-2.5">
          {cards.map((card) => (
            <SortableKanbanCard
              key={card.id}
              card={card}
              onSelect={onSelectCard}
            />
          ))}

          {cards.length === 0 && (
            <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200/80 p-6 text-center dark:border-zinc-800/80">
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                Drop an issue here
              </p>
              <button
                type="button"
                onClick={() => onAddCard(column.id)}
                className="mt-2 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
              >
                + Create issue
              </button>
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

interface KanbanBoardProps {
  filteredCards: Card[];
  onPersistCardMove: (
    cardId: string,
    targetColumnId: string,
    newPosition: string,
    prevPos?: string,
    nextPos?: string
  ) => void;
}

export function KanbanBoard({
  filteredCards,
  onPersistCardMove,
}: KanbanBoardProps) {
  const board = useWorkspaceStore((s) => s.board);
  const setSelectedCardId = useWorkspaceStore((s) => s.setSelectedCardId);
  const openCreateCardModal = useWorkspaceStore((s) => s.openCreateCardModal);

  const [activeCardId, setActiveCardId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const sortedColumns = useMemo(
    () =>
      [...board.columns].sort((a, b) =>
        comparePositions(a.position, b.position)
      ),
    [board.columns]
  );

  const activeCard = useMemo(
    () => board.cards.find((c) => c.id === activeCardId) ?? null,
    [board.cards, activeCardId]
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveCardId(String(event.active.id));
  };

  const handleDragOver = (_event: DragOverEvent) => {
    // Final fractional index position is computed deterministically in handleDragEnd
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveCardId(null);
    const { active, over } = event;
    if (!over) return;

    const draggedCardId = String(active.id);
    const overId = String(over.id);

    const draggedCard = board.cards.find((c) => c.id === draggedCardId);
    if (!draggedCard) return;

    // Determine target column and index
    const overColumn = board.columns.find((col) => col.id === overId);
    const overCard = board.cards.find((c) => c.id === overId);

    const targetColumnId = overColumn
      ? overColumn.id
      : overCard
        ? overCard.column_id
        : draggedCard.column_id;

    // All cards in target column (excluding the dragged card itself), sorted by position
    const targetColCards = board.cards
      .filter((c) => c.column_id === targetColumnId && c.id !== draggedCardId)
      .sort((a, b) => comparePositions(a.position, b.position));

    let prevPos: string | undefined;
    let nextPos: string | undefined;

    if (overColumn) {
      // Dropped directly on column container -> append to end of column
      prevPos =
        targetColCards.length > 0
          ? targetColCards[targetColCards.length - 1].position
          : undefined;
      nextPos = undefined;
    } else if (overCard) {
      if (overCard.id === draggedCardId) return;

      const overIdxInTarget = targetColCards.findIndex(
        (c) => c.id === overCard.id
      );

      if (overIdxInTarget === -1) {
        prevPos =
          targetColCards.length > 0
            ? targetColCards[targetColCards.length - 1].position
            : undefined;
        nextPos = undefined;
      } else {
        // Check if moving downwards within the same column or inserting before overCard
        const originalColCards = board.cards
          .filter((c) => c.column_id === draggedCard.column_id)
          .sort((a, b) => comparePositions(a.position, b.position));
        const oldIdx = originalColCards.findIndex(
          (c) => c.id === draggedCardId
        );
        const newIdx = originalColCards.findIndex((c) => c.id === overCard.id);

        const isMovingDownSameCol =
          draggedCard.column_id === targetColumnId &&
          oldIdx !== -1 &&
          newIdx !== -1 &&
          oldIdx < newIdx;

        if (isMovingDownSameCol) {
          // Place immediately after overCard
          prevPos = targetColCards[overIdxInTarget].position;
          nextPos = targetColCards[overIdxInTarget + 1]?.position;
        } else {
          // Place immediately before overCard
          prevPos = targetColCards[overIdxInTarget - 1]?.position;
          nextPos = targetColCards[overIdxInTarget].position;
        }
      }
    }

    const newPosition = generatePositionBetween(prevPos, nextPos);

    if (
      draggedCard.column_id === targetColumnId &&
      draggedCard.position === newPosition
    ) {
      return;
    }

    onPersistCardMove(
      draggedCardId,
      targetColumnId,
      newPosition,
      prevPos,
      nextPos
    );
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-6">
        {sortedColumns.map((column) => {
          const colCards = filteredCards
            .filter((c) => c.column_id === column.id)
            .sort((a, b) => comparePositions(a.position, b.position));

          return (
            <KanbanColumn
              key={column.id}
              column={column}
              cards={colCards}
              onSelectCard={(id) => setSelectedCardId(id)}
              onAddCard={(colId) => openCreateCardModal(colId)}
            />
          );
        })}
      </div>

      <DragOverlay>
        {activeCard ? (
          <div className="w-[320px] sm:w-[340px]">
            <KanbanCardContent
              card={activeCard}
              onSelect={() => {}}
              isOverlay
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
