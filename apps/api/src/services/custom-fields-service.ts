import { randomUUID } from "node:crypto";
import {
  type Card,
  type CustomFieldDefinition,
  type CustomFieldOption,
  type CreateCustomFieldDefinitionRequest,
  type UpdateCustomFieldDefinitionRequest,
} from "@kinetix/contracts";
import { StorageRepository } from "../db/repository.js";
import { BoardRealtimeHub } from "../ws/hub.js";
import { AppError } from "../errors.js";

function generateNextPosition(existingPositions: string[]): string {
  if (existingPositions.length === 0) return "a0";
  const sorted = [...existingPositions].sort();
  const last = sorted[sorted.length - 1]!;
  const match = last.match(/^a(\d+)$/);
  if (match) {
    return `a${parseInt(match[1]!, 10) + 1}`;
  }
  return `${last}z`;
}

export class CustomFieldsService {
  constructor(
    private readonly repository: StorageRepository,
    private readonly hub: BoardRealtimeHub
  ) {}

  public async listCustomFields(boardId: string): Promise<CustomFieldDefinition[]> {
    const fields = await this.repository.getCustomFields(boardId);
    return [...fields].sort((a, b) => a.position.localeCompare(b.position));
  }

  public async createCustomField(
    boardId: string,
    input: CreateCustomFieldDefinitionRequest,
    actorId = "kinetix-api"
  ): Promise<CustomFieldDefinition> {
    const board = await this.repository.getBoardById(boardId);
    if (!board) {
      throw new AppError(
        404,
        "RESOURCE_NOT_FOUND",
        `Board '${boardId}' not found`,
        { board_id: boardId }
      );
    }

    const existingPositions = (board.custom_fields ?? []).map((f) => f.position);
    const position = input.position ?? generateNextPosition(existingPositions);

    let options: CustomFieldOption[] = [];
    if (input.type === "DROPDOWN") {
      options = (input.options ?? []).map((opt) => ({
        id:
          opt.id && opt.id.trim().length > 0
            ? opt.id
            : `opt-${randomUUID().slice(0, 8)}`,
        label: opt.label,
        color: opt.color ?? "blue",
      }));
    }

    const newField: CustomFieldDefinition = {
      id: `cf-${randomUUID()}`,
      board_id: boardId,
      name: input.name,
      type: input.type,
      options,
      show_on_front: input.show_on_front ?? true,
      position,
      created_at: new Date().toISOString(),
    };

    const created = await this.repository.createCustomField(boardId, newField);

    await this.hub.broadcast({
      event: "BOARD_UPDATED",
      board_id: boardId,
      actor_id: actorId,
      data: { custom_field: created },
    });

    return created;
  }

  public async updateCustomField(
    fieldId: string,
    input: UpdateCustomFieldDefinitionRequest,
    actorId = "kinetix-api"
  ): Promise<CustomFieldDefinition> {
    const updatePayload: Partial<CustomFieldDefinition> = {};

    if (input.name !== undefined) {
      updatePayload.name = input.name;
    }
    if (input.show_on_front !== undefined) {
      updatePayload.show_on_front = input.show_on_front;
    }
    if (input.position !== undefined) {
      updatePayload.position = input.position;
    }
    if (input.options !== undefined) {
      updatePayload.options = input.options.map((opt) => ({
        id:
          opt.id && opt.id.trim().length > 0
            ? opt.id
            : `opt-${randomUUID().slice(0, 8)}`,
        label: opt.label,
        color: opt.color ?? "blue",
      }));
    }

    const res = await this.repository.updateCustomField(fieldId, updatePayload);

    await this.hub.broadcast({
      event: "BOARD_UPDATED",
      board_id: res.boardId,
      actor_id: actorId,
      data: { custom_field: res.field },
    });

    return res.field;
  }

  public async deleteCustomField(
    fieldId: string,
    actorId = "kinetix-api"
  ): Promise<{ id: string; deleted: true }> {
    const res = await this.repository.deleteCustomField(fieldId);

    await this.hub.broadcast({
      event: "BOARD_UPDATED",
      board_id: res.boardId,
      actor_id: actorId,
      data: { deleted_field_id: fieldId },
    });

    return { id: res.id, deleted: true };
  }

  public async setCardCustomFieldValue(
    cardId: string,
    fieldId: string,
    value: string | number | boolean | null,
    actorName = "Alex Rivera",
    actorId = "kinetix-api"
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

    const board = await this.repository.getBoardById(card.board_id);
    if (!board) {
      throw new AppError(
        404,
        "RESOURCE_NOT_FOUND",
        `Board '${card.board_id}' not found`,
        { board_id: card.board_id }
      );
    }

    const fieldDef = (board.custom_fields ?? []).find((f) => f.id === fieldId);
    if (!fieldDef) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        `Custom field '${fieldId}' does not belong to board '${card.board_id}'`,
        { field_id: fieldId, board_id: card.board_id }
      );
    }

    // Validate value against field type
    if (value !== null) {
      switch (fieldDef.type) {
        case "NUMBER": {
          if (typeof value !== "number" || Number.isNaN(value)) {
            throw new AppError(
              400,
              "VALIDATION_ERROR",
              `Value for custom field '${fieldDef.name}' must be a number or null`,
              { field_id: fieldId, field_type: fieldDef.type, value }
            );
          }
          break;
        }
        case "CHECKBOX": {
          if (typeof value !== "boolean") {
            throw new AppError(
              400,
              "VALIDATION_ERROR",
              `Value for custom field '${fieldDef.name}' must be a boolean or null`,
              { field_id: fieldId, field_type: fieldDef.type, value }
            );
          }
          break;
        }
        case "DROPDOWN": {
          if (typeof value !== "string") {
            throw new AppError(
              400,
              "VALIDATION_ERROR",
              `Value for custom field '${fieldDef.name}' must be an option ID string or null`,
              { field_id: fieldId, field_type: fieldDef.type, value }
            );
          }
          const optionExists = (fieldDef.options ?? []).some(
            (opt) => opt.id === value
          );
          if (!optionExists) {
            throw new AppError(
              400,
              "VALIDATION_ERROR",
              `Option ID '${value}' is not valid for dropdown custom field '${fieldDef.name}'`,
              {
                field_id: fieldId,
                field_type: fieldDef.type,
                value,
                valid_options: (fieldDef.options ?? []).map((o) => o.id),
              }
            );
          }
          break;
        }
        case "TEXT": {
          if (typeof value !== "string") {
            throw new AppError(
              400,
              "VALIDATION_ERROR",
              `Value for custom field '${fieldDef.name}' must be a string or null`,
              { field_id: fieldId, field_type: fieldDef.type, value }
            );
          }
          break;
        }
        case "DATE": {
          if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
            throw new AppError(
              400,
              "VALIDATION_ERROR",
              `Value for custom field '${fieldDef.name}' must be a valid date string or null`,
              { field_id: fieldId, field_type: fieldDef.type, value }
            );
          }
          break;
        }
      }
    }

    const updatedCard = await this.repository.setCardCustomFieldValue(
      cardId,
      fieldId,
      value,
      {
        actorName,
        activityDescription: `${actorName} updated custom field "${fieldDef.name}"`,
      }
    );

    await this.hub.broadcast({
      event: "CARD_UPDATED",
      board_id: board.id,
      actor_id: actorId,
      data: updatedCard,
    });

    return updatedCard;
  }
}
