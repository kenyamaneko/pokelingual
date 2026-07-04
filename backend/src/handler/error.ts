import type { Response } from "express";
import { NotFoundError, ExternalServiceError, RateLimitError } from "../domain/errors.js";
import type { RateLimitResponse } from "../../../shared/api-types/rate-limit.js";

/**
 * ドメインエラーを HTTP ステータスにマップしてレスポンスを返す共通ハンドラ。
 * @param res Express のレスポンスオブジェクト。
 * @param err 捕捉したエラー (ドメインエラーまたは想定外の値)。
 * @param path リクエストパス (ログ用)。
 */
export function handleError(res: Response, err: unknown, path: string): void {
  if (err instanceof NotFoundError) {
    console.warn("resource not found", { error: String(err), path });
    res.status(404).json({ error: "resource not found" });
  } else if (err instanceof RateLimitError) {
    const message = err.kind === "user"
      ? "きょうの　しゅぎょうは　ここまでだ！あした　また　きてくれな。"
      : "きょうは　たくさんの　トレーナーが　きているようだ。あした　また　ちょうせんしてくれ！";
    const body: RateLimitResponse = { error: err.kind, message };
    res.status(429).json(body);
  } else if (err instanceof ExternalServiceError) {
    console.error("external service error", { service: err.service, error: String(err.cause), path });
    res.status(502).json({ error: "external service unavailable" });
  } else {
    console.error("internal error", { error: String(err), path });
    res.status(500).json({ error: "internal server error" });
  }
}
