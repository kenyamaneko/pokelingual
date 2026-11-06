import { describe, expect } from "vitest";
import express from "express";
import request from "supertest";
import { setupRoutes } from "./router.js";
import { devAuth } from "../middleware/auth-mock.js";
import { rateLimit } from "../middleware/rate-limit.js";
import { QuestService } from "../service/quest-service.js";
import { PokedexService } from "../service/pokedex-service.js";
import { SettingsService } from "../service/settings-service.js";
import { QuestHandler } from "../handler/quest-handler.js";
import { PokedexHandler } from "../handler/pokedex-handler.js";
import { SettingsHandler } from "../handler/settings-handler.js";
import { UsageHandler } from "../handler/usage-handler.js";
import { TutorialHandler } from "../handler/tutorial-handler.js";
import { createTutorialQuestHandler } from "../composition/tutorial-quest.js";
import { RateLimitError } from "../domain/errors.js";
import { DEFAULT_QUEST_TUNING } from "../testing/quest-tuning-fixture.js";
import { DEFAULT_MAX_EXCLUDED_POKEMON_COUNT } from "../testing/settings-fixture.js";
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
import { defineCase } from "../test/defineCase.js";

interface AppOverrides {
  llmError?: Error;
  rateLimitKind?: RateLimitKind;
  settingsError?: Error;
  pokemonError?: Error;
  sessionStoreError?: Error;
  seededUserPokemon?: UserPokemon[];
}

function makeApp(o: AppOverrides = {}) {
  const pokemonClient = makePokemonClient([makePokemon()], { error: o.pokemonError });
  const llm: LLMClient = {
    generateText: async () => {
      if (o.llmError) throw o.llmError;
      return JSON.stringify({ units: [0.7], review: "よい 翻訳だ。" });
    },
  };
  const servablePokemonIDs = new Set(Array.from({ length: 100 }, (_, i) => i + 1));
  const random: RandomSource = { next: () => 0 };

  // 保存結果を公開 API から観測するため、状態を持つインメモリ実装にする。
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
    resetTutorialCompleted: async () => {
      tutorialCompleted = false;
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
  const questService = new QuestService(
    pokemonClient,
    llm,
    settingsRepo,
    random,
    sessionStore,
    DEFAULT_QUEST_TUNING,
  );
  const pokedexService = new PokedexService(userPokemonRepo, pokemonClient, settingsRepo);
  const settingsService = new SettingsService(settingsRepo, servablePokemonIDs, DEFAULT_MAX_EXCLUDED_POKEMON_COUNT);

  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    setupRoutes(
      devAuth(),
      rateLimit(rateLimitRepo),
      new QuestHandler(questService, userPokemonRepo),
      createTutorialQuestHandler(tutorialSessionStore, DEFAULT_QUEST_TUNING),
      new PokedexHandler(pokedexService),
      new SettingsHandler(settingsService),
      new UsageHandler(rateLimitRepo),
      new TutorialHandler(userRepo),
    ),
  );
  return app;
}

const REQUEST_QUEST = "クエスト画面で、クエストの出題を依頼する";
const REQUEST_SCORING = "クエスト画面で、翻訳の採点を依頼する";
const REQUEST_HINT = "クエスト画面の名前当てで、ヒントの取得を依頼する";
const REQUEST_POKEDEX_DETAIL = "図鑑画面で、図鑑詳細の取得を依頼する";
const REQUEST_EXCLUDED_POKEMON_UPDATE = "設定画面で、除外ポケモンの更新を依頼する";
const REQUEST_GENERATIONS_UPDATE = "設定画面で、出題世代の更新を依頼する";
const REQUEST_SETTINGS = "設定画面を開くために、設定の取得を依頼する";
const REQUEST_TUTORIAL_STATUS = "ホーム画面の「ポケモンを探しに行く」の遷移先を決めるために、チュートリアルの完了状態の取得を依頼する";
const REQUEST_TUTORIAL_CAPTURE = "チュートリアル画面で、捕獲を依頼する";
const REQUEST_POKEDEX = "図鑑画面で、図鑑の取得を依頼する";
const TUTORIAL_QUEST_ANSWERED =
  "チュートリアルのクエストで、出題と、訳文「電気タイプのねずみポケモン」の採点と、日本語名「ピカチュウ」の回答が済んでいるとき";
