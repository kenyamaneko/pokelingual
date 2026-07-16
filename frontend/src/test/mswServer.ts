import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import type { BallType } from "../../../shared/api-types/quest";

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

/** チュートリアルの名前当てで直近に獲得したボール種別。guess-name と capture の応答を一致させるために保持する。 */
let tutorialEarnedBall: BallType = "ultra";

/** テストケース間で tutorialEarnedBall を初期状態に戻す。afterEach から呼ぶ。 */
export function resetTutorialQuestState(): void {
  tutorialEarnedBall = "ultra";
}

// 既定ハンドラ: 背景取得 (UsageProvider の /usage 等) を含む全エンドポイントに無害な既定応答を与える。
// 各テストは server.use(...) でケースごとに上書きする。onUnhandledRequest:"error" のため全経路にハンドラが要る。
const defaultHandlers = [
  http.get(apiUrl("/usage"), () => HttpResponse.json({ count: 0, limit: 30 })),
  http.get(apiUrl("/pokedex"), () =>
    HttpResponse.json({ pokemon: [], captured_count: 0, unavailable_count: 0 }),
  ),
  http.get(apiUrl("/pokedex/:id"), () => HttpResponse.json({})),
  http.get(apiUrl("/quest/locations"), () =>
    HttpResponse.json({
      locations: [
        { id: "test-place", name: "テスト草原", description: "テスト用の場所", types: ["normal"] },
      ],
    }),
  ),
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
  http.get(apiUrl("/tutorial/quest/new"), () =>
    HttpResponse.json({
      pokemon_id: 25,
      description_en: "It is an Electric-type Mouse Pokémon.",
      is_legendary: false,
      is_mythical: false,
    }),
  ),
  http.post(apiUrl("/tutorial/quest/score"), () =>
    HttpResponse.json({ score: 99, review: "かんぺきな　ほんやくだ！", description_ja: "電気タイプのねずみポケモン" }),
  ),
  http.post(apiUrl("/tutorial/quest/guess-name"), async ({ request }) => {
    const { guess } = (await request.json()) as { guess: string };
    const isEnglish = guess.trim().toLowerCase() === "pikachu";
    tutorialEarnedBall = isEnglish ? "ultra" : "great";
    return HttpResponse.json({
      correct: true,
      ball_type: tutorialEarnedBall,
      language: isEnglish ? "en" : "ja",
      attempts_remaining: 0,
    });
  }),
  http.post(apiUrl("/tutorial/quest/skip-guess"), () => HttpResponse.json({ ball_type: "poke" })),
  http.post(apiUrl("/tutorial/quest/capture"), () =>
    HttpResponse.json({
      captured: true,
      probability: 1,
      pokemon_id: 25,
      name_en: "Pikachu",
      name_ja: "ピカチュウ",
      sprite_url: "https://example.test/pikachu.png",
      score: 99,
      description_en: "It is an Electric-type Mouse Pokémon.",
      description_ja: "電気タイプのねずみポケモン",
      base_stat_total: 320,
      ball_type: tutorialEarnedBall,
      types: ["electric"],
      height: 4,
      weight: 60,
      is_legendary: false,
      is_mythical: false,
    }),
  ),
  http.get(apiUrl("/settings"), () =>
    HttpResponse.json({ excluded_pokemon_ids: [], enabled_generations: [1, 2, 3, 4, 5, 6, 7, 8] }),
  ),
  http.put(apiUrl("/settings/excluded-pokemon"), () => HttpResponse.json({})),
  http.get(apiUrl("/tutorial-status"), () => HttpResponse.json({ tutorial_completed: false })),
  http.put(apiUrl("/tutorial-status/complete"), () => HttpResponse.json({ status: "ok" })),
];

/** テスト用の MSW サーバ。HTTP 境界でバックエンド API をモックする。 */
export const server = setupServer(...defaultHandlers);

server.events.on("request:start", ({ request }) => {
  requestLog.push({ method: request.method, path: new URL(request.url).pathname });
});
