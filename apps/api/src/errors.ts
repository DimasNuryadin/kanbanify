import type { ErrorCode, StandardError } from "@kinetix/contracts";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details: Record<string, unknown>;

  constructor(
    statusCode: number,
    code: ErrorCode,
    message: string,
    details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  toJSON(): StandardError {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
      },
    };
  }
}

export function buildErrorPayload(
  code: ErrorCode,
  message: string,
  details: Record<string, unknown> = {}
): StandardError {
  return {
    error: {
      code,
      message,
      details,
    },
  };
}