const TUTORIAL_QUEST_STARTED = "チュートリアルのクエストが出題されているとき";

describe("[本体:クエスト]出題から捕獲までの一連の操作", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "出題されるポケモンがフシギダネ (図鑑番号 1) だけで、AI の採点が判定値 0.7 を返し、捕獲の抽選が必ず成功するとき",
          When: [
            REQUEST_QUEST,
            "クエスト画面で、訳文「はやい」の採点を依頼する",
            "クエスト画面の名前当てで、スキップを依頼する",
            "クエスト画面で、捕獲を依頼する",
            REQUEST_POKEDEX,
          ],
          Then: "各操作が成功し、出題の英文は「A strange seed was planted on its back at birth. The plant sprouts and grows with this Pokémon.」、最終評価点は 66、スキップで手に入るボールと捕獲に使われるボールはモンスターボールになり、捕獲に成功して、図鑑に図鑑番号 1 のポケモンが捕獲済みとして現れ、捕獲数は 1 になる",
        },
      ],
    },
    async () => {
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

      const pokedex = await request(app).get("/api/pokedex");
      expect(pokedex.status).toBe(200);
      expect(pokedex.body.pokemon).toHaveLength(1);
      expect(pokedex.body.pokemon[0]).toMatchObject({ pokemon_id: 1, status: "captured" });
      expect(pokedex.body.captured_count).toBe(1);
    },
  );
});

describe("[本体:クエスト]クエストの出題", () => {
  for (const { given, overrides } of [
    {
      given: "ポケモン情報の取得が失敗するとき",
      overrides: { pokemonError: new Error("pokemon data unavailable") },
    },
    {
      given: "クエストセッションの保存が失敗するとき",
      overrides: { sessionStoreError: new Error("redis unavailable") },
    },
  ]) {
    defineCase(
      {
        種別: "部品間結合テスト",
        正常異常: "異常系",
        観点: ["外部依存の失敗"],
        steps: [
          {
            Given: given,
            When: [REQUEST_QUEST],
            Then: "502 になり、外部サービスが利用できない旨が返る",
          },
        ],
      },
      async () => {
        const app = makeApp(overrides);
        const res = await request(app).get("/api/quest/new");
        expect(res.status).toBe(502);
        expect(res.body).toEqual({ error: "external service unavailable" });
      },
    );
  }

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      観点: ["外部依存の失敗"],
      steps: [
        {
          Given: "ユーザー設定の取得が想定外のエラーで失敗するとき",
          When: [REQUEST_QUEST],
          Then: "500 になり、サーバー内部のエラーである旨が返る",
        },
      ],
    },
    async () => {
      const app = makeApp({ settingsError: new Error("boom") });
      const res = await request(app).get("/api/quest/new");
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: "internal server error" });
    },
  );
});

describe("[本体:クエスト]場所の候補提示", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          When: ["クエスト画面の場所選択で、場所の候補の取得を依頼する"],
          Then: "場所の候補は 4 か所返る",
        },
      ],
    },
    async () => {
      const res = await request(makeApp()).get("/api/quest/locations");
      expect(res.status).toBe(200);
      expect(res.body.locations).toHaveLength(4);
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          When: ["クエスト画面の場所選択で、場所の候補の取得を依頼する"],
          Then: "候補の先頭の場所に ID・名前・説明・タイプが含まれる",
        },
      ],
    },
    async () => {
      const res = await request(makeApp()).get("/api/quest/locations");
      expect(res.status).toBe(200);
      expect(res.body.locations[0]).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        description: expect.any(String),
        types: expect.any(Array),
      });
    },
  );
});

