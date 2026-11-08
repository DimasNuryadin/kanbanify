import { Redis } from "ioredis";
import {
  WSMessageSchema,
  type WSEventType,
  type WSMessage,
} from "@kinetix/contracts";

export interface SocketLike {
  readyState: number;
  OPEN?: number;
  send(data: string): void;
  on(event: string, listener: (...args: unknown[]) => void): void;
}

const REDIS_CHANNEL_PREFIX = "kinetix:board:";

export class BoardRealtimeHub {
  private readonly connectionsByBoard = new Map<string, Set<SocketLike>>();
  private pubClient: Redis | null = null;
  private subClient: Redis | null = null;
  private redisEnabled = false;
  private readonly instanceId = Math.random().toString(36).slice(2, 10);

  public async init(redisUrl?: string): Promise<void> {
    const url = redisUrl ?? process.env.REDIS_URL ?? "redis://localhost:6379/0";

    if (process.env.FORCE_IN_MEMORY_REDIS === "true") {
      console.warn(
        "[BoardRealtimeHub] FORCE_IN_MEMORY_REDIS=true; using in-process WebSocket broadcast."
      );
      this.redisEnabled = false;
      return;
    }

    const pub = new Redis(url, {
      lazyConnect: true,
      connectTimeout: 1500,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });
    const sub = new Redis(url, {
      lazyConnect: true,
      connectTimeout: 1500,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });

    pub.on("error", () => {
      this.redisEnabled = false;
    });
    sub.on("error", () => {
      this.redisEnabled = false;
    });

    try {
      await Promise.all([pub.connect(), sub.connect()]);
      await sub.psubscribe(`${REDIS_CHANNEL_PREFIX}*`);
      sub.on(
        "pmessage",
        (_pattern: string, _channel: string, rawPayload: string) => {
          try {
            const parsed = JSON.parse(rawPayload) as {
              originId?: string;
              message: WSMessage;
            };
            if (parsed.originId === this.instanceId) {
              return;
            }
            const validated = WSMessageSchema.parse(parsed.message);
            this.broadcastLocal(validated.board_id, validated);
          } catch (err) {
            console.warn(
              "[BoardRealtimeHub] Ignored invalid Redis Pub/Sub payload:",
              err
            );
          }
        }
      );

      this.pubClient = pub;
      this.subClient = sub;
      this.redisEnabled = true;
      console.info("[BoardRealtimeHub] Connected to Redis Pub/Sub.");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(
        `[BoardRealtimeHub] Redis unreachable (${message}). Gracefully falling back to in-process WebSocket broadcast.`
      );
      this.redisEnabled = false;
      pub.disconnect();
      sub.disconnect();
      this.pubClient = null;
      this.subClient = null;
    }
  }

  public addClient(boardId: string, socket: SocketLike): void {
    let clients = this.connectionsByBoard.get(boardId);
    if (!clients) {
      clients = new Set<SocketLike>();
      this.connectionsByBoard.set(boardId, clients);
    }
    clients.add(socket);

    socket.on("close", () => {
      this.removeClient(boardId, socket);
    });
    socket.on("error", () => {
      this.removeClient(boardId, socket);
    });
  }

  public removeClient(boardId: string, socket: SocketLike): void {
    const clients = this.connectionsByBoard.get(boardId);
    if (!clients) return;
    clients.delete(socket);
    if (clients.size === 0) {
      this.connectionsByBoard.delete(boardId);
    }
  }

  public async broadcast<TData>(params: {
    event: WSEventType;
    board_id: string;
    data: TData;
    actor_id?: string;
  }): Promise<WSMessage<TData>> {
    const message: WSMessage<TData> = {
      event: params.event,
      board_id: params.board_id,
      data: params.data,
      actor_id: params.actor_id ?? "system",
      timestamp: new Date().toISOString(),
    };

    WSMessageSchema.parse(message);

    // Immediately broadcast to local WebSocket subscribers
    this.broadcastLocal(params.board_id, message);

    // Publish to Redis Pub/Sub when available so horizontal replicas receive it
    if (this.redisEnabled && this.pubClient) {
      try {
        await this.pubClient.publish(
          `${REDIS_CHANNEL_PREFIX}${params.board_id}`,
          JSON.stringify({
            originId: this.instanceId,
            message,
          })
        );
      } catch (err) {
        console.warn(
          "[BoardRealtimeHub] Redis publish failed, using local WebSocket broadcast only:",
          err
        );
        this.redisEnabled = false;
      }
    }

    return message;
  }

  private broadcastLocal(boardId: string, message: WSMessage): void {
    const clients = this.connectionsByBoard.get(boardId);
    if (!clients || clients.size === 0) return;

    const serialized = JSON.stringify(message);
    for (const socket of clients) {
      const openState = socket.OPEN ?? 1;
      if (socket.readyState === openState) {
        try {
          socket.send(serialized);
        } catch {
          this.removeClient(boardId, socket);
        }
      }
    }
  }

  public async close(): Promise<void> {
    this.connectionsByBoard.clear();
    if (this.pubClient) {
      this.pubClient.disconnect();
      this.pubClient = null;
    }
    if (this.subClient) {
      this.subClient.disconnect();
      this.subClient = null;
    }
  }
}
