import { randomUUID } from "node:crypto";
import {
  type AuthUser,
  type Card,
  type LogTimeEntryRequest,
  type PomodoroCompleteRequest,
  type TimeEntry,
  CardSchema,
  TimeEntrySchema,
} from "@kinetix/contracts";
import { StorageRepository } from "../db/repository.js";
import { BoardRealtimeHub } from "../ws/hub.js";
import { AppError } from "../errors.js";

export class TimeTrackingService {
  constructor(
    private readonly repository: StorageRepository,
    private readonly hub: BoardRealtimeHub
  ) {}

  /**
   * Starts a live stopwatch on a card.
   * If the requesting user already has a running timer on another card,
   * that timer is stopped and committed before the new timer starts.
   * If another timer is already running on this card, it is stopped and committed first.
   */
  public async startStopwatch(
    cardId: string,
    actor: AuthUser,
    requestedUserId?: string,
    requestedUserName?: string
  ): Promise<Card> {
    const card = await this.repository.getCardById(cardId);
    if (!card) {
      throw new AppError(
        404,
        "RESOURCE_NOT_FOUND",
        `Card '${cardId}' not found`,
        { card_id: cardId }
      );
    }

    const effectiveUserId = requestedUserId ?? actor.id;
    const effectiveUserName = requestedUserName ?? actor.name;
    const nowIso = new Date().toISOString();

    // 1. If requesting user has an active timer on another card, commit it first
    const runningCard = await this.repository.findCardWithActiveTimerForUser(
      effectiveUserId
    );
    if (runningCard && runningCard.id !== cardId) {
      await this.stopStopwatch(runningCard.id, actor, {
        note: `Auto-stopped prior to starting stopwatch on card "${card.title}"`,
      });
    }

    // 2. If this card already has an active timer (from anyone), commit it first
    if (card.time_tracking?.active_timer) {
      await this.stopStopwatch(cardId, actor, {
        note: `Auto-committed previous timer before new stopwatch session`,
      });
      // Re-fetch card after commit
      const refreshed = await this.repository.getCardById(cardId);
      if (refreshed) {
        Object.assign(card, refreshed);
      }
    }

    // 3. Initialize time_tracking container if absent
    if (!card.time_tracking) {
      card.time_tracking = {
        estimated_seconds: 0,
        total_logged_seconds: 0,
        active_timer: null,
        entries: [],
        pomodoro_completed_count: 0,
      };
    }

    card.time_tracking.active_timer = {
      card_id: cardId,
      user_id: effectiveUserId,
      user_name: effectiveUserName,
      started_at: nowIso,
    };
    card.updated_at = nowIso;

    await this.repository.saveCardDirect(card);

    // Broadcast TIMER_UPDATED and CARD_UPDATED
    await this.hub.broadcast({
      event: "TIMER_UPDATED",
      board_id: card.board_id,
      actor_id: actor.id,
      data: {
        card_id: card.id,
        active_timer: card.time_tracking.active_timer,
        updated_at: nowIso,
      },
    });

    await this.hub.broadcast({
      event: "CARD_UPDATED",
      board_id: card.board_id,
      actor_id: actor.id,
      data: card,
    });

    await this.repository.appendBoardActivity(card.board_id, {
      card_id: card.id,
      actor_name: actor.name,
      action_type: "CARD_MOVED",
      description: `${actor.name} started stopwatch on "${card.title}"`,
    });

    return CardSchema.parse(card);
  }

  /**
   * Stops the active stopwatch on a card, commits the duration into entries,
   * increments total_logged_seconds, and clears active_timer.
   */
  public async stopStopwatch(
    cardId: string,
    actor: AuthUser,
    options?: {
      duration_seconds_override?: number;
      note?: string;
    }
  ): Promise<Card> {
    const card = await this.repository.getCardById(cardId);
    if (!card) {
      throw new AppError(
        404,
        "RESOURCE_NOT_FOUND",
        `Card '${cardId}' not found`,
        { card_id: cardId }
      );
    }

    if (!card.time_tracking) {
      card.time_tracking = {
        estimated_seconds: 0,
        total_logged_seconds: 0,
        active_timer: null,
        entries: [],
        pomodoro_completed_count: 0,
      };
    }

    const activeTimer = card.time_tracking.active_timer;
    const now = new Date();
    const nowIso = now.toISOString();

    let durationSeconds = 1;
    if (
      options?.duration_seconds_override !== undefined &&
      options.duration_seconds_override > 0
    ) {
      durationSeconds = Math.round(options.duration_seconds_override);
    } else if (activeTimer?.started_at) {
      const elapsed = Math.round(
        (now.getTime() - new Date(activeTimer.started_at).getTime()) / 1000
      );
      durationSeconds = Math.max(1, elapsed);
    } else {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        `No active stopwatch timer running on card '${cardId}'`,
        { card_id: cardId }
      );
    }