describe("[本体:採点]翻訳の採点", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      観点: ["エッジケース"],
      steps: [
        {
          Given: "クエストセッションが無いとき",
          When: [REQUEST_SCORING],
          Then: "404 になり、対象が見つからない旨が返る",
        },
      ],
    },
    async () => {
      const res = await request(makeApp()).post("/api/quest/score").send({ translation: "訳" });
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "resource not found" });
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      観点: ["外部依存の失敗"],
      steps: [
        {
          Given: "クエストが出題されている状態で、AI の呼び出しが失敗するとき",
          When: [REQUEST_SCORING],
          Then: "502 になり、外部サービスが利用できない旨が返る",
        },
      ],
    },
    async () => {
      const app = makeApp({ llmError: new Error("llm down") });
      await request(app).get("/api/quest/new");
      const res = await request(app).post("/api/quest/score").send({ translation: "訳" });
      expect(res.status).toBe(502);
      expect(res.body).toEqual({ error: "external service unavailable" });
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      観点: ["エッジケース"],
      steps: [
        {
          Given: "訳文が無いとき",
          When: [REQUEST_SCORING],
          Then: "400 になり、訳文が必須である旨が返る",
        },
      ],
    },
    async () => {
      const res = await request(makeApp()).post("/api/quest/score").send({});
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "translation is required" });
    },
  );
});

describe("[本体:AI 呼び出し回数]採点の日次上限", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      steps: [
        {
          Given: "ユーザーの日次上限に達しているとき",
          When: [REQUEST_SCORING],
          Then: "429 になり、ユーザーの日次上限に達した旨が返る",
        },
      ],
    },
    async () => {
      const app = makeApp({ rateLimitKind: "user" });
      const res = await request(app).post("/api/quest/score").send({ translation: "訳" });
      expect(res.status).toBe(429);
      expect(res.body.error).toBe("user");
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      steps: [
        {
          Given: "ユーザーの日次上限に達しているとき",
          When: [REQUEST_SCORING],
          Then: "429 の応答に、「そろそろ　研究に　戻るぞ。また　明日　来てくれ」というユーザー向けメッセージが含まれる",
        },
      ],
    },
    async () => {
      const app = makeApp({ rateLimitKind: "user" });
      const res = await request(app).post("/api/quest/score").send({ translation: "訳" });
      expect(res.body.message).toBe("そろそろ　研究に　戻るぞ。また　明日　来てくれ");
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      steps: [
        {
          Given: "全体の日次上限に達しているとき",
          When: [REQUEST_SCORING],
          Then: "429 になり、全体の日次上限に達した旨が返る",
        },
      ],
    },
    async () => {
      const app = makeApp({ rateLimitKind: "global" });
      const res = await request(app).post("/api/quest/score").send({ translation: "訳" });
      expect(res.status).toBe(429);
      expect(res.body.error).toBe("global");
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      steps: [
        {
          Given: "全体の日次上限に達しているとき",
          When: [REQUEST_SCORING],
          Then: "429 の応答に、「今日は　たくさんの　トレーナーが　来ているぞ。また　明日　来てくれ」というユーザー向けメッセージが含まれる",
        },
      ],
    },
    async () => {
      const app = makeApp({ rateLimitKind: "global" });
      const res = await request(app).post("/api/quest/score").send({ translation: "訳" });
      expect(res.body.message).toBe("今日は　たくさんの　トレーナーが　来ているぞ。また　明日　来てくれ");
    },
  );
});

