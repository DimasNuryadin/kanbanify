import { randomUUID } from "node:crypto";
import {
  BoardExportCsvResponseSchema,
  BoardSchema,
  TrelloImportResultSchema,
  type Activity,
  type Attachment,
  type AutomationRule,
  type Board,
  type BoardExportCsvResponse,
  type Card,
  type Checklist,
  type ChecklistItem,
  type Column,
  type Comment,
  type Label,
  type LabelColor,
  type Member,
  type Priority,
  type TrelloImportRequest,
  type TrelloImportResult,
} from "@kinetix/contracts";
import {
  DEFAULT_BOARD_BACKGROUND,
  DEFAULT_CARD_COVER,
  DEFAULT_WORKSPACE_ID,
  StorageRepository,
  buildDefaultBoardLabels,
  buildDefaultBoardMembers,
  compareFractionalIndex,
  syncChecklistsAndSubtasks,
} from "../db/repository.js";
import type { BoardRealtimeHub } from "../ws/hub.js";

const VALID_LABEL_COLORS: Set<string> = new Set([
  "green",
  "yellow",
  "orange",
  "red",
  "purple",
  "blue",
  "sky",
  "lime",
  "pink",
  "black",
]);

function normalizeLabelColor(raw: unknown): LabelColor {
  if (typeof raw === "string") {
    const lower = raw.toLowerCase().trim();
    if (VALID_LABEL_COLORS.has(lower)) {
      return lower as LabelColor;
    }
    if (lower.includes("green")) return "green";
    if (lower.includes("yellow")) return "yellow";
    if (lower.includes("orange")) return "orange";
    if (lower.includes("red")) return "red";
    if (lower.includes("purple")) return "purple";
    if (lower.includes("blue")) return "blue";
    if (lower.includes("sky") || lower.includes("teal")) return "sky";
    if (lower.includes("lime")) return "lime";
    if (lower.includes("pink")) return "pink";
    if (lower.includes("black") || lower.includes("dark")) return "black";
  }
  return "blue";
}

function generateFractionalPosition(index: number): string {
  // Produces lexicographically sorted fractional positions:
  // 0..9 -> "a0".."a9"
  // 10..99 -> "b10".."b99"
  // 100..999 -> "c100".."c999"
  if (index < 10) return `a${index}`;
  if (index < 100) return `b${index}`;
  if (index < 1000) return `c${index}`;
  return `d${index}`;
}

function normalizeIsoDateOrNull(val: unknown): string | null {
  if (!val || typeof val !== "string") return null;
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function deriveInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "TM";
  return parts
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 4);
}

function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  const str = String(value);
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

export class ImportExportService {
  private readonly repository: StorageRepository;
  private readonly hub: BoardRealtimeHub;

  constructor(repository: StorageRepository, hub: BoardRealtimeHub) {
    this.repository = repository;
    this.hub = hub;
  }

  /**
   * Imports either a Native Trello Export JSON or a Kinetix Board JSON,
   * persists it into the target workspace, broadcasts BOARD_IMPORTED & BOARD_UPDATED,
   * and returns TrelloImportResultSchema.
   */
  public async importBoard(
    request: TrelloImportRequest,
    actorId: string = "kinetix-api"
  ): Promise<TrelloImportResult> {
    const rawPayload = (request.payload ?? {}) as Record<string, any>;
    const workspaceId =
      request.workspace_id &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        request.workspace_id
      )
        ? request.workspace_id
        : DEFAULT_WORKSPACE_ID;

    // Detect if payload is Kinetix Board JSON or Native Trello JSON
    const isKinetixJson =
      request.format === "kinetix_json" ||
      (Array.isArray(rawPayload.columns) && !Array.isArray(rawPayload.lists));

    const result = isKinetixJson
      ? await this.importKinetixBoardJson(
          rawPayload,
          workspaceId,
          request.board_title_override
        )
      : await this.importTrelloBoardJson(
          rawPayload,
          workspaceId,
          request.board_title_override
        );

    const validatedResult = TrelloImportResultSchema.parse(result);

