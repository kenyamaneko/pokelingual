export type RateLimitKind = "user" | "global";

export interface RateLimitDetail {
  kind: RateLimitKind;
  message: string;
}

// axios インターセプタから React 木の外で発火させるため EventTarget で橋渡しする
export const rateLimitEvents = new EventTarget();

export const RATE_LIMIT_EVENT = "rate-limit";