    const startedAt =
      activeTimer?.started_at ??
      new Date(now.getTime() - durationSeconds * 1000).toISOString();

    const entryUserId = activeTimer?.user_id ?? actor.id;
    const entryUserName = activeTimer?.user_name ?? actor.name;
    const entryUserInitials = actor.initials || "AR";

    const entry: TimeEntry = {
      id: randomUUID(),
      card_id: cardId,
      user_id: entryUserId,
      user_name: entryUserName,
      user_initials: entryUserInitials,
      duration_seconds: durationSeconds,
      note: options?.note ?? "",
      source: "STOPWATCH",
      started_at: startedAt,
      ended_at: nowIso,
      created_at: nowIso,
    };

    TimeEntrySchema.parse(entry);

    card.time_tracking.entries = [
      ...(card.time_tracking.entries ?? []),
      entry,
    ];
    card.time_tracking.total_logged_seconds = (
      card.time_tracking.entries ?? []
    ).reduce((sum, e) => sum + e.duration_seconds, 0);
    card.time_tracking.active_timer = null;
    card.updated_at = nowIso;

    await this.repository.saveCardDirect(card);

    await this.hub.broadcast({
      event: "TIMER_UPDATED",
      board_id: card.board_id,
      actor_id: actor.id,
      data: {
        card_id: card.id,
        active_timer: null,
        updated_at: nowIso,
      },
    });

    await this.hub.broadcast({
      event: "CARD_UPDATED",
      board_id: card.board_id,
      actor_id: actor.id,
      data: card,
    });

    await this.repository.appendBoardActivity(card.board_id, {
      card_id: card.id,
      actor_name: actor.name,
      action_type: "CARD_MOVED",
      description: `${actor.name} logged ${durationSeconds}s via stopwatch on "${card.title}"`,
    });

