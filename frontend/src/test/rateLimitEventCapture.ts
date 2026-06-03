import { afterEach } from "vitest";
import { vi } from "vitest";
import { RATE_LIMIT_EVENT, rateLimitEvents } from "../utils/rateLimitEvents";

const cleanups: Array<() => void> = [];

// rateLimitEvents は EventTarget のシングルトン。テストが手動で removeEventListener
// を呼ぶとアサーション失敗時にリスナがリークし、後続テストに伝搬する。afterEach で一括解除する。
afterEach(() => {
  cleanups.splice(0).forEach((fn) => fn());
});

/** rateLimitEvents の発火を捕捉する vi.fn を返す。後始末は本ファイル内の afterEach に委ねる。 */
export function spyOnRateLimitEvents(): ReturnType<typeof vi.fn> {
  const handler = vi.fn();
  rateLimitEvents.addEventListener(RATE_LIMIT_EVENT, handler);
  cleanups.push(() => rateLimitEvents.removeEventListener(RATE_LIMIT_EVENT, handler));
  return handler;
}
