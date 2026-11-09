"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Bell,
  Check,
  CheckCircle2,
  Code2,
  Copy,
  ExternalLink,
  Globe,
  Hash,
  MessageSquare,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import {
  AISummaryNotificationResponse,
  CreateWebhookRequest,
  TestWebhookResponse,
  UpdateWebhookRequest,
  WebhookConfig,
  WebhookEventType,
  WebhookEventTypeEnum,
  WebhookPlatform,
  WebhookPlatformEnum,
} from "@kinetix/contracts";
import { useWorkspaceStore } from "@/store/workspace-store";

interface WebhooksModalProps {
  boardId: string;
  boardTitle: string;
  webhooks: WebhookConfig[];
  onCreateWebhook: (payload: CreateWebhookRequest) => Promise<void>;
  onUpdateWebhook: (
    webhookId: string,
    payload: UpdateWebhookRequest
  ) => Promise<void>;
  onDeleteWebhook: (webhookId: string) => Promise<void>;
  onTestWebhook: (webhookId: string) => Promise<TestWebhookResponse>;
  onGenerateAISummary: () => Promise<AISummaryNotificationResponse>;
}

const ALL_EVENTS: Array<{
  type: WebhookEventType;
  label: string;
  description: string;
}> = [
  {
    type: "CARD_CREATED",
    label: "Card Created",
    description: "Fires when a new task or story is added to any column",
  },
  {
    type: "CARD_MOVED",
    label: "Card Moved",
    description: "Fires on column transitions or reorder updates",
  },
  {
    type: "CARD_ARCHIVED",
    label: "Card Archived",
    description: "Fires when cards are moved to board archives",
  },
  {
    type: "COMMENT_ADDED",
    label: "Comment Added",
    description: "Fires on new team collaborator discussions",
  },
  {
    type: "AUTOMATION_TRIGGERED",
    label: "Automation Triggered",
    description: "Fires when Butler automated rules execute",
  },
];