describe("[本体:AI 呼び出し回数]AI 呼び出し回数の記録と取得", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "今日の AI 呼び出し回数が 3 回のとき",
          When: ["ヘッダーの残り回数の表示のために、AI 呼び出し回数の取得を依頼する"],
          Then: "今日の AI 呼び出し回数は 3 回で返る",
        },
      ],
    },
    async () => {
      const res = await request(makeApp()).get("/api/usage");
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(3);
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "日次上限が 30 回のとき",
          When: ["ヘッダーの残り回数の表示のために、AI 呼び出し回数の取得を依頼する"],
          Then: "日次上限は 30 回で返る",
        },
      ],
    },
    async () => {
      const res = await request(makeApp()).get("/api/usage");
      expect(res.status).toBe(200);
      expect(res.body.limit).toBe(30);
    },
  );
});

describe("[本体:クエスト]進行中のクエストの取得", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "クエストが出題され、訳文「はやい」の採点が終わっているとき",
          When: ["クエスト画面の再読み込み時に、進行中のクエストの取得を依頼する"],
          Then: "名前当ての段階であることが返る",
        },
      ],
    },
    async () => {
      const app = makeApp();
      await request(app).get("/api/quest/new");
      await request(app).post("/api/quest/score").send({ translation: "はやい" });

      const res = await request(app).get("/api/quest/current");
      expect(res.status).toBe(200);
      expect(res.body.phase).toBe("guessing");
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "クエストが出題され、訳文「はやい」の採点が終わっているとき",
          When: ["クエスト画面の再読み込み時に、進行中のクエストの取得を依頼する"],
          Then: "採点で送った訳文「はやい」が返る",
        },
      ],
    },
    async () => {
      const app = makeApp();
      await request(app).get("/api/quest/new");
      await request(app).post("/api/quest/score").send({ translation: "はやい" });

      const res = await request(app).get("/api/quest/current");
      expect(res.status).toBe(200);
      expect(res.body.user_translation).toBe("はやい");
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      steps: [
        {
          Given: "クエストセッションが無いとき",
          When: ["クエスト画面の再読み込み時に、進行中のクエストの取得を依頼する"],
          Then: "404 になり、対象が見つからない旨が返る",
        },
      ],
    },
    async () => {
      const res = await request(makeApp()).get("/api/quest/current");
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "resource not found" });
    },
  );
});

describe("[本体:名前当て]名前当ての回答", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      観点: ["エッジケース"],
      steps: [
        {
          Given: "回答が無いとき",
          When: ["クエスト画面の名前当てで、回答の送信を依頼する"],
          Then: "400 になり、回答が必須である旨が返る",
        },
      ],
    },
    async () => {
      const res = await request(makeApp()).post("/api/quest/guess-name").send({});
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "guess is required" });
    },
  );
});

describe("[本体:名前当て]名前当てのヒント", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "クエストが出題されていて、出題ポケモンがフシギダネのとき",
          When: [REQUEST_HINT],
          Then: "出題ポケモンのタイプ (くさ・どく) が返る",
        },
      ],
    },
    async () => {
      const app = makeApp();
      await request(app).get("/api/quest/new");
      const res = await request(app).post("/api/quest/hint").send({});
      expect(res.status).toBe(200);
      expect(res.body.types).toEqual(["grass", "poison"]);
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "クエストが出題されているとき",
          When: [REQUEST_HINT],
          Then: "残り挑戦回数は 2 回になる",
        },
      ],
    },
    async () => {
      const app = makeApp();
      await request(app).get("/api/quest/new");
      const res = await request(app).post("/api/quest/hint").send({});
      expect(res.status).toBe(200);
      expect(res.body.attempts_remaining).toBe(2);
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      観点: ["境界値"],
      steps: [
        {
          Given: "名前当てに 2 回不正解になっていて、残り挑戦回数が 1 回のとき",
          When: [REQUEST_HINT],
          Then: "500 になり、サーバー内部のエラーである旨が返る",
        },
      ],
    },
    async () => {
      const app = makeApp();
      await request(app).get("/api/quest/new");
      await request(app).post("/api/quest/guess-name").send({ guess: "wrong1" });
      await request(app).post("/api/quest/guess-name").send({ guess: "wrong2" });
      const res = await request(app).post("/api/quest/hint").send({});
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: "internal server error" });
    },
  );
});

