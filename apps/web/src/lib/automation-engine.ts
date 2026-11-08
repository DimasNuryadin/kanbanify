import {
  AutomationAction,
  AutomationRule,
  Board,
  Card,
  Checklist,
  Comment,
  Priority,
} from "@kinetix/contracts";
import { createDeterministicUuid } from "./mock-data";

export interface ButlerExecutionToast {
  id: string;
  ruleName: string;
  cardTitle: string;
  actionSummary: string;
  timestamp: string;
}

export type AutomationTriggerEvent =
  | {
      type: "WHEN_CARD_MOVED_TO_COLUMN";
      targetColumnId: string;
      targetColumnTitle?: string;
    }
  | { type: "WHEN_CARD_CREATED" }
  | { type: "WHEN_CHECKLIST_COMPLETED"; checklistId?: string }
  | { type: "WHEN_PRIORITY_CHANGED"; priority: Priority }
  | { type: "WHEN_LABEL_ADDED"; labelId: string };

function formatActionSummary(actions: AutomationAction[]): string {
  const parts: string[] = [];
  for (const a of actions) {
    switch (a.type) {
      case "MARK_DUE_DATE_COMPLETE":
        parts.push(
          a.due_complete_value === false
            ? "marked due date incomplete"
            : "marked due date complete"
        );
        break;
      case "ASSIGN_MEMBER":
        parts.push("assigned member");
        break;
      case "ADD_LABEL":
        parts.push("added label");
        break;
      case "SET_PRIORITY":
        parts.push(`set priority ${a.priority ?? ""}`);
        break;
      case "MOVE_CARD_TO_COLUMN":
        parts.push("moved list");
        break;
      case "ADD_CHECKLIST":
        parts.push(`added checklist "${a.checklist_title ?? "Checklist"}"`);
        break;
      case "POST_COMMENT":
        parts.push("posted comment");
        break;
    }
  }
  return parts.join(" • ");
}