    // Broadcast both BOARD_IMPORTED and BOARD_UPDATED so any connected workspace/board listeners sync immediately
    await this.hub.broadcast({
      event: "BOARD_IMPORTED",
      board_id: validatedResult.board.id,
      data: validatedResult,
      actor_id: actorId,
    });

    await this.hub.broadcast({
      event: "BOARD_UPDATED",
      board_id: validatedResult.board.id,
      data: validatedResult.board,
      actor_id: actorId,
    });

    return validatedResult;
  }

  private async importTrelloBoardJson(
    payload: Record<string, any>,
    workspaceId: string,
    titleOverride?: string
  ): Promise<TrelloImportResult> {
    const boardId = randomUUID();
    const now = new Date().toISOString();

    const rawName =
      typeof payload.name === "string" && payload.name.trim().length > 0
        ? payload.name.trim()
        : typeof payload.title === "string" && payload.title.trim().length > 0
        ? payload.title.trim()
        : "Imported Trello Board";

    const boardTitle = (titleOverride?.trim() || rawName).slice(0, 150);
    const boardDescription =
      typeof payload.desc === "string"
        ? payload.desc
        : typeof payload.description === "string"
        ? payload.description
        : "Imported from Trello JSON export";

    // 1. Map Members
    const defaultMembers = buildDefaultBoardMembers();
    const memberIdMap = new Map<string, string>();
    const boardMembers: Member[] = [...defaultMembers];

    if (Array.isArray(payload.members)) {
      const palette = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ec4899", "#06b6d4"];
      payload.members.forEach((rawMem: any, idx: number) => {
        if (!rawMem || typeof rawMem !== "object") return;
        const trelloMemId = String(rawMem.id ?? `trello-mem-${idx}`);
        const fullName = String(
          rawMem.fullName ?? rawMem.name ?? rawMem.username ?? `Member ${idx + 1}`
        )
          .trim()
          .slice(0, 120);

        const existingMatch = boardMembers.find(
          (m) => m.name.toLowerCase() === fullName.toLowerCase()
        );
        if (existingMatch) {
          memberIdMap.set(trelloMemId, existingMatch.id);
          return;
        }

        const newMemId = randomUUID();
        memberIdMap.set(trelloMemId, newMemId);
        const safeEmailSlug =
          fullName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ".")
            .replace(/(^\.|\.$)/g, "") || `member${idx + 1}`;

        boardMembers.push({
          id: newMemId,
          name: fullName || `Member ${idx + 1}`,
          email:
            typeof rawMem.email === "string" && rawMem.email.includes("@")
              ? rawMem.email
              : `${safeEmailSlug}@kinetix.dev`,
          avatar_url:
            typeof rawMem.avatarUrl === "string" ? rawMem.avatarUrl : null,
          initials:
            typeof rawMem.initials === "string" &&
            rawMem.initials.trim().length > 0
              ? rawMem.initials.trim().toUpperCase().slice(0, 4)
              : deriveInitials(fullName),
          color: palette[idx % palette.length] ?? "#3b82f6",
        });
      });
    }

    // 2. Map Labels
    const boardLabels: Label[] = buildDefaultBoardLabels(boardId);
    const labelIdMap = new Map<string, string>();

    const registerOrMatchTrelloLabel = (rawLbl: any): string | null => {
      if (!rawLbl || typeof rawLbl !== "object") return null;
      const trelloLblId = rawLbl.id ? String(rawLbl.id) : null;
      if (trelloLblId && labelIdMap.has(trelloLblId)) {
        return labelIdMap.get(trelloLblId)!;
      }

      const lblName =
        typeof rawLbl.name === "string" ? rawLbl.name.trim().slice(0, 100) : "";
      const lblColor = normalizeLabelColor(rawLbl.color);

      const existing = boardLabels.find(
        (bl) =>
          (lblName && bl.name.toLowerCase() === lblName.toLowerCase()) ||
          (!lblName && bl.color === lblColor)
      );
      if (existing) {
        if (trelloLblId) labelIdMap.set(trelloLblId, existing.id);
        return existing.id;
      }

      const newLabelId = randomUUID();
      const newLabel: Label = {
        id: newLabelId,
        board_id: boardId,
        name: lblName || lblColor.charAt(0).toUpperCase() + lblColor.slice(1),
        color: lblColor,
      };
      boardLabels.push(newLabel);
      if (trelloLblId) labelIdMap.set(trelloLblId, newLabelId);
      return newLabelId;
    };

    if (Array.isArray(payload.labels)) {
      for (const rawLbl of payload.labels) {
        registerOrMatchTrelloLabel(rawLbl);
      }
    }

    // 3. Map Lists -> Columns (filter out closed === true, sort by pos)
    const rawLists: any[] = Array.isArray(payload.lists) ? payload.lists : [];
    const openLists = rawLists
      .filter((lst) => lst && typeof lst === "object" && lst.closed !== true)
      .sort((a, b) => {
        const posA = typeof a.pos === "number" ? a.pos : Number.MAX_SAFE_INTEGER;
        const posB = typeof b.pos === "number" ? b.pos : Number.MAX_SAFE_INTEGER;
        return posA - posB;
      });

    const listIdToColumnId = new Map<string, string>();
    const columns: Column[] = [];

    if (openLists.length > 0) {
      openLists.forEach((lst, idx) => {
        const colId = randomUUID();
        const trelloListId = String(lst.id ?? `list-${idx}`);
        listIdToColumnId.set(trelloListId, colId);

        const colTitle =
          typeof lst.name === "string" && lst.name.trim().length > 0
            ? lst.name.trim().slice(0, 100)
            : typeof lst.title === "string" && lst.title.trim().length > 0
            ? lst.title.trim().slice(0, 100)
            : `List ${idx + 1}`;

        columns.push({
          id: colId,
          board_id: boardId,
          title: colTitle,
          position: generateFractionalPosition(idx),
          wip_limit:
            typeof lst.wip_limit === "number" && lst.wip_limit > 0
              ? Math.floor(lst.wip_limit)
              : null,
          color: typeof lst.color === "string" ? lst.color : null,
          is_archived: Boolean(lst.closed === true),
        });
      });
    } else {
      // Fallback default columns if Trello payload has no open lists
      const fallbackTitles = ["To Do", "In Progress", "Done"];
      fallbackTitles.forEach((title, idx) => {
        const colId = randomUUID();
        listIdToColumnId.set(`default-${idx}`, colId);
        columns.push({
          id: colId,
          board_id: boardId,
          title,
          position: generateFractionalPosition(idx),
          wip_limit: null,
          color: null,
          is_archived: false,
        });
      });
    }

    const importedListsCount =
      openLists.length > 0 ? openLists.length : columns.length;
    const defaultColumnId = columns[0]!.id;

    // 4. Pre-index Checklists by Trello idCard
    const rawChecklists: any[] = Array.isArray(payload.checklists)
      ? payload.checklists
      : [];
    const checklistsByTrelloCardId = new Map<string, any[]>();
    let importedChecklistsCount = 0;

    for (const rawCl of rawChecklists) {
      if (!rawCl || typeof rawCl !== "object") continue;
      const idCard = rawCl.idCard ? String(rawCl.idCard) : "";
      if (!idCard) continue;
      const existing = checklistsByTrelloCardId.get(idCard) ?? [];
      existing.push(rawCl);
      checklistsByTrelloCardId.set(idCard, existing);
    }

    // 5. Group and sort Trello Cards per column by pos
    const rawCards: any[] = Array.isArray(payload.cards) ? payload.cards : [];
    const cardsByColumnId = new Map<string, any[]>();

    for (const rawCard of rawCards) {
      if (!rawCard || typeof rawCard !== "object") continue;
      const trelloListId = rawCard.idList ? String(rawCard.idList) : "";
      const targetColumnId =
        listIdToColumnId.get(trelloListId) ?? defaultColumnId;
      const group = cardsByColumnId.get(targetColumnId) ?? [];
      group.push(rawCard);
      cardsByColumnId.set(targetColumnId, group);
    }

    const cards: Card[] = [];

    for (const [colId, colRawCards] of cardsByColumnId.entries()) {
      colRawCards.sort((a, b) => {
        const posA = typeof a.pos === "number" ? a.pos : Number.MAX_SAFE_INTEGER;
        const posB = typeof b.pos === "number" ? b.pos : Number.MAX_SAFE_INTEGER;
        return posA - posB;
      });

      colRawCards.forEach((rawCard, cardIdx) => {
        const cardId = randomUUID();
        const trelloCardId = rawCard.id ? String(rawCard.id) : `card-${cardIdx}`;
        const cardTitle =
          typeof rawCard.name === "string" && rawCard.name.trim().length > 0
            ? rawCard.name.trim().slice(0, 255)
            : typeof rawCard.title === "string" &&
              rawCard.title.trim().length > 0
            ? rawCard.title.trim().slice(0, 255)
            : `Imported Card #${cardIdx + 1}`;

        const cardDesc =
          typeof rawCard.desc === "string"
            ? rawCard.desc
            : typeof rawCard.description === "string"
            ? rawCard.description
            : "";

        // Map card labels (both inline `labels` objects and `idLabels` references)
        const cardLabelIds = new Set<string>();
        if (Array.isArray(rawCard.labels)) {
          for (const rl of rawCard.labels) {
            const mappedId = registerOrMatchTrelloLabel(rl);
            if (mappedId) cardLabelIds.add(mappedId);
          }
        }
        if (Array.isArray(rawCard.idLabels)) {
          for (const idLbl of rawCard.idLabels) {
            const mapped = labelIdMap.get(String(idLbl));
            if (mapped) cardLabelIds.add(mapped);
          }
        }

        // Map card members
        const cardMemberIds = new Set<string>();
        if (Array.isArray(rawCard.idMembers)) {
          for (const idMem of rawCard.idMembers) {
            const mapped = memberIdMap.get(String(idMem));
            if (mapped) cardMemberIds.add(mapped);
          }
        }

        // Map card checklists (from top-level `checklists` matching `idCard` or inline `rawCard.checklists`)
        const matchingRawChecklists = [
          ...(checklistsByTrelloCardId.get(trelloCardId) ?? []),
          ...(Array.isArray(rawCard.checklists) ? rawCard.checklists : []),
        ];

        matchingRawChecklists.sort((a, b) => {
          const posA =
            typeof a.pos === "number" ? a.pos : Number.MAX_SAFE_INTEGER;
          const posB =
            typeof b.pos === "number" ? b.pos : Number.MAX_SAFE_INTEGER;
          return posA - posB;
        });

        const cardChecklists: Checklist[] = matchingRawChecklists.map(
          (rawCl, clIdx) => {
            importedChecklistsCount += 1;
            const rawItems: any[] = Array.isArray(rawCl.checkItems)
              ? rawCl.checkItems
              : Array.isArray(rawCl.items)
              ? rawCl.items
              : [];

            rawItems.sort((a, b) => {
              const posA =
                typeof a.pos === "number" ? a.pos : Number.MAX_SAFE_INTEGER;
              const posB =
                typeof b.pos === "number" ? b.pos : Number.MAX_SAFE_INTEGER;
              return posA - posB;
            });

            const items: ChecklistItem[] = rawItems.map((it, itIdx) => ({
              id: randomUUID(),
              title:
                typeof it.name === "string" && it.name.trim().length > 0
                  ? it.name.trim().slice(0, 280)
                  : typeof it.title === "string" && it.title.trim().length > 0
                  ? it.title.trim().slice(0, 280)
                  : `Step ${itIdx + 1}`,
              is_completed:
                it.state === "complete" || Boolean(it.is_completed === true),
              position: generateFractionalPosition(itIdx),
              due_date: normalizeIsoDateOrNull(it.due ?? it.due_date),
              assignee_id:
                it.idMember && memberIdMap.has(String(it.idMember))
                  ? memberIdMap.get(String(it.idMember))!
                  : null,
            }));

            return {
              id: randomUUID(),
              title:
                typeof rawCl.name === "string" && rawCl.name.trim().length > 0
                  ? rawCl.name.trim().slice(0, 150)
                  : typeof rawCl.title === "string" &&
                    rawCl.title.trim().length > 0
                  ? rawCl.title.trim().slice(0, 150)
                  : "Checklist",
              position: generateFractionalPosition(clIdx),
              items,
            };
          }
        );

        const { checklists, subtasks } = syncChecklistsAndSubtasks({
          inputChecklists: cardChecklists,
        });

        // Infer priority if priority label or field present
        let priority: Priority = "MEDIUM";
        if (
          typeof rawCard.priority === "string" &&
          ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(
            rawCard.priority.toUpperCase()
          )
        ) {
          priority = rawCard.priority.toUpperCase() as Priority;
        } else {
          const cardLabelsMeta = boardLabels.filter((bl) =>
            cardLabelIds.has(bl.id)
          );
          if (cardLabelsMeta.some((l) => l.color === "red")) {
            priority = "URGENT";
          } else if (cardLabelsMeta.some((l) => l.color === "orange")) {
            priority = "HIGH";
          }
        }

        const storyPoints =
          typeof rawCard.story_points === "number" &&
          rawCard.story_points >= 0 &&
          rawCard.story_points <= 100
            ? Math.round(rawCard.story_points)
            : subtasks.length > 0
            ? Math.min(13, Math.max(1, subtasks.length * 2))
            : 3;

        cards.push({
          id: cardId,
          board_id: boardId,
          column_id: colId,
          title: cardTitle,
          description: cardDesc,
          position: generateFractionalPosition(cardIdx),
          priority,
          story_points: storyPoints,
          tags: ["trello-import"],
          subtasks,
          blocked_by_card_ids: [],
          due_date: normalizeIsoDateOrNull(rawCard.due ?? rawCard.due_date),
          updated_at:
            normalizeIsoDateOrNull(rawCard.dateLastActivity) ?? now,
          cover: { ...DEFAULT_CARD_COVER },
          label_ids: Array.from(cardLabelIds),
          member_ids: Array.from(cardMemberIds),
          checklists,
          comments: [],
          attachments: [],
          start_date: normalizeIsoDateOrNull(rawCard.start ?? rawCard.start_date),
          is_due_complete: Boolean(
            rawCard.dueComplete ?? rawCard.is_due_complete ?? false
          ),
          is_archived: Boolean(rawCard.closed ?? rawCard.is_archived ?? false),
          is_watching: Boolean(rawCard.subscribed ?? rawCard.is_watching ?? false),
        });
      });
    }

    const importActivity: Activity = {
      id: randomUUID(),
      board_id: boardId,
      card_id: null,
      actor_name: "Alex Rivera",
      action_type: "CARD_CREATED",
      description: `imported Trello board "${boardTitle}" (${importedListsCount} lists, ${cards.length} cards, ${importedChecklistsCount} checklists)`,
      created_at: now,
      is_automated: false,
    };

    const newBoard: Board = BoardSchema.parse({
      id: boardId,
      workspace_id: workspaceId,
      title: boardTitle,
      description: boardDescription,
      is_starred: false,
      background: { ...DEFAULT_BOARD_BACKGROUND },
      columns: columns.sort((a, b) =>
        compareFractionalIndex(a.position, b.position)
      ),
      cards: cards.sort((a, b) =>
        compareFractionalIndex(a.position, b.position)
      ),
      labels: boardLabels,
      members: boardMembers,
      activities: [importActivity],
      automation_rules: [],
      created_at: now,
    });

    await this.repository.saveBoardDirect(newBoard);

    return {
      board: newBoard,
      imported_lists_count: importedListsCount,
      imported_cards_count: cards.length,
      imported_checklists_count: importedChecklistsCount,
    };
  }

  private async importKinetixBoardJson(
    payload: Record<string, any>,
    workspaceId: string,
    titleOverride?: string
  ): Promise<TrelloImportResult> {
    const boardId = randomUUID();
    const now = new Date().toISOString();

    const rawTitle =
      typeof payload.title === "string" && payload.title.trim().length > 0
        ? payload.title.trim()
        : typeof payload.name === "string" && payload.name.trim().length > 0
        ? payload.name.trim()
        : "Imported Kinetix Board";

    const boardTitle = (titleOverride?.trim() || rawTitle).slice(0, 150);
    const boardDescription =
      typeof payload.description === "string" ? payload.description : "";

    // Map labels with fresh IDs bound to new boardId
    const oldLabelIdToNew = new Map<string, string>();
    const rawLabels: any[] = Array.isArray(payload.labels) ? payload.labels : [];
    const boardLabels: Label[] =
      rawLabels.length > 0
        ? rawLabels.map((lbl, idx) => {
            const newId = randomUUID();
            if (lbl?.id) oldLabelIdToNew.set(String(lbl.id), newId);
            return {
              id: newId,
              board_id: boardId,
              name:
                typeof lbl?.name === "string"
                  ? lbl.name.slice(0, 100)
                  : `Label ${idx + 1}`,
              color: normalizeLabelColor(lbl?.color),
            };
          })
        : buildDefaultBoardLabels(boardId);

    const boardMembers: Member[] =
      Array.isArray(payload.members) && payload.members.length > 0
        ? payload.members
        : buildDefaultBoardMembers();

    // Map columns with fresh UUIDs
    const oldColIdToNew = new Map<string, string>();
    const rawColumns: any[] = Array.isArray(payload.columns)
      ? payload.columns
      : [];
    const columns: Column[] = rawColumns.map((col, idx) => {
      const newColId = randomUUID();
      if (col?.id) oldColIdToNew.set(String(col.id), newColId);
      return {
        id: newColId,
        board_id: boardId,
        title:
          typeof col?.title === "string" && col.title.trim().length > 0
            ? col.title.trim().slice(0, 100)
            : `Column ${idx + 1}`,
        position:
          typeof col?.position === "string" && col.position.trim().length > 0
            ? col.position.trim()
            : generateFractionalPosition(idx),
        wip_limit:
          typeof col?.wip_limit === "number" && col.wip_limit > 0
            ? Math.floor(col.wip_limit)
            : null,
        color: typeof col?.color === "string" ? col.color : null,
        is_archived: Boolean(col?.is_archived ?? false),
      };
    });

    if (columns.length === 0) {
      ["Backlog", "In Progress", "Review", "Done"].forEach((t, idx) => {
        columns.push({
          id: randomUUID(),
          board_id: boardId,
          title: t,
          position: generateFractionalPosition(idx),
          wip_limit: null,
          color: null,
          is_archived: false,
        });
      });
    }

    const defaultColId = columns[0]!.id;
    let importedChecklistsCount = 0;

    const rawCards: any[] = Array.isArray(payload.cards) ? payload.cards : [];
    const cards: Card[] = rawCards.map((c, idx) => {
      const cardId = randomUUID();
      const targetColId =
        (c?.column_id && oldColIdToNew.get(String(c.column_id))) ||
        defaultColId;

      const rawClList: any[] = Array.isArray(c?.checklists) ? c.checklists : [];
      const cardChecklists: Checklist[] = rawClList.map((cl, clIdx) => {
        importedChecklistsCount += 1;
        const rawItems: any[] = Array.isArray(cl?.items) ? cl.items : [];
        return {
          id: randomUUID(),
          title:
            typeof cl?.title === "string" && cl.title.trim().length > 0
              ? cl.title.trim().slice(0, 150)
              : "Checklist",
          position:
            typeof cl?.position === "string" && cl.position.trim().length > 0
              ? cl.position.trim()
              : generateFractionalPosition(clIdx),
          items: rawItems.map((it, itIdx) => ({
            id: randomUUID(),
            title:
              typeof it?.title === "string" && it.title.trim().length > 0
                ? it.title.trim().slice(0, 280)
                : `Item ${itIdx + 1}`,
            is_completed: Boolean(it?.is_completed ?? false),
            position:
              typeof it?.position === "string" && it.position.trim().length > 0
                ? it.position.trim()
                : generateFractionalPosition(itIdx),
            due_date: normalizeIsoDateOrNull(it?.due_date),
            assignee_id:
              typeof it?.assignee_id === "string" ? it.assignee_id : null,
          })),
        };
      });

      const { checklists, subtasks } = syncChecklistsAndSubtasks({
        inputChecklists: cardChecklists.length > 0 ? cardChecklists : undefined,
        inputSubtasks:
          cardChecklists.length === 0 && Array.isArray(c?.subtasks)
            ? c.subtasks.map((st: any, stIdx: number) => ({
                id: randomUUID(),
                title: String(st?.title ?? `Subtask ${stIdx + 1}`).slice(0, 280),
                is_completed: Boolean(st?.is_completed ?? false),
                position:
                  typeof st?.position === "string"
                    ? st.position
                    : generateFractionalPosition(stIdx),
              }))
            : undefined,
      });

      const mappedLabelIds = Array.isArray(c?.label_ids)
        ? c.label_ids.map(
            (lid: unknown) => oldLabelIdToNew.get(String(lid)) ?? String(lid)
          )
        : [];

      const mappedComments: Comment[] = Array.isArray(c?.comments)
        ? c.comments.map((cm: any) => ({
            id: randomUUID(),
            card_id: cardId,
            author_id: String(
              cm?.author_id ?? "88888888-8888-4888-8888-888888888881"
            ),
            author_name: String(cm?.author_name ?? "Alex Rivera").slice(0, 120),
            author_initials: String(cm?.author_initials ?? "AR").slice(0, 4),
            content: String(cm?.content ?? "Comment"),
            created_at: normalizeIsoDateOrNull(cm?.created_at) ?? now,
            updated_at: normalizeIsoDateOrNull(cm?.updated_at) ?? now,
          }))
        : [];

      const mappedAttachments: Attachment[] = Array.isArray(c?.attachments)
        ? c.attachments.map((att: any) => ({
            id: randomUUID(),
            name: String(att?.name ?? "Attachment").slice(0, 255),
            url: String(att?.url ?? "https://kinetix.dev"),
            type:
              att?.type === "image" || att?.type === "file"
                ? att.type
                : ("link" as const),
            created_at: normalizeIsoDateOrNull(att?.created_at) ?? now,
          }))
        : [];

      return {
        id: cardId,
        board_id: boardId,
        column_id: targetColId,
        title:
          typeof c?.title === "string" && c.title.trim().length > 0
            ? c.title.trim().slice(0, 255)
            : `Card ${idx + 1}`,
        description: typeof c?.description === "string" ? c.description : "",
        position:
          typeof c?.position === "string" && c.position.trim().length > 0
            ? c.position.trim()
            : generateFractionalPosition(idx),
        priority:
          typeof c?.priority === "string" &&
          ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(c.priority)
            ? (c.priority as Priority)
            : "MEDIUM",
        story_points:
          typeof c?.story_points === "number" ? c.story_points : null,
        tags: Array.isArray(c?.tags) ? c.tags.map(String) : [],
        subtasks,
        blocked_by_card_ids: [],
        due_date: normalizeIsoDateOrNull(c?.due_date),
        updated_at: normalizeIsoDateOrNull(c?.updated_at) ?? now,
        cover: c?.cover ?? { ...DEFAULT_CARD_COVER },
        label_ids: mappedLabelIds,
        member_ids: Array.isArray(c?.member_ids)
          ? c.member_ids.map(String)
          : [],
        checklists,
        comments: mappedComments,
        attachments: mappedAttachments,
        start_date: normalizeIsoDateOrNull(c?.start_date),
        is_due_complete: Boolean(c?.is_due_complete ?? false),
        is_archived: Boolean(c?.is_archived ?? false),
        is_watching: Boolean(c?.is_watching ?? false),
      };
    });

    const mappedRules: AutomationRule[] = Array.isArray(payload.automation_rules)
      ? payload.automation_rules.map((r: any) => ({
          ...r,
          id: randomUUID(),
          board_id: boardId,
          created_at: normalizeIsoDateOrNull(r?.created_at) ?? now,
        }))
      : [];

    const newBoard: Board = BoardSchema.parse({
      id: boardId,
      workspace_id: workspaceId,
      title: boardTitle,
      description: boardDescription,
      is_starred: Boolean(payload.is_starred ?? false),
      background: payload.background ?? { ...DEFAULT_BOARD_BACKGROUND },
      columns: columns.sort((a, b) =>
        compareFractionalIndex(a.position, b.position)
      ),
      cards: cards.sort((a, b) =>
        compareFractionalIndex(a.position, b.position)
      ),
      labels: boardLabels,
      members: boardMembers,
      activities: [
        {
          id: randomUUID(),
          board_id: boardId,
          card_id: null,
          actor_name: "Alex Rivera",
          action_type: "CARD_CREATED",
          description: `imported Kinetix board "${boardTitle}"`,
          created_at: now,
          is_automated: false,
        },
      ],
      automation_rules: mappedRules,
      created_at: now,
    });

    await this.repository.saveBoardDirect(newBoard);

    return {
      board: newBoard,
      imported_lists_count: columns.length,
      imported_cards_count: cards.length,
      imported_checklists_count: importedChecklistsCount,
    };
  }

  /**
   * Exports a board into RFC-4180 compliant CSV format wrapped in BoardExportCsvResponseSchema.
   */
  public exportBoardToCsv(board: Board): BoardExportCsvResponse {
    const columnMap = new Map<string, string>(
      board.columns.map((c) => [c.id, c.title])
    );
    const labelMap = new Map<string, string>(
      board.labels.map((l) => [l.id, l.name || l.color])
    );
    const memberMap = new Map<string, string>(
      board.members.map((m) => [m.id, m.name])
    );

    const headers = [
      "Card ID",
      "Title",
      "Column",
      "Priority",
      "Story Points",
      "Labels",
      "Members",
      "Due Date",
      "Due Complete",
      "Checklist Progress",
      "Blocked By Count",
      "Archived",
      "Updated At",
    ];

    const rows: string[] = [headers.join(",")];

    for (const card of board.cards) {
      const colTitle = columnMap.get(card.column_id) ?? "Unknown";
      const labelNames = (card.label_ids ?? [])
        .map((id) => labelMap.get(id))
        .filter(Boolean)
        .join("; ");
      const memberNames = (card.member_ids ?? [])
        .map((id) => memberMap.get(id))
        .filter(Boolean)
        .join("; ");

      let totalChecklistItems = 0;
      let completedChecklistItems = 0;
      if (Array.isArray(card.checklists) && card.checklists.length > 0) {
        for (const cl of card.checklists) {
          for (const item of cl.items ?? []) {
            totalChecklistItems += 1;
            if (item.is_completed) completedChecklistItems += 1;
          }
        }
      } else if (Array.isArray(card.subtasks) && card.subtasks.length > 0) {
        for (const st of card.subtasks) {
          totalChecklistItems += 1;
          if (st.is_completed) completedChecklistItems += 1;
        }
      }

      const checklistProgress = `${completedChecklistItems}/${totalChecklistItems}`;
      const blockedByCount = Array.isArray(card.blocked_by_card_ids)
        ? card.blocked_by_card_ids.length
        : 0;

      const rowCells = [
        escapeCsvCell(card.id),
        escapeCsvCell(card.title),
        escapeCsvCell(colTitle),
        escapeCsvCell(card.priority),
        escapeCsvCell(card.story_points ?? 0),
        escapeCsvCell(labelNames),
        escapeCsvCell(memberNames),
        escapeCsvCell(card.due_date ?? ""),
        escapeCsvCell(card.is_due_complete),
        escapeCsvCell(checklistProgress),
        escapeCsvCell(blockedByCount),
        escapeCsvCell(card.is_archived),
        escapeCsvCell(card.updated_at),
      ];

      rows.push(rowCells.join(","));
    }

    const csvData = rows.join("\n");
    const slugTitle =
      board.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") || "board";

    return BoardExportCsvResponseSchema.parse({
      filename: `${slugTitle}-export.csv`,
      content_type: "text/csv",
      csv_data: csvData,
    });
  }
}