describe("[本体:図鑑]図鑑詳細の取得", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      観点: ["エッジケース"],
      steps: [
        {
          Given: "図鑑番号が「abc」(数値でない) のとき",
          When: [REQUEST_POKEDEX_DETAIL],
          Then: "400 になり、図鑑番号が不正である旨が返る",
        },
      ],
    },
    async () => {
      const res = await request(makeApp()).get("/api/pokedex/abc");
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "invalid pokemon id" });
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      観点: ["外部依存の失敗"],
      steps: [
        {
          Given: "図鑑に記録済みのポケモンについて、ポケモン情報の取得が失敗するとき",
          When: [REQUEST_POKEDEX_DETAIL],
          Then: "502 になり、外部サービスが利用できない旨が返る",
        },
      ],
    },
    async () => {
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
    },
  );
});

describe("[共通:設定]除外ポケモンの更新", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "除外ポケモンの指定が図鑑番号 7・3・3 で、重複した番号と順不同の番号が含まれているとき",
          When: [REQUEST_EXCLUDED_POKEMON_UPDATE, REQUEST_SETTINGS],
          Then: "除外ポケモンは重複が除かれ、昇順の図鑑番号 3・7 になり、出題世代は世代 1〜8 のままになる",
        },
      ],
    },
    async () => {
      const app = makeApp();
      const put = await request(app).put("/api/settings/excluded-pokemon").send({ pokemon_ids: [7, 3, 3] });
      expect(put.status).toBe(200);

      const got = await request(app).get("/api/settings");
      expect(got.status).toBe(200);
      expect(got.body).toEqual({ excluded_pokemon_ids: [3, 7], enabled_generations: [1, 2, 3, 4, 5, 6, 7, 8] });
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      観点: ["エッジケース"],
      steps: [
        {
          Given: "除外ポケモンが配列でないとき",
          When: [REQUEST_EXCLUDED_POKEMON_UPDATE],
          Then: "400 になり、配列でなければならない旨が返る",
        },
      ],
    },
    async () => {
      const res = await request(makeApp()).put("/api/settings/excluded-pokemon").send({ pokemon_ids: "1" });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "excluded_pokemon_ids must be an array" });
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      観点: ["境界値"],
      steps: [
        {
          Given: "除外ポケモンの数が上限を 1 つ超えるとき",
          When: [REQUEST_EXCLUDED_POKEMON_UPDATE],
          Then: "400 になり、上限を超えている旨が返る",
        },
      ],
    },
    async () => {
      const ids = Array.from({ length: 31 }, (_, i) => i + 1);
      const res = await request(makeApp()).put("/api/settings/excluded-pokemon").send({ pokemon_ids: ids });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "excluded_pokemon_ids exceeds limit (max 30)" });
    },
  );

  for (const { given, id } of [
    { given: "除外ポケモンの指定に含まれる番号が、出題可能な図鑑番号の最小値の 1 つ手前の番号のとき", id: 0 },
    { given: "除外ポケモンの指定に含まれる番号が、出題可能な図鑑番号の最大値の 1 つ先の番号のとき", id: 101 },
  ]) {
    defineCase(
      {
        種別: "部品間結合テスト",
        正常異常: "異常系",
        観点: ["境界値"],
        steps: [
          {
            Given: given,
            When: [REQUEST_EXCLUDED_POKEMON_UPDATE],
            Then: "400 になり、その番号が図鑑に無い旨が返る",
          },
        ],
      },
      async () => {
        const res = await request(makeApp()).put("/api/settings/excluded-pokemon").send({ pokemon_ids: [id] });
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: `pokemon id not in pokedex: ${id}` });
      },
    );
  }
});