export function evaluateAndExecuteAutomations({
  board,
  card,
  event,
}: {
  board: Board;
  card: Card;
  event: AutomationTriggerEvent;
}): {
  updatedCard: Card;
  updatedRules: AutomationRule[];
  newActivities: Board["activities"];
  toasts: ButlerExecutionToast[];
} {
  const activeRules = (board.automation_rules ?? []).filter(
    (rule) => rule.is_enabled
  );
  if (activeRules.length === 0) {
    return {
      updatedCard: card,
      updatedRules: board.automation_rules ?? [],
      newActivities: [],
      toasts: [],
    };
  }

  let mutatedCard = { ...card };
  const mutatedRulesMap = new Map<string, AutomationRule>(
    (board.automation_rules ?? []).map((r) => [r.id, { ...r }])
  );
  const newActivities: Board["activities"] = [];
  const toasts: ButlerExecutionToast[] = [];

  for (const rule of activeRules) {
    let isMatch = false;

    switch (event.type) {
      case "WHEN_CARD_MOVED_TO_COLUMN": {
        if (rule.trigger.type === "WHEN_CARD_MOVED_TO_COLUMN") {
          const matchColId =
            !rule.trigger.column_id ||
            rule.trigger.column_id === event.targetColumnId;
          const matchTitle =
            !rule.trigger.column_title_match ||
            (event.targetColumnTitle &&
              event.targetColumnTitle
                .toLowerCase()
                .includes(rule.trigger.column_title_match.toLowerCase()));

          if (matchColId && matchTitle) {
            isMatch = true;
          }
        }
        break;
      }
      case "WHEN_CARD_CREATED": {
        if (rule.trigger.type === "WHEN_CARD_CREATED") {
          isMatch = true;
        }
        break;
      }
      case "WHEN_CHECKLIST_COMPLETED": {
        if (rule.trigger.type === "WHEN_CHECKLIST_COMPLETED") {
          isMatch = true;
        }
        break;
      }
      case "WHEN_PRIORITY_CHANGED": {
        if (rule.trigger.type === "WHEN_PRIORITY_CHANGED") {
          if (
            !rule.trigger.priority ||
            rule.trigger.priority === event.priority
          ) {
            isMatch = true;
          }
        }
        break;
      }
      case "WHEN_LABEL_ADDED": {
        if (rule.trigger.type === "WHEN_LABEL_ADDED") {
          if (
            !rule.trigger.label_id ||
            rule.trigger.label_id === event.labelId
          ) {
            isMatch = true;
          }
        }
        break;
      }
    }

    if (isMatch) {
      // Execute each action in the rule sequentially
      for (const action of rule.actions) {
        switch (action.type) {
          case "MARK_DUE_DATE_COMPLETE": {
            mutatedCard.is_due_complete = action.due_complete_value ?? true;
            break;
          }
          case "ASSIGN_MEMBER": {
            if (action.member_id) {
              const currentMembers = new Set(mutatedCard.member_ids ?? []);
              currentMembers.add(action.member_id);
              mutatedCard.member_ids = Array.from(currentMembers);
            }
            break;
          }
          case "ADD_LABEL": {
            if (action.label_id) {
              const currentLabels = new Set(mutatedCard.label_ids ?? []);
              currentLabels.add(action.label_id);
              mutatedCard.label_ids = Array.from(currentLabels);
            }
            break;
          }
          case "SET_PRIORITY": {
            if (action.priority) {
              mutatedCard.priority = action.priority;
            }
            break;
          }
          case "MOVE_CARD_TO_COLUMN": {
            if (action.target_column_id) {
              mutatedCard.column_id = action.target_column_id;
            }
            break;
          }
          case "ADD_CHECKLIST": {
            const newChecklist: Checklist = {
              id: createDeterministicUuid(),
              title: action.checklist_title || "Checklist",
              position: "a0",
              items: (action.checklist_items ?? []).map((title, idx) => ({
                id: createDeterministicUuid(),
                title,
                is_completed: false,
                position: `a${idx}`,
                due_date: null,
                assignee_id: null,
              })),
            };
            mutatedCard.checklists = [
              ...(mutatedCard.checklists ?? []),
              newChecklist,
            ];
            break;
          }
          case "POST_COMMENT": {
            if (action.comment_text) {
              const now = new Date().toISOString();
              const butlerComment: Comment = {
                id: createDeterministicUuid(),
                card_id: mutatedCard.id,
                author_id: "system_butler",
                author_name: "Kinetix Butler",
                author_initials: "KB",
                content: action.comment_text,
                created_at: now,
                updated_at: now,
              };
              mutatedCard.comments = [
                ...(mutatedCard.comments ?? []),
                butlerComment,
              ];
            }
            break;
          }
        }
      }

      // Update rule telemetry
      const ruleToUpdate = mutatedRulesMap.get(rule.id);
      if (ruleToUpdate) {
        ruleToUpdate.execution_count = (ruleToUpdate.execution_count ?? 0) + 1;
        ruleToUpdate.last_triggered_at = new Date().toISOString();
        mutatedRulesMap.set(rule.id, ruleToUpdate);
      }

      // Append Activity trail
      newActivities.push({
        id: createDeterministicUuid(),
        board_id: board.id,
        card_id: mutatedCard.id,
        actor_name: "Kinetix Butler",
        action_type: "AUTOMATION_TRIGGERED",
        is_automated: true,
        description: `🤖 Butler executed rule '${rule.name}' on '${mutatedCard.title}'`,
        created_at: new Date().toISOString(),
      });

      // Push Toast Notification
      toasts.push({
        id: createDeterministicUuid(),
        ruleName: rule.name,
        cardTitle: mutatedCard.title,
        actionSummary: formatActionSummary(rule.actions),
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      });
    }
  }

  mutatedCard.updated_at = new Date().toISOString();

  return {
    updatedCard: mutatedCard,
    updatedRules: Array.from(mutatedRulesMap.values()),
    newActivities,
    toasts,
  };
}
