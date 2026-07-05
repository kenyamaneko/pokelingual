import type { Response } from "express";
import { NotFoundError, ExternalServiceError, RateLimitError } from "../domain/errors.js";
import { logger } from "../util/logger.js";
import type { RateLimitResponse } from "../../../shared/api-types/rate-limit.js";
import type { ErrorResponse } from "../../../shared/api-types/error.js";

/**
 * ドメインエラーを HTTP ステータスにマップしてレスポンスを返す共通ハンドラ。
 * @param res Express のレスポンスオブジェクト。
 * @param err 捕捉したエラー (ドメインエラーまたは想定外の値)。
 * @param path リクエストパス (ログ用)。
 */
export function handleError(res: Response, err: unknown, path: string): void {
  if (err instanceof NotFoundError) {
    logger.warn("resource not found", { error: String(err), path });
    res.status(404).json({ error: "resource not found" } satisfies ErrorResponse);
  } else if (err instanceof RateLimitError) {
    const message = err.kind === "user"
      ? "そろそろ　研究に　戻るぞ。また　明日　来てくれ"
      : "今日は　たくさんの　トレーナーが　来ているぞ。また　明日　来てくれ";
    const body: RateLimitResponse = { error: err.kind, message };
    res.status(429).json(body);
  } else if (err instanceof ExternalServiceError) {
    logger.error("external service error", { service: err.service, error: String(err.cause), path });
    res.status(502).json({ error: "external service unavailable" } satisfies ErrorResponse);
  } else {
    logger.error("internal error", { error: String(err), path });
    res.status(500).json({ error: "internal server error" } satisfies ErrorResponse);
  }
}
