"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Activity as ActivityIcon,
  AlertOctagon,
  AlignLeft,
  Archive,
  ArchiveRestore,
  ArrowRight,
  Bold,
  Calendar,
  Check,
  CheckCircle2,
  CheckSquare,
  Circle,
  Code,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Heading2,
  Image as ImageIcon,
  Link2,
  List,
  MessageSquare,
  Palette,
  Paperclip,
  Plus,
  Send,
  Sparkles,
  Tag,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  Attachment,
  Card,
  Checklist,
  ChecklistItem,
  CopyCardRequest,
  CreateCommentRequest,
  Label,
  LabelColor,
  LabelColorEnum,
  Priority,
  UpdateBoardRequest,
  UpdateCardRequest,
} from "@kinetix/contracts";
import { PRIORITY_STYLES } from "./kanban-board";
import { useWorkspaceStore } from "@/store/workspace-store";
import {
  comparePositions,
  generatePositionBetween,
} from "@/lib/fractional-index";
import { createDeterministicUuid } from "@/lib/mock-data";
import { boardWsClient } from "@/lib/ws-client";
import {
  CARD_COVER_COLORS,
  getDueDateStatus,
  LABEL_COLOR_MAP,
  resolveCoverColor,
} from "@/lib/trello-theme";

interface CardDetailDrawerProps {
  onUpdateCard: (cardId: string, payload: UpdateCardRequest) => Promise<void>;
  onMoveCard: (
    cardId: string,
    targetColumnId: string,
    newPosition: string
  ) => Promise<void>;
  onCopyCard: (cardId: string, payload: CopyCardRequest) => Promise<void>;
  onDeleteCard: (cardId: string) => Promise<void>;
  onAddComment: (
    cardId: string,
    payload: CreateCommentRequest
  ) => Promise<void>;
  onDeleteComment: (cardId: string, commentId: string) => Promise<void>;
  onAiDecompose: (cardId: string) => Promise<void>;
  onUpdateBoard: (payload: UpdateBoardRequest) => Promise<void>;
}

type ActivePopover =
  | null
  | "members"
  | "labels"
  | "checklist"
  | "dates"
  | "cover"
  | "attachment"
  | "blockers"
  | "move"
  | "copy";

const STORY_POINT_OPTIONS = [1, 2, 3, 5, 8, 13, 21];
const ALL_LABEL_COLORS = LabelColorEnum.options;

function FormattedMarkdownPreview({ content }: { content: string }) {
  const lines = content.split("\n");
  return (
    <div className="space-y-1.5 text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={idx} className="h-1.5" />;
        }
        if (trimmed.startsWith("## ")) {
          return (
            <h4
              key={idx}
              className="pt-2 text-xs font-bold tracking-tight text-zinc-900 dark:text-zinc-100"
            >
              {trimmed.slice(3)}
            </h4>
          );
        }
        if (trimmed.startsWith("# ")) {
          return (
            <h3
              key={idx}
              className="pt-2 text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-100"
            >
              {trimmed.slice(2)}
            </h3>
          );
        }
        if (trimmed.startsWith("- ")) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
              <span>{trimmed.slice(2)}</span>
            </div>
          );
        }
        return <p key={idx}>{line}</p>;
      })}
    </div>
  );
}

