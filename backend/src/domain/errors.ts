/** リソースが存在しないことを表す。handleError で 404 にマップされる。 */
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

/** PokeAPI/Gemini など外部サービス呼び出し失敗を表す。handleError で 502 にマップされる。 */
export class ExternalServiceError extends Error {
  service: string;
  cause: Error;

  constructor(service: string, err: Error) {
    super(`${service}: ${err.message}`);
    this.name = "ExternalServiceError";
    this.service = service;
    this.cause = err;
  }
}

// RateLimitKind は 429 レスポンスの error フィールドに乗る wire 値なので、shared/api-types を SSOT として再 export する。
import type { RateLimitKind } from "../../../shared/api-types/rate-limit.js";
export type { RateLimitKind };

/** レート制限到達を表す。handleError で 429 にマップされる。 */
export class RateLimitError extends Error {
  kind: RateLimitKind;

  constructor(kind: RateLimitKind) {
    super(`rate limit exceeded: ${kind}`);
    this.name = "RateLimitError";
    this.kind = kind;
  }
}
