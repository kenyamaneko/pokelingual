import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { setupRoutes } from "./router.js";
import { devAuth } from "../middleware/auth-mock.js";
import { rateLimit } from "../middleware/rate-limit.js";
import { QuestService } from "../service/quest-service.js";
import { PokedexService } from "../service/pokedex-service.js";
import { QuestHandler } from "../handler/quest-handler.js";
import { PokedexHandler } from "../handler/pokedex-handler.js";
import { SettingsHandler } from "../handler/settings-handler.js";
import { UsageHandler } from "../handler/usage-handler.js";
import { TutorialHandler } from "../handler/tutorial-handler.js";
import { createTutorialQuestHandler } from "../composition/tutorial-quest.js";
import { RateLimitError } from "../domain/errors.js";
import { LOCATION_CHOICE_COUNT } from "../domain/location.js";
import type {
  LLMClient,
  RandomSource,
  RateLimitRepository,
  UserPokemonRepository,
  UserSettingsRepository,
  UserRepository,
} from "../domain/ports.js";
import type { UserPokemon, UserSettings } from "../domain/user.js";
import type { RateLimitKind } from "../domain/errors.js";
import { makePokemon, makePokemonClient } from "../testing/pokemon-fixtures.js";
import { makeInMemoryQuestSessionStore } from "../testing/session-store-fixture.js";

interface AppOverrides {
  /** LLM が投げるエラー (指定時は generateText が失敗する)。 */
  llmError?: Error;
  /** レートリミットが投げる到達種別 (指定時は checkAndIncrement が RateLimitError を投げる)。 */
  rateLimitKind?: RateLimitKind;
  /** settings 取得が投げるエラー (想定外エラー→500 の検証用)。 */
  settingsError?: Error;
  /** ポケモン種別クライアントが投げるエラー (指定時は getPokemonByID が失敗する)。 */
  pokemonError?: Error;
  /** クエストセッションストアが投げるエラー (指定時は get/set/delete がこのエラーを投げる)。 */
  sessionStoreError?: Error;
  /** 図鑑詳細エンドポイントの検証用に、事前に保存済みとして扱うユーザ実績。 */
  seededUserPokemon?: UserPokemon[];
}

/**
 * 本物の router/handler/service にスタブの外部境界を注入した Express アプリを組み立てる。
 * @param o スタブ挙動の上書き。
 * @returns supertest で叩ける Express アプリ。
 */
function makeApp(o: AppOverrides = {}) {
  const pokemonClient = makePokemonClient([makePokemon()], { error: o.pokemonError });
  const llm: LLMClient = {
    generateText: async () => {
      if (o.llmError) throw o.llmError;
      return JSON.stringify({ score: 70, review: "よい 翻訳だ。" });
    },
  };
  const environment = "prod" as const;
  // 除外設定の検証用の供給可能な図鑑番号 (ダミー)。1..100 を供給リストとして扱う。
  const servablePokemonIDs = new Set(Array.from({ length: 100 }, (_, i) => i + 1));
  const random: RandomSource = { next: () => 0 };

  // インメモリの Firestore 代替。保存された値を公開 API (GET /pokedex 等) から観測するために状態を持つ。
  const pokemonStore = new Map<number, UserPokemon>();
  for (const entry of o.seededUserPokemon ?? []) {
    pokemonStore.set(entry.pokemon_id, entry);
  }
  const userPokemonRepo: UserPokemonRepository = {
    upsertEncounter: async (_uid, pokemonID, score, isCaptured) => {
      pokemonStore.set(pokemonID, {
        pokemon_id: pokemonID,
        status: isCaptured ? "captured" : "seen",
        total_captures: isCaptured ? 1 : 0,
        total_encounters: 1,
        last_captured_at: isCaptured ? new Date() : null,
        last_encountered_at: new Date(),
        best_score: score,
      });
    },
    getPokedex: async () => [...pokemonStore.values()],
    getPokemon: async (_uid, pokemonID) => {
      const p = pokemonStore.get(pokemonID);
      if (!p) throw new Error(`not found: ${pokemonID}`);
      return p;
    },
  };

  let savedSettings: UserSettings = { excluded_pokemon_ids: null, enabled_generations: null };
  const settingsRepo: UserSettingsRepository = {
    getSettings: async () => {
      if (o.settingsError) throw o.settingsError;
      return savedSettings;
    },
    updateExcludedPokemon: async (_uid, ids) => {
      savedSettings = { ...savedSettings, excluded_pokemon_ids: ids };
    },
    updateEnabledGenerations: async (_uid, generations) => {
      savedSettings = { ...savedSettings, enabled_generations: generations };
    },
  };

  let tutorialCompleted = false;
  const userRepo: UserRepository = {
    getUser: async () => ({ tutorial_completed: tutorialCompleted }),
    markTutorialCompleted: async () => {
      tutorialCompleted = true;
    },
  };

  const rateLimitRepo: RateLimitRepository = {
    checkAndIncrement: async () => {
      if (o.rateLimitKind) throw new RateLimitError(o.rateLimitKind);
      return { count: 1, limit: 30 };
    },
    getUserUsage: async () => ({ count: 3, limit: 30 }),
  };

  const sessionStore = makeInMemoryQuestSessionStore({ error: o.sessionStoreError });
  const tutorialSessionStore = makeInMemoryQuestSessionStore();
  const questService = new QuestService(pokemonClient, llm, environment, settingsRepo, random, sessionStore);
  const pokedexService = new PokedexService(userPokemonRepo, pokemonClient, settingsRepo, environment);

  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    setupRoutes(
      devAuth(),
      rateLimit(rateLimitRepo),
      new QuestHandler(questService, userPokemonRepo),
      createTutorialQuestHandler(environment, tutorialSessionStore),
      new PokedexHandler(pokedexService),
      new SettingsHandler(settingsRepo, servablePokemonIDs),
      new UsageHandler(rateLimitRepo),
      new TutorialHandler(userRepo),
    ),
  );
  return app;
}

