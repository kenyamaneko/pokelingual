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

/** レート制限の到達種別。"user" は個人上限、"global" はサービス全体上限。 */
export type RateLimitKind = "user" | "global";

/** レート制限到達を表す。handleError で 429 にマップされる。 */
export class RateLimitError extends Error {
  kind: RateLimitKind;

  constructor(kind: RateLimitKind) {
    super(`rate limit exceeded: ${kind}`);
    this.name = "RateLimitError";
    this.kind = kind;
  }
}
