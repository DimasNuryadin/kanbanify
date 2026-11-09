"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Layers,
  MessageSquare,
  Plus,
  RotateCcw,
  Sparkles,
  Tag,
  Trash2,
  User,
  X,
  Zap,
} from "lucide-react";
import {
  AutomationAction,
  AutomationActionType,
  AutomationRule,
  AutomationTrigger,
  AutomationTriggerType,
  Board,
  CreateAutomationRuleRequest,
  Priority,
  UpdateAutomationRuleRequest,
} from "@kinetix/contracts";
import { useWorkspaceStore } from "@/store/workspace-store";

interface ButlerAutomationModalProps {
  board: Board;
  onCreateRule: (payload: CreateAutomationRuleRequest) => Promise<void>;
  onUpdateRule: (ruleId: string, payload: UpdateAutomationRuleRequest) => Promise<void>;
  onDeleteRule: (ruleId: string) => Promise<void>;
  onAiGenerateRule: (prompt: string) => Promise<{
    id?: string;
    name: string;
    description: string;
    trigger: AutomationTrigger;
    actions: AutomationAction[];
  }>;
}

export function ButlerAutomationModal({
  board,
  onCreateRule,
  onUpdateRule,
  onDeleteRule,
  onAiGenerateRule,
}: ButlerAutomationModalProps) {
  const isOpen = useWorkspaceStore((s) => s.isAutomationModalOpen);
  const setOpen = useWorkspaceStore((s) => s.setAutomationModalOpen);
  const rules = useWorkspaceStore((s) => s.automationRules);

  const [activeTab, setActiveTab] = useState<"rules" | "ai" | "visual">("rules");

  // AI Builder state
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiGeneratedPreview, setAiGeneratedPreview] = useState<{
    id?: string;
    name: string;
    description: string;
    trigger: AutomationTrigger;
    actions: AutomationAction[];
  } | null>(null);

  // Visual Builder state
  const [ruleName, setRuleName] = useState("");
  const [ruleDescription, setRuleDescription] = useState("");
  const [triggerType, setTriggerType] =
    useState<AutomationTriggerType>("WHEN_CARD_MOVED_TO_COLUMN");
  const [triggerColId, setTriggerColId] = useState<string>(
    board.columns[board.columns.length - 1]?.id ?? ""
  );
  const [triggerPriority, setTriggerPriority] = useState<Priority>("URGENT");
  const [triggerLabelId, setTriggerLabelId] = useState<string>(
    board.labels[0]?.id ?? ""
  );

  const [actionList, setActionList] = useState<AutomationAction[]>([]);
  const [pendingActionType, setPendingActionType] =
    useState<AutomationActionType>("MARK_DUE_DATE_COMPLETE");
  const [pendingMemberId, setPendingMemberId] = useState<string>(
    board.members[0]?.id ?? ""
  );
  const [pendingLabelId, setPendingLabelId] = useState<string>(
    board.labels[0]?.id ?? ""
  );
  const [pendingPriority, setPendingPriority] = useState<Priority>("HIGH");
  const [pendingTargetColId, setPendingTargetColId] = useState<string>(
    board.columns[0]?.id ?? ""
  );
  const [pendingChecklistTitle, setPendingChecklistTitle] =
    useState<string>("Acceptance Criteria");
  const [pendingChecklistItems, setPendingChecklistItems] = useState<string>(
    "Unit tests pass, Peer review completed"
  );
  const [pendingCommentText, setPendingCommentText] = useState<string>(
    "🤖 Butler automated: Card updated automatically."
  );

  if (!isOpen) return null;

  const activeCount = rules.filter((r) => r.is_enabled).length;

  const handleGenerateAi = async () => {
    const trimmed = aiPrompt.trim();
    if (!trimmed || isGeneratingAi) return;

    try {
      setIsGeneratingAi(true);
      const parsed = await onAiGenerateRule(trimmed);
      setAiGeneratedPreview(parsed);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleSaveAiGenerated = async () => {
    if (!aiGeneratedPreview) return;
    if (!aiGeneratedPreview.id) {
      await onCreateRule({
        name: aiGeneratedPreview.name,
        description: aiGeneratedPreview.description,
        is_enabled: true,
        trigger: aiGeneratedPreview.trigger,
        actions: aiGeneratedPreview.actions,
      });
    }
    setAiGeneratedPreview(null);
    setAiPrompt("");
    setActiveTab("rules");
  };

  const handleDiscardAiGenerated = async () => {
    if (aiGeneratedPreview?.id) {
      await onDeleteRule(aiGeneratedPreview.id);
    }
    setAiGeneratedPreview(null);
  };

  const handleAddVisualAction = () => {
    let action: AutomationAction;
    switch (pendingActionType) {
      case "MARK_DUE_DATE_COMPLETE":
        action = {
          type: "MARK_DUE_DATE_COMPLETE",
          due_complete_value: true,
          member_id: null,
          label_id: null,
          priority: null,
          target_column_id: null,
          checklist_title: null,
          checklist_items: null,
          comment_text: null,
        };
        break;
      case "ASSIGN_MEMBER":
        action = {
          type: "ASSIGN_MEMBER",
          member_id: pendingMemberId,
          label_id: null,
          priority: null,
          target_column_id: null,
          checklist_title: null,
          checklist_items: null,
          comment_text: null,
          due_complete_value: null,
        };
        break;
      case "ADD_LABEL":
        action = {
          type: "ADD_LABEL",
          label_id: pendingLabelId,
          member_id: null,
          priority: null,
          target_column_id: null,
          checklist_title: null,
          checklist_items: null,
          comment_text: null,
          due_complete_value: null,
        };
        break;
      case "SET_PRIORITY":
        action = {
          type: "SET_PRIORITY",
          priority: pendingPriority,
          member_id: null,
          label_id: null,
          target_column_id: null,
          checklist_title: null,
          checklist_items: null,
          comment_text: null,
          due_complete_value: null,
        };
        break;
      case "MOVE_CARD_TO_COLUMN":
        action = {
          type: "MOVE_CARD_TO_COLUMN",
          target_column_id: pendingTargetColId,
          member_id: null,
          label_id: null,
          priority: null,
          checklist_title: null,
          checklist_items: null,
          comment_text: null,
          due_complete_value: null,
        };
        break;
      case "ADD_CHECKLIST":
        action = {
          type: "ADD_CHECKLIST",
          checklist_title: pendingChecklistTitle.trim() || "Checklist",
          checklist_items: pendingChecklistItems
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          member_id: null,
          label_id: null,
          priority: null,
          target_column_id: null,
          comment_text: null,
          due_complete_value: null,
        };
        break;
      case "POST_COMMENT":
        action = {
          type: "POST_COMMENT",
          comment_text: pendingCommentText.trim(),
          member_id: null,
          label_id: null,
          priority: null,
          target_column_id: null,
          checklist_title: null,
          checklist_items: null,
          due_complete_value: null,
        };
        break;
    }
    setActionList([...actionList, action]);
  };

  const handleSaveVisualRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim() || actionList.length === 0) return;

    let trigger: AutomationTrigger;
    switch (triggerType) {
      case "WHEN_CARD_MOVED_TO_COLUMN": {
        const col = board.columns.find((c) => c.id === triggerColId);
        trigger = {
          type: "WHEN_CARD_MOVED_TO_COLUMN",
          column_id: triggerColId,
          column_title_match: col?.title ?? null,
          priority: null,
          label_id: null,
        };
        break;
      }
      case "WHEN_CARD_CREATED":
        trigger = {
          type: "WHEN_CARD_CREATED",
          column_id: null,
          column_title_match: null,
          priority: null,
          label_id: null,
        };
        break;
      case "WHEN_CHECKLIST_COMPLETED":
        trigger = {
          type: "WHEN_CHECKLIST_COMPLETED",
          column_id: null,
          column_title_match: null,
          priority: null,
          label_id: null,
        };
        break;
      case "WHEN_PRIORITY_CHANGED":
        trigger = {
          type: "WHEN_PRIORITY_CHANGED",
          priority: triggerPriority,
          column_id: null,
          column_title_match: null,
          label_id: null,
        };
        break;
      case "WHEN_LABEL_ADDED":
        trigger = {
          type: "WHEN_LABEL_ADDED",
          label_id: triggerLabelId,
          column_id: null,
          column_title_match: null,
          priority: null,
        };
        break;
    }

    await onCreateRule({
      name: ruleName.trim(),
      description: ruleDescription.trim(),
      is_enabled: true,
      trigger,
      actions: actionList,
    });

    setRuleName("");
    setRuleDescription("");
    setActionList([]);
    setActiveTab("rules");
  };

  const handleApplyPreset = async (presetType: "done" | "review" | "urgent") => {
    const doneCol = board.columns.find((c) =>
      c.title.toLowerCase().includes("done")
    ) || board.columns[board.columns.length - 1];

    const reviewCol = board.columns.find((c) =>
      c.title.toLowerCase().includes("review")
    ) || board.columns[1] || doneCol;

    const shipReadyLabel = board.labels.find(
      (l) => l.color === "green" || l.name.toLowerCase().includes("ready")
    ) || board.labels[0];

    const blockerLabel = board.labels.find(
      (l) => l.color === "red" || l.name.toLowerCase().includes("block")
    ) || board.labels[board.labels.length - 1] || board.labels[0];

    const leadMember = board.members[0];

    if (presetType === "done") {
      await onCreateRule({
        name: "Auto-Complete on Done",
        description:
          "When card moved to Done, mark due date complete, attach Ship Ready label, and post comment",
        is_enabled: true,
        trigger: {
          type: "WHEN_CARD_MOVED_TO_COLUMN",
          column_id: doneCol?.id ?? null,
          column_title_match: doneCol?.title ?? "Done",
          priority: null,
          label_id: null,
        },
        actions: [
          {
            type: "MARK_DUE_DATE_COMPLETE",
            due_complete_value: true,
            member_id: null,
            label_id: null,
            priority: null,
            target_column_id: null,
            checklist_title: null,
            checklist_items: null,
            comment_text: null,
          },
          ...(shipReadyLabel
            ? [
                {
                  type: "ADD_LABEL" as const,
                  label_id: shipReadyLabel.id,
                  member_id: null,
                  priority: null,
                  target_column_id: null,
                  checklist_title: null,
                  checklist_items: null,
                  comment_text: null,
                  due_complete_value: null,
                },
              ]
            : []),
          {
            type: "POST_COMMENT",
            comment_text:
              "🤖 Butler automated: Card marked complete on move to Done.",
            member_id: null,
            label_id: null,
            priority: null,
            target_column_id: null,
            checklist_title: null,
            checklist_items: null,
            due_complete_value: null,
          },
        ],
      });
    } else if (presetType === "review") {
      await onCreateRule({
        name: "Auto-Move to Review when Checklist 100%",
        description:
          "When checklist is 100% completed, move card to Review list and set priority to HIGH",
        is_enabled: true,
        trigger: {
          type: "WHEN_CHECKLIST_COMPLETED",
          column_id: null,
          column_title_match: null,
          priority: null,
          label_id: null,
        },
        actions: [
          {
            type: "MOVE_CARD_TO_COLUMN",
            target_column_id: reviewCol?.id ?? null,
            member_id: null,
            label_id: null,
            priority: null,
            checklist_title: null,
            checklist_items: null,
            comment_text: null,
            due_complete_value: null,
          },
          {
            type: "SET_PRIORITY",
            priority: "HIGH",
            member_id: null,
            label_id: null,
            target_column_id: null,
            checklist_title: null,
            checklist_items: null,
            comment_text: null,
            due_complete_value: null,
          },
          {
            type: "POST_COMMENT",
            comment_text:
              "🤖 Butler automated: Checklist 100% finished — card routed to Review.",
            member_id: null,
            label_id: null,
            priority: null,
            target_column_id: null,
            checklist_title: null,
            checklist_items: null,
            due_complete_value: null,
          },
        ],
      });
    } else if (presetType === "urgent") {
      await onCreateRule({
        name: "Urgent Card Escalation",
        description:
          "When card priority is set to URGENT, auto-assign lead member and add Blocker label",
        is_enabled: true,
        trigger: {
          type: "WHEN_PRIORITY_CHANGED",
          priority: "URGENT",
          column_id: null,
          column_title_match: null,
          label_id: null,
        },
        actions: [
          ...(leadMember
            ? [
                {
                  type: "ASSIGN_MEMBER" as const,
                  member_id: leadMember.id,
                  label_id: null,
                  priority: null,
                  target_column_id: null,
                  checklist_title: null,
                  checklist_items: null,
                  comment_text: null,
                  due_complete_value: null,
                },
              ]
            : []),
          ...(blockerLabel
            ? [
                {
                  type: "ADD_LABEL" as const,
                  label_id: blockerLabel.id,
                  member_id: null,
                  priority: null,
                  target_column_id: null,
                  checklist_title: null,
                  checklist_items: null,
                  comment_text: null,
                  due_complete_value: null,
                },
              ]
            : []),
          {
            type: "POST_COMMENT",
            comment_text:
              "🤖 Butler automated: Urgent card escalated to team lead with Blocker label.",
            member_id: null,
            label_id: null,
            priority: null,
            target_column_id: null,
            checklist_title: null,
            checklist_items: null,
            due_complete_value: null,
          },
        ],
      });
    }
  };

  const samplePrompts = [
    "When a card is moved to Done, mark due date complete, assign to Alex, and add Green label",
    "Saat checklist selesai 100%, pindahkan kartu ke kolom Review",
    "When priority changed to URGENT, assign Alex Rivera and add Blocker label",
    "When card is created, set priority to HIGH and add Quality Review checklist",
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in-0">
      <div className="flex h-[92vh] max-h-[760px] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-zinc-200/80 p-5 dark:border-zinc-800/80">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/20 via-violet-500/15 to-transparent text-indigo-600 shadow-xs dark:text-indigo-400">
              <Zap className="h-5 w-5 fill-indigo-500/30" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Kanbanify Butler Automation Center
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                  <Bot className="h-2.5 w-2.5" />
                  {activeCount} active rules
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Rule engine with real-time optimistic execution, AI natural language parsing, and audit trails
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-zinc-200/60 bg-zinc-50 px-5 py-2.5 dark:border-zinc-850 dark:bg-zinc-900/60">
          <button
            type="button"
            onClick={() => setActiveTab("rules")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              activeTab === "rules"
                ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100"
                : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            <span>Active Rules ({rules.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("ai")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              activeTab === "ai"
                ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100"
                : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
            <span>✨ AI Rule Builder</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("visual")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              activeTab === "visual"
                ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100"
                : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            <Layers className="h-3.5 w-3.5 text-violet-500" />
            <span>Visual Builder</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === "rules" && (
            <div className="space-y-6">
              {/* Active Rules List */}
              <div>
                <div className="flex items-center justify-between pb-2">
                  <h3 className="text-xs font-bold tracking-wider text-zinc-400 uppercase dark:text-zinc-500">
                    Configured Rules on This Board
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab("visual")}
                    className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Create Custom Rule</span>
                  </button>
                </div>

                {rules.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-800">
                    <Zap className="h-8 w-8 text-zinc-400" />
                    <p className="mt-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                      No automation rules configured yet
                    </p>
                    <p className="mt-1 max-w-sm text-xs text-zinc-500">
                      Try generating a rule with plain English/Indonesian or choose a 1-click preset below.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {rules.map((rule) => {
                      return (
                        <div
                          key={rule.id}
                          className="flex flex-col justify-between gap-3 rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-4 transition-all hover:border-zinc-300 dark:border-zinc-800/80 dark:bg-zinc-900/60 dark:hover:border-zinc-700"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                                  {rule.name}
                                </h4>

                                <span
                                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold ${
                                    rule.is_enabled
                                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                      : "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                                  }`}
                                >
                                  {rule.is_enabled ? "Active" : "Disabled"}
                                </span>

                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                                  ⚡ Triggered {rule.execution_count} times
                                </span>
                              </div>

                              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                                {rule.description}
                              </p>
                            </div>

                            {/* Enable/Disable Toggle Switch & Delete */}
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdateRule(rule.id, {
                                    is_enabled: !rule.is_enabled,
                                  })
                                }
                                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                  rule.is_enabled ? "bg-indigo-600" : "bg-zinc-300 dark:bg-zinc-700"
                                }`}
                              >
                                <span
                                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                                    rule.is_enabled ? "translate-x-4" : "translate-x-0"
                                  }`}
                                />
                              </button>

                              <button
                                type="button"
                                onClick={() => onDeleteRule(rule.id)}
                                title="Delete Rule"
                                className="rounded p-1 text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Human-Readable Pipeline Badge Chain */}
                          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-200/50 dark:border-zinc-800/50 text-xs">
                            <span className="inline-flex items-center gap-1 rounded-md bg-zinc-200/80 px-2 py-1 font-mono text-[11px] font-semibold text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                              WHEN: {formatTriggerHuman(rule.trigger, board)}
                            </span>

                            <ArrowRight className="h-3 w-3 text-zinc-400" />

                            {rule.actions.map((action, idx) => (
                              <span
                                key={`act-${idx}`}
                                className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-1 font-mono text-[11px] font-semibold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"
                              >
                                {formatActionHuman(action, board)}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 1-Click Preset Automation Templates */}
              <div className="pt-4 border-t border-zinc-200/80 dark:border-zinc-800/80">
                <h3 className="text-xs font-bold tracking-wider text-zinc-400 uppercase dark:text-zinc-500">
                  1-Click Preset Automation Templates
                </h3>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="flex flex-col justify-between rounded-xl border border-zinc-200/80 bg-white p-3.5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900/80">
                    <div>
                      <div className="flex items-center gap-1.5 font-bold text-xs text-zinc-900 dark:text-zinc-100">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        <span>Auto-Complete on Done</span>
                      </div>
                      <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                        When a card moves to Done, mark due date complete, add Ship Ready label, and post activity comment.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset("done")}
                      className="mt-3 flex items-center justify-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Add Preset</span>
                    </button>
                  </div>

                  <div className="flex flex-col justify-between rounded-xl border border-zinc-200/80 bg-white p-3.5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900/80">
                    <div>
                      <div className="flex items-center gap-1.5 font-bold text-xs text-zinc-900 dark:text-zinc-100">
                        <ArrowRight className="h-4 w-4 text-indigo-500" />
                        <span>Checklist 100% Pipeline</span>
                      </div>
                      <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                        When all items in a card checklist are completed, auto-move the card to the Review list with High priority.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset("review")}
                      className="mt-3 flex items-center justify-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Add Preset</span>
                    </button>
                  </div>

                  <div className="flex flex-col justify-between rounded-xl border border-zinc-200/80 bg-white p-3.5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900/80">
                    <div>
                      <div className="flex items-center gap-1.5 font-bold text-xs text-zinc-900 dark:text-zinc-100">
                        <AlertTriangle className="h-4 w-4 text-rose-500" />
                        <span>Urgent Card Triage</span>
                      </div>
                      <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                        When priority is set to Urgent, assign lead engineer, add Blocker label, and record audit trail.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset("urgent")}
                      className="mt-3 flex items-center justify-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Add Preset</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "ai" && (
            <div className="space-y-5">
              {/* Top Banner */}
              <div className="rounded-xl border border-indigo-500/20 bg-gradient-to-r from-indigo-500/10 via-violet-500/10 to-transparent p-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-indigo-500 animate-pulse" />
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    ✨ AI Natural Language Rule Builder
                  </h3>
                </div>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Type instructions in plain English or Indonesian. Butler uses semantic parsing to map triggers to your columns, members, and labels.
                </p>

                {/* Prompt Textarea */}
                <div className="mt-3">
                  <textarea
                    rows={3}
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="e.g. When a card is moved to Done, mark due date complete, assign to Alex, and add Green label..."
                    className="w-full rounded-xl border border-zinc-300 bg-white p-3 text-xs text-zinc-900 placeholder-zinc-400 shadow-2xs focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  />
                </div>

                {/* Sample Prompt Chips */}
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-semibold text-zinc-400 uppercase">
                    Try asking:
                  </span>
                  {samplePrompts.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setAiPrompt(p)}
                      className="rounded-md border border-zinc-200/80 bg-white/80 px-2 py-0.5 text-[11px] text-zinc-600 transition-colors hover:bg-white hover:text-indigo-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:text-indigo-300"
                    >
                      &quot;{p.slice(0, 36)}...&quot;
                    </button>
                  ))}
                </div>

                {/* Generate Button */}
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    disabled={!aiPrompt.trim() || isGeneratingAi}
                    onClick={handleGenerateAi}
                    className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-indigo-500 disabled:opacity-50"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>{isGeneratingAi ? "Synthesizing Rule..." : "Generate Rule with AI"}</span>
                  </button>
                </div>
              </div>

              {/* Generated Result Preview */}
              {aiGeneratedPreview && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/20 p-4 animate-in fade-in-0 dark:border-emerald-400/30 dark:bg-emerald-950/20">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold tracking-wider text-emerald-600 dark:text-emerald-400 uppercase">
                      <Check className="h-3 w-3" />
                      Parsed Rule Ready
                    </span>
                    <button
                      type="button"
                      onClick={() => setAiGeneratedPreview(null)}
                      className="text-zinc-400 hover:text-zinc-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <h4 className="mt-2 text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    {aiGeneratedPreview.name}
                  </h4>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    {aiGeneratedPreview.description}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-md bg-zinc-200/80 px-2 py-1 font-mono text-[11px] font-semibold text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                      WHEN: {formatTriggerHuman(aiGeneratedPreview.trigger, board)}
                    </span>
                    <ArrowRight className="h-3 w-3 text-zinc-400" />
                    {aiGeneratedPreview.actions.map((act, i) => (
                      <span
                        key={i}
                        className="rounded-md bg-indigo-50 px-2 py-1 font-mono text-[11px] font-semibold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"
                      >
                        {formatActionHuman(act, board)}
                      </span>
                    ))}
                  </div>

                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={handleDiscardAiGenerated}
                      className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-400"
                    >
                      Discard
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveAiGenerated}
                      className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-500"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>Save & Activate Rule</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "visual" && (
            <form onSubmit={handleSaveVisualRule} className="space-y-5">
              {/* Rule Name & Description */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Rule Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={ruleName}
                    onChange={(e) => setRuleName(e.target.value)}
                    placeholder="e.g. Escalate Urgent Bugs"
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 placeholder-zinc-400 focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Description (Optional)
                  </label>
                  <input
                    type="text"
                    value={ruleDescription}
                    onChange={(e) => setRuleDescription(e.target.value)}
                    placeholder="Brief explanation of when and why this rule fires"
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 placeholder-zinc-400 focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              {/* Step 1: Trigger */}
              <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
                <span className="inline-flex items-center gap-1 rounded bg-zinc-200 px-2 py-0.5 text-[10px] font-bold text-zinc-700 uppercase dark:bg-zinc-800 dark:text-zinc-300">
                  Step 1: Choose Trigger
                </span>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-500">
                      When this happens:
                    </label>
                    <select
                      value={triggerType}
                      onChange={(e) =>
                        setTriggerType(e.target.value as AutomationTriggerType)
                      }
                      className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    >
                      <option value="WHEN_CARD_MOVED_TO_COLUMN">
                        Card is moved to a list
                      </option>
                      <option value="WHEN_CARD_CREATED">A new card is created</option>
                      <option value="WHEN_CHECKLIST_COMPLETED">
                        All checklist items are completed (100%)
                      </option>
                      <option value="WHEN_PRIORITY_CHANGED">
                        Card priority changes to...
                      </option>
                      <option value="WHEN_LABEL_ADDED">A label is attached</option>
                    </select>
                  </div>

                  {triggerType === "WHEN_CARD_MOVED_TO_COLUMN" && (
                    <div>
                      <label className="block text-[11px] font-medium text-zinc-500">
                        Target List:
                      </label>
                      <select
                        value={triggerColId}
                        onChange={(e) => setTriggerColId(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                      >
                        {board.columns.map((col) => (
                          <option key={col.id} value={col.id}>
                            {col.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {triggerType === "WHEN_PRIORITY_CHANGED" && (
                    <div>
                      <label className="block text-[11px] font-medium text-zinc-500">
                        Priority value:
                      </label>
                      <select
                        value={triggerPriority}
                        onChange={(e) =>
                          setTriggerPriority(e.target.value as Priority)
                        }
                        className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                      >
                        <option value="LOW">LOW</option>
                        <option value="MEDIUM">MEDIUM</option>
                        <option value="HIGH">HIGH</option>
                        <option value="URGENT">URGENT</option>
                      </select>
                    </div>
                  )}

                  {triggerType === "WHEN_LABEL_ADDED" && (
                    <div>
                      <label className="block text-[11px] font-medium text-zinc-500">
                        Label attached:
                      </label>
                      <select
                        value={triggerLabelId}
                        onChange={(e) => setTriggerLabelId(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                      >
                        {board.labels.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name} ({l.color})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Step 2: Actions Chain */}
              <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 rounded bg-indigo-500/20 px-2 py-0.5 text-[10px] font-bold text-indigo-700 uppercase dark:text-indigo-300">
                    Step 2: Chained Actions ({actionList.length})
                  </span>
                </div>

                {/* Added actions list */}
                {actionList.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {actionList.map((action, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] font-semibold text-zinc-400">
                            Action {idx + 1}:
                          </span>
                          <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                            {formatActionHuman(action, board)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setActionList(actionList.filter((_, i) => i !== idx))
                          }
                          className="rounded p-0.5 text-zinc-400 hover:text-rose-500"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add new action builder */}
                <div className="mt-3 grid grid-cols-1 gap-2.5 rounded-lg border border-dashed border-zinc-300 p-3 sm:grid-cols-3 dark:border-zinc-700">
                  <div className="sm:col-span-1">
                    <label className="block text-[11px] font-medium text-zinc-500">
                      Add action type:
                    </label>
                    <select
                      value={pendingActionType}
                      onChange={(e) =>
                        setPendingActionType(
                          e.target.value as AutomationActionType
                        )
                      }
                      className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    >
                      <option value="MARK_DUE_DATE_COMPLETE">
                        Mark Due Date Complete
                      </option>
                      <option value="ASSIGN_MEMBER">Assign Team Member</option>
                      <option value="ADD_LABEL">Add Board Label</option>
                      <option value="SET_PRIORITY">Set Card Priority</option>
                      <option value="MOVE_CARD_TO_COLUMN">
                        Move Card to List
                      </option>
                      <option value="ADD_CHECKLIST">Add Checklist</option>
                      <option value="POST_COMMENT">Post Butler Comment</option>
                    </select>
                  </div>

                  {/* Sub-inputs depending on action type */}
                  <div className="sm:col-span-2 flex items-end gap-2">
                    {pendingActionType === "ASSIGN_MEMBER" && (
                      <div className="flex-1">
                        <label className="block text-[11px] font-medium text-zinc-500">
                          Member:
                        </label>
                        <select
                          value={pendingMemberId}
                          onChange={(e) => setPendingMemberId(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                        >
                          {board.members.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name} ({m.email})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {pendingActionType === "ADD_LABEL" && (
                      <div className="flex-1">
                        <label className="block text-[11px] font-medium text-zinc-500">
                          Label:
                        </label>
                        <select
                          value={pendingLabelId}
                          onChange={(e) => setPendingLabelId(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                        >
                          {board.labels.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.name} ({l.color})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {pendingActionType === "SET_PRIORITY" && (
                      <div className="flex-1">
                        <label className="block text-[11px] font-medium text-zinc-500">
                          Priority:
                        </label>
                        <select
                          value={pendingPriority}
                          onChange={(e) =>
                            setPendingPriority(e.target.value as Priority)
                          }
                          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                        >
                          <option value="LOW">LOW</option>
                          <option value="MEDIUM">MEDIUM</option>
                          <option value="HIGH">HIGH</option>
                          <option value="URGENT">URGENT</option>
                        </select>
                      </div>
                    )}

                    {pendingActionType === "MOVE_CARD_TO_COLUMN" && (
                      <div className="flex-1">
                        <label className="block text-[11px] font-medium text-zinc-500">
                          Destination List:
                        </label>
                        <select
                          value={pendingTargetColId}
                          onChange={(e) =>
                            setPendingTargetColId(e.target.value)
                          }
                          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                        >
                          {board.columns.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.title}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {pendingActionType === "ADD_CHECKLIST" && (
                      <div className="flex-1">
                        <label className="block text-[11px] font-medium text-zinc-500">
                          Title & comma-separated items:
                        </label>
                        <input
                          type="text"
                          value={pendingChecklistTitle}
                          onChange={(e) =>
                            setPendingChecklistTitle(e.target.value)
                          }
                          placeholder="Checklist Title"
                          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                        />
                      </div>
                    )}

                    {pendingActionType === "POST_COMMENT" && (
                      <div className="flex-1">
                        <label className="block text-[11px] font-medium text-zinc-500">
                          Comment Text:
                        </label>
                        <input
                          type="text"
                          value={pendingCommentText}
                          onChange={(e) => setPendingCommentText(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                        />
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleAddVisualAction}
                      className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500"
                    >
                      + Add
                    </button>
                  </div>
                </div>
              </div>

              {/* Submit */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("rules")}
                  className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!ruleName.trim() || actionList.length === 0}
                  className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Save Automation Rule</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function formatTriggerHuman(
  trigger: AutomationTrigger,
  board: Board
): string {
  switch (trigger.type) {
    case "WHEN_CARD_MOVED_TO_COLUMN": {
      const col = board.columns.find((c) => c.id === trigger.column_id);
      return `Card moved to "${col?.title ?? trigger.column_title_match ?? "List"}"`;
    }
    case "WHEN_CARD_CREATED":
      return "Card created in board";
    case "WHEN_CHECKLIST_COMPLETED":
      return "Checklist completed 100%";
    case "WHEN_PRIORITY_CHANGED":
      return `Priority changed to ${trigger.priority ?? "any"}`;
    case "WHEN_LABEL_ADDED": {
      const label = board.labels.find((l) => l.id === trigger.label_id);
      return `Label "${label?.name ?? "tag"}" attached`;
    }
    default:
      return "Trigger event";
  }
}

function formatActionHuman(action: AutomationAction, board: Board): string {
  switch (action.type) {
    case "MARK_DUE_DATE_COMPLETE":
      return action.due_complete_value === false
        ? "Mark due date incomplete"
        : "Mark due date complete";
    case "ASSIGN_MEMBER": {
      const member = board.members.find((m) => m.id === action.member_id);
      return `Assign ${member?.name ?? "Member"}`;
    }
    case "ADD_LABEL": {
      const label = board.labels.find((l) => l.id === action.label_id);
      return `Add label "${label?.name ?? label?.color ?? "label"}"`;
    }
    case "SET_PRIORITY":
      return `Set priority to ${action.priority ?? "MEDIUM"}`;
    case "MOVE_CARD_TO_COLUMN": {
      const col = board.columns.find((c) => c.id === action.target_column_id);
      return `Move to "${col?.title ?? "List"}"`;
    }
    case "ADD_CHECKLIST":
      return `Add checklist "${action.checklist_title ?? "Checklist"}"`;
    case "POST_COMMENT":
      return `Post comment: "${action.comment_text?.slice(0, 30) ?? ""}"`;
    default:
      return "Action";
  }
}