describe("[共通:設定]出題世代の更新", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "出題世代の指定が世代 3・1・1 で、重複した世代と順不同の世代が含まれているとき",
          When: [REQUEST_GENERATIONS_UPDATE, REQUEST_SETTINGS],
          Then: "出題世代は重複が除かれ、昇順の世代 1・3 になり、除外ポケモンは 0 件のままになる",
        },
      ],
    },
    async () => {
      const app = makeApp();
      const put = await request(app).put("/api/settings/generations").send({ generations: [3, 1, 1] });
      expect(put.status).toBe(200);

      const got = await request(app).get("/api/settings");
      expect(got.status).toBe(200);
      expect(got.body).toEqual({ excluded_pokemon_ids: [], enabled_generations: [1, 3] });
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      観点: ["件数・有無"],
      steps: [
        {
          Given: "世代を 1 つも選ばないとき",
          When: [REQUEST_GENERATIONS_UPDATE],
          Then: "400 になり、1 つ以上の世代の選択が必要な旨が返る",
        },
      ],
    },
    async () => {
      const res = await request(makeApp()).put("/api/settings/generations").send({ generations: [] });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "at least one generation must be selected" });
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      観点: ["エッジケース"],
      steps: [
        {
          Given: "第 1〜8 世代に無い世代番号 99 を含むとき",
          When: [REQUEST_GENERATIONS_UPDATE],
          Then: "400 になり、存在しない世代である旨が返る",
        },
      ],
    },
    async () => {
      const res = await request(makeApp()).put("/api/settings/generations").send({ generations: [99] });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "unknown generation: 99 (must be one of 1,2,3,4,5,6,7,8)" });
    },
  );
});

describe("[本体:チュートリアル]チュートリアル完了状態の取得と記録", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "チュートリアルが未完了のとき",
          When: [REQUEST_TUTORIAL_STATUS],
          Then: "未完了として返る",
        },
      ],
    },
    async () => {
      const res = await request(makeApp()).get("/api/tutorial-status");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ tutorial_completed: false });
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          When: ["チュートリアル画面で、チュートリアルの完了の記録を依頼する", REQUEST_TUTORIAL_STATUS],
          Then: "完了済みとして返る",
        },
      ],
    },
    async () => {
      const app = makeApp();
      const complete = await request(app).put("/api/tutorial-status/complete");
      expect(complete.status).toBe(200);

      const got = await request(app).get("/api/tutorial-status");
      expect(got.body).toEqual({ tutorial_completed: true });
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          When: [
            "チュートリアル画面で、チュートリアルの完了の記録を依頼する",
            "チュートリアルの完了状態を未完了に戻すよう依頼する",
            REQUEST_TUTORIAL_STATUS,
          ],
          Then: "未完了として返る",
        },
      ],
    },
    async () => {
      const app = makeApp();
      await request(app).put("/api/tutorial-status/complete");
      const reset = await request(app).put("/api/tutorial-status/reset");
      expect(reset.status).toBe(200);

      const got = await request(app).get("/api/tutorial-status");
      expect(got.body).toEqual({ tutorial_completed: false });
    },
  );
});

async function makeAppWithTutorialGuessed() {
  const app = makeApp();
  await request(app).get("/api/tutorial/quest/new");
  await request(app).post("/api/tutorial/quest/score").send({ translation: "電気タイプのねずみポケモン" });
  await request(app).post("/api/tutorial/quest/guess-name").send({ guess: "ピカチュウ" });
  return app;
}

