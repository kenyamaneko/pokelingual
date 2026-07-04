import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";

// client.ts と同じ baseURL 組み立てにすることで、ハンドラ URL と実リクエスト URL を確実に一致させる。
const API_BASE = `${import.meta.env.VITE_API_BASE_URL}/api`;

/**
 * API パスを絶対 URL に変換する。テストで server.use のハンドラ URL を書くのに使う。
 * @param path 先頭スラッシュ始まりの API パス (例 "/usage")。
 * @returns baseURL を前置した絶対 URL。
 */
export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

/** バックエンドへ飛んだリクエストの記録。「呼ばれた/呼ばれない」を HTTP 境界で観測するのに使う。afterEach でクリアする。 */
export const requestLog: { method: string; path: string }[] = [];

/**
 * 記録済みリクエストのうち、指定パスへのものの件数を返す。
 * @param path 末尾一致で数える API パス (例 "/usage")。
 * @returns 該当リクエスト件数。
 */
export function countRequests(path: string): number {
  return requestLog.filter((r) => r.path.endsWith(path)).length;
}

// 既定ハンドラ: 背景取得 (UsageProvider の /usage 等) を含む全エンドポイントに無害な既定応答を与える。
// 各テストは server.use(...) でケースごとに上書きする。onUnhandledRequest:"error" のため全経路にハンドラが要る。
const defaultHandlers = [
  http.get(apiUrl("/usage"), () => HttpResponse.json({ count: 0, limit: 30 })),
  http.get(apiUrl("/pokedex"), () =>
    HttpResponse.json({ pokemon: [], captured_count: 0, unavailable_count: 0 }),
  ),
  http.get(apiUrl("/pokedex/:id"), () => HttpResponse.json({})),
  http.get(apiUrl("/quest/new"), () =>
    HttpResponse.json({
      pokemon_id: 1,
      description_en: "",
      is_legendary: false,
      is_mythical: false,
    }),
  ),
  http.post(apiUrl("/quest/score"), () =>
    HttpResponse.json({ score: 0, review: "", description_ja: "" }),
  ),
  http.post(apiUrl("/quest/guess-name"), () =>
    HttpResponse.json({ correct: false, ball_type: "poke", language: "en", attempts_remaining: 0 }),
  ),
  http.post(apiUrl("/quest/skip-guess"), () => HttpResponse.json({ ball_type: "poke" })),
  http.post(apiUrl("/quest/capture"), () => HttpResponse.json({})),
  http.post(apiUrl("/quest/chat"), () => HttpResponse.json({ reply: "" })),
  http.get(apiUrl("/settings"), () => HttpResponse.json({ excluded_pokemon_ids: [] })),
  http.put(apiUrl("/settings/excluded-pokemon"), () => HttpResponse.json({})),
];

/** テスト用の MSW サーバ。HTTP 境界でバックエンド API をモックする。 */
export const server = setupServer(...defaultHandlers);

server.events.on("request:start", ({ request }) => {
  requestLog.push({ method: request.method, path: new URL(request.url).pathname });
});
