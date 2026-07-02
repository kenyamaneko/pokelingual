import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { setupRoutes } from "./router.js";
import { devAuth } from "../middleware/auth-mock.js";
import { rateLimit } from "../middleware/rate-limit.js";
import { QuestService } from "../service/quest-service.js";
import { ChatService } from "../service/chat-service.js";
import { PokedexService } from "../service/pokedex-service.js";
import { QuestHandler } from "../handler/quest-handler.js";
import { PokedexHandler } from "../handler/pokedex-handler.js";
import { SettingsHandler } from "../handler/settings-handler.js";
import { UsageHandler } from "../handler/usage-handler.js";
import { RateLimitError } from "../domain/errors.js";
import type {
  LLMClient,
  PokemonClient,
  PokemonConfig,
  RandomSource,
  RateLimitRepository,
  UserPokemonRepository,
  UserSettingsRepository,
} from "../domain/ports.js";
import type { Pokemon } from "../domain/pokemon.js";
import type { UserPokemon, UserSettings } from "../domain/user.js";
import type { RateLimitKind } from "../domain/errors.js";

/**
 * テスト用のダミーポケモンを作る。
 * @param overrides 上書きするフィールド。
 * @returns ダミーポケモン。
 */
function makePokemon(overrides: Partial<Pokemon> = {}): Pokemon {
  return {
    id: 1,
    name_en: "Testmon",
    name_ja: "テストモン",
    description_en: "Testmon is fast.",
    description_ja: "テストモンは 速い。",
    sprite_url: "https://example.com/1.png",
    base_stat_total: 300,
    types: ["normal"],
    height: 1,
    weight: 1,
    is_legendary: false,
    is_mythical: false,
    ...overrides,
  };
}

interface AppOverrides {
  /** LLM が投げるエラー (指定時は generateText が失敗する)。 */
  llmError?: Error;
  /** レートリミットが投げる到達種別 (指定時は checkAndIncrement が RateLimitError を投げる)。 */
  rateLimitKind?: RateLimitKind;
  /** settings 取得が投げるエラー (想定外エラー→500 の検証用)。 */
  settingsError?: Error;
}

/**
 * 本物の router/handler/service にスタブの外部境界を注入した Express アプリを組み立てる。
 * @param o スタブ挙動の上書き。
 * @returns supertest で叩ける Express アプリ。
 */
function makeApp(o: AppOverrides = {}) {
  const pokemonClient: PokemonClient = {
    getRandomPokemon: async () => makePokemon(),
    getPokemonByID: async () => makePokemon(),
  };
  const llm: LLMClient = {
    generateText: async () => {
      if (o.llmError) throw o.llmError;
      return JSON.stringify({ score: 70, review: "よい 翻訳だ。" });
    },
  };
  const config: PokemonConfig = { maxPokemonID: 100, devExcludedPokemonIDs: [] };
  const random: RandomSource = { next: () => 0 };

  // インメモリの Firestore 代替。保存された値を公開 API (GET /pokedex 等) から観測するために状態を持つ。
  const pokemonStore = new Map<number, UserPokemon>();
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

  let savedSettings: UserSettings = { excluded_pokemon_ids: null };
  const settingsRepo: UserSettingsRepository = {
    getSettings: async () => {
      if (o.settingsError) throw o.settingsError;
      return savedSettings;
    },
    updateExcludedPokemon: async (_uid, ids) => {
      savedSettings = { excluded_pokemon_ids: ids };
    },
  };

  const rateLimitRepo: RateLimitRepository = {
    checkAndIncrement: async () => {
      if (o.rateLimitKind) throw new RateLimitError(o.rateLimitKind);
      return { count: 1, limit: 30 };
    },
    getUserUsage: async () => ({ count: 3, limit: 30 }),
  };

  const questService = new QuestService(pokemonClient, llm, config, settingsRepo, random);
  const chatService = new ChatService(llm);
  const pokedexService = new PokedexService(userPokemonRepo, pokemonClient, settingsRepo, config);

  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    setupRoutes(
      devAuth(),
      rateLimit(rateLimitRepo),
      new QuestHandler(questService, chatService, userPokemonRepo),
      new PokedexHandler(pokedexService),
      new SettingsHandler(settingsRepo, config),
      new UsageHandler(rateLimitRepo),
    ),
  );
  return app;
}

describe("エラー→HTTP マッピング (公開入口経由)", () => {
  it("セッションが無い採点リクエストは 404 を返す", async () => {
    const res = await request(makeApp()).post("/api/quest/score").send({ translation: "訳" });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "resource not found" });
  });

  it("LLM が失敗した採点は 502 を返す", async () => {
    const app = makeApp({ llmError: new Error("llm down") });
    await request(app).get("/api/quest/new");
    const res = await request(app).post("/api/quest/score").send({ translation: "訳" });
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: "external service unavailable" });
  });

  it("ユーザー上限到達は 429 + kind=user + ユーザー向けメッセージを返す", async () => {
    const app = makeApp({ rateLimitKind: "user" });
    const res = await request(app).post("/api/quest/score").send({ translation: "訳" });
    expect(res.status).toBe(429);
    expect(res.body.error).toBe("user");
    expect(res.body.message).toBeTruthy();
  });

  it("全体上限到達は 429 + kind=global を返し、メッセージは user と異なる", async () => {
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
});

describe("入力バリデーションの 400 (公開入口経由)", () => {
  it("translation 欠落の採点は 400", async () => {
    const res = await request(makeApp()).post("/api/quest/score").send({});
    expect(res.status).toBe(400);
  });

  it("guess 欠落の名前推測は 400", async () => {
    const res = await request(makeApp()).post("/api/quest/guess-name").send({});
    expect(res.status).toBe(400);
  });

  it("messages 空のチャットは 400", async () => {
    const res = await request(makeApp()).post("/api/quest/chat").send({ context: {}, messages: [] });
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

  it.each([0, 101])("範囲外の除外 ID %i は 400", async (id) => {
    const res = await request(makeApp()).put("/api/settings/excluded-pokemon").send({ pokemon_ids: [id] });
    expect(res.status).toBe(400);
  });

  it("件数上限を超える除外設定は 400", async () => {
    const ids = Array.from({ length: 31 }, (_, i) => i + 1);
    const res = await request(makeApp()).put("/api/settings/excluded-pokemon").send({ pokemon_ids: ids });
    expect(res.status).toBe(400);
  });
});

describe("正常系フロー (公開入口経由)", () => {
  it("出題→採点→スキップ→捕獲が通り、捕獲結果が図鑑に保存される", async () => {
    const app = makeApp();

    const quest = await request(app).get("/api/quest/new");
    expect(quest.status).toBe(200);
    expect(quest.body.description_en).toBe("This Pokémon is fast.");

    const score = await request(app).post("/api/quest/score").send({ translation: "はやい" });
    expect(score.status).toBe(200);
    expect(score.body.score).toBe(70);

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

  it("除外設定の保存内容が GET で読み戻せる", async () => {
    const app = makeApp();
    const put = await request(app).put("/api/settings/excluded-pokemon").send({ pokemon_ids: [7, 3, 3] });
    expect(put.status).toBe(200);

    // 重複排除・昇順に正規化されて保存される
    const got = await request(app).get("/api/settings");
    expect(got.status).toBe(200);
    expect(got.body).toEqual({ excluded_pokemon_ids: [3, 7] });
  });

  it("利用状況が取得できる", async () => {
    const res = await request(makeApp()).get("/api/usage");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ count: 3, limit: 30 });
  });
});