    return CardSchema.parse(card);
  }

  /**
   * Logs a manual time entry or updates the target estimation for the card.
   */
  public async logTimeEntry(
    cardId: string,
    actor: AuthUser,
    input: LogTimeEntryRequest
  ): Promise<Card> {
    const card = await this.repository.getCardById(cardId);
    if (!card) {
      throw new AppError(
        404,
        "RESOURCE_NOT_FOUND",
        `Card '${cardId}' not found`,
        { card_id: cardId }
      );
    }

    if (!card.time_tracking) {
      card.time_tracking = {
        estimated_seconds: 0,
        total_logged_seconds: 0,
        active_timer: null,
        entries: [],
        pomodoro_completed_count: 0,
      };
    }

    const now = new Date();
    const nowIso = now.toISOString();

    if (input.estimated_seconds !== undefined) {
      card.time_tracking.estimated_seconds = Math.max(
        0,
        input.estimated_seconds
      );
    }

    if (input.duration_seconds !== undefined && input.duration_seconds > 0) {
      const duration = input.duration_seconds;
      const startedAt =
        input.started_at ??
        new Date(now.getTime() - duration * 1000).toISOString();
      const endedAt = input.ended_at ?? nowIso;

      const entry: TimeEntry = {
        id: randomUUID(),
        card_id: cardId,
        user_id: actor.id,
        user_name: actor.name,
        user_initials: actor.initials || "AR",
        duration_seconds: duration,
        note: input.note ?? "",
        source: input.source ?? "MANUAL",
        started_at: startedAt,
        ended_at: endedAt,
        created_at: nowIso,
      };

      TimeEntrySchema.parse(entry);

      card.time_tracking.entries = [
        ...(card.time_tracking.entries ?? []),
        entry,
      ];
      card.time_tracking.total_logged_seconds = (
        card.time_tracking.entries ?? []
      ).reduce((sum, e) => sum + e.duration_seconds, 0);
    }

    card.updated_at = nowIso;
    await this.repository.saveCardDirect(card);

    await this.hub.broadcast({
      event: "CARD_UPDATED",
      board_id: card.board_id,
      actor_id: actor.id,
      data: card,
    });

    await this.repository.appendBoardActivity(card.board_id, {
      card_id: card.id,
      actor_name: actor.name,
      action_type: "CARD_MOVED",
      description: `${actor.name} updated worklog on "${card.title}"`,
    });

    return CardSchema.parse(card);
  }

  /**
   * Deletes a specific time entry from the card worklogs and recalculates total_logged_seconds.
   */
  public async deleteTimeEntry(
    cardId: string,
    entryId: string,
    actor: AuthUser
  ): Promise<Card> {
    const card = await this.repository.getCardById(cardId);
    if (!card) {
      throw new AppError(
        404,
        "RESOURCE_NOT_FOUND",
        `Card '${cardId}' not found`,
        { card_id: cardId }
      );
    }

    if (!card.time_tracking) {
      throw new AppError(
        404,
        "RESOURCE_NOT_FOUND",
        `Time entry '${entryId}' not found on card '${cardId}'`,
        { card_id: cardId, entry_id: entryId }
      );
    }

    const existingEntries = card.time_tracking.entries ?? [];
    const index = existingEntries.findIndex((e) => e.id === entryId);
    if (index === -1) {
      throw new AppError(
        404,
        "RESOURCE_NOT_FOUND",
        `Time entry '${entryId}' not found on card '${cardId}'`,
        { card_id: cardId, entry_id: entryId }
      );
    }

    const nextEntries = existingEntries.filter((e) => e.id !== entryId);
    card.time_tracking.entries = nextEntries;
    card.time_tracking.total_logged_seconds = nextEntries.reduce(
      (sum, e) => sum + e.duration_seconds,
      0
    );
    card.updated_at = new Date().toISOString();

    await this.repository.saveCardDirect(card);

    await this.hub.broadcast({
      event: "CARD_UPDATED",
      board_id: card.board_id,
      actor_id: actor.id,
      data: card,
    });

    await this.repository.appendBoardActivity(card.board_id, {
      card_id: card.id,
      actor_name: actor.name,
      action_type: "CARD_MOVED",
      description: `${actor.name} deleted a time entry from "${card.title}"`,
    });

    return CardSchema.parse(card);
  }

  /**
   * Completes a Pomodoro focus session on the card.
   * Increments pomodoro_completed_count when mode === 'FOCUS', appends a POMODORO worklog,
   * increments total_logged_seconds, and broadcasts CARD_UPDATED.
   */
  public async completePomodoro(
    cardId: string,
    actor: AuthUser,
    input: PomodoroCompleteRequest
  ): Promise<Card> {
    const card = await this.repository.getCardById(cardId);
    if (!card) {
      throw new AppError(
        404,
        "RESOURCE_NOT_FOUND",
        `Card '${cardId}' not found`,
        { card_id: cardId }
      );
    }

    if (!card.time_tracking) {
      card.time_tracking = {
        estimated_seconds: 0,
        total_logged_seconds: 0,
        active_timer: null,
        entries: [],
        pomodoro_completed_count: 0,
      };
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const duration = input.duration_seconds ?? 1500;

    if (input.mode === "FOCUS") {
      card.time_tracking.pomodoro_completed_count =
        (card.time_tracking.pomodoro_completed_count ?? 0) + 1;

      const startedAt = new Date(now.getTime() - duration * 1000).toISOString();

      const entry: TimeEntry = {
        id: randomUUID(),
        card_id: cardId,
        user_id: actor.id,
        user_name: actor.name,
        user_initials: actor.initials || "AR",
        duration_seconds: duration,
        note: input.note || "Completed 25m Pomodoro focus session",
        source: "POMODORO",
        started_at: startedAt,
        ended_at: nowIso,
        created_at: nowIso,
      };

      TimeEntrySchema.parse(entry);

      card.time_tracking.entries = [
        ...(card.time_tracking.entries ?? []),
        entry,
      ];
      card.time_tracking.total_logged_seconds = (
        card.time_tracking.entries ?? []
      ).reduce((sum, e) => sum + e.duration_seconds, 0);
    }

    card.updated_at = nowIso;
    await this.repository.saveCardDirect(card);

    await this.hub.broadcast({
      event: "CARD_UPDATED",
      board_id: card.board_id,
      actor_id: actor.id,
      data: card,
    });

    await this.repository.appendBoardActivity(card.board_id, {
      card_id: card.id,
      actor_name: actor.name,
      action_type: "CARD_MOVED",
      description: `${actor.name} completed ${input.mode} session (${duration}s) on "${card.title}"`,
    });

    return CardSchema.parse(card);
  }
}