describe("エラー時の HTTP レスポンス (公開入口経由)", () => {
  it("セッションが無い採点リクエストは 404 を返す", async () => {
    const res = await request(makeApp()).post("/api/quest/score").send({ translation: "訳" });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "resource not found" });
  });

  it("AI 呼び出しが失敗した採点は 502 を返す", async () => {
    const app = makeApp({ llmError: new Error("llm down") });
    await request(app).get("/api/quest/new");
    const res = await request(app).post("/api/quest/score").send({ translation: "訳" });
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: "external service unavailable" });
  });

  it("ポケモン情報の取得に失敗した出題リクエストは 502 を返す", async () => {
    const app = makeApp({ pokemonError: new Error("pokemon data unavailable") });
    const res = await request(app).get("/api/quest/new");
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: "external service unavailable" });
  });

  it("ポケモン情報の取得に失敗した図鑑詳細リクエストは 502 を返す", async () => {
    const app = makeApp({
      pokemonError: new Error("pokemon data unavailable"),
      seededUserPokemon: [
        {
          pokemon_id: 1,
          status: "seen",
          total_captures: 0,
          total_encounters: 1,
          last_captured_at: null,
          last_encountered_at: new Date(),
          best_score: 0,
        },
      ],
    });
    const res = await request(app).get("/api/pokedex/1");
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: "external service unavailable" });
  });

  it("自分の利用上限に達すると 429 になり、個人の上限である旨とユーザー向けメッセージを返す", async () => {
    const app = makeApp({ rateLimitKind: "user" });
    const res = await request(app).post("/api/quest/score").send({ translation: "訳" });
    expect(res.status).toBe(429);
    expect(res.body.error).toBe("user");
    expect(res.body.message).toBeTruthy();
  });

  it("全体の利用上限に達すると 429 になり、全体の上限である旨を返し、メッセージはユーザー上限時と異なる", async () => {
    const userRes = await request(makeApp({ rateLimitKind: "user" }))
      .post("/api/quest/score")
      .send({ translation: "訳" });
    const globalRes = await request(makeApp({ rateLimitKind: "global" }))
      .post("/api/quest/score")
      .send({ translation: "訳" });
    expect(globalRes.status).toBe(429);
    expect(globalRes.body.error).toBe("global");
    expect(globalRes.body.message).not.toBe(userRes.body.message);
  });

  it("想定外のエラーは 500 を返す", async () => {
    const app = makeApp({ settingsError: new Error("boom") });
    const res = await request(app).get("/api/quest/new");
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "internal server error" });
  });

  it("残り試行回数が不足した状態でヒントを要求すると 500 を返す", async () => {
    const app = makeApp();
    await request(app).get("/api/quest/new");
    await request(app).post("/api/quest/guess-name").send({ guess: "wrong1" });
    await request(app).post("/api/quest/guess-name").send({ guess: "wrong2" });
    const res = await request(app).post("/api/quest/hint").send({});
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "internal server error" });
  });

  it("セッションストアが障害を起こすと 502 を返す", async () => {
    const app = makeApp({ sessionStoreError: new Error("redis unavailable") });
    const res = await request(app).get("/api/quest/new");
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: "external service unavailable" });
  });
});

