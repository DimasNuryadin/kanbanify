"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlertOctagon,
  AlignLeft,
  Archive,
  Calendar,
  Check,
  CheckSquare,
  Copy,
  Eye,
  GripVertical,
  MessageSquare,
  MoreHorizontal,
  Palette,
  Paperclip,
  Pencil,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import {
  Card,
  Column,
  CopyColumnRequest,
  CreateCardRequest,
  CreateColumnRequest,
  Label,
  Member,
  Priority,
  UpdateCardRequest,
  UpdateColumnRequest,
} from "@kinetix/contracts";
import {
  comparePositions,
  generatePositionBetween,
} from "@/lib/fractional-index";
import { useWorkspaceStore } from "@/store/workspace-store";
import {
  getDueDateStatus,
  LABEL_COLOR_MAP,
  LIST_COLOR_ACCENTS,
  resolveCoverColor,
} from "@/lib/trello-theme";

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
  boardLabels: Label[];
  boardMembers: Member[];
  areLabelsExpanded: boolean;
  onToggleLabelsExpanded: () => void;
  onSelect: (cardId: string) => void;
  onUpdateCard: (cardId: string, payload: UpdateCardRequest) => Promise<void>;
  isOverlay?: boolean;
}

function KanbanCardContent({
  card,
  boardLabels,
  boardMembers,
  areLabelsExpanded,
  onToggleLabelsExpanded,
  onSelect,
  onUpdateCard,
  isOverlay = false,
  dragHandleProps,
}: KanbanCardItemProps & {
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
}) {
  const [isQuickEditing, setIsQuickEditing] = useState(false);
  const [quickTitle, setQuickTitle] = useState(card.title);

  const presences = useWorkspaceStore((s) => s.presences);
  const editingCollaborator = useMemo(() => {
    return presences.find(
      (p) =>
        p.active_card_id === card.id &&
        p.status === "EDITING" &&
        p.user_id !== "88888888-8888-4888-8888-888888888881"
    );
  }, [presences, card.id]);

  useEffect(() => {
    setQuickTitle(card.title);
  }, [card.title]);

  const priorityMeta = PRIORITY_STYLES[card.priority];
  const isBlocked = card.blocked_by_card_ids.length > 0;
  const hasAiTag = card.tags.includes("ai-decomposed");

  // Compute checklist items progress across all checklists (or fallback to subtasks)
  const { completedChecklistItems, totalChecklistItems } = useMemo(() => {
    if (card.checklists && card.checklists.length > 0) {
      let total = 0;
      let done = 0;
      for (const cl of card.checklists) {
        total += cl.items.length;
        done += cl.items.filter((i) => i.is_completed).length;
      }
      return { completedChecklistItems: done, totalChecklistItems: total };
    }
    return {
      completedChecklistItems: card.subtasks.filter((s) => s.is_completed)
        .length,
      totalChecklistItems: card.subtasks.length,
    };
  }, [card.checklists, card.subtasks]);

  const allChecklistDone =
    totalChecklistItems > 0 &&
    completedChecklistItems === totalChecklistItems;

  const dueStatus = getDueDateStatus(card.due_date, card.is_due_complete);

  const activeLabels = useMemo(
    () => boardLabels.filter((l) => card.label_ids?.includes(l.id)),
    [boardLabels, card.label_ids]
  );

  const assignedMembers = useMemo(
    () => boardMembers.filter((m) => card.member_ids?.includes(m.id)),
    [boardMembers, card.member_ids]
  );

  const hasCover = card.cover && card.cover.type !== "none" && card.cover.value;
  const isFullCover = hasCover && card.cover.size === "full";

  const handleSaveQuickEdit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setIsQuickEditing(false);
    const trimmed = quickTitle.trim();
    if (!trimmed || trimmed === card.title) {
      setQuickTitle(card.title);
      return;
    }
    await onUpdateCard(card.id, { title: trimmed });
  };

  // Full Cover Card Mode (Trello "full" cover size)
  if (isFullCover && !isQuickEditing) {
    return (
      <div
        onClick={() => onSelect(card.id)}
        style={
          card.cover.type === "color"
            ? { backgroundColor: resolveCoverColor(card.cover.value) }
            : {
                backgroundImage: `linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.65)), url(${card.cover.value})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
        }
        className={`group relative min-h-[104px] cursor-pointer overflow-hidden rounded-xl border p-3.5 text-left text-white shadow-sm transition-all duration-150 hover:shadow-md ${
          isOverlay
            ? "rotate-1 scale-[1.02] shadow-2xl ring-2 ring-white/40"
            : editingCollaborator
              ? "border-violet-500 ring-2 ring-violet-400/80 shadow-[0_0_15px_rgba(139,92,246,0.5)] animate-pulse"
              : "border-black/15"
        }`}
      >
        {/* Live Editing Pill for Full Cover */}
        {editingCollaborator && (
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-black/40 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-xs">
            <span>💬</span>
            <span>{editingCollaborator.user_name} is editing...</span>
            <span className="inline-flex items-center gap-0.5 ml-0.5">
              <span className="h-1 w-1 rounded-full bg-white animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="h-1 w-1 rounded-full bg-white animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="h-1 w-1 rounded-full bg-white animate-bounce" style={{ animationDelay: "300ms" }} />
            </span>
          </div>
        )}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap gap-1">
            {activeLabels.map((lbl) => (
              <button
                key={lbl.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleLabelsExpanded();
                }}
                className="rounded-md bg-black/30 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-xs transition-all duration-200 hover:bg-black/45"
              >
                {areLabelsExpanded ? lbl.name || lbl.color : ""}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              title="Quick edit card title"
              onClick={(e) => {
                e.stopPropagation();
                setIsQuickEditing(true);
              }}
              className="rounded-md bg-black/35 p-1 text-white hover:bg-black/55"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              type="button"
              aria-label="Drag handle"
              onClick={(e) => e.stopPropagation()}
              {...dragHandleProps}
              className="cursor-grab rounded-md bg-black/35 p-1 text-white active:cursor-grabbing"
            >
              <GripVertical className="h-3 w-3" />
            </button>
          </div>
        </div>

        <h3 className="mt-4 text-sm leading-snug font-bold tracking-tight text-white drop-shadow-xs">
          {card.title}
        </h3>

        <div className="mt-3 flex items-center justify-between text-[11px] text-white/90">
          <div className="flex items-center gap-2">
            {card.is_watching && <Eye className="h-3.5 w-3.5" />}
            {totalChecklistItems > 0 && (
              <span className="inline-flex items-center gap-1 rounded bg-black/25 px-1.5 py-0.5 font-mono text-[10px]">
                <CheckSquare className="h-3 w-3" />
                {completedChecklistItems}/{totalChecklistItems}
              </span>
            )}
          </div>
          {assignedMembers.length > 0 && (
            <div className="flex -space-x-1">
              {assignedMembers.map((m) => (
                <span
                  key={m.id}
                  title={m.name}
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/60 text-[9px] font-bold text-white"
                  style={{ backgroundColor: m.color }}
                >
                  {m.initials}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => {
        if (!isQuickEditing) onSelect(card.id);
      }}
      className={`group relative cursor-pointer overflow-hidden rounded-xl border bg-white text-left transition-all duration-150 dark:bg-zinc-900/95 ${
        isOverlay
          ? "rotate-1 scale-[1.02] border-indigo-500/60 shadow-2xl ring-2 ring-indigo-500/20"
          : editingCollaborator
            ? "border-violet-500/80 shadow-[0_0_15px_rgba(139,92,246,0.35)] ring-2 ring-violet-500/40 animate-pulse"
            : isBlocked
              ? "border-red-500/45 shadow-xs hover:border-red-500/75 dark:border-red-500/40 dark:hover:border-red-500/65"
              : "border-zinc-200/85 shadow-xs hover:border-zinc-300 hover:shadow-md dark:border-zinc-800/90 dark:hover:border-zinc-700"
      }`}
    >
      {/* Card Cover Banner ("normal" top strip) */}
      {hasCover && card.cover.size === "normal" && (
        <div
          className={
            card.cover.type === "image" ? "h-28 w-full" : "h-7 w-full"
          }
          style={
            card.cover.type === "color"
              ? { backgroundColor: resolveCoverColor(card.cover.value) }
              : {
                  backgroundImage: `url(${card.cover.value})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
          }
        />
      )}

      <div className="p-3">
        {/* Hover Quick-Edit Button + Drag Handle in Top-Right */}
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            title="Quick edit title or archive"
            onClick={(e) => {
              e.stopPropagation();
              setIsQuickEditing(!isQuickEditing);
            }}
            className="rounded-lg border border-zinc-200/80 bg-white/95 p-1 text-zinc-600 shadow-xs backdrop-blur-xs hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800/95 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            type="button"
            aria-label="Drag handle"
            onClick={(e) => e.stopPropagation()}
            {...dragHandleProps}
            className="cursor-grab rounded-lg border border-zinc-200/80 bg-white/95 p-1 text-zinc-500 shadow-xs backdrop-blur-xs hover:bg-zinc-100 hover:text-zinc-900 active:cursor-grabbing dark:border-zinc-700 dark:bg-zinc-800/95 dark:text-zinc-400"
          >
            <GripVertical className="h-3 w-3" />
          </button>
        </div>

        {/* Live Collaborator Editing & Conflict Prevention Pill */}
        {editingCollaborator && (
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-violet-500/40 bg-violet-500/15 px-2.5 py-0.5 text-[10px] font-semibold text-violet-700 shadow-xs backdrop-blur-xs dark:bg-violet-500/25 dark:text-violet-200">
            <span>💬</span>
            <span>{editingCollaborator.user_name} is editing...</span>
            <span className="inline-flex items-center gap-0.5 ml-0.5">
              <span className="h-1 w-1 rounded-full bg-violet-600 dark:bg-violet-300 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="h-1 w-1 rounded-full bg-violet-600 dark:bg-violet-300 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="h-1 w-1 rounded-full bg-violet-600 dark:bg-violet-300 animate-bounce" style={{ animationDelay: "300ms" }} />
            </span>
          </div>
        )}

        {/* Expandable Color Labels Row */}
        {activeLabels.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1 pr-12">
            {activeLabels.map((lbl) => {
              const style = LABEL_COLOR_MAP[lbl.color];
              return (
                <button
                  key={lbl.id}
                  type="button"
                  title={`${lbl.name || style.name} (Click to toggle label text across board)`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleLabelsExpanded();
                  }}
                  className={`inline-flex items-center overflow-hidden rounded-md font-semibold transition-all duration-200 ${
                    areLabelsExpanded
                      ? `border px-2 py-0.5 text-[10px] ${style.pillBg} ${style.pillText}`
                      : "h-2 w-10 hover:opacity-85"
                  }`}
                  style={
                    !areLabelsExpanded
                      ? { backgroundColor: style.swatch }
                      : undefined
                  }
                >
                  {areLabelsExpanded && (
                    <span className="truncate">{lbl.name || style.name}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Quick Edit Inline Mode vs Standard Title */}
        {isQuickEditing ? (
          <form
            onSubmit={handleSaveQuickEdit}
            onClick={(e) => e.stopPropagation()}
            className="mb-2 space-y-2"
          >
            <textarea
              rows={2}
              autoFocus
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSaveQuickEdit();
                } else if (e.key === "Escape") {
                  setQuickTitle(card.title);
                  setIsQuickEditing(false);
                }
              }}
              className="w-full resize-none rounded-lg border border-indigo-500 bg-zinc-50 p-2 text-xs font-semibold text-zinc-900 focus:bg-white focus:outline-none dark:bg-zinc-950 dark:text-zinc-100"
            />
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1">
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-indigo-500"
                >
                  <Check className="h-3 w-3" />
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setQuickTitle(card.title);
                    setIsQuickEditing(false);
                  }}
                  className="rounded-md px-2 py-1 text-[11px] text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
              </div>
              <button
                type="button"
                onClick={() => onUpdateCard(card.id, { is_archived: true })}
                title="Archive card"
                className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-600 hover:bg-amber-500/20 dark:text-amber-300"
              >
                <Archive className="h-3 w-3" />
                Archive
              </button>
            </div>
          </form>
        ) : (
          <h3 className="mb-1.5 pr-8 text-[13px] leading-snug font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {card.title}
          </h3>
        )}

        {/* Priority + Story Points + AI + Blocker Row */}
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${priorityMeta.badge}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${priorityMeta.dot}`} />
            {priorityMeta.label}
          </span>

          {card.story_points !== null && (
            <span className="rounded border border-zinc-200/80 bg-zinc-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-zinc-700 dark:border-zinc-700/80 dark:bg-zinc-800 dark:text-zinc-200">
              {card.story_points}pt
            </span>
          )}

          {isBlocked && (
            <span
              title={`Blocked by ${card.blocked_by_card_ids.length} upstream card(s)`}
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

        {/* Rich Trello Footer Metadata Badges & Assigned Member Avatars */}
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-2 text-[11px] text-zinc-500 dark:border-zinc-800/80 dark:text-zinc-400">
          {/* Left Badges */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Watching Eye Badge */}
            {card.is_watching && (
              <span
                title="You are watching this card"
                className="inline-flex items-center text-zinc-500 dark:text-zinc-400"
              >
                <Eye className="h-3.5 w-3.5" />
              </span>
            )}

            {/* Interactive Due Date Badge (Green when completed, Red when overdue, Amber when due soon) */}
            {card.due_date && (
              <button
                type="button"
                title={
                  card.is_due_complete
                    ? "This card is complete (Click to mark incomplete)"
                    : dueStatus === "overdue"
                      ? "This card is overdue! (Click to mark complete)"
                      : dueStatus === "due-soon"
                        ? "This card is due soon (Click to mark complete)"
                        : "Click to toggle due date completion"
                }
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateCard(card.id, {
                    is_due_complete: !card.is_due_complete,
                  });
                }}
                className={`group/due inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-semibold transition-colors ${
                  dueStatus === "complete"
                    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                    : dueStatus === "overdue"
                      ? "border-rose-500/40 bg-rose-500/15 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300"
                      : dueStatus === "due-soon"
                        ? "border-amber-500/40 bg-amber-500/15 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300"
                        : "border-zinc-200/80 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                }`}
              >
                <span className="relative flex h-3 w-3 items-center justify-center">
                  <Calendar className="h-3 w-3 group-hover/due:hidden" />
                  <span
                    className={`hidden h-3 w-3 items-center justify-center rounded-xs border group-hover/due:flex ${
                      card.is_due_complete
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : "border-current"
                    }`}
                  >
                    {card.is_due_complete && <Check className="h-2.5 w-2.5" />}
                  </span>
                </span>
                <span>
                  {new Date(card.due_date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    timeZone: "UTC",
                  })}
                </span>
              </button>
            )}

            {/* Description Indicator Icon */}
            {card.description && card.description.trim().length > 0 && (
              <span
                title="This card has a description"
                className="inline-flex items-center text-zinc-400 dark:text-zinc-500"
              >
                <AlignLeft className="h-3.5 w-3.5" />
              </span>
            )}

            {/* Comments Count Badge */}
            {card.comments && card.comments.length > 0 && (
              <span
                title={`${card.comments.length} comment(s)`}
                className="inline-flex items-center gap-1 font-mono text-[10px] text-zinc-500 dark:text-zinc-400"
              >
                <MessageSquare className="h-3 w-3" />
                {card.comments.length}
              </span>
            )}

            {/* Attachments Count Badge */}
            {card.attachments && card.attachments.length > 0 && (
              <span
                title={`${card.attachments.length} attachment(s)`}
                className="inline-flex items-center gap-1 font-mono text-[10px] text-zinc-500 dark:text-zinc-400"
              >
                <Paperclip className="h-3 w-3" />
                {card.attachments.length}
              </span>
            )}

            {/* Checklist Progress Badge (Turns Green when all items are completed) */}
            {totalChecklistItems > 0 && (
              <span
                title={`Checklist items: ${completedChecklistItems}/${totalChecklistItems} completed`}
                className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                  allChecklistDone
                    ? "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                }`}
              >
                <CheckSquare className="h-3 w-3" />
                {completedChecklistItems}/{totalChecklistItems}
              </span>
            )}
          </div>

          {/* Right: Assigned Member Avatars */}
          {assignedMembers.length > 0 && (
            <div className="flex -space-x-1.5">
              {assignedMembers.map((member) => (
                <span
                  key={member.id}
                  title={member.name}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white shadow-2xs dark:border-zinc-900"
                  style={{ backgroundColor: member.color }}
                >
                  {member.initials}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SortableKanbanCard(props: KanbanCardItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: props.card.id,
    data: {
      type: "Card",
      card: props.card,
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
        className="h-[118px] rounded-xl border-2 border-dashed border-indigo-500/45 bg-indigo-500/10 dark:border-indigo-400/35 dark:bg-indigo-500/15"
      />
    );
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <KanbanCardContent {...props} dragHandleProps={listeners} />
    </div>
  );
}

interface SortableKanbanColumnProps {
  column: Column;
  cards: Card[];
  boardLabels: Label[];
  boardMembers: Member[];
  areLabelsExpanded: boolean;
  onToggleLabelsExpanded: () => void;
  onSelectCard: (cardId: string) => void;
  onUpdateCard: (cardId: string, payload: UpdateCardRequest) => Promise<void>;
  onCreateCard: (payload: CreateCardRequest) => Promise<void>;
  onUpdateColumn: (
    columnId: string,
    payload: UpdateColumnRequest
  ) => Promise<void>;
  onCopyColumn: (
    columnId: string,
    payload?: CopyColumnRequest
  ) => Promise<void>;
}

function SortableKanbanColumn({
  column,
  cards,
  boardLabels,
  boardMembers,
  areLabelsExpanded,
  onToggleLabelsExpanded,
  onSelectCard,
  onUpdateCard,
  onCreateCard,
  onUpdateColumn,
  onCopyColumn,
}: SortableKanbanColumnProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: column.id,
    data: {
      type: "Column",
      column,
    },
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  // Inline List Title Rename
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(column.title);

  // List Header Menu (...)
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Inline Bottom Card Composer ("+ Add a card")
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [composerTitle, setComposerTitle] = useState("");
  const composerInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setTitleDraft(column.title);
  }, [column.title]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isMenuOpen]);

  const cardIds = useMemo(() => cards.map((c) => c.id), [cards]);
  const isWipExceeded =
    column.wip_limit !== null && cards.length > column.wip_limit;

  const handleSaveColumnTitle = async () => {
    setIsEditingTitle(false);
    const trimmed = titleDraft.trim();
    if (!trimmed || trimmed === column.title) {
      setTitleDraft(column.title);
      return;
    }
    await onUpdateColumn(column.id, { title: trimmed });
  };

  const handleInlineCreateCard = async () => {
    const trimmed = composerTitle.trim();
    if (!trimmed) return;

    const lastPos =
      cards.length > 0 ? cards[cards.length - 1].position : undefined;
    const nextPos = generatePositionBetween(lastPos, undefined);

    setComposerTitle("");
    await onCreateCard({
      column_id: column.id,
      title: trimmed,
      description: "",
      position: nextPos,
      priority: "MEDIUM",
      story_points: null,
      tags: [],
      subtasks: [],
      blocked_by_card_ids: [],
      due_date: null,
      cover: { type: "none", value: null, size: "normal" },
      label_ids: [],
      member_ids: [],
      checklists: [],
      comments: [],
      attachments: [],
      start_date: null,
      is_due_complete: false,
      is_archived: false,
      is_watching: false,
    });

    // Keep composer open and focused for rapid Trello entry
    setTimeout(() => {
      composerInputRef.current?.focus();
    }, 10);
  };

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="h-[520px] w-[310px] shrink-0 rounded-2xl border-2 border-dashed border-indigo-500/50 bg-indigo-500/10 sm:w-[325px]"
      />
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="flex max-h-[calc(100vh-148px)] w-[310px] shrink-0 flex-col rounded-2xl border border-zinc-200/85 bg-zinc-100/90 p-2.5 shadow-xs backdrop-blur-md transition-colors duration-150 sm:w-[325px] dark:border-zinc-800/85 dark:bg-zinc-900/85"
    >
      {/* Top Color Accent Bar if column.color is set */}
      {column.color && (
        <div
          className="mb-2 h-1.5 w-full rounded-full"
          style={{ backgroundColor: column.color }}
        />
      )}

      {/* List Header */}
      <div className="mb-2.5 flex items-center justify-between gap-2 px-1">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {/* Column Drag Handle */}
          <button
            type="button"
            title="Drag list horizontally"
            {...listeners}
            className="cursor-grab rounded p-0.5 text-zinc-400 hover:bg-zinc-200/70 hover:text-zinc-700 active:cursor-grabbing dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>

          {isEditingTitle ? (
            <input
              type="text"
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={handleSaveColumnTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveColumnTitle();
                if (e.key === "Escape") {
                  setTitleDraft(column.title);
                  setIsEditingTitle(false);
                }
              }}
              className="w-full rounded-md border border-indigo-500 bg-white px-2 py-0.5 text-xs font-bold text-zinc-900 focus:outline-none dark:bg-zinc-950 dark:text-zinc-100"
            />
          ) : (
            <button
              type="button"
              onClick={() => setIsEditingTitle(true)}
              title="Click to rename list"
              className="truncate rounded px-1 py-0.5 text-left text-xs font-bold tracking-tight text-zinc-900 hover:bg-zinc-200/60 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              {column.title}
            </button>
          )}

          <span
            className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold ${
              isWipExceeded
                ? "bg-red-500/15 text-red-600 dark:text-red-400"
                : "bg-zinc-200/80 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            }`}
          >
            {cards.length}
            {column.wip_limit ? `/${column.wip_limit}` : ""}
          </span>
        </div>

        {/* List Header Actions Menu (...) */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            title="List actions"
            className="rounded-lg p-1 text-zinc-500 transition-colors hover:bg-zinc-200/70 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>

          {isMenuOpen && (
            <div className="absolute top-full right-0 z-40 mt-1 w-56 rounded-xl border border-zinc-200/90 bg-white p-2 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
              <div className="mb-1.5 flex items-center justify-between border-b border-zinc-100 px-2 pb-1.5 text-[11px] font-semibold text-zinc-500 dark:border-zinc-800">
                <span>List Actions</span>
                <button
                  type="button"
                  onClick={() => setIsMenuOpen(false)}
                  className="text-zinc-400 hover:text-zinc-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  setIsComposerOpen(true);
                  setTimeout(() => composerInputRef.current?.focus(), 20);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <Plus className="h-3.5 w-3.5 text-indigo-500" />
                Add a card...
              </button>

              <button
                type="button"
                onClick={async () => {
                  setIsMenuOpen(false);
                  await onCopyColumn(column.id, {
                    title: `${column.title} (Copy)`,
                  });
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <Copy className="h-3.5 w-3.5 text-zinc-400" />
                Copy list...
              </button>

              {/* Change List Color Accent */}
              <div className="my-1.5 border-t border-zinc-100 pt-2 px-2 dark:border-zinc-800">
                <span className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">
                  <Palette className="h-3 w-3" />
                  List Color Accent
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {LIST_COLOR_ACCENTS.map((acc) => {
                    const active = column.color === acc.value;
                    return (
                      <button
                        key={acc.name}
                        type="button"
                        onClick={() =>
                          onUpdateColumn(column.id, { color: acc.value })
                        }
                        title={acc.name}
                        className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                          active
                            ? "scale-110 ring-2 ring-indigo-500"
                            : "border-zinc-300 dark:border-zinc-700"
                        }`}
                        style={{
                          backgroundColor: acc.value ?? "transparent",
                        }}
                      >
                        {active && (
                          <Check
                            className={`h-3 w-3 ${
                              acc.value ? "text-white" : "text-zinc-500"
                            }`}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-1.5 border-t border-zinc-100 pt-1 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={async () => {
                    setIsMenuOpen(false);
                    await onUpdateColumn(column.id, { is_archived: true });
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-amber-600 hover:bg-amber-500/10 dark:text-amber-400"
                >
                  <Archive className="h-3.5 w-3.5" />
                  Archive this list
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Scrollable Cards List */}
      <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-0.5 py-0.5">
          {cards.map((card) => (
            <SortableKanbanCard
              key={card.id}
              card={card}
              boardLabels={boardLabels}
              boardMembers={boardMembers}
              areLabelsExpanded={areLabelsExpanded}
              onToggleLabelsExpanded={onToggleLabelsExpanded}
              onSelect={onSelectCard}
              onUpdateCard={onUpdateCard}
            />
          ))}
        </div>
      </SortableContext>

      {/* Inline Bottom Card Composer ("+ Add a card") */}
      <div className="mt-2 pt-1">
        {isComposerOpen ? (
          <div className="rounded-xl border border-zinc-200/90 bg-white p-2 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
            <textarea
              ref={composerInputRef}
              rows={2}
              autoFocus
              value={composerTitle}
              onChange={(e) => setComposerTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleInlineCreateCard();
                } else if (e.key === "Escape") {
                  setIsComposerOpen(false);
                  setComposerTitle("");
                }
              }}
              placeholder="Enter a title for this card..."
              className="w-full resize-none bg-transparent text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-100"
            />
            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleInlineCreateCard}
                  className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-500"
                >
                  Add card
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsComposerOpen(false);
                    setComposerTitle("");
                  }}
                  className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <span className="font-mono text-[10px] text-zinc-400">
                ↵ to add
              </span>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setIsComposerOpen(true);
              setTimeout(() => composerInputRef.current?.focus(), 20);
            }}
            className="flex w-full items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-left text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-200/75 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/80 dark:hover:text-zinc-100"
          >
            <Plus className="h-4 w-4" />
            <span>Add a card</span>
          </button>
        )}
      </div>
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
  onPersistColumnMove: (
    columnId: string,
    newPosition: string,
    prevPos?: string,
    nextPos?: string
  ) => void;
  onCreateCard: (payload: CreateCardRequest) => Promise<void>;
  onUpdateCard: (cardId: string, payload: UpdateCardRequest) => Promise<void>;
  onCreateColumn: (payload: CreateColumnRequest) => Promise<void>;
  onUpdateColumn: (
    columnId: string,
    payload: UpdateColumnRequest
  ) => Promise<void>;
  onCopyColumn: (
    columnId: string,
    payload?: CopyColumnRequest
  ) => Promise<void>;
}

export function KanbanBoard({
  filteredCards,
  onPersistCardMove,
  onPersistColumnMove,
  onCreateCard,
  onUpdateCard,
  onCreateColumn,
  onUpdateColumn,
  onCopyColumn,
}: KanbanBoardProps) {
  const board = useWorkspaceStore((s) => s.board);
  const setSelectedCardId = useWorkspaceStore((s) => s.setSelectedCardId);
  const areLabelsExpanded = useWorkspaceStore((s) => s.areLabelsExpanded);
  const toggleLabelsExpanded = useWorkspaceStore((s) => s.toggleLabelsExpanded);

  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);

  // "+ Add another list" Inline Composer state
  const [isAddingList, setIsAddingList] = useState(false);
  const [newListTitle, setNewListTitle] = useState("");
  const [newListColor, setNewListColor] = useState<string | null>("#3b82f6");

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

  const visibleColumns = useMemo(
    () =>
      board.columns
        .filter((col) => !col.is_archived)
        .sort((a, b) => comparePositions(a.position, b.position)),
    [board.columns]
  );

  const columnIds = useMemo(
    () => visibleColumns.map((col) => col.id),
    [visibleColumns]
  );

  const activeCard = useMemo(
    () => board.cards.find((c) => c.id === activeCardId) ?? null,
    [board.cards, activeCardId]
  );

  const activeColumn = useMemo(
    () => visibleColumns.find((col) => col.id === activeColumnId) ?? null,
    [visibleColumns, activeColumnId]
  );

  const handleDragStart = (event: DragStartEvent) => {
    const type = event.active.data.current?.type;
    if (type === "Column") {
      setActiveColumnId(String(event.active.id));
      setActiveCardId(null);
    } else {
      setActiveCardId(String(event.active.id));
      setActiveColumnId(null);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const draggedType = event.active.data.current?.type;
    setActiveCardId(null);
    setActiveColumnId(null);

    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // 1. Horizontal List (Column) Reordering
    if (draggedType === "Column") {
      if (activeId === overId) return;

      const overCard = board.cards.find((c) => c.id === overId);
      const targetColId = overCard ? overCard.column_id : overId;

      const oldIdx = visibleColumns.findIndex((c) => c.id === activeId);
      const newIdx = visibleColumns.findIndex((c) => c.id === targetColId);
      if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) return;

      const otherCols = visibleColumns.filter((c) => c.id !== activeId);
      const targetIdxInOthers = otherCols.findIndex(
        (c) => c.id === targetColId
      );

      let prevPos: string | undefined;
      let nextPos: string | undefined;

      if (oldIdx < newIdx) {
        // Moving right: place after targetCol
        prevPos = otherCols[targetIdxInOthers]?.position;
        nextPos = otherCols[targetIdxInOthers + 1]?.position;
      } else {
        // Moving left: place before targetCol
        prevPos = otherCols[targetIdxInOthers - 1]?.position;
        nextPos = otherCols[targetIdxInOthers]?.position;
      }

      const newPosition = generatePositionBetween(prevPos, nextPos);
      onPersistColumnMove(activeId, newPosition, prevPos, nextPos);
      return;
    }

    // 2. Vertical or Cross-List Card Reordering
    const draggedCard = board.cards.find((c) => c.id === activeId);
    if (!draggedCard) return;

    const overColumn = visibleColumns.find((col) => col.id === overId);
    const overCard = board.cards.find((c) => c.id === overId);

    const targetColumnId = overColumn
      ? overColumn.id
      : overCard
        ? overCard.column_id
        : draggedCard.column_id;

    const targetColCards = board.cards
      .filter(
        (c) =>
          c.column_id === targetColumnId &&
          c.id !== activeId &&
          !c.is_archived
      )
      .sort((a, b) => comparePositions(a.position, b.position));

    let prevPos: string | undefined;
    let nextPos: string | undefined;

    if (overColumn) {
      prevPos =
        targetColCards.length > 0
          ? targetColCards[targetColCards.length - 1].position
          : undefined;
      nextPos = undefined;
    } else if (overCard) {
      if (overCard.id === activeId) return;

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
        const originalColCards = board.cards
          .filter(
            (c) => c.column_id === draggedCard.column_id && !c.is_archived
          )
          .sort((a, b) => comparePositions(a.position, b.position));
        const oldIdx = originalColCards.findIndex((c) => c.id === activeId);
        const newIdx = originalColCards.findIndex((c) => c.id === overCard.id);

        const isMovingDownSameCol =
          draggedCard.column_id === targetColumnId &&
          oldIdx !== -1 &&
          newIdx !== -1 &&
          oldIdx < newIdx;

        if (isMovingDownSameCol) {
          prevPos = targetColCards[overIdxInTarget].position;
          nextPos = targetColCards[overIdxInTarget + 1]?.position;
        } else {
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

    onPersistCardMove(activeId, targetColumnId, newPosition, prevPos, nextPos);
  };

  const handleCreateNewList = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newListTitle.trim();
    if (!trimmed) return;

    const lastColPos =
      visibleColumns.length > 0
        ? visibleColumns[visibleColumns.length - 1].position
        : undefined;
    const position = generatePositionBetween(lastColPos, undefined);

    setNewListTitle("");
    setIsAddingList(false);

    await onCreateColumn({
      title: trimmed,
      position,
      wip_limit: null,
      color: newListColor,
    });
  };

  return (
    <DndContext
      id="kanbanify-kanban-dnd"
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex items-start gap-4 overflow-x-auto pb-8">
        <SortableContext
          items={columnIds}
          strategy={horizontalListSortingStrategy}
        >
          {visibleColumns.map((column) => {
            const colCards = filteredCards
              .filter((c) => c.column_id === column.id && !c.is_archived)
              .sort((a, b) => comparePositions(a.position, b.position));

            return (
              <SortableKanbanColumn
                key={column.id}
                column={column}
                cards={colCards}
                boardLabels={board.labels}
                boardMembers={board.members}
                areLabelsExpanded={areLabelsExpanded}
                onToggleLabelsExpanded={toggleLabelsExpanded}
                onSelectCard={(id) => setSelectedCardId(id)}
                onUpdateCard={onUpdateCard}
                onCreateCard={onCreateCard}
                onUpdateColumn={onUpdateColumn}
                onCopyColumn={onCopyColumn}
              />
            );
          })}
        </SortableContext>

        {/* "+ Add another list" Button at Far Right of Board Canvas */}
        <div className="w-[300px] shrink-0">
          {isAddingList ? (
            <form
              onSubmit={handleCreateNewList}
              className="rounded-2xl border border-zinc-200/90 bg-white/95 p-3 shadow-lg backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/95"
            >
              <input
                type="text"
                autoFocus
                value={newListTitle}
                onChange={(e) => setNewListTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setIsAddingList(false);
                    setNewListTitle("");
                  }
                }}
                placeholder="Enter list title..."
                className="w-full rounded-xl border border-indigo-500 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:outline-none dark:bg-zinc-950 dark:text-zinc-100"
              />

              <div className="mt-2.5 flex items-center gap-1.5">
                {LIST_COLOR_ACCENTS.map((acc) => (
                  <button
                    key={acc.name}
                    type="button"
                    onClick={() => setNewListColor(acc.value)}
                    title={`Accent: ${acc.name}`}
                    className={`h-4 w-4 rounded-full border ${
                      newListColor === acc.value
                        ? "scale-110 ring-2 ring-indigo-500"
                        : "border-zinc-300 dark:border-zinc-700"
                    }`}
                    style={{
                      backgroundColor: acc.value ?? "transparent",
                    }}
                  />
                ))}
              </div>

              <div className="mt-3 flex items-center gap-2">
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
                >
                  Add list
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingList(false);
                    setNewListTitle("");
                  }}
                  className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setIsAddingList(true)}
              className="flex w-full items-center gap-2 rounded-2xl border border-zinc-200/70 bg-white/75 px-4 py-3 text-left text-xs font-semibold text-zinc-700 shadow-2xs backdrop-blur-md transition-all hover:bg-white/95 dark:border-zinc-800/70 dark:bg-zinc-900/70 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              <Plus className="h-4 w-4 text-indigo-500" />
              <span>+ Add another list</span>
            </button>
          )}
        </div>
      </div>

      <DragOverlay>
        {activeCard ? (
          <div className="w-[310px] sm:w-[325px]">
            <KanbanCardContent
              card={activeCard}
              boardLabels={board.labels}
              boardMembers={board.members}
              areLabelsExpanded={areLabelsExpanded}
              onToggleLabelsExpanded={() => {}}
              onSelect={() => {}}
              onUpdateCard={async () => {}}
              isOverlay
            />
          </div>
        ) : activeColumn ? (
          <div className="w-[310px] rounded-2xl border border-indigo-500/60 bg-zinc-100/95 p-3 opacity-95 shadow-2xl sm:w-[325px] dark:bg-zinc-900/95">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                {activeColumn.title}
              </span>
              <span className="rounded-full bg-zinc-200 px-2 py-0.5 font-mono text-[10px] dark:bg-zinc-800">
                Moving List
              </span>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
