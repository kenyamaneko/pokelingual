/** リソースが存在しないことを表す。handleError で 404 にマップされる。 */
export class NotFoundError extends Error {
  /**
   * @param message エラーメッセージ。
   */
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

/** Gemini/Firestore など外部依存の呼び出し失敗を表す。handleError で 502 にマップされる。 */
export class ExternalServiceError extends Error {
  service: string;
  cause: Error;

  /**
   * @param service 失敗した外部サービス名。
   * @param err 原因となったエラー。
   */
  constructor(service: string, err: Error) {
    super(`${service}: ${err.message}`);
    this.name = "ExternalServiceError";
    this.service = service;
    this.cause = err;
  }
}

/** 現在の設定 (世代・除外) では出題できるポケモンがいないことを表す。handleError で 409 にマップされる。 */
export class EmptyQuestPoolError extends Error {
  constructor() {
    super("no pokemon available for the current quest settings");
    this.name = "EmptyQuestPoolError";
  }
}

/** 現在のクエストの状態ではヒントを要求できないことを表す。 */
export class HintUnavailableError extends Error {
  /**
   * @param message ヒントを要求できない理由。
   */
  constructor(message: string) {
    super(message);
    this.name = "HintUnavailableError";
  }
}

// RateLimitKind は 429 レスポンスの error フィールドに乗る wire 値なので、shared/api-types を SSOT として再 export する。
import type { RateLimitKind } from "../../../shared/api-types/rate-limit.js";
export type { RateLimitKind };

/** レート制限到達を表す。handleError で 429 にマップされる。 */
export class RateLimitError extends Error {
  kind: RateLimitKind;

  /**
   * @param kind 到達したレート制限の種別。
   */
  constructor(kind: RateLimitKind) {
    super(`rate limit exceeded: ${kind}`);
    this.name = "RateLimitError";
    this.kind = kind;
  }
}