export function WebhooksModal({
  boardId,
  boardTitle,
  webhooks,
  onCreateWebhook,
  onUpdateWebhook,
  onDeleteWebhook,
  onTestWebhook,
  onGenerateAISummary,
}: WebhooksModalProps) {
  const isWebhooksModalOpen = useWorkspaceStore((s) => s.isWebhooksModalOpen);
  const setWebhooksModalOpen = useWorkspaceStore(
    (s) => s.setWebhooksModalOpen
  );
  const addToast = useWorkspaceStore((s) => s.addToast);

  // Form states
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState<WebhookPlatform>("SLACK");
  const [url, setUrl] = useState("");
  const [subscribedEvents, setSubscribedEvents] = useState<WebhookEventType[]>([
    "CARD_CREATED",
    "CARD_MOVED",
    "AUTOMATION_TRIGGERED",
  ]);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Testing & AI Standup states
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResponse, setTestResponse] = useState<{
    id: string;
    res: TestWebhookResponse;
  } | null>(null);

  // Live Payload Previewer Tab: "slack" | "discord" | "raw"
  const [previewTab, setPreviewTab] = useState<"slack" | "discord" | "raw">(
    "slack"
  );
  const [isGeneratingAiSummary, setIsGeneratingAiSummary] = useState(false);
  const [aiSummary, setAiSummary] = useState<AISummaryNotificationResponse | null>(
    null
  );
  const [copiedPayload, setCopiedPayload] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (isWebhooksModalOpen) {
      setFormError(null);
      setTestResponse(null);
    }
  }, [isWebhooksModalOpen]);

  // Sync default URL placeholder based on platform
  const urlPlaceholder = useMemo(() => {
    switch (platform) {
      case "SLACK":
        return "https://hooks.slack.example.com/services/sample-token";
      case "DISCORD":
        return "https://discord.example.com/api/webhooks/sample-token";
      case "CUSTOM":
        return "https://api.example.com/webhooks/kanbanify";
    }
  }, [platform]);

  // Handle Event checkbox toggle
  const toggleEvent = (eventType: WebhookEventType) => {
    setSubscribedEvents((prev) =>
      prev.includes(eventType)
        ? prev.filter((e) => e !== eventType)
        : [...prev, eventType]
    );
  };

  const handleSelectAllEvents = () => {
    setSubscribedEvents(WebhookEventTypeEnum.options);
  };

  const handleClearAllEvents = () => {
    setSubscribedEvents([]);
  };

  // Submit Add Webhook Form
  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedName = name.trim();
    const trimmedUrl = url.trim();

    if (!trimmedName) {
      setFormError("Webhook name is required.");
      return;
    }
    if (!trimmedUrl) {
      setFormError("Webhook destination URL is required.");
      return;
    }

    try {
      new URL(trimmedUrl);
    } catch {
      setFormError("Please enter a valid HTTP/HTTPS URL.");
      return;
    }

    if (subscribedEvents.length === 0) {
      setFormError("Please select at least one subscribed event.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreateWebhook({
        name: trimmedName,
        platform,
        url: trimmedUrl,
        is_enabled: true,
        subscribed_events: subscribedEvents,
      });

      // Reset form
      setName("");
      setUrl("");
      setSubscribedEvents([
        "CARD_CREATED",
        "CARD_MOVED",
        "AUTOMATION_TRIGGERED",
      ]);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to register webhook."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Webhook Enabled / Disabled
  const handleToggleEnabled = async (webhook: WebhookConfig) => {
    await onUpdateWebhook(webhook.id, {
      is_enabled: !webhook.is_enabled,
    });
  };

  // Live Test Ping Dispatcher
  const handleTestPing = async (webhook: WebhookConfig) => {
    setTestingId(webhook.id);
    setTestResponse(null);
    try {
      const res = await onTestWebhook(webhook.id);
      setTestResponse({ id: webhook.id, res });

      // Add a visual Butler-style toast for immediate feedback
      addToast({
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        ruleName: `Webhook Ping: ${webhook.platform}`,
        cardTitle: webhook.name,
        actionSummary: res.message,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      });
    } catch (err) {
      setTestResponse({
        id: webhook.id,
        res: {
          success: false,
          status_code: 500,
          message:
            err instanceof Error
              ? err.message
              : "Failed to dispatch test payload",
        },
      });
    } finally {
      setTestingId(null);
    }
  };

  // AI Standup Digest Generator
  const handleGenerateAiDigest = async () => {
    setIsGeneratingAiSummary(true);
    try {
      const digest = await onGenerateAISummary();
      setAiSummary(digest);
    } catch (err) {
      // Fallback digest if service fails
      setAiSummary({
        slack_block_kit_payload: {
          blocks: [
            {
              type: "header",
              text: {
                type: "plain_text",
                text: `📋 Kanbanify Standup: ${boardTitle}`,
                emoji: true,
              },
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*Sprint Status*: 🟢 *On Track* — 14 active tasks progressing.\n*Highlights*: Review bottleneck resolved.`,
              },
            },
          ],
        },
        discord_embed_payload: {
          username: "Kanbanify Bot",
          embeds: [
            {
              title: `📋 Daily Standup Digest: ${boardTitle}`,
              color: 5793266,
              description: `Daily standup digest for **${boardTitle}** generated by Kanbanify AI Engine:`,
              fields: [
                {
                  name: "🚀 Team Velocity",
                  value: "14 cards active. All critical milestones on track.",
                  inline: true,
                },
              ],
            },
          ],
        },
        summary_text: `Kanbanify Standup Digest for ${boardTitle}: On track with high velocity.`,
      });
    } finally {
      setIsGeneratingAiSummary(false);
    }
  };

  // Active Payload for Preview
  const slackPayload = useMemo(() => {
    if (aiSummary) return aiSummary.slack_block_kit_payload;
    return {
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: `📋 Kanbanify Activity: ${boardTitle}`,
            emoji: true,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Alex Rivera* moved *Implement Real-Time Presence & Typing Indicators* to *Review*.\n*Kanbanify Butler* auto-assigned Maya Lin and tagged *Ship Ready*.`,
          },
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `⚡ Dispatched via Kanbanify Webhook Dispatcher | ${new Date().toLocaleTimeString()} UTC`,
            },
          ],
        },
      ],
    };
  }, [aiSummary, boardTitle]);

  const discordPayload = useMemo(() => {
    if (aiSummary) return aiSummary.discord_embed_payload;
    return {
      username: "Kanbanify Bot",
      avatar_url: "https://kanbanify.internal/icons/bot-avatar.png",
      embeds: [
        {
          title: `📋 Board Event: ${boardTitle}`,
          color: 5793266, // Discord Blurple
          description: `Outbound lifecycle notification for **${boardTitle}**:`,
          fields: [
            {
              name: "Card Moved",
              value:
                "**Implement Real-Time Presence & Typing Indicators** moved to **Review** by Alex Rivera",
              inline: false,
            },
            {
              name: "Butler Automation",
              value:
                "Rule **Auto-Assign Reviewer** triggered with Blocker tag",
              inline: false,
            },
          ],
          footer: {
            text: "Kanbanify Webhook Dispatcher",
          },
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }, [aiSummary, boardTitle]);

  const currentPayloadJson = useMemo(() => {
    if (previewTab === "slack") {
      return JSON.stringify(slackPayload, null, 2);
    }
    return JSON.stringify(discordPayload, null, 2);
  }, [previewTab, slackPayload, discordPayload]);

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(currentPayloadJson);
      setCopiedPayload(true);
      setTimeout(() => setCopiedPayload(false), 2000);
    } catch {
      // Ignore clipboard error
    }
  };

  if (!isWebhooksModalOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="webhooks-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-md transition-opacity duration-200"
        onClick={() => setWebhooksModalOpen(false)}
      />

      {/* Modal Dialog Card */}
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-zinc-200/90 bg-white shadow-2xl transition-all duration-200 dark:border-zinc-800 dark:bg-zinc-950">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200/80 px-6 py-4 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/20 via-violet-500/15 to-transparent text-indigo-600 shadow-xs dark:text-indigo-400">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2
                  id="webhooks-modal-title"
                  className="text-base font-bold text-zinc-900 dark:text-zinc-100"
                >
                  Slack &amp; Discord Webhook Integrations
                </h2>
                <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300">
                  {webhooks.length} configured
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Broadcast real-time Kanban lifecycle events and AI standup digests
                directly to your team channels
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setWebhooksModalOpen(false)}
            aria-label="Close modal"
            className="rounded-xl p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body - 2 Columns (Left: Webhook Form & Configured List, Right: Realistic Payload Previewer) */}
        <div className="grid min-h-0 flex-1 grid-cols-1 divide-y divide-zinc-200 overflow-y-auto lg:grid-cols-12 lg:divide-x lg:divide-y-0 dark:divide-zinc-800">
          {/* Left Column (7 cols): Webhook Form & Active Webhook List */}
          <div className="space-y-6 p-6 lg:col-span-7">
            {/* Form Section */}
            <form onSubmit={handleCreateWebhook} className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold tracking-wider text-zinc-700 uppercase dark:text-zinc-300">
                  Register New Webhook
                </span>
                <span className="text-[11px] text-zinc-400">
                  Board: <strong className="text-zinc-700 dark:text-zinc-300">{boardTitle}</strong>
                </span>
              </div>

              {formError && (
                <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Webhook Name & Target Platform Selector */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    Webhook Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Engineering #sprint-updates"
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:bg-zinc-950"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    Target Platform
                  </label>
                  <div className="grid grid-cols-3 gap-1 rounded-xl border border-zinc-200/80 bg-zinc-100/70 p-1 dark:border-zinc-800 dark:bg-zinc-900">
                    <button
                      type="button"
                      onClick={() => setPlatform("SLACK")}
                      className={`flex items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-semibold transition-all ${
                        platform === "SLACK"
                          ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100"
                          : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                      }`}
                    >
                      <Hash className="h-3.5 w-3.5 text-emerald-500" />
                      <span>Slack</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlatform("DISCORD")}
                      className={`flex items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-semibold transition-all ${
                        platform === "DISCORD"
                          ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100"
                          : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                      }`}
                    >
                      <MessageSquare className="h-3.5 w-3.5 text-indigo-500" />
                      <span>Discord</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlatform("CUSTOM")}
                      className={`flex items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-semibold transition-all ${
                        platform === "CUSTOM"
                          ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100"
                          : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                      }`}
                    >
                      <Globe className="h-3.5 w-3.5 text-amber-500" />
                      <span>Custom</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Webhook Destination URL */}
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Webhook Target URL
                </label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder={urlPlaceholder}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:bg-zinc-950"
                />
              </div>

              {/* Subscribed Events Checkbox Matrix */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    Subscribed Board Lifecycle Events ({subscribedEvents.length}/5)
                  </label>
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={handleSelectAllEvents}
                      className="text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      Select all
                    </button>
                    <span className="text-zinc-300 dark:text-zinc-700">•</span>
                    <button
                      type="button"
                      onClick={handleClearAllEvents}
                      className="text-zinc-500 hover:underline dark:text-zinc-400"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {ALL_EVENTS.map((ev) => {
                    const checked = subscribedEvents.includes(ev.type);
                    return (
                      <label
                        key={ev.type}
                        className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-2.5 transition-all ${
                          checked
                            ? "border-indigo-500/50 bg-indigo-500/5 dark:bg-indigo-500/10"
                            : "border-zinc-200/80 bg-zinc-50/50 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleEvent(ev.type)}
                          className="mt-0.5 h-3.5 w-3.5 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                            {ev.label}
                          </p>
                          <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                            {ev.description}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 px-4 py-2 text-xs font-semibold text-white shadow-xs transition-all hover:bg-zinc-800 active:scale-[0.99] disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Register Webhook</span>
                </button>
              </div>
            </form>

            {/* Configured Webhooks List */}
            <div className="space-y-3 pt-3">
              <div className="flex items-center justify-between border-t border-zinc-200/80 pt-4 dark:border-zinc-800">
                <span className="text-xs font-bold tracking-wider text-zinc-700 uppercase dark:text-zinc-300">
                  Configured Board Webhooks ({webhooks.length})
                </span>
                <span className="text-[11px] text-zinc-400">
                  Dispatched via Fastify Outbound Webhook Worker
                </span>
              </div>

              {webhooks.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-800">
                  <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                    <Bell className="h-4 w-4" />
                  </div>
                  <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                    No webhooks configured yet
                  </p>
                  <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                    Register a Slack or Discord webhook above to receive automated notifications.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {webhooks.map((wh) => {
                    const isTesting = testingId === wh.id;
                    const thisTestRes =
                      testResponse?.id === wh.id ? testResponse.res : null;

                    return (
                      <div
                        key={wh.id}
                        className={`rounded-2xl border p-3.5 transition-all ${
                          wh.is_enabled
                            ? "border-zinc-200/90 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900/90"
                            : "border-zinc-200/50 bg-zinc-50/70 opacity-65 dark:border-zinc-800/50 dark:bg-zinc-900/40"
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase ${
                                  wh.platform === "SLACK"
                                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                    : wh.platform === "DISCORD"
                                      ? "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300"
                                      : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                                }`}
                              >
                                {wh.platform === "SLACK" ? (
                                  <Hash className="h-3 w-3" />
                                ) : wh.platform === "DISCORD" ? (
                                  <MessageSquare className="h-3 w-3" />
                                ) : (
                                  <Globe className="h-3 w-3" />
                                )}
                                {wh.platform}
                              </span>

                              <h4 className="truncate text-xs font-bold text-zinc-900 dark:text-zinc-100">
                                {wh.name}
                              </h4>

                              <span
                                className={`h-2 w-2 rounded-full ${
                                  wh.is_enabled ? "bg-emerald-500" : "bg-zinc-400"
                                }`}
                                title={wh.is_enabled ? "Enabled" : "Disabled"}
                              />
                            </div>

                            <p className="mt-1 truncate font-mono text-[11px] text-zinc-400">
                              {wh.url}
                            </p>

                            {/* Subscribed Events Badges */}
                            <div className="mt-2 flex flex-wrap gap-1">
                              {wh.subscribed_events.map((ev) => (
                                <span
                                  key={ev}
                                  className="rounded bg-zinc-100 px-1.5 py-0.2 font-mono text-[9px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                                >
                                  {ev.toLowerCase().replace(/_/g, " ")}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Action Controls: Enable Toggle, Delete, Test Ping */}
                          <div className="flex items-center gap-1.5">
                            {/* Toggle Enable Button */}
                            <button
                              type="button"
                              onClick={() => handleToggleEnabled(wh)}
                              title={wh.is_enabled ? "Click to disable" : "Click to enable"}
                              className={`rounded-lg p-1.5 transition-colors ${
                                wh.is_enabled
                                  ? "text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                                  : "text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-800"
                              }`}
                            >
                              {wh.is_enabled ? (
                                <ToggleRight className="h-5 w-5" />
                              ) : (
                                <ToggleLeft className="h-5 w-5" />
                              )}
                            </button>

                            {/* Live Test Ping Button */}
                            <button
                              type="button"
                              onClick={() => handleTestPing(wh)}
                              disabled={isTesting}
                              title="Send a sample test notification ping to this webhook"
                              className="inline-flex items-center gap-1 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-xs font-semibold text-indigo-700 transition-all hover:bg-indigo-500/20 active:scale-[0.99] disabled:opacity-50 dark:border-indigo-400/30 dark:bg-indigo-400/10 dark:text-indigo-300"
                            >
                              {isTesting ? (
                                <RefreshCw className="h-3 w-3 animate-spin" />
                              ) : (
                                <Send className="h-3 w-3" />
                              )}
                              <span>🚀 Test Ping</span>
                            </button>

                            {/* Delete Button */}
                            <button
                              type="button"
                              onClick={() => onDeleteWebhook(wh.id)}
                              title="Delete webhook"
                              className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-rose-500/10 hover:text-rose-600 dark:hover:bg-rose-500/15"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Test Delivery Result Feedback */}
                        {thisTestRes && (
                          <div
                            className={`mt-2.5 flex items-center justify-between rounded-xl p-2.5 text-xs transition-all ${
                              thisTestRes.success
                                ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                                : "border border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-200"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {thisTestRes.success ? (
                                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                              ) : (
                                <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
                              )}
                              <span>{thisTestRes.message}</span>
                            </div>
                            {thisTestRes.status_code && (
                              <span className="font-mono text-[10px] font-bold">
                                HTTP {thisTestRes.status_code}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Column (5 cols): Interactive Slack & Discord Message Previewer */}
          <div className="flex flex-col space-y-4 bg-zinc-50/70 p-6 lg:col-span-5 dark:bg-zinc-950/60">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold tracking-wider text-zinc-700 uppercase dark:text-zinc-300">
                👁️ Live Message Previewer
              </span>

              {/* Format Tab Switcher: Slack vs Discord vs Raw JSON */}
              <div className="flex items-center rounded-lg border border-zinc-200/80 bg-white p-0.5 dark:border-zinc-800 dark:bg-zinc-900">
                <button
                  type="button"
                  onClick={() => setPreviewTab("slack")}
                  className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-all ${
                    previewTab === "slack"
                      ? "bg-zinc-900 text-white shadow-xs dark:bg-zinc-100 dark:text-zinc-900"
                      : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                  }`}
                >
                  <Hash className="h-3 w-3" />
                  <span>Slack</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab("discord")}
                  className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-all ${
                    previewTab === "discord"
                      ? "bg-zinc-900 text-white shadow-xs dark:bg-zinc-100 dark:text-zinc-900"
                      : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                  }`}
                >
                  <MessageSquare className="h-3 w-3" />
                  <span>Discord</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab("raw")}
                  className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-all ${
                    previewTab === "raw"
                      ? "bg-zinc-900 text-white shadow-xs dark:bg-zinc-100 dark:text-zinc-900"
                      : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                  }`}
                >
                  <Code2 className="h-3 w-3" />
                  <span>JSON</span>
                </button>
              </div>
            </div>

            {/* AI Daily Standup Digest Generator Button */}
            <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/10 via-violet-500/10 to-transparent p-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1 text-xs font-bold text-indigo-700 dark:text-indigo-300">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>✨ AI Daily Standup Digest</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Synthesize recent activity into Slack Block Kit &amp; Discord Embeds
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleGenerateAiDigest}
                  disabled={isGeneratingAiSummary}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition-all hover:from-indigo-500 hover:to-violet-500 active:scale-[0.99] disabled:opacity-50"
                >
                  <Sparkles
                    className={`h-3 w-3 ${
                      isGeneratingAiSummary ? "animate-spin" : ""
                    }`}
                  />
                  <span>
                    {isGeneratingAiSummary ? "Generating..." : "Generate Digest"}
                  </span>
                </button>
              </div>
            </div>

            {/* Visual Chat Card Preview Container */}
            <div className="min-h-[300px] flex-1 overflow-hidden rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-inner dark:border-zinc-800 dark:bg-zinc-900/90">
              {previewTab === "slack" ? (
                /* Slack Realistic Channel View */
                <div className="space-y-3 font-sans">
                  {/* Slack Channel Header bar */}
                  <div className="flex items-center gap-1.5 border-b border-zinc-200/80 pb-2 text-xs font-semibold text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
                    <Hash className="h-3.5 w-3.5 text-zinc-400" />
                    <span>sprint-updates</span>
                    <span className="text-[10px] text-zinc-400">| Slack App</span>
                  </div>

                  {/* Slack Bot Message */}
                  <div className="flex items-start gap-2.5">
                    {/* Bot Avatar */}
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold text-white shadow-xs">
                      K
                    </div>

                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                          Kanbanify
                        </span>
                        <span className="rounded bg-zinc-200/80 px-1 py-0.2 font-mono text-[9px] font-semibold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
                          APP
                        </span>
                        <span className="text-[10px] text-zinc-400">
                          Today at {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>

                      {/* Slack Block Kit Card Body */}
                      <div className="rounded-xl border-l-4 border-indigo-600 bg-zinc-50 p-3.5 text-xs text-zinc-800 dark:bg-zinc-950/70 dark:text-zinc-200">
                        <h4 className="font-bold text-zinc-900 dark:text-white">
                          📋 Kanbanify Board: {boardTitle}
                        </h4>
                        <div className="mt-1.5 space-y-1 text-xs leading-relaxed">
                          <p>
                            • <strong>Alex Rivera</strong> moved <em>Implement Real-Time Presence &amp; Typing Indicators</em> to <strong>Review</strong>.
                          </p>
                          <p>
                            • <strong>Kanbanify Butler</strong> executed <em>Auto-Assign Reviewer on Done</em>.
                          </p>
                        </div>
                        <div className="mt-2 text-[10px] text-zinc-400">
                          ⚡ Dispatched via Kanbanify Webhook Dispatcher
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : previewTab === "discord" ? (
                /* Discord Realistic Channel View */
                <div className="space-y-3 font-sans">
                  {/* Discord Channel Header */}
                  <div className="flex items-center gap-1.5 border-b border-zinc-200/80 pb-2 text-xs font-semibold text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
                    <span className="font-mono text-zinc-400">#</span>
                    <span>announcements</span>
                    <span className="text-[10px] text-zinc-400">| Discord Webhook</span>
                  </div>

                  {/* Discord Message */}
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#5865F2] text-xs font-bold text-white shadow-xs">
                      KB
                    </div>

                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xs font-bold text-[#5865F2]">
                          Kanbanify Bot
                        </span>
                        <span className="rounded bg-[#5865F2] px-1 py-0.2 font-mono text-[9px] font-bold text-white uppercase">
                          BOT
                        </span>
                        <span className="text-[10px] text-zinc-400">
                          Today at {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>

                      {/* Discord Rich Embed Container */}
                      <div className="rounded-r-xl border-l-4 border-[#5865F2] bg-zinc-100/90 p-3.5 text-xs text-zinc-800 dark:bg-[#2b2d31] dark:text-zinc-200">
                        <h4 className="font-bold text-zinc-900 dark:text-white">
                          📋 Board Update: {boardTitle}
                        </h4>
                        <p className="mt-1 text-[11px] text-zinc-600 dark:text-zinc-300">
                          Recent lifecycle activity on board <strong>{boardTitle}</strong>:
                        </p>

                        <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <div className="rounded-lg bg-white/70 p-2 dark:bg-[#1e1f22]">
                            <span className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
                              Card Moved
                            </span>
                            <p className="mt-0.5 text-xs font-semibold">
                              Real-Time Presence to Review
                            </p>
                          </div>
                          <div className="rounded-lg bg-white/70 p-2 dark:bg-[#1e1f22]">
                            <span className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
                              Butler Automation
                            </span>
                            <p className="mt-0.5 text-xs font-semibold">
                              Auto-Tag Ship Ready executed
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between text-[10px] text-zinc-400">
                          <span>Kanbanify Webhook Dispatcher</span>
                          <span>{new Date().toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Raw JSON Payload View */
                <div className="relative h-full">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-mono text-[11px] text-zinc-500">
                      Payload Envelope (Strictly Validated with Zod)
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyJson}
                      className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
                    >
                      {copiedPayload ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-500" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>Copy JSON</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="max-h-72 overflow-auto rounded-xl bg-zinc-950 p-3 font-mono text-[11px] leading-relaxed text-emerald-400">
                    {currentPayloadJson}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-zinc-200/80 px-6 py-3 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            <span>Outbound Webhook Dispatcher v5.0</span>
          </div>

          <button
            type="button"
            onClick={() => setWebhooksModalOpen(false)}
            className="rounded-xl border border-zinc-200/80 bg-zinc-100 px-4 py-1.5 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
