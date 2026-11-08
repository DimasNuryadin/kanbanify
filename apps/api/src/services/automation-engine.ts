import { randomUUID } from "node:crypto";
import type {
  Activity,
  AutomationAction,
  AutomationActionType,
  AutomationRule,
  AutomationTrigger,
  Board,
  Card,
  Checklist,
  Comment,
} from "@kinetix/contracts";
import type { StorageRepository } from "../db/repository.js";
import type { BoardRealtimeHub } from "../ws/hub.js";

export type AutomationTriggerEvent =
  | {
      type: "CARD_MOVED";
      card: Card;
      sourceColumnId?: string;
      targetColumnId: string;
    }
  | {
      type: "CARD_CREATED";
      card: Card;
    }
  | {
      type: "CARD_UPDATED";
      card: Card;
      previousCard: Card;
    };

export interface AutomationExecutionResult {
  card: Card;
  executedRules: Array<{
    rule: AutomationRule;
    actionTypes: AutomationActionType[];
  }>;
}

export class AutomationEngine {
  constructor(
    private repository: StorageRepository,
    private hub?: BoardRealtimeHub
  ) {}

  /**
   * Evaluates Butler automation rules on the board for the given trigger event.
   * Guarantees max 1 automation hop per user request to prevent recursion loops.
   */
  public async evaluateAndExecute(
    boardId: string,
    event: AutomationTriggerEvent,
    options: { depth?: number } = {}
  ): Promise<AutomationExecutionResult> {
    const depth = options.depth ?? 0;
    // Guard against infinite recursion: max 1 automation hop per user request
    if (depth >= 1) {
      return { card: event.card, executedRules: [] };
    }

    const board = await this.repository.getBoardById(boardId);
    if (!board) {
      return { card: event.card, executedRules: [] };
    }

    const enabledRules = (board.automation_rules ?? []).filter(
      (rule) => rule.is_enabled
    );
    if (enabledRules.length === 0) {
      return { card: event.card, executedRules: [] };
    }

    // Clone working card
    const workingCard: Card = JSON.parse(JSON.stringify(event.card));
    const executedRules: Array<{
      rule: AutomationRule;
      actionTypes: AutomationActionType[];
    }> = [];

    for (const rule of enabledRules) {
      if (!this.matchesTrigger(rule.trigger, event, board)) {
        continue;
      }

      const executedActionTypes: AutomationActionType[] = [];

      for (const action of rule.actions) {
        this.applyAction(workingCard, action, board, rule);
        executedActionTypes.push(action.type);
      }

      // Update rule execution count and timestamp in repository
      const recordedRule = await this.repository.updateRuleExecution(board.id, rule.id);
      rule.execution_count = recordedRule.execution_count;
      rule.last_triggered_at = recordedRule.last_triggered_at;

      // Append Activity log entry
      const activityDescription = `🤖 Butler executed rule: [${rule.name}]`;
      await this.repository.appendBoardActivity(board.id, {
        card_id: workingCard.id,
        actor_name: "🤖 Butler Bot",
        action_type: "AUTOMATION_TRIGGERED",
        description: activityDescription,
        is_automated: true,
      });

      // Broadcast AUTOMATION_TRIGGERED WebSocket event
      if (this.hub) {
        await this.hub.broadcast({
          event: "AUTOMATION_TRIGGERED",
          board_id: board.id,
          data: {
            rule_id: rule.id,
            rule_name: rule.name,
            card_id: workingCard.id,
            trigger_type: rule.trigger.type,
            action_types: executedActionTypes,
            execution_count: rule.execution_count,
            triggered_at: rule.last_triggered_at ?? new Date().toISOString(),
          },
          actor_id: "system_butler",
        });
      }

      executedRules.push({ rule, actionTypes: executedActionTypes });
    }

    if (executedRules.length > 0) {
      workingCard.updated_at = new Date().toISOString();
      await this.repository.saveCardDirect(workingCard);

      // Broadcast CARD_UPDATED so all connected clients reflect changes
      if (this.hub) {
        await this.hub.broadcast({
          event: "CARD_UPDATED",
          board_id: board.id,
          data: workingCard,
          actor_id: "system_butler",
        });
      }
    }

    return { card: workingCard, executedRules };
  }