describe("入力バリデーションの 400 (公開入口経由)", () => {
  it("訳文が無い採点リクエストは 400", async () => {
    const res = await request(makeApp()).post("/api/quest/score").send({});
    expect(res.status).toBe(400);
  });

  it("名前当ての回答が無いリクエストは 400", async () => {
    const res = await request(makeApp()).post("/api/quest/guess-name").send({});
    expect(res.status).toBe(400);
  });

  it("数値でない図鑑 ID は 400", async () => {
    const res = await request(makeApp()).get("/api/pokedex/abc");
    expect(res.status).toBe(400);
  });

  it("配列でない除外設定は 400", async () => {
    const res = await request(makeApp()).put("/api/settings/excluded-pokemon").send({ pokemon_ids: "1" });
    expect(res.status).toBe(400);
  });

  it.each([0, 101])("供給リストに無い除外 ID %s は 400", async (id) => {
    const res = await request(makeApp()).put("/api/settings/excluded-pokemon").send({ pokemon_ids: [id] });
    expect(res.status).toBe(400);
  });

  it("件数上限を超える除外設定は 400", async () => {
    const ids = Array.from({ length: 31 }, (_, i) => i + 1);
    const res = await request(makeApp()).put("/api/settings/excluded-pokemon").send({ pokemon_ids: ids });
    expect(res.status).toBe(400);
  });

  it("空の世代設定は 400 (最低1世代必須)", async () => {
    const res = await request(makeApp()).put("/api/settings/generations").send({ generations: [] });
    expect(res.status).toBe(400);
  });

  it("未知の世代番号を含む世代設定は 400", async () => {
    const res = await request(makeApp()).put("/api/settings/generations").send({ generations: [99] });
    expect(res.status).toBe(400);
  });
});

describe("正常系フロー (公開入口経由)", () => {
  it("出題→採点→スキップ→捕獲が通り、捕獲結果が図鑑に保存される", async () => {
    const app = makeApp();

    const quest = await request(app).get("/api/quest/new");
    expect(quest.status).toBe(200);
    expect(quest.body.description_en).toBe(
      "A strange seed was planted on its back at birth. The plant sprouts and grows with this Pokémon.",
    );

    const score = await request(app).post("/api/quest/score").send({ translation: "はやい" });
    expect(score.status).toBe(200);
    expect(score.body.score).toBe(66);

    const skip = await request(app).post("/api/quest/skip-guess").send({});
    expect(skip.status).toBe(200);
    expect(skip.body).toEqual({ ball_type: "poke" });

    const capture = await request(app).post("/api/quest/capture").send({});
    expect(capture.status).toBe(200);
    expect(capture.body.captured).toBe(true);
    expect(capture.body.ball_type).toBe("poke");

    // 操作の結果まで確かめる: 捕獲したポケモンが公開 API 経由で図鑑に現れる
    const pokedex = await request(app).get("/api/pokedex");
    expect(pokedex.status).toBe(200);
    expect(pokedex.body.pokemon).toHaveLength(1);
    expect(pokedex.body.pokemon[0]).toMatchObject({ pokemon_id: 1, status: "captured" });
    expect(pokedex.body.captured_count).toBe(1);
  });

  it("規定回数連続で名前当てに不正解すると、最終回の応答で正解名が開示される", async () => {
    const app = makeApp();
    await request(app).get("/api/quest/new");
    const first = await request(app).post("/api/quest/guess-name").send({ guess: "wrong1" });
    expect(first.body.reveal_name_en).toBeUndefined();
    const second = await request(app).post("/api/quest/guess-name").send({ guess: "wrong2" });
    expect(second.body.reveal_name_en).toBeUndefined();
    const third = await request(app).post("/api/quest/guess-name").send({ guess: "wrong3" });
    expect(third.body).toMatchObject({
      correct: false,
      ball_type: "poke",
      attempts_remaining: 0,
      reveal_name_en: "Bulbasaur",
    });
  });

  it("出題後にヒントを要求すると、出題ポケモンのタイプと消費後の残り試行回数が返る", async () => {
    const app = makeApp();
    await request(app).get("/api/quest/new");
    const res = await request(app).post("/api/quest/hint").send({});
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ types: ["grass", "poison"], attempts_remaining: 2 });
  });

  it("重複や順序を含む除外設定を保存すると、取得時は重複を除いた昇順の内容が返る", async () => {
    const app = makeApp();
    const put = await request(app).put("/api/settings/excluded-pokemon").send({ pokemon_ids: [7, 3, 3] });
    expect(put.status).toBe(200);

    // 重複排除・昇順に正規化されて保存される。世代は未設定なので全世代が返る
    const got = await request(app).get("/api/settings");
    expect(got.status).toBe(200);
    expect(got.body).toEqual({ excluded_pokemon_ids: [3, 7], enabled_generations: [1, 2, 3, 4, 5, 6, 7, 8] });
  });

  it("重複や順序を含む世代設定を保存すると、取得時は重複を除いた昇順の内容が返る", async () => {
    const app = makeApp();
    const put = await request(app).put("/api/settings/generations").send({ generations: [3, 1, 1] });
    expect(put.status).toBe(200);

    // 重複排除・昇順に正規化され、除外は未設定なので空で返る
    const got = await request(app).get("/api/settings");
    expect(got.status).toBe(200);
    expect(got.body).toEqual({ excluded_pokemon_ids: [], enabled_generations: [1, 3] });
  });

  it("認証済みユーザーが利用状況を取得すると、利用回数と上限が返る", async () => {
    const res = await request(makeApp()).get("/api/usage");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ count: 3, limit: 30 });
  });

  it("チュートリアル未完了のとき、完了状態を取得すると false が返る", async () => {
    const res = await request(makeApp()).get("/api/tutorial-status");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ tutorial_completed: false });
  });

  it("完了フラグを立てた後に完了状態を取得すると、true が返る", async () => {
    const app = makeApp();
    const complete = await request(app).put("/api/tutorial-status/complete");
    expect(complete.status).toBe(200);

    const got = await request(app).get("/api/tutorial-status");
    expect(got.body).toEqual({ tutorial_completed: true });
  });

  it("場所選択の候補として、決められた数の場所が ID・名前・説明・タイプ付きで返る", async () => {
    const res = await request(makeApp()).get("/api/quest/locations");
    expect(res.status).toBe(200);
    expect(res.body.locations).toHaveLength(LOCATION_CHOICE_COUNT);
    expect(res.body.locations[0]).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      description: expect.any(String),
      types: expect.any(Array),
    });
  });
});

