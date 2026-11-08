import {
  Board,
  BoardSchema,
  Card,
  CardMovedEventData,
  CardMovedEventDataSchema,
  CardSchema,
  Column,
  ColumnMovedEventData,
  ColumnMovedEventDataSchema,
  ColumnSchema,
  Comment,
  CommentSchema,
  CopyColumnResponseSchema,
  WSMessageSchema,
} from "@kinetix/contracts";

export const WS_BASE_URL =
  process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws";

export type WSConnectionStatus =
  | "mock"
  | "connecting"
  | "connected"
  | "disconnected";

export interface WSBoardHandlers {
  onStatusChange: (status: WSConnectionStatus) => void;
  onCardMoved: (data: CardMovedEventData) => void;
  onCardUpdated: (card: Card) => void;
  onCardCreated: (card: Card) => void;
  onCardArchived?: (cardOrId: Card | { id: string; deleted?: boolean }) => void;
  onColumnCreated: (column: Column) => void;
  onColumnMoved?: (data: ColumnMovedEventData) => void;
  onColumnUpdated?: (column: Column) => void;
  onCommentAdded?: (comment: Comment) => void;
  onBoardUpdated?: (board: Board) => void;
}

export class BoardWebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private boardId: string | null = null;
  private handlers: WSBoardHandlers | null = null;
  private isDisposed = false;

  connect(boardId: string, useMock: boolean, handlers: WSBoardHandlers): void {
    this.disconnect();
    this.isDisposed = false;
    this.boardId = boardId;
    this.handlers = handlers;

    if (useMock || typeof window === "undefined") {
      handlers.onStatusChange("mock");
      return;
    }

    this.openSocket();
  }

  private openSocket(): void {
    if (this.isDisposed || !this.boardId || !this.handlers) return;

    try {
      this.handlers.onStatusChange("connecting");
      const base = WS_BASE_URL.replace(/\/$/, "");
      const url = `${base}/boards/${this.boardId}`;
      const socket = new WebSocket(url);
      this.ws = socket;

      socket.onopen = () => {
        if (this.isDisposed) return;
        this.handlers?.onStatusChange("connected");
      };

      socket.onmessage = (event) => {
        if (this.isDisposed) return;
        try {
          const raw = JSON.parse(String(event.data));
          const parsedMsg = WSMessageSchema.safeParse(raw);
          if (!parsedMsg.success) return;

          const { event: eventType, data } = parsedMsg.data;

          switch (eventType) {
            case "CARD_MOVED": {
              const moved = CardMovedEventDataSchema.safeParse(data);
              if (moved.success) {
                this.handlers?.onCardMoved(moved.data);
              } else {
                const asCard = CardSchema.safeParse(data);
                if (asCard.success) {
                  this.handlers?.onCardUpdated(asCard.data);
                }
              }
              break;
            }
            case "CARD_UPDATED": {
              const updated = CardSchema.safeParse(data);
              if (updated.success) {
                this.handlers?.onCardUpdated(updated.data);
              }
              break;
            }
            case "CARD_CREATED": {
              const created = CardSchema.safeParse(data);
              if (created.success) {
                this.handlers?.onCardCreated(created.data);
              }
              break;
            }
            case "CARD_ARCHIVED": {
              const archivedCard = CardSchema.safeParse(data);
              if (archivedCard.success) {
                this.handlers?.onCardArchived?.(archivedCard.data);
              } else if (
                data &&
                typeof data === "object" &&
                "id" in data &&
                typeof (data as { id: unknown }).id === "string"
              ) {
                this.handlers?.onCardArchived?.(
                  data as { id: string; deleted?: boolean }
                );
              }
              break;
            }
            case "COLUMN_CREATED": {
              const col = ColumnSchema.safeParse(data);
              if (col.success) {
                this.handlers?.onColumnCreated(col.data);
              } else {
                const copied = CopyColumnResponseSchema.safeParse(data);
                if (copied.success) {
                  this.handlers?.onColumnCreated(copied.data.column);
                  for (const card of copied.data.cards) {
                    this.handlers?.onCardCreated(card);
                  }
                }
              }
              break;
            }
            case "COLUMN_MOVED": {
              const colMoved = ColumnMovedEventDataSchema.safeParse(data);
              if (colMoved.success) {
                this.handlers?.onColumnMoved?.(colMoved.data);
              } else {
                const asCol = ColumnSchema.safeParse(data);
                if (asCol.success) {
                  this.handlers?.onColumnUpdated?.(asCol.data);
                }
              }
              break;
            }
            case "COLUMN_UPDATED": {
              const col = ColumnSchema.safeParse(data);
              if (col.success) {
                this.handlers?.onColumnUpdated?.(col.data);
              }
              break;
            }
            case "COMMENT_ADDED": {
              const comment = CommentSchema.safeParse(data);
              if (comment.success) {
                this.handlers?.onCommentAdded?.(comment.data);
              } else {
                const asCard = CardSchema.safeParse(data);
                if (asCard.success) {
                  this.handlers?.onCardUpdated(asCard.data);
                }
              }
              break;
            }
            case "BOARD_UPDATED": {
              const board = BoardSchema.safeParse(data);
              if (board.success) {
                this.handlers?.onBoardUpdated?.(board.data);
              }
              break;
            }
          }
        } catch {
          // Ignore malformed WS frames
        }
      };

      socket.onerror = () => {
        if (this.isDisposed) return;
        this.handlers?.onStatusChange("disconnected");
      };

      socket.onclose = () => {
        if (this.isDisposed) return;
        this.handlers?.onStatusChange("disconnected");
        this.reconnectTimer = setTimeout(() => {
          this.openSocket();
        }, 4000);
      };
    } catch {
      this.handlers?.onStatusChange("disconnected");
    }
  }

  disconnect(): void {
    this.isDisposed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.onopen = null;
        this.ws.onmessage = null;
        this.ws.onerror = null;
        this.ws.onclose = null;
        this.ws.close();
      } catch {
        // Ignore close errors
      }
      this.ws = null;
    }
  }
}

export const boardWsClient = new BoardWebSocketClient();