export function CardDetailDrawer({
  onUpdateCard,
  onMoveCard,
  onCopyCard,
  onDeleteCard,
  onAddComment,
  onDeleteComment,
  onAiDecompose,
  onUpdateBoard,
}: CardDetailDrawerProps) {
  const board = useWorkspaceStore((s) => s.board);
  const selectedCardId = useWorkspaceStore((s) => s.selectedCardId);
  const setSelectedCardId = useWorkspaceStore((s) => s.setSelectedCardId);

  const card: Card | null =
    board.cards.find((c) => c.id === selectedCardId) ?? null;

  const presences = useWorkspaceStore((s) => s.presences);
  const editingCollaborator = useMemo(() => {
    if (!card) return null;
    return presences.find(
      (p) =>
        p.active_card_id === card.id &&
        p.status === "EDITING" &&
        p.user_id !== "88888888-8888-4888-8888-888888888881"
    );
  }, [presences, card?.id]);

  useEffect(() => {
    if (card?.id) {
      boardWsClient.sendClientPresence("START_TYPING", card.id);
      return () => {
        boardWsClient.sendClientPresence("STOP_TYPING", card.id);
      };
    }
  }, [card?.id]);

  const [activePopover, setActivePopover] = useState<ActivePopover>(null);
  const [isDecomposing, setIsDecomposing] = useState(false);

  // Title & Description editing states
  const [titleDraft, setTitleDraft] = useState("");
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState("");

  // Checklist states
  const [newChecklistTitle, setNewChecklistTitle] = useState("Checklist");
  const [addingItemChecklistId, setAddingItemChecklistId] = useState<
    string | null
  >(null);
  const [newItemTitle, setNewItemTitle] = useState("");
  const [hiddenCompletedChecklists, setHiddenCompletedChecklists] = useState<
    Record<string, boolean>
  >({});

  // Labels popover states
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState<LabelColor>("blue");

  // Attachment popover states
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [attachmentName, setAttachmentName] = useState("");

  // Cover custom image URL
  const [customCoverImageUrl, setCustomCoverImageUrl] = useState("");

  // Comments & Activity states
  const [commentInput, setCommentInput] = useState("");
  const [showActivityDetails, setShowActivityDetails] = useState(true);

  // Copy Card popover states
  const [copyTitle, setCopyTitle] = useState("");
  const [copyColumnId, setCopyColumnId] = useState("");
  const [keepChecklists, setKeepChecklists] = useState(true);
  const [keepLabels, setKeepLabels] = useState(true);
  const [keepMembers, setKeepMembers] = useState(true);
  const [keepAttachments, setKeepAttachments] = useState(true);

  // Move Card popover states
  const [moveTargetColId, setMoveTargetColId] = useState("");

  useEffect(() => {
    if (card) {
      setTitleDraft(card.title);
      setDescDraft(card.description);
      setIsEditingDesc(false);
      setActivePopover(null);
      setCopyTitle(`${card.title} (Copy)`);
      setCopyColumnId(card.column_id);
      setMoveTargetColId(card.column_id);
    }
  }, [card?.id]);

  useEffect(() => {
    if (card) {
      setTitleDraft(card.title);
      if (!isEditingDesc) {
        setDescDraft(card.description);
      }
    }
  }, [card?.title, card?.description, isEditingDesc]);

  useEffect(() => {
    if (!card) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (activePopover) {
          setActivePopover(null);
        } else {
          setSelectedCardId(null);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [card, activePopover, setSelectedCardId]);

  const cardActivities = useMemo(() => {
    if (!card) return [];
    return board.activities.filter((a) => a.card_id === card.id);
  }, [board.activities, card]);

  if (!card) return null;

  const currentColumn = board.columns.find((col) => col.id === card.column_id);
  const assignedMembers = board.members.filter((m) =>
    card.member_ids.includes(m.id)
  );
  const activeLabels = board.labels.filter((l) =>
    card.label_ids.includes(l.id)
  );
  const blockingCards = board.cards.filter((c) =>
    card.blocked_by_card_ids.includes(c.id)
  );
  const otherCards = board.cards.filter(
    (c) => c.id !== card.id && !c.is_archived
  );
  const dueStatus = getDueDateStatus(card.due_date, card.is_due_complete);
  const hasCover = card.cover && card.cover.type !== "none" && card.cover.value;

  const handleSaveTitle = async () => {
    const trimmed = titleDraft.trim();
    if (!trimmed || trimmed === card.title) {
      setTitleDraft(card.title);
      return;
    }
    await onUpdateCard(card.id, { title: trimmed });
  };

  const handleSaveDescription = async () => {
    setIsEditingDesc(false);
    await onUpdateCard(card.id, { description: descDraft });
  };

  const insertMarkdownSnippet = (snippet: string) => {
    setDescDraft((prev) =>
      prev ? `${prev}\n${snippet}` : snippet
    );
  };

  // Member toggle
  const handleToggleMember = async (memberId: string) => {
    const exists = card.member_ids.includes(memberId);
    const nextIds = exists
      ? card.member_ids.filter((id) => id !== memberId)
      : [...card.member_ids, memberId];
    await onUpdateCard(card.id, { member_ids: nextIds });
  };

  // Label toggle
  const handleToggleLabel = async (labelId: string) => {
    const exists = card.label_ids.includes(labelId);
    const nextIds = exists
      ? card.label_ids.filter((id) => id !== labelId)
      : [...card.label_ids, labelId];
    await onUpdateCard(card.id, { label_ids: nextIds });
  };

  const handleCreateNewBoardLabel = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newLabelName.trim();
    if (!trimmed) return;
    const created: Label = {
      id: createDeterministicUuid(),
      board_id: board.id,
      name: trimmed,
      color: newLabelColor,
    };
    setNewLabelName("");
    await onUpdateBoard({
      labels: [...board.labels, created],
    });
    await onUpdateCard(card.id, {
      label_ids: [...card.label_ids, created.id],
    });
  };

  // Checklists Management
  const handleAddChecklist = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newChecklistTitle.trim() || "Checklist";
    const sorted = [...card.checklists].sort((a, b) =>
      comparePositions(a.position, b.position)
    );
    const lastPos =
      sorted.length > 0 ? sorted[sorted.length - 1].position : undefined;
    const nextChecklist: Checklist = {
      id: createDeterministicUuid(),
      title,
      position: generatePositionBetween(lastPos, undefined),
      items: [],
    };
    setNewChecklistTitle("Checklist");
    setActivePopover(null);
    await onUpdateCard(card.id, {
      checklists: [...card.checklists, nextChecklist],
    });
    setAddingItemChecklistId(nextChecklist.id);
  };

  const handleDeleteChecklist = async (checklistId: string) => {
    const nextChecklists = card.checklists.filter(
      (cl) => cl.id !== checklistId
    );
    await onUpdateCard(card.id, { checklists: nextChecklists });
  };

  const handleToggleChecklistItem = async (
    checklistId: string,
    itemId: string
  ) => {
    const nextChecklists = card.checklists.map((cl) => {
      if (cl.id !== checklistId) return cl;
      return {
        ...cl,
        items: cl.items.map((item) =>
          item.id === itemId
            ? { ...item, is_completed: !item.is_completed }
            : item
        ),
      };
    });
    await onUpdateCard(card.id, { checklists: nextChecklists });
  };

  const handleAddChecklistItem = async (
    e: React.FormEvent,
    checklistId: string
  ) => {
    e.preventDefault();
    const trimmed = newItemTitle.trim();
    if (!trimmed) return;

    const targetCl = card.checklists.find((cl) => cl.id === checklistId);
    if (!targetCl) return;

    const sortedItems = [...targetCl.items].sort((a, b) =>
      comparePositions(a.position, b.position)
    );
    const lastPos =
      sortedItems.length > 0
        ? sortedItems[sortedItems.length - 1].position
        : undefined;

    const newItem: ChecklistItem = {
      id: createDeterministicUuid(),
      title: trimmed,
      is_completed: false,
      position: generatePositionBetween(lastPos, undefined),
      due_date: null,
      assignee_id: null,
    };

    setNewItemTitle("");
    const nextChecklists = card.checklists.map((cl) =>
      cl.id === checklistId ? { ...cl, items: [...cl.items, newItem] } : cl
    );
    await onUpdateCard(card.id, { checklists: nextChecklists });
  };

  const handleDeleteChecklistItem = async (
    checklistId: string,
    itemId: string
  ) => {
    const nextChecklists = card.checklists.map((cl) =>
      cl.id === checklistId
        ? { ...cl, items: cl.items.filter((i) => i.id !== itemId) }
        : cl
    );
    await onUpdateCard(card.id, { checklists: nextChecklists });
  };

  // Attachments Management
  const handleAddAttachment = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = attachmentUrl.trim();
    if (!url) return;
    const isImage = /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(url);
    const newAtt: Attachment = {
      id: createDeterministicUuid(),
      name: attachmentName.trim() || url.replace(/^https?:\/\//, "").slice(0, 48),
      url,
      type: isImage ? "image" : "link",
      created_at: new Date().toISOString(),
    };
    setAttachmentUrl("");
    setAttachmentName("");
    setActivePopover(null);
    await onUpdateCard(card.id, {
      attachments: [...card.attachments, newAtt],
    });
  };

  const handleRemoveAttachment = async (attId: string) => {
    await onUpdateCard(card.id, {
      attachments: card.attachments.filter((a) => a.id !== attId),
    });
  };

  // Comments Management
  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = commentInput.trim();
    if (!trimmed) return;
    setCommentInput("");
    const currentMember = board.members[0];
    await onAddComment(card.id, {
      author_id: currentMember?.id ?? "88888888-8888-4888-8888-888888888881",
      author_name: currentMember?.name ?? "Alex Rivera",
      author_initials: currentMember?.initials ?? "AR",
      content: trimmed,
    });
  };

  // Blocker Toggle
  const handleToggleBlocker = async (blockerCardId: string) => {
    const exists = card.blocked_by_card_ids.includes(blockerCardId);
    const nextIds = exists
      ? card.blocked_by_card_ids.filter((id) => id !== blockerCardId)
      : [...card.blocked_by_card_ids, blockerCardId];
    await onUpdateCard(card.id, { blocked_by_card_ids: nextIds });
  };

  // AI Smart Enrich / Decompose
  const handleTriggerAiDecompose = async () => {
    if (isDecomposing) return;
    setIsDecomposing(true);
    try {
      await onAiDecompose(card.id);
    } finally {
      setIsDecomposing(false);
    }
  };

  // Move Card Action
  const handleMoveCardToColumn = async (targetColId: string) => {
    setMoveTargetColId(targetColId);
    if (targetColId === card.column_id) return;
    const colCards = board.cards
      .filter((c) => c.column_id === targetColId && !c.is_archived)
      .sort((a, b) => comparePositions(a.position, b.position));
    const lastPos =
      colCards.length > 0 ? colCards[colCards.length - 1].position : undefined;
    const nextPos = generatePositionBetween(lastPos, undefined);
    setActivePopover(null);
    await onMoveCard(card.id, targetColId, nextPos);
  };

  // Copy Card Action
  const handleConfirmCopyCard = async (e: React.FormEvent) => {
    e.preventDefault();
    setActivePopover(null);
    await onCopyCard(card.id, {
      title: copyTitle.trim() || `${card.title} (Copy)`,
      target_column_id: copyColumnId || card.column_id,
      keep_checklists: keepChecklists,
      keep_labels: keepLabels,
      keep_members: keepMembers,
      keep_attachments: keepAttachments,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-zinc-950/60 px-3 py-8 backdrop-blur-xs sm:px-6 sm:py-12">
      {/* Backdrop click receiver */}
      <div
        onClick={() => setSelectedCardId(null)}
        className="fixed inset-0 -z-10"
      />

      {/* Centered 2-Column Trello Card Modal */}
      <div className="relative w-full max-w-4xl overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
        {/* Archived Banner (if card is archived) */}
        {card.is_archived && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/30 bg-amber-500/15 px-6 py-3 text-xs font-medium text-amber-900 dark:text-amber-200">
            <div className="flex items-center gap-2">
              <Archive className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span>This card is archived.</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onUpdateCard(card.id, { is_archived: false })}
                className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-zinc-800 shadow-2xs hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-100"
              >
                <ArchiveRestore className="h-3.5 w-3.5 text-emerald-500" />
                Restore to Board
              </button>
              <button
                type="button"
                onClick={() => onDeleteCard(card.id)}
                className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete Permanently
              </button>
            </div>
          </div>
        )}

        {/* Top Modal Cover Banner */}
        {hasCover && (
          <div
            className="relative flex h-28 w-full items-end justify-end p-3 transition-colors"
            style={
              card.cover.type === "color"
                ? { backgroundColor: resolveCoverColor(card.cover.value) }
                : {
                    backgroundImage: `url(${card.cover.value})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }
            }
          >
            <button
              type="button"
              onClick={() =>
                setActivePopover(activePopover === "cover" ? null : "cover")
              }
              className="inline-flex items-center gap-1.5 rounded-lg bg-black/45 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-xs transition-colors hover:bg-black/65"
            >
              <Palette className="h-3.5 w-3.5" />
              Cover
            </button>

            <button
              type="button"
              onClick={() => setSelectedCardId(null)}
              className="absolute top-3 right-3 rounded-full bg-black/45 p-1.5 text-white backdrop-blur-xs transition-colors hover:bg-black/65"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Top Modal Title & Subtitle Header */}
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200/80 px-6 pt-5 pb-4 dark:border-zinc-800/80">
          <div className="min-w-0 flex-1">
            <input
              type="text"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveTitle();
              }}
              className="w-full rounded-lg bg-transparent px-1.5 py-0.5 -mx-1.5 text-lg font-bold tracking-tight text-zinc-900 focus:bg-zinc-100 focus:outline-none sm:text-xl dark:text-zinc-100 dark:focus:bg-zinc-900"
            />

            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              <span>in list</span>
              <select
                value={card.column_id}
                onChange={(e) => handleMoveCardToColumn(e.target.value)}
                className="rounded-md border border-zinc-200/80 bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-200/70 focus:outline-none dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
              >
                {board.columns
                  .filter((col) => !col.is_archived)
                  .map((col) => (
                    <option key={col.id} value={col.id}>
                      {col.title}
                    </option>
                  ))}
              </select>

              {card.is_watching && (
                <span className="inline-flex items-center gap-1 rounded-md bg-indigo-500/10 px-2 py-0.5 text-[11px] font-medium text-indigo-600 dark:text-indigo-300">
                  <Eye className="h-3 w-3" />
                  Watching
                </span>
              )}

              <span className="font-mono text-[11px] text-zinc-400">
                pos: {card.position}
              </span>
            </div>
          </div>

          {!hasCover && (
            <button
              type="button"
              onClick={() => setSelectedCardId(null)}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* 2-Column Trello Modal Body */}
        <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-12">
          {/* LEFT MAIN COLUMN (8 cols) */}
          <div className="space-y-6 md:col-span-8">
            {/* Blocker Alert Banner */}
            {blockingCards.length > 0 && (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3.5 text-xs text-red-800 dark:bg-red-500/15 dark:text-red-200">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertOctagon className="h-4 w-4 shrink-0 text-red-500" />
                  <span>
                    Blocked by {blockingCards.length} upstream card(s)
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {blockingCards.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setSelectedCardId(b.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 bg-white/80 px-2 py-1 text-[11px] font-medium text-red-700 hover:underline dark:bg-zinc-900/80 dark:text-red-300"
                    >
                      <span>{b.title}</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Metadata Row: Assigned Members, Active Labels, Due Date, Priority & Story Points */}
            <div className="flex flex-wrap items-start gap-5">
              {/* Members */}
              <div>
                <span className="mb-1.5 block text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">
                  Members
                </span>
                <div className="flex items-center gap-1.5">
                  {assignedMembers.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleToggleMember(m.id)}
                      title={`${m.name} (Click to remove)`}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white shadow-xs transition-transform hover:scale-105"
                      style={{ backgroundColor: m.color }}
                    >
                      {m.initials}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setActivePopover(
                        activePopover === "members" ? null : "members"
                      )
                    }
                    title="Assign member"
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-zinc-300 bg-zinc-50 text-zinc-500 hover:border-indigo-500 hover:text-indigo-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Labels */}
              <div>
                <span className="mb-1.5 block text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">
                  Labels
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {activeLabels.map((lbl) => {
                    const style = LABEL_COLOR_MAP[lbl.color];
                    return (
                      <button
                        key={lbl.id}
                        type="button"
                        onClick={() =>
                          setActivePopover(
                            activePopover === "labels" ? null : "labels"
                          )
                        }
                        className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold ${style.pillBg} ${style.pillText}`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${style.dot}`}
                        />
                        <span>{lbl.name || style.name}</span>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() =>
                      setActivePopover(
                        activePopover === "labels" ? null : "labels"
                      )
                    }
                    title="Add label"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50 text-zinc-500 hover:border-indigo-500 hover:text-indigo-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Due Date with Completion Checkbox */}
              {card.due_date && (
                <div>
                  <span className="mb-1.5 block text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">
                    Due Date
                  </span>
                  <div className="flex items-center gap-2 rounded-lg border border-zinc-200/80 bg-zinc-50 px-2.5 py-1.5 dark:border-zinc-800 dark:bg-zinc-900">
                    <input
                      type="checkbox"
                      checked={card.is_due_complete}
                      onChange={(e) =>
                        onUpdateCard(card.id, {
                          is_due_complete: e.target.checked,
                        })
                      }
                      className="h-4 w-4 cursor-pointer rounded accent-emerald-600"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setActivePopover(
                          activePopover === "dates" ? null : "dates"
                        )
                      }
                      className="flex items-center gap-1.5 text-xs font-medium text-zinc-800 dark:text-zinc-200"
                    >
                      <span>
                        {card.start_date
                          ? `${new Date(card.start_date).toLocaleDateString(
                              "en-US",
                              { month: "short", day: "numeric" }
                            )} – `
                          : ""}
                        {new Date(card.due_date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      {dueStatus === "complete" && (
                        <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                          Complete
                        </span>
                      )}
                      {dueStatus === "overdue" && (
                        <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 dark:text-rose-300">
                          Overdue
                        </span>
                      )}
                      {dueStatus === "due-soon" && (
                        <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300">
                          Due soon
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Priority & Story Points Selectors */}
              <div>
                <span className="mb-1.5 block text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">
                  Priority & Points
                </span>
                <div className="flex items-center gap-1.5">
                  <select
                    value={card.priority}
                    onChange={(e) =>
                      onUpdateCard(card.id, {
                        priority: e.target.value as Priority,
                      })
                    }
                    className="h-8 rounded-lg border border-zinc-200/80 bg-zinc-50 px-2 text-xs font-medium text-zinc-800 focus:border-indigo-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                  >
                    {(Object.keys(PRIORITY_STYLES) as Priority[]).map((p) => (
                      <option key={p} value={p}>
                        {PRIORITY_STYLES[p].label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={card.story_points ?? ""}
                    onChange={(e) =>
                      onUpdateCard(card.id, {
                        story_points:
                          e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                    className="h-8 rounded-lg border border-zinc-200/80 bg-zinc-50 px-2 font-mono text-xs font-medium text-zinc-800 focus:border-indigo-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                  >
                    <option value="">— pts</option>
                    {STORY_POINT_OPTIONS.map((pts) => (
                      <option key={pts} value={pts}>
                        {pts} pts
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Live Typing & Conflict Prevention Banner */}
            {editingCollaborator && (
              <div className="mb-4 flex items-center justify-between rounded-xl border border-violet-500/40 bg-gradient-to-r from-violet-500/15 via-indigo-500/10 to-violet-500/15 p-3 shadow-xs backdrop-blur-xs">
                <div className="flex items-center gap-2.5">
                  <div
                    className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-xs"
                    style={{ backgroundColor: editingCollaborator.color }}
                  >
                    {editingCollaborator.initials}
                  </div>
                  <div className="text-xs font-semibold text-violet-900 dark:text-violet-200">
                    ⚡ <span className="font-bold">{editingCollaborator.user_name}</span> is currently typing on this card
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-600 dark:bg-violet-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-600 dark:bg-violet-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-600 dark:bg-violet-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}

            {/* Markdown Description Editor */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="flex items-center gap-2 text-xs font-bold tracking-wider text-zinc-800 uppercase dark:text-zinc-200">
                  <AlignLeft className="h-4 w-4 text-zinc-400" />
                  Description
                </h4>
                {!isEditingDesc && (
                  <button
                    type="button"
                    onClick={() => setIsEditingDesc(true)}
                    className="rounded-lg border border-zinc-200/80 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Edit
                  </button>
                )}
              </div>

              {isEditingDesc ? (
                <div className="rounded-xl border border-indigo-500 bg-zinc-50/80 p-3 dark:bg-zinc-900/90">
                  {/* Formatting Toolbar Helper */}
                  <div className="mb-2 flex flex-wrap items-center gap-1 border-b border-zinc-200/80 pb-2 dark:border-zinc-800">
                    <button
                      type="button"
                      onClick={() => insertMarkdownSnippet("## Section Heading")}
                      title="Insert Heading"
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-200/70 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      <Heading2 className="h-3.5 w-3.5" />
                      Heading
                    </button>
                    <button
                      type="button"
                      onClick={() => insertMarkdownSnippet("**Bold Text**")}
                      title="Insert Bold"
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-200/70 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      <Bold className="h-3.5 w-3.5" />
                      Bold
                    </button>
                    <button
                      type="button"
                      onClick={() => insertMarkdownSnippet("- Bullet item")}
                      title="Insert Bullet List"
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-200/70 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      <List className="h-3.5 w-3.5" />
                      Bullet
                    </button>
                    <button
                      type="button"
                      onClick={() => insertMarkdownSnippet("`code_snippet`")}
                      title="Insert Code"
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-200/70 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      <Code className="h-3.5 w-3.5" />
                      Code
                    </button>
                  </div>

                  <textarea
                    rows={5}
                    autoFocus
                    value={descDraft}
                    onChange={(e) => setDescDraft(e.target.value)}
                    onFocus={() =>
                      boardWsClient.sendClientPresence("START_TYPING", card.id)
                    }
                    onBlur={() =>
                      boardWsClient.sendClientPresence("STOP_TYPING", card.id)
                    }
                    placeholder="Add a more detailed description, technical spec, or Markdown notes..."
                    className="w-full resize-y bg-transparent text-xs leading-relaxed text-zinc-900 focus:outline-none dark:text-zinc-100"
                  />

                  <div className="mt-2.5 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSaveDescription}
                      className="rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDescDraft(card.description);
                        setIsEditingDesc(false);
                      }}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-200/60 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => setIsEditingDesc(true)}
                  className="min-h-[68px] cursor-pointer rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-3.5 transition-colors hover:bg-zinc-100/70 dark:border-zinc-800/80 dark:bg-zinc-900/50 dark:hover:bg-zinc-900"
                >
                  {card.description ? (
                    <FormattedMarkdownPreview content={card.description} />
                  ) : (
                    <p className="text-xs text-zinc-400">
                      Add a more detailed description...
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Multiple Named Checklists */}
            {card.checklists.map((cl) => {
              const total = cl.items.length;
              const completed = cl.items.filter((i) => i.is_completed).length;
              const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
              const hideCompleted = !!hiddenCompletedChecklists[cl.id];
              const visibleItems = hideCompleted
                ? cl.items.filter((i) => !i.is_completed)
                : cl.items;

              return (
                <div
                  key={cl.id}
                  className="rounded-xl border border-zinc-200/80 bg-zinc-50/40 p-4 dark:border-zinc-800/80 dark:bg-zinc-900/40"
                >
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CheckSquare className="h-4 w-4 text-indigo-500" />
                      <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                        {cl.title}
                      </h4>
                    </div>

                    <div className="flex items-center gap-2">
                      {completed > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            setHiddenCompletedChecklists((prev) => ({
                              ...prev,
                              [cl.id]: !prev[cl.id],
                            }))
                          }
                          className="rounded-lg border border-zinc-200/80 bg-white px-2 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300"
                        >
                          {hideCompleted
                            ? `Show checked items (${completed})`
                            : "Hide completed items"}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteChecklist(cl.id)}
                        className="rounded-lg border border-zinc-200/80 bg-white px-2 py-1 text-[11px] font-medium text-zinc-600 hover:bg-rose-500/10 hover:text-rose-600 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Checklist Progress Bar */}
                  <div className="mb-3 flex items-center gap-2.5">
                    <span className="w-8 font-mono text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                      {pct}%
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          pct === 100 ? "bg-emerald-500" : "bg-indigo-500"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Checklist Items */}
                  <div className="space-y-1.5">
                    {visibleItems.map((item) => {
                      const assignee = board.members.find(
                        (m) => m.id === item.assignee_id
                      );
                      return (
                        <div
                          key={item.id}
                          className="group flex items-center justify-between gap-2 rounded-lg border border-zinc-200/60 bg-white px-3 py-2 text-xs transition-colors hover:border-zinc-300 dark:border-zinc-800/70 dark:bg-zinc-900"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              handleToggleChecklistItem(cl.id, item.id)
                            }
                            className="flex flex-1 items-center gap-2.5 text-left"
                          >
                            {item.is_completed ? (
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                            ) : (
                              <Circle className="h-4 w-4 shrink-0 text-zinc-400" />
                            )}
                            <span
                              className={
                                item.is_completed
                                  ? "line-through text-zinc-400 dark:text-zinc-500"
                                  : "text-zinc-800 dark:text-zinc-200"
                              }
                            >
                              {item.title}
                            </span>
                          </button>

                          <div className="flex items-center gap-1.5">
                            {assignee && (
                              <span
                                title={assignee.name}
                                className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white"
                                style={{ backgroundColor: assignee.color }}
                              >
                                {assignee.initials}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                handleDeleteChecklistItem(cl.id, item.id)
                              }
                              className="rounded p-1 text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-rose-500/10 hover:text-rose-500"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Add Item Inline */}
                  {addingItemChecklistId === cl.id ? (
                    <form
                      onSubmit={(e) => handleAddChecklistItem(e, cl.id)}
                      className="mt-2.5 space-y-2"
                    >
                      <input
                        type="text"
                        autoFocus
                        value={newItemTitle}
                        onChange={(e) => setNewItemTitle(e.target.value)}
                        placeholder="Add an item..."
                        className="w-full rounded-lg border border-indigo-500 bg-white px-3 py-1.5 text-xs text-zinc-900 focus:outline-none dark:bg-zinc-900 dark:text-zinc-100"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="submit"
                          className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-500"
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAddingItemChecklistId(null);
                            setNewItemTitle("");
                          }}
                          className="rounded-lg px-2.5 py-1 text-xs text-zinc-500 hover:bg-zinc-200/60 dark:hover:bg-zinc-800"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setAddingItemChecklistId(cl.id);
                        setNewItemTitle("");
                      }}
                      className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-zinc-200/80 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add an item
                    </button>
                  )}
                </div>
              );
            })}

            {/* Attachments Section */}
            {card.attachments.length > 0 && (
              <div>
                <h4 className="mb-2.5 flex items-center gap-2 text-xs font-bold tracking-wider text-zinc-800 uppercase dark:text-zinc-200">
                  <Paperclip className="h-4 w-4 text-zinc-400" />
                  Attachments ({card.attachments.length})
                </h4>
                <div className="space-y-2">
                  {card.attachments.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-2.5 dark:border-zinc-800 dark:bg-zinc-900/50"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        {att.type === "image" ? (
                          <div
                            className="h-12 w-16 shrink-0 rounded-lg border border-zinc-200 bg-cover bg-center dark:border-zinc-700"
                            style={{ backgroundImage: `url(${att.url})` }}
                          />
                        ) : (
                          <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                            <Link2 className="h-5 w-5" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <a
                            href={att.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 truncate text-xs font-semibold text-zinc-900 hover:text-indigo-600 dark:text-zinc-100 dark:hover:text-indigo-400"
                          >
                            <span className="truncate">{att.name}</span>
                            <ExternalLink className="h-3 w-3 shrink-0" />
                          </a>
                          <p className="truncate font-mono text-[10px] text-zinc-400">
                            {att.url}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(att.id)}
                        className="rounded-lg p-1.5 text-zinc-400 hover:bg-rose-500/10 hover:text-rose-500"
                        title="Remove attachment"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Activity & Comments Feed */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h4 className="flex items-center gap-2 text-xs font-bold tracking-wider text-zinc-800 uppercase dark:text-zinc-200">
                  <MessageSquare className="h-4 w-4 text-zinc-400" />
                  Activity & Comments
                </h4>
                <button
                  type="button"
                  onClick={() => setShowActivityDetails(!showActivityDetails)}
                  className="rounded-lg border border-zinc-200/80 bg-zinc-50 px-2.5 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                >
                  {showActivityDetails ? "Hide Details" : "Show Details"}
                </button>
              </div>

              {/* Write Comment Form */}
              <form onSubmit={handleSubmitComment} className="mb-4 flex gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                  AR
                </span>
                <div className="flex-1 rounded-xl border border-zinc-200/80 bg-zinc-50 p-2.5 focus-within:border-indigo-500 focus-within:bg-white dark:border-zinc-800 dark:bg-zinc-900 dark:focus-within:bg-zinc-950">
                  <textarea
                    rows={2}
                    value={commentInput}
                    onChange={(e) => setCommentInput(e.target.value)}
                    onFocus={() =>
                      boardWsClient.sendClientPresence("START_TYPING", card.id)
                    }
                    onBlur={() =>
                      boardWsClient.sendClientPresence("STOP_TYPING", card.id)
                    }
                    placeholder="Write a comment..."
                    className="w-full resize-none bg-transparent text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-100"
                  />
                  <div className="mt-1.5 flex justify-end">
                    <button
                      type="submit"
                      disabled={!commentInput.trim()}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-40"
                    >
                      <Send className="h-3 w-3" />
                      Comment
                    </button>
                  </div>
                </div>
              </form>

              {/* Comments List */}
              <div className="space-y-3">
                {card.comments.map((cm) => (
                  <div key={cm.id} className="flex items-start gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">
                      {cm.author_initials}
                    </span>
                    <div className="flex-1 rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/70">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                            {cm.author_name}
                          </span>
                          <span className="font-mono text-[10px] text-zinc-400">
                            {new Date(cm.created_at).toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => onDeleteComment(card.id, cm.id)}
                          title="Delete comment"
                          className="text-zinc-400 hover:text-rose-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
                        {cm.content}
                      </p>
                    </div>
                  </div>
                ))}

                {/* Chronological Activity History */}
                {showActivityDetails &&
                  cardActivities.map((act) => (
                    <div
                      key={act.id}
                      className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs text-zinc-500 dark:text-zinc-400"
                    >
                      <div className="flex items-center gap-2">
                        {act.is_automated ||
                        act.action_type === "AUTOMATION_TRIGGERED" ? (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-400/20 dark:text-amber-300">
                            🤖 Butler
                          </span>
                        ) : (
                          <ActivityIcon className="h-3.5 w-3.5 text-zinc-400" />
                        )}
                        <span>
                          <strong className="text-zinc-700 dark:text-zinc-300">
                            {act.actor_name}
                          </strong>{" "}
                          {act.description}
                        </span>
                      </div>
                      <span className="shrink-0 font-mono text-[10px] text-zinc-400">
                        {new Date(act.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* RIGHT ACTION SIDEBAR ("Add to card" & "Actions") (4 cols) */}
          <div className="space-y-5 md:col-span-4">
            {/* ✨ AI Smart Enrich / Decompose Button */}
            <div className="rounded-xl border border-indigo-500/35 bg-gradient-to-br from-indigo-500/15 via-violet-500/10 to-transparent p-3.5">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-zinc-900 dark:text-zinc-100">
                <Sparkles className="h-4 w-4 text-indigo-500" />
                <span>Kanbanify AI Smart Enrich</span>
              </div>
              <p className="mb-3 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                Auto-generate structured spec, suggested color labels, and
                categorized checklists.
              </p>
              <button
                type="button"
                disabled={isDecomposing}
                onClick={handleTriggerAiDecompose}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:from-indigo-500 hover:to-violet-500 disabled:opacity-60"
              >
                <Sparkles
                  className={`h-3.5 w-3.5 ${
                    isDecomposing ? "animate-spin" : ""
                  }`}
                />
                <span>
                  {isDecomposing
                    ? "Enriching Card..."
                    : "✨ AI Smart Enrich"}
                </span>
              </button>
            </div>

            {/* "Add to card" Buttons */}
            <div>
              <h5 className="mb-2 text-[10px] font-bold tracking-wider text-zinc-400 uppercase">
                Add to card
              </h5>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-1">
                <button
                  type="button"
                  onClick={() =>
                    setActivePopover(
                      activePopover === "members" ? null : "members"
                    )
                  }
                  className="flex items-center gap-2 rounded-xl border border-zinc-200/80 bg-zinc-50/80 px-3 py-2 text-left text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  <Users className="h-3.5 w-3.5 text-indigo-500" />
                  <span>Members</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setActivePopover(
                      activePopover === "labels" ? null : "labels"
                    )
                  }
                  className="flex items-center gap-2 rounded-xl border border-zinc-200/80 bg-zinc-50/80 px-3 py-2 text-left text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  <Tag className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Labels</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setActivePopover(
                      activePopover === "checklist" ? null : "checklist"
                    )
                  }
                  className="flex items-center gap-2 rounded-xl border border-zinc-200/80 bg-zinc-50/80 px-3 py-2 text-left text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  <CheckSquare className="h-3.5 w-3.5 text-sky-500" />
                  <span>Checklist</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setActivePopover(
                      activePopover === "dates" ? null : "dates"
                    )
                  }
                  className="flex items-center gap-2 rounded-xl border border-zinc-200/80 bg-zinc-50/80 px-3 py-2 text-left text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  <Calendar className="h-3.5 w-3.5 text-amber-500" />
                  <span>Dates</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setActivePopover(
                      activePopover === "attachment" ? null : "attachment"
                    )
                  }
                  className="flex items-center gap-2 rounded-xl border border-zinc-200/80 bg-zinc-50/80 px-3 py-2 text-left text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  <Paperclip className="h-3.5 w-3.5 text-violet-500" />
                  <span>Attachment</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setActivePopover(
                      activePopover === "cover" ? null : "cover"
                    )
                  }
                  className="flex items-center gap-2 rounded-xl border border-zinc-200/80 bg-zinc-50/80 px-3 py-2 text-left text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  <Palette className="h-3.5 w-3.5 text-pink-500" />
                  <span>Cover</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setActivePopover(
                      activePopover === "blockers" ? null : "blockers"
                    )
                  }
                  className="flex items-center gap-2 rounded-xl border border-zinc-200/80 bg-zinc-50/80 px-3 py-2 text-left text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  <AlertOctagon className="h-3.5 w-3.5 text-rose-500" />
                  <span>Blockers ({card.blocked_by_card_ids.length})</span>
                </button>
              </div>
            </div>

            {/* Active Popover Panel inside Sidebar */}
            {activePopover && (
              <div className="rounded-2xl border border-indigo-500/40 bg-zinc-50 p-3.5 shadow-lg dark:bg-zinc-900">
                <div className="mb-2.5 flex items-center justify-between border-b border-zinc-200/80 pb-2 dark:border-zinc-800">
                  <span className="text-xs font-bold capitalize text-zinc-900 dark:text-zinc-100">
                    {activePopover}
                  </span>
                  <button
                    type="button"
                    onClick={() => setActivePopover(null)}
                    className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Members Popover */}
                {activePopover === "members" && (
                  <div className="space-y-1.5">
                    {board.members.map((m) => {
                      const active = card.member_ids.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => handleToggleMember(m.id)}
                          className="flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-left text-xs hover:bg-zinc-200/60 dark:hover:bg-zinc-800"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
                              style={{ backgroundColor: m.color }}
                            >
                              {m.initials}
                            </span>
                            <span className="font-medium text-zinc-800 dark:text-zinc-200">
                              {m.name}
                            </span>
                          </div>
                          {active && (
                            <Check className="h-4 w-4 text-indigo-500" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Labels Popover */}
                {activePopover === "labels" && (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      {board.labels.map((lbl) => {
                        const style = LABEL_COLOR_MAP[lbl.color];
                        const active = card.label_ids.includes(lbl.id);
                        return (
                          <button
                            key={lbl.id}
                            type="button"
                            onClick={() => handleToggleLabel(lbl.id)}
                            className="flex w-full items-center justify-between gap-2 rounded-lg p-1 hover:bg-zinc-200/50 dark:hover:bg-zinc-800"
                          >
                            <span
                              className={`flex-1 rounded-md border px-2.5 py-1 text-left text-xs font-semibold ${style.pillBg} ${style.pillText}`}
                            >
                              {lbl.name || style.name}
                            </span>
                            {active && (
                              <Check className="h-4 w-4 shrink-0 text-indigo-500" />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    <form
                      onSubmit={handleCreateNewBoardLabel}
                      className="space-y-2 border-t border-zinc-200/80 pt-2.5 dark:border-zinc-800"
                    >
                      <input
                        type="text"
                        value={newLabelName}
                        onChange={(e) => setNewLabelName(e.target.value)}
                        placeholder="New label name..."
                        className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                      />
                      <div className="flex flex-wrap gap-1">
                        {ALL_LABEL_COLORS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setNewLabelColor(c)}
                            className={`h-5 w-6 rounded ${
                              newLabelColor === c
                                ? "ring-2 ring-indigo-500"
                                : ""
                            }`}
                            style={{
                              backgroundColor: LABEL_COLOR_MAP[c].swatch,
                            }}
                          />
                        ))}
                      </div>
                      <button
                        type="submit"
                        className="w-full rounded-lg bg-zinc-900 py-1.5 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-950"
                      >
                        Create Label
                      </button>
                    </form>
                  </div>
                )}

                {/* Checklist Popover */}
                {activePopover === "checklist" && (
                  <form onSubmit={handleAddChecklist} className="space-y-2.5">
                    <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                      Checklist Title
                    </label>
                    <input
                      type="text"
                      autoFocus
                      value={newChecklistTitle}
                      onChange={(e) => setNewChecklistTitle(e.target.value)}
                      placeholder="e.g., Frontend Tasks, QA Verification"
                      className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                    />
                    <button
                      type="submit"
                      className="w-full rounded-lg bg-indigo-600 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
                    >
                      Add Checklist
                    </button>
                  </form>
                )}

                {/* Dates Popover */}
                {activePopover === "dates" && (
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={
                          card.start_date
                            ? new Date(card.start_date)
                                .toISOString()
                                .split("T")[0]
                            : ""
                        }
                        onChange={(e) =>
                          onUpdateCard(card.id, {
                            start_date: e.target.value
                              ? new Date(e.target.value).toISOString()
                              : null,
                          })
                        }
                        className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 font-mono text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                        Due Date
                      </label>
                      <input
                        type="date"
                        value={
                          card.due_date
                            ? new Date(card.due_date)
                                .toISOString()
                                .split("T")[0]
                            : ""
                        }
                        onChange={(e) =>
                          onUpdateCard(card.id, {
                            due_date: e.target.value
                              ? new Date(e.target.value).toISOString()
                              : null,
                          })
                        }
                        className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 font-mono text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateCard(card.id, {
                          start_date: null,
                          due_date: null,
                          is_due_complete: false,
                        })
                      }
                      className="w-full rounded-lg border border-zinc-200 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300"
                    >
                      Remove Dates
                    </button>
                  </div>
                )}

                {/* Attachment Popover */}
                {activePopover === "attachment" && (
                  <form onSubmit={handleAddAttachment} className="space-y-2.5">
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                        Link or Image URL
                      </label>
                      <input
                        type="url"
                        required
                        autoFocus
                        value={attachmentUrl}
                        onChange={(e) => setAttachmentUrl(e.target.value)}
                        placeholder="https://..."
                        className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                        Display Name (optional)
                      </label>
                      <input
                        type="text"
                        value={attachmentName}
                        onChange={(e) => setAttachmentName(e.target.value)}
                        placeholder="Architecture Spec..."
                        className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full rounded-lg bg-indigo-600 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
                    >
                      Attach
                    </button>
                  </form>
                )}

                {/* Cover Popover */}
                {activePopover === "cover" && (
                  <div className="space-y-3">
                    <div>
                      <span className="mb-1.5 block text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                        Cover Size
                      </span>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateCard(card.id, {
                              cover: {
                                type:
                                  card.cover.type === "none"
                                    ? "color"
                                    : card.cover.type,
                                value: card.cover.value ?? "#3b82f6",
                                size: "normal",
                              },
                            })
                          }
                          className={`rounded-lg border py-1.5 text-xs font-medium ${
                            card.cover.size === "normal"
                              ? "border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300"
                              : "border-zinc-200 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
                          }`}
                        >
                          Top Strip
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateCard(card.id, {
                              cover: {
                                type:
                                  card.cover.type === "none"
                                    ? "color"
                                    : card.cover.type,
                                value: card.cover.value ?? "#3b82f6",
                                size: "full",
                              },
                            })
                          }
                          className={`rounded-lg border py-1.5 text-xs font-medium ${
                            card.cover.size === "full"
                              ? "border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300"
                              : "border-zinc-200 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
                          }`}
                        >
                          Full Card
                        </button>
                      </div>
                    </div>

                    <div>
                      <span className="mb-1.5 block text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                        Colors
                      </span>
                      <div className="grid grid-cols-5 gap-1.5">
                        {CARD_COVER_COLORS.map((c) => (
                          <button
                            key={c.value}
                            type="button"
                            onClick={() =>
                              onUpdateCard(card.id, {
                                cover: {
                                  type: "color",
                                  value: c.value,
                                  size: card.cover.size,
                                },
                              })
                            }
                            className={`h-7 rounded-md transition-transform ${
                              card.cover.type === "color" &&
                              resolveCoverColor(card.cover.value) === c.value
                                ? "scale-105 ring-2 ring-indigo-500"
                                : ""
                            }`}
                            style={{ backgroundColor: c.value }}
                            title={c.name}
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="mb-1 block text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                        Custom Cover Image URL
                      </span>
                      <div className="flex gap-1.5">
                        <input
                          type="url"
                          value={customCoverImageUrl}
                          onChange={(e) =>
                            setCustomCoverImageUrl(e.target.value)
                          }
                          placeholder="https://images.unsplash.com/..."
                          className="flex-1 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-950"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!customCoverImageUrl.trim()) return;
                            onUpdateCard(card.id, {
                              cover: {
                                type: "image",
                                value: customCoverImageUrl.trim(),
                                size: card.cover.size,
                              },
                            });
                            setCustomCoverImageUrl("");
                          }}
                          className="rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white"
                        >
                          <ImageIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {hasCover && (
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateCard(card.id, {
                            cover: {
                              type: "none",
                              value: null,
                              size: "normal",
                            },
                          })
                        }
                        className="w-full rounded-lg border border-zinc-200 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300"
                      >
                        Remove Cover
                      </button>
                    )}
                  </div>
                )}

                {/* Blockers Popover */}
                {activePopover === "blockers" && (
                  <div className="max-h-48 space-y-1 overflow-y-auto">
                    {otherCards.map((other) => {
                      const isBlocking = card.blocked_by_card_ids.includes(
                        other.id
                      );
                      return (
                        <button
                          key={other.id}
                          type="button"
                          onClick={() => handleToggleBlocker(other.id)}
                          className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs ${
                            isBlocking
                              ? "bg-rose-500/15 font-semibold text-rose-700 dark:text-rose-300"
                              : "text-zinc-700 hover:bg-zinc-200/50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                          }`}
                        >
                          <span className="truncate">{other.title}</span>
                          {isBlocking && (
                            <Check className="h-3.5 w-3.5 shrink-0 text-rose-500" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Move Card Popover */}
                {activePopover === "move" && (
                  <div className="space-y-2.5">
                    <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                      Destination List
                    </label>
                    <select
                      value={moveTargetColId}
                      onChange={(e) => handleMoveCardToColumn(e.target.value)}
                      className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                    >
                      {board.columns
                        .filter((col) => !col.is_archived)
                        .map((col) => (
                          <option key={col.id} value={col.id}>
                            {col.title}
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                {/* Copy Card Popover */}
                {activePopover === "copy" && (
                  <form onSubmit={handleConfirmCopyCard} className="space-y-2.5">
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                        Title
                      </label>
                      <input
                        type="text"
                        value={copyTitle}
                        onChange={(e) => setCopyTitle(e.target.value)}
                        className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                        Copy to List
                      </label>
                      <select
                        value={copyColumnId}
                        onChange={(e) => setCopyColumnId(e.target.value)}
                        className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                      >
                        {board.columns
                          .filter((col) => !col.is_archived)
                          .map((col) => (
                            <option key={col.id} value={col.id}>
                              {col.title}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="space-y-1 text-xs text-zinc-600 dark:text-zinc-300">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={keepChecklists}
                          onChange={(e) => setKeepChecklists(e.target.checked)}
                        />
                        Keep Checklists ({card.checklists.length})
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={keepLabels}
                          onChange={(e) => setKeepLabels(e.target.checked)}
                        />
                        Keep Labels ({card.label_ids.length})
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={keepMembers}
                          onChange={(e) => setKeepMembers(e.target.checked)}
                        />
                        Keep Members ({card.member_ids.length})
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={keepAttachments}
                          onChange={(e) => setKeepAttachments(e.target.checked)}
                        />
                        Keep Attachments ({card.attachments.length})
                      </label>
                    </div>
                    <button
                      type="submit"
                      className="w-full rounded-lg bg-indigo-600 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
                    >
                      Create Card Copy
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* "Actions" Section */}
            <div>
              <h5 className="mb-2 text-[10px] font-bold tracking-wider text-zinc-400 uppercase">
                Actions
              </h5>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-1">
                <button
                  type="button"
                  onClick={() =>
                    setActivePopover(activePopover === "move" ? null : "move")
                  }
                  className="flex items-center gap-2 rounded-xl border border-zinc-200/80 bg-zinc-50/80 px-3 py-2 text-left text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  <ArrowRight className="h-3.5 w-3.5 text-zinc-400" />
                  <span>Move ({currentColumn?.title ?? "List"})</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setActivePopover(activePopover === "copy" ? null : "copy")
                  }
                  className="flex items-center gap-2 rounded-xl border border-zinc-200/80 bg-zinc-50/80 px-3 py-2 text-left text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  <Copy className="h-3.5 w-3.5 text-zinc-400" />
                  <span>Copy Card</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    onUpdateCard(card.id, { is_watching: !card.is_watching })
                  }
                  className="flex items-center justify-between rounded-xl border border-zinc-200/80 bg-zinc-50/80 px-3 py-2 text-left text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  <span className="flex items-center gap-2">
                    {card.is_watching ? (
                      <EyeOff className="h-3.5 w-3.5 text-indigo-500" />
                    ) : (
                      <Eye className="h-3.5 w-3.5 text-zinc-400" />
                    )}
                    <span>{card.is_watching ? "Watching" : "Watch"}</span>
                  </span>
                  {card.is_watching && (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white">
                      <Check className="h-2.5 w-2.5" />
                    </span>
                  )}
                </button>

                {!card.is_archived ? (
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateCard(card.id, { is_archived: true })
                    }
                    className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-left text-xs font-medium text-amber-700 transition-colors hover:bg-amber-500/20 dark:text-amber-300"
                  >
                    <Archive className="h-3.5 w-3.5" />
                    <span>Archive Card</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onDeleteCard(card.id)}
                    className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-left text-xs font-medium text-rose-600 transition-colors hover:bg-rose-500/20 dark:text-rose-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete Permanently</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