describe("チュートリアル用クエスト (公開入口経由)", () => {
  it("出題はピカチュウ固定で、決まった英文が返る", async () => {
    const res = await request(makeApp()).get("/api/tutorial/quest/new");
    expect(res.status).toBe(200);
    expect(res.body.pokemon_id).toBe(25);
    expect(res.body.description_en).toBe("It is an Electric-type Mouse Pokémon.");
  });

  it("採点は最終評価点の上限 (99) になる", async () => {
    const app = makeApp();
    await request(app).get("/api/tutorial/quest/new");
    const res = await request(app).post("/api/tutorial/quest/score").send({ translation: "でたらめ" });
    expect(res.status).toBe(200);
    expect(res.body.score).toBe(99);
  });

  it("英語名で正解すると、ハイパーボールが手に入る", async () => {
    const app = makeApp();
    await request(app).get("/api/tutorial/quest/new");
    const res = await request(app).post("/api/tutorial/quest/guess-name").send({ guess: "pikachu" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ correct: true, ball_type: "ultra" });
  });

  it("日本語名で正解すると、スーパーボールが手に入る", async () => {
    const app = makeApp();
    await request(app).get("/api/tutorial/quest/new");
    const res = await request(app).post("/api/tutorial/quest/guess-name").send({ guess: "ピカチュウ" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ correct: true, ball_type: "great" });
  });

  it("採点して名前を当てた後の捕獲は必ず成功する", async () => {
    const app = makeApp();
    await request(app).get("/api/tutorial/quest/new");
    await request(app).post("/api/tutorial/quest/score").send({ translation: "電気タイプのねずみポケモン" });
    await request(app).post("/api/tutorial/quest/guess-name").send({ guess: "ピカチュウ" });
    const res = await request(app).post("/api/tutorial/quest/capture").send({});
    expect(res.status).toBe(200);
    expect(res.body.captured).toBe(true);
  });

  it("捕獲まで進めても、ユーザーの図鑑には記録されない", async () => {
    const app = makeApp();
    await request(app).get("/api/tutorial/quest/new");
    await request(app).post("/api/tutorial/quest/score").send({ translation: "電気タイプのねずみポケモン" });
    await request(app).post("/api/tutorial/quest/guess-name").send({ guess: "ピカチュウ" });
    await request(app).post("/api/tutorial/quest/capture").send({});

    const pokedex = await request(app).get("/api/pokedex");
    expect(pokedex.status).toBe(200);
    expect(pokedex.body.pokemon).toHaveLength(0);
    expect(pokedex.body.captured_count).toBe(0);
  });

  it("採点は利用上限に達していても実行できる", async () => {
    const app = makeApp({ rateLimitKind: "user" });
    await request(app).get("/api/tutorial/quest/new");
    const res = await request(app).post("/api/tutorial/quest/score").send({ translation: "でたらめ" });
    expect(res.status).toBe(200);
    expect(res.body.score).toBe(99);
  });
});