describe("[本体:チュートリアル]固定シナリオのクエスト", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          When: ["チュートリアル画面で、チュートリアルのクエストの出題を依頼する"],
          Then: "出題ポケモンは図鑑番号 25 のピカチュウになる",
        },
      ],
    },
    async () => {
      const res = await request(makeApp()).get("/api/tutorial/quest/new");
      expect(res.status).toBe(200);
      expect(res.body.pokemon_id).toBe(25);
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          When: ["チュートリアル画面で、チュートリアルのクエストの出題を依頼する"],
          Then: "英文は「It is an Electric-type Mouse Pokémon.」になる",
        },
      ],
    },
    async () => {
      const res = await request(makeApp()).get("/api/tutorial/quest/new");
      expect(res.status).toBe(200);
      expect(res.body.description_en).toBe("It is an Electric-type Mouse Pokémon.");
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: TUTORIAL_QUEST_STARTED,
          When: ["チュートリアル画面で、訳文「でたらめ」の採点を依頼する"],
          Then: "最終評価点は 99 になる",
        },
      ],
    },
    async () => {
      const app = makeApp();
      await request(app).get("/api/tutorial/quest/new");
      const res = await request(app).post("/api/tutorial/quest/score").send({ translation: "でたらめ" });
      expect(res.status).toBe(200);
      expect(res.body.score).toBe(99);
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      steps: [
        {
          Given: "ユーザーの日次上限に達していて、チュートリアルのクエストが出題されているとき",
          When: ["チュートリアル画面で、訳文「でたらめ」の採点を依頼する"],
          Then: "最終評価点は 99 になる",
        },
      ],
    },
    async () => {
      const app = makeApp({ rateLimitKind: "user" });
      await request(app).get("/api/tutorial/quest/new");
      const res = await request(app).post("/api/tutorial/quest/score").send({ translation: "でたらめ" });
      expect(res.status).toBe(200);
      expect(res.body.score).toBe(99);
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: TUTORIAL_QUEST_STARTED,
          When: ["チュートリアル画面の名前当てで、英語名「pikachu」の回答の送信を依頼する"],
          Then: "正解になり、ハイパーボールが手に入る",
        },
      ],
    },
    async () => {
      const app = makeApp();
      await request(app).get("/api/tutorial/quest/new");
      const res = await request(app).post("/api/tutorial/quest/guess-name").send({ guess: "pikachu" });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ correct: true, ball_type: "ultra" });
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: TUTORIAL_QUEST_STARTED,
          When: ["チュートリアル画面の名前当てで、日本語名「ピカチュウ」の回答の送信を依頼する"],
          Then: "正解になり、スーパーボールが手に入る",
        },
      ],
    },
    async () => {
      const app = makeApp();
      await request(app).get("/api/tutorial/quest/new");
      const res = await request(app).post("/api/tutorial/quest/guess-name").send({ guess: "ピカチュウ" });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ correct: true, ball_type: "great" });
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: TUTORIAL_QUEST_ANSWERED,
          When: [REQUEST_TUTORIAL_CAPTURE],
          Then: "必ず捕獲に成功する",
        },
      ],
    },
    async () => {
      const app = await makeAppWithTutorialGuessed();

      const res = await request(app).post("/api/tutorial/quest/capture").send({});
      expect(res.status).toBe(200);
      expect(res.body.captured).toBe(true);
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: TUTORIAL_QUEST_ANSWERED,
          When: [REQUEST_TUTORIAL_CAPTURE, REQUEST_POKEDEX],
          Then: "ポケモンの一覧は空になる",
        },
      ],
    },
    async () => {
      const app = await makeAppWithTutorialGuessed();
      await request(app).post("/api/tutorial/quest/capture").send({});

      const pokedex = await request(app).get("/api/pokedex");
      expect(pokedex.status).toBe(200);
      expect(pokedex.body.pokemon).toHaveLength(0);
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: TUTORIAL_QUEST_ANSWERED,
          When: [REQUEST_TUTORIAL_CAPTURE, REQUEST_POKEDEX],
          Then: "捕獲数は 0 になる",
        },
      ],
    },
    async () => {
      const app = await makeAppWithTutorialGuessed();
      await request(app).post("/api/tutorial/quest/capture").send({});

      const pokedex = await request(app).get("/api/pokedex");
      expect(pokedex.status).toBe(200);
      expect(pokedex.body.captured_count).toBe(0);
    },
  );
});
