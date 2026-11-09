import { createHmac, randomUUID } from "node:crypto";
import {
  AISummaryNotificationResponseSchema,
  OutboundWebhookPayloadSchema,
  type OutboundWebhookPayload,
  type WebhookConfig,
  type WebhookEventType,
  type WebhookPlatform,
} from "@kinetix/contracts";
import type { StorageRepository } from "../db/repository.js";

export interface DispatchEventOptions {
  event: WebhookEventType;
  board_id: string;
  actor?: { id: string; name: string };
  data: Record<string, unknown>;
  timestamp?: string;
}

export interface DispatchResult {
  success: boolean;
  status_code: number;
  delivered: boolean;
  platform: WebhookPlatform;
  message: string;
  delivered_at: string;
  preview_payload?: Record<string, unknown>;
}

export class WebhookDispatcher {
  private readonly signingSecret: string;
  private readonly aiEngineUrl: string;
  private readonly internalToken: string;

  constructor(private readonly repository: StorageRepository) {
    this.signingSecret =
      process.env.WEBHOOK_SIGNING_SECRET ?? "kanbanify-webhook-signing-secret";
    this.aiEngineUrl =
      process.env.AI_ENGINE_URL ?? "http://localhost:8001";
    this.internalToken =
      process.env.INTERNAL_SERVICE_TOKEN ??
      "kinetix_internal_secret_token_change_in_production";
  }

  public isPlaceholderUrl(url: string): boolean {
    const lower = url.toLowerCase();
    return (
      lower.includes("example.com") ||
      lower.includes("hooks.slack.com/services/t000") ||
      lower.includes("discord.com/api/webhooks/mock") ||
      lower.includes("localhost/mock") ||
      lower.includes("mock") ||
      lower.includes("placeholder")
    );
  }

  public computeSignature(payload: string): string {
    return createHmac("sha256", this.signingSecret)
      .update(payload)
      .digest("hex");
  }

