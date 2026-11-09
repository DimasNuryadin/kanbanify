import { randomUUID } from "node:crypto";
import {
  DEFAULT_BOARD_MEMBERS,
  PresenceMessageSchema,
  UserPresenceSchema,
  type PresenceEventType,
  type PresenceMessage,
  type UserPresence,
  type UserPresenceStatus,
} from "@kinetix/contracts";
import type { BoardRealtimeHub, SocketLike } from "../ws/hub.js";

export interface ClientEventPayload {
  event: string;
  card_id?: string | null;
  user_id?: string;
  user_name?: string;
  avatar_url?: string | null;
  initials?: string;
  color?: string;
  status?: UserPresenceStatus;
  [key: string]: unknown;
}

export class PresenceService {
  private readonly presencesByBoard = new Map<string, Map<string, UserPresence>>();
  private readonly socketUserMap = new Map<SocketLike, { boardId: string; userId: string }>();

  constructor(private readonly hub: BoardRealtimeHub) {}

  public getPresences(boardId: string): UserPresence[] {
    const boardMap = this.presencesByBoard.get(boardId);
    if (!boardMap) return [];
    return Array.from(boardMap.values());
  }

  public getPresence(boardId: string, userId: string): UserPresence | null {
    const boardMap = this.presencesByBoard.get(boardId);
    return boardMap?.get(userId) ?? null;
  }

  private resolveDefaultUser(indexHint: number = 0): {
    user_id: string;
    user_name: string;
    avatar_url: string | null;
    initials: string;
    color: string;
  } {
    const defaultMember =
      DEFAULT_BOARD_MEMBERS[indexHint % DEFAULT_BOARD_MEMBERS.length];
    if (defaultMember) {
      return {
        user_id: defaultMember.id,
        user_name: defaultMember.name,
        avatar_url: defaultMember.avatar_url,
        initials: defaultMember.initials,
        color: defaultMember.color,
      };
    }
    return {
      user_id: randomUUID(),
      user_name: "Anonymous Collaborator",
      avatar_url: null,
      initials: "AC",
      color: "#3b82f6",
    };
  }