  private matchesTrigger(
    trigger: AutomationTrigger,
    event: AutomationTriggerEvent,
    board: Board
  ): boolean {
    switch (trigger.type) {
      case "WHEN_CARD_MOVED_TO_COLUMN": {
        if (event.type !== "CARD_MOVED") return false;
        const targetCol = board.columns.find(
          (c) => c.id === event.targetColumnId
        );

        if (trigger.column_id) {
          if (trigger.column_id === event.targetColumnId) return true;
        }

        if (trigger.column_title_match && targetCol) {
          const matchNorm = trigger.column_title_match.trim().toLowerCase();
          const titleNorm = targetCol.title.trim().toLowerCase();
          if (titleNorm.includes(matchNorm) || matchNorm.includes(titleNorm)) {
            return true;
          }
        }

        if (!trigger.column_id && !trigger.column_title_match) {
          return true;
        }
        return false;
      }

      case "WHEN_CARD_CREATED": {
        if (event.type !== "CARD_CREATED") return false;
        if (trigger.column_id) {
          return trigger.column_id === event.card.column_id;
        }
        if (trigger.column_title_match) {
          const col = board.columns.find((c) => c.id === event.card.column_id);
          if (!col) return false;
          return col.title
            .toLowerCase()
            .includes(trigger.column_title_match.toLowerCase());
        }
        return true;
      }

      case "WHEN_CHECKLIST_COMPLETED": {
        if (event.type !== "CARD_UPDATED") return false;
        const prevChecklists = event.previousCard.checklists ?? [];
        const currChecklists = event.card.checklists ?? [];

        if (currChecklists.length === 0) return false;

        // Condition A: Any checklist whose items are now 100% complete and had incomplete items before
        for (const currCl of currChecklists) {
          if (!currCl.items || currCl.items.length === 0) continue;
          const allCompleted = currCl.items.every((it) => it.is_completed);
          if (!allCompleted) continue;

          const prevCl = prevChecklists.find((p) => p.id === currCl.id);
          if (!prevCl) {
            // New checklist created with all completed
            return true;
          }
          const prevAllCompleted =
            prevCl.items.length > 0 &&
            prevCl.items.every((it) => it.is_completed);
          if (!prevAllCompleted) {
            return true;
          }
        }

        // Condition B: All items across all checklists are complete
        const allItemsCurr = currChecklists.flatMap((cl) => cl.items ?? []);
        if (allItemsCurr.length > 0 && allItemsCurr.every((i) => i.is_completed)) {
          const allItemsPrev = prevChecklists.flatMap((cl) => cl.items ?? []);
          const prevCompletedAll =
            allItemsPrev.length > 0 && allItemsPrev.every((i) => i.is_completed);
          if (!prevCompletedAll) {
            return true;
          }
        }

        return false;
      }

      case "WHEN_PRIORITY_CHANGED": {
        if (event.type !== "CARD_UPDATED") return false;
        const prevPriority = event.previousCard.priority;
        const currPriority = event.card.priority;
        if (prevPriority === currPriority) return false;

        if (trigger.priority) {
          return currPriority === trigger.priority;
        }
        return true;
      }

      case "WHEN_LABEL_ADDED": {
        if (event.type !== "CARD_UPDATED") return false;
        if (!trigger.label_id) return false;
        const prevLabels = new Set(event.previousCard.label_ids ?? []);
        const currLabels = new Set(event.card.label_ids ?? []);
        return currLabels.has(trigger.label_id) && !prevLabels.has(trigger.label_id);
      }

      default:
        return false;
    }
  }

  private applyAction(
    card: Card,
    action: AutomationAction,
    board: Board,
    rule: AutomationRule
  ): void {
    switch (action.type) {
      case "MARK_DUE_DATE_COMPLETE": {
        const val = action.due_complete_value ?? true;
        card.is_due_complete = val;
        if (val && !card.due_date) {
          card.due_date = new Date().toISOString();
        }
        break;
      }

      case "ASSIGN_MEMBER": {
        let memberId = action.member_id;
        if (!memberId) {
          memberId = board.members[0]?.id ?? "88888888-8888-4888-8888-888888888881";
        }
        if (memberId && !card.member_ids.includes(memberId)) {
          card.member_ids = [...card.member_ids, memberId];
        }
        break;
      }

      case "ADD_LABEL": {
        let labelId = action.label_id;
        if (!labelId) {
          // If unspecified, pick green label from board
          const greenLabel = board.labels.find((l) => l.color === "green");
          labelId = greenLabel?.id ?? (board.labels[0]?.id ?? null);
        }
        if (labelId && !card.label_ids.includes(labelId)) {
          card.label_ids = [...card.label_ids, labelId];
        }
        break;
      }

      case "SET_PRIORITY": {
        if (action.priority) {
          card.priority = action.priority;
        }
        break;
      }

      case "MOVE_CARD_TO_COLUMN": {
        let targetCol = board.columns.find(
          (c) => c.id === action.target_column_id
        );
        if (!targetCol && action.target_column_id) {
          targetCol = board.columns.find(
            (c) =>
              c.title.toLowerCase() ===
              action.target_column_id?.toLowerCase()
          );
        }
        if (!targetCol && action.checklist_title) {
          targetCol = board.columns.find(
            (c) =>
              c.title.toLowerCase() ===
              action.checklist_title?.toLowerCase()
          );
        }
        if (!targetCol) {
          targetCol = board.columns.find((c) =>
            c.title.toLowerCase().includes("review")
          );
        }

        if (targetCol) {
          card.column_id = targetCol.id;
          card.position = "a0";
        }
        break;
      }

      case "ADD_CHECKLIST": {
        const title = action.checklist_title || "Checklist";
        const items = (action.checklist_items ?? []).map((itemTitle, idx) => ({
          id: randomUUID(),
          title: itemTitle,
          is_completed: false,
          position: `a${idx}`,
          due_date: null,
          assignee_id: null,
        }));
        const newCl: Checklist = {
          id: randomUUID(),
          title,
          position: `a${card.checklists.length}`,
          items,
        };
        card.checklists = [...card.checklists, newCl];
        break;
      }

      case "POST_COMMENT": {
        const now = new Date().toISOString();
        const content =
          action.comment_text ||
          `🤖 Butler automated action: executed ${rule.name}.`;
        const comment: Comment = {
          id: randomUUID(),
          card_id: card.id,
          author_id: "system_butler",
          author_name: "🤖 Butler Bot",
          author_initials: "BB",
          content,
          created_at: now,
          updated_at: now,
        };
        card.comments = [comment, ...(card.comments ?? [])];
        break;
      }
    }
  }
}
