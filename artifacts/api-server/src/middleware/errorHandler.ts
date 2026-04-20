import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { logger } from "../lib/logger";

function coerceStatus(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 400 || n > 599) return 500;
  return Math.floor(n);
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof ZodError) {
    logger.warn(
      { issues: err.errors, method: req.method, path: req.originalUrl },
      "request validation failed",
    );
    res.status(400).json({ message: "Invalid data", errors: err.errors });
    return;
  }

  const rawStatus = (err as any)?.status ?? (err as any)?.statusCode;
  const status = coerceStatus(rawStatus);
  const message =
    err instanceof Error ? err.message : "Internal server error";

  logger.error(
    { err, status, method: req.method, path: req.originalUrl },
    "request error",
  );
  res.status(status).json({ message });
}