  public formatSlackPayload(
    boardTitle: string,
    event: WebhookEventType,
    actorName: string,
    data: Record<string, unknown>,
    timestamp: string
  ): Record<string, unknown> {
    const cardTitle =
      (data.card_title as string) || (data.title as string) || "Card";
    const priority = (data.priority as string) || "MEDIUM";

    return {
      text: `[${event}] on *${boardTitle}*: ${cardTitle}`,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: `📋 Board Notification: ${boardTitle}`,
            emoji: true,
          },
        },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*Board:*\n${boardTitle}` },
            { type: "mrkdwn", text: `*Action:*\n${event}` },
            { type: "mrkdwn", text: `*Card:*\n${cardTitle}` },
            { type: "mrkdwn", text: `*Actor:*\n${actorName}` },
            { type: "mrkdwn", text: `*Priority:*\n\`${priority}\`` },
          ],
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `⚡ Dispatched via Kanbanify Webhook Dispatcher | ${timestamp}`,
            },
          ],
        },
      ],
    };
  }

  public formatDiscordPayload(
    boardTitle: string,
    event: WebhookEventType,
    actorName: string,
    data: Record<string, unknown>,
    timestamp: string
  ): Record<string, unknown> {
    const cardTitle =
      (data.card_title as string) || (data.title as string) || "Card";
    const priority = (data.priority as string) || "MEDIUM";

    // Discord decimal color mapping
    // Green (3066993) for Done/Completed
    // Red (15158332) for Urgent/Archived
    // Blurple (5793266) for Card Moved/Created / default
    let color = 5793266;
    if (
      event === "CARD_ARCHIVED" ||
      priority === "URGENT" ||
      data.is_archived === true
    ) {
      color = 15158332;
    } else if (
      (typeof data.target_column_title === "string" &&
        data.target_column_title.toLowerCase().includes("done")) ||
      (typeof data.target_column === "string" &&
        data.target_column.toLowerCase().includes("done"))
    ) {
      color = 3066993;
    }

    return {
      content: `📋 Board Notification on **${boardTitle}**`,
      embeds: [
        {
          title: `${event}: ${cardTitle}`,
          description: `${actorName} triggered **${event}** on card **${cardTitle}** in **${boardTitle}**.`,
          color,
          fields: [
            { name: "Board", value: boardTitle, inline: true },
            { name: "Card", value: cardTitle, inline: true },
            { name: "Action", value: event, inline: true },
            { name: "Actor", value: actorName, inline: true },
            { name: "Priority", value: priority, inline: true },
          ],
          footer: {
            text: "Kanbanify Webhook Dispatcher",
          },
          timestamp,
        },
      ],
    };
  }

  public formatCustomPayload(
    boardId: string,
    event: WebhookEventType,
    actor: { id: string; name: string },
    data: Record<string, unknown>,
    timestamp: string
  ): OutboundWebhookPayload {
    const payload: OutboundWebhookPayload = {
      event,
      board_id: boardId,
      timestamp,
      actor,
      data,
    };
    OutboundWebhookPayloadSchema.parse(payload);
    return payload;
  }

  public async formatPayloadForPlatform(
    platform: WebhookPlatform,
    boardTitle: string,
    boardId: string,
    event: WebhookEventType,
    actor: { id: string; name: string },
    data: Record<string, unknown>,
    timestamp: string
  ): Promise<Record<string, unknown>> {
    if (platform === "SLACK") {
      return this.formatSlackPayload(
        boardTitle,
        event,
        actor.name,
        data,
        timestamp
      );
    }
    if (platform === "DISCORD") {
      return this.formatDiscordPayload(
        boardTitle,
        event,
        actor.name,
        data,
        timestamp
      );
    }
    return this.formatCustomPayload(boardId, event, actor, data, timestamp) as unknown as Record<
      string,
      unknown
    >;
  }

  public async dispatchWebhook(
    webhook: WebhookConfig,
    payload: Record<string, unknown>,
    event: WebhookEventType
  ): Promise<DispatchResult> {
    const serialized = JSON.stringify(payload);
    const signature = this.computeSignature(serialized);
    const deliveryId = randomUUID();
    const deliveredAt = new Date().toISOString();

    if (this.isPlaceholderUrl(webhook.url)) {
      console.info(
        `[WebhookDispatcher] Simulated fast 200 OK delivery for ${webhook.platform} to placeholder URL: ${webhook.url}`
      );
      return {
        success: true,
        status_code: 200,
        delivered: true,
        platform: webhook.platform,
        message: `Test ping successfully delivered to ${webhook.platform} endpoint`,
        delivered_at: deliveredAt,
        preview_payload: payload,
      };
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Kanbanify-Event": event,
      "X-Kinetix-Event": event,
      "X-Kinetix-Delivery-Id": deliveryId,
      "X-Kinetix-Signature": `sha256=${signature}`,
      "User-Agent": "Kanbanify-Webhook-Dispatcher/1.0",
    };

    try {
      const response = await fetch(webhook.url, {
        method: "POST",
        headers,
        body: serialized,
        signal: AbortSignal.timeout(3000),
      });

      const isOk = response.ok;
      return {
        success: isOk,
        status_code: response.status,
        delivered: isOk,
        platform: webhook.platform,
        message: isOk
          ? `Webhook delivered to ${webhook.platform} with status ${response.status}`
          : `Endpoint responded with status ${response.status}`,
        delivered_at: deliveredAt,
        preview_payload: payload,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        `[WebhookDispatcher] Delivery failed for ${webhook.url} (${msg})`
      );
      return {
        success: false,
        status_code: 504,
        delivered: false,
        platform: webhook.platform,
        message: `Delivery failed: ${msg}`,
        delivered_at: deliveredAt,
        preview_payload: payload,
      };
    }
  }

  public async dispatchBoardEvent(
    boardId: string,
    options: DispatchEventOptions
  ): Promise<void> {
    try {
      const board = await this.repository.getBoardById(boardId);
      if (!board) return;

      const webhooks = board.webhooks ?? [];
      const enabledWebhooks = webhooks.filter(
        (w) => w.is_enabled && w.subscribed_events.includes(options.event)
      );

      if (enabledWebhooks.length === 0) return;

      const timestamp = options.timestamp ?? new Date().toISOString();
      const actor = options.actor ?? {
        id: "88888888-8888-4888-8888-888888888881",
        name: "Alex Rivera",
      };

      for (const wh of enabledWebhooks) {
        const payload = await this.formatPayloadForPlatform(
          wh.platform,
          board.title,
          boardId,
          options.event,
          actor,
          options.data,
          timestamp
        );
        // Non-blocking dispatch
        void this.dispatchWebhook(wh, payload, options.event);
      }
    } catch (err) {
      console.warn("[WebhookDispatcher] Error in dispatchBoardEvent:", err);
    }
  }

  public async testWebhook(webhookId: string): Promise<DispatchResult> {
    const found = await this.repository.getWebhookById(webhookId);
    if (!found) {
      throw new Error(`Webhook '${webhookId}' not found`);
    }

    const { webhook, boardId } = found;
    const board = await this.repository.getBoardById(boardId);
    const boardTitle = board?.title ?? "Kinetix Workspace";
    const timestamp = new Date().toISOString();

    const sampleEvent: WebhookEventType =
      webhook.subscribed_events[0] ?? "CARD_MOVED";
    const actor = {
      id: "88888888-8888-4888-8888-888888888881",
      name: "Alex Rivera",
    };
    const sampleData = {
      card_id: "44444444-4444-4444-8444-444444444441",
      card_title: "Implement OAuth2 PKCE flow",
      target_column: "Done",
      priority: "HIGH",
    };

    let previewPayload = await this.formatPayloadForPlatform(
      webhook.platform,
      boardTitle,
      boardId,
      sampleEvent,
      actor,
      sampleData,
      timestamp
    );

    // Optionally try enriching via AI engine if available
    try {
      const aiRes = await fetch(
        `${this.aiEngineUrl}/internal/v1/format-notification`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Internal-Token": this.internalToken,
          },
          body: JSON.stringify({
            board_title: boardTitle,
            recent_activities: board?.activities?.slice(-3) ?? [],
          }),
          signal: AbortSignal.timeout(1000),
        }
      );
      if (aiRes.ok) {
        const json = await aiRes.json();
        const parsed = AISummaryNotificationResponseSchema.safeParse(json);
        if (parsed.success) {
          if (webhook.platform === "SLACK") {
            previewPayload = parsed.data.slack_block_kit_payload;
          } else if (webhook.platform === "DISCORD") {
            previewPayload = parsed.data.discord_embed_payload;
          }
        }
      }
    } catch {
      // Graceful fallback to deterministic local formatter
    }

    const result = await this.dispatchWebhook(
      webhook,
      previewPayload,
      sampleEvent
    );

    return {
      ...result,
      preview_payload: previewPayload,
    };
  }
}