  public registerSocket(
    boardId: string,
    socket: SocketLike,
    initialUserData?: Partial<UserPresence>
  ): UserPresence {
    let boardMap = this.presencesByBoard.get(boardId);
    if (!boardMap) {
      boardMap = new Map<string, UserPresence>();
      this.presencesByBoard.set(boardId, boardMap);
    }

    const defaultUser = this.resolveDefaultUser(boardMap.size);
    const userId = initialUserData?.user_id ?? defaultUser.user_id;
    const userName = initialUserData?.user_name ?? defaultUser.user_name;
    const initials =
      initialUserData?.initials ??
      defaultUser.initials ??
      userName
        .split(" ")
        .map((s) => s[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
    const color = initialUserData?.color ?? defaultUser.color;
    const avatarUrl = initialUserData?.avatar_url ?? defaultUser.avatar_url;

    const presence: UserPresence = {
      user_id: userId,
      user_name: userName,
      avatar_url: avatarUrl,
      initials,
      color,
      status: initialUserData?.status ?? "ACTIVE",
      active_card_id: initialUserData?.active_card_id ?? null,
      last_seen: new Date().toISOString(),
    };

    UserPresenceSchema.parse(presence);
    boardMap.set(userId, presence);
    this.socketUserMap.set(socket, { boardId, userId });

    this.hub.addClient(boardId, socket);

    void this.broadcastPresence(boardId, "USER_JOINED", presence);

    socket.on("message", (data: unknown) => {
      void this.handleSocketMessage(boardId, socket, data);
    });

    socket.on("close", () => {
      this.handleSocketClose(boardId, socket);
    });

    socket.on("error", () => {
      this.handleSocketClose(boardId, socket);
    });

    return presence;
  }

  public async handleSocketMessage(
    boardId: string,
    socket: SocketLike,
    rawData: unknown
  ): Promise<PresenceMessage | null> {
    try {
      const text =
        typeof rawData === "string"
          ? rawData
          : Buffer.isBuffer(rawData)
          ? rawData.toString("utf-8")
          : String(rawData);

      const payload = JSON.parse(text) as ClientEventPayload;
      const mapping = this.socketUserMap.get(socket);
      const userId = payload.user_id ?? mapping?.userId;
      if (!userId) return null;

      return await this.handleClientEvent(boardId, userId, payload);
    } catch (err) {
      console.warn("[PresenceService] Failed to parse socket message:", err);
      return null;
    }
  }

  public async handleClientEvent(
    boardId: string,
    userId: string,
    payload: ClientEventPayload
  ): Promise<PresenceMessage> {
    let boardMap = this.presencesByBoard.get(boardId);
    if (!boardMap) {
      boardMap = new Map<string, UserPresence>();
      this.presencesByBoard.set(boardId, boardMap);
    }

    let existing = boardMap.get(userId);
    if (!existing) {
      const defaultUser = this.resolveDefaultUser(boardMap.size);
      existing = {
        user_id: userId,
        user_name: payload.user_name ?? defaultUser.user_name,
        avatar_url: payload.avatar_url ?? defaultUser.avatar_url,
        initials:
          payload.initials ??
          defaultUser.initials ??
          (payload.user_name ?? defaultUser.user_name).slice(0, 2).toUpperCase(),
        color: payload.color ?? defaultUser.color,
        status: "ACTIVE",
        active_card_id: null,
        last_seen: new Date().toISOString(),
      };
    }

    const now = new Date().toISOString();
    let eventType: PresenceEventType = "PRESENCE_SYNC";

    switch (payload.event) {
      case "START_TYPING": {
        existing = {
          ...existing,
          status: "EDITING",
          active_card_id: payload.card_id ?? null,
          last_seen: now,
        };
        eventType = "USER_TYPING";
        break;
      }
      case "STOP_TYPING": {
        existing = {
          ...existing,
          status: "ACTIVE",
          active_card_id: null,
          last_seen: now,
        };
        eventType = "PRESENCE_SYNC";
        break;
      }
      case "USER_JOINED": {
        existing = {
          ...existing,
          status: "ACTIVE",
          last_seen: now,
        };
        eventType = "USER_JOINED";
        break;
      }
      case "HEARTBEAT":
      default: {
        existing = {
          ...existing,
          status: payload.status ?? "ACTIVE",
          active_card_id:
            payload.card_id !== undefined ? payload.card_id : existing.active_card_id,
          last_seen: now,
        };
        eventType = "PRESENCE_SYNC";
        break;
      }
    }

    UserPresenceSchema.parse(existing);
    boardMap.set(userId, existing);

    return await this.broadcastPresence(boardId, eventType, existing);
  }

  public handleSocketClose(boardId: string, socket: SocketLike): void {
    const mapping = this.socketUserMap.get(socket);
    this.socketUserMap.delete(socket);
    this.hub.removeClient(boardId, socket);

    if (mapping) {
      const boardMap = this.presencesByBoard.get(boardId);
      const user = boardMap?.get(mapping.userId);
      if (user) {
        let hasOtherSockets = false;
        for (const [, info] of this.socketUserMap.entries()) {
          if (info.boardId === boardId && info.userId === mapping.userId) {
            hasOtherSockets = true;
            break;
          }
        }

        if (!hasOtherSockets) {
          boardMap?.delete(mapping.userId);
          const offlineUser: UserPresence = {
            ...user,
            status: "ACTIVE",
            active_card_id: null,
            last_seen: new Date().toISOString(),
          };
          void this.broadcastPresence(boardId, "USER_LEFT", offlineUser);
        }
      }
    }
  }

  public async updatePresenceRest(
    boardId: string,
    data: Partial<UserPresence> & {
      user_id?: string;
      event?: string;
      card_id?: string | null;
    }
  ): Promise<{
    success: boolean;
    presence: UserPresence;
    presences: UserPresence[];
  }> {
    let boardMap = this.presencesByBoard.get(boardId);
    if (!boardMap) {
      boardMap = new Map<string, UserPresence>();
      this.presencesByBoard.set(boardId, boardMap);
    }

    const defaultUser = this.resolveDefaultUser(boardMap.size);
    const userId = data.user_id ?? defaultUser.user_id;
    let existing = boardMap.get(userId);

    const now = new Date().toISOString();
    const derivedStatus: UserPresenceStatus =
      data.event === "START_TYPING"
        ? "EDITING"
        : data.event === "STOP_TYPING"
        ? "ACTIVE"
        : data.status ?? (existing ? existing.status : "ACTIVE");

    const derivedCardId =
      data.event === "STOP_TYPING"
        ? null
        : data.card_id !== undefined
        ? data.card_id
        : data.active_card_id !== undefined
        ? data.active_card_id
        : existing
        ? existing.active_card_id
        : null;

    if (!existing) {
      existing = {
        user_id: userId,
        user_name: data.user_name ?? defaultUser.user_name,
        avatar_url: data.avatar_url ?? defaultUser.avatar_url,
        initials: data.initials ?? defaultUser.initials,
        color: data.color ?? defaultUser.color,
        status: derivedStatus,
        active_card_id: derivedCardId,
        last_seen: now,
      };
    } else {
      existing = {
        ...existing,
        user_name: data.user_name ?? existing.user_name,
        avatar_url:
          data.avatar_url !== undefined ? data.avatar_url : existing.avatar_url,
        initials: data.initials ?? existing.initials,
        color: data.color ?? existing.color,
        status: derivedStatus,
        active_card_id: derivedCardId,
        last_seen: now,
      };
    }

    UserPresenceSchema.parse(existing);
    boardMap.set(userId, existing);

    const eventType: PresenceEventType =
      data.event === "START_TYPING"
        ? "USER_TYPING"
        : data.event === "USER_JOINED"
        ? "USER_JOINED"
        : "PRESENCE_SYNC";

    void this.broadcastPresence(boardId, eventType, existing);

    return {
      success: true,
      presence: existing,
      presences: this.getPresences(boardId),
    };
  }

  public async broadcastPresence(
    boardId: string,
    eventType: PresenceEventType,
    actor: UserPresence
  ): Promise<PresenceMessage> {
    const presences = this.getPresences(boardId);
    const message: PresenceMessage = {
      event: eventType,
      board_id: boardId,
      presences,
      actor,
    };

    PresenceMessageSchema.parse(message);

    await this.hub.broadcast({
      event: eventType,
      board_id: boardId,
      data: message,
      actor_id: actor.user_id,
    });

    return message;
  }
}
