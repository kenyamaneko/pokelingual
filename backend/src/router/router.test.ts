import { describe, it, expect } from "vitest";
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

describe("[クエスト] 出題から捕獲までの一連の操作", () => {
  describe("正常系", () => {
    it("出題、採点、名前当てのスキップ、捕獲を順に行うと、捕獲したポケモンが図鑑に捕獲済みとして現れる", async () => {
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
    });
  });
});

describe("[出題] クエストの出題", () => {
  describe("異常系", () => {
    it("ポケモン情報の取得が失敗したとき、出題すると、502 になり、外部サービスが利用できない旨が返る", async () => {
      const app = makeApp({ pokemonError: new Error("pokemon data unavailable") });
      const res = await request(app).get("/api/quest/new");
      expect(res.status).toBe(502);
      expect(res.body).toEqual({ error: "external service unavailable" });
    });

    it("クエストセッションの保存が失敗したとき、出題すると、502 になり、外部サービスが利用できない旨が返る", async () => {
      const app = makeApp({ sessionStoreError: new Error("redis unavailable") });
      const res = await request(app).get("/api/quest/new");
      expect(res.status).toBe(502);
      expect(res.body).toEqual({ error: "external service unavailable" });
    });

    it("ユーザー設定の取得が想定外のエラーで失敗したとき、出題すると、500 になり、サーバー内部のエラーである旨が返る", async () => {
      const app = makeApp({ settingsError: new Error("boom") });
      const res = await request(app).get("/api/quest/new");
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: "internal server error" });
    });
  });
});

describe("[出題] 場所の候補提示", () => {
  describe("正常系", () => {
    it("候補を取得すると、設定された提示件数と同じ数の場所が返る", async () => {
      const res = await request(makeApp()).get("/api/quest/locations");
      expect(res.status).toBe(200);
      expect(res.body.locations).toHaveLength(DEFAULT_QUEST_TUNING.locationChoiceCount);
    });

    it("候補を取得すると、候補の先頭の場所に ID・名前・説明・タイプが含まれる", async () => {
      const res = await request(makeApp()).get("/api/quest/locations");
      expect(res.status).toBe(200);
      expect(res.body.locations[0]).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        description: expect.any(String),
        types: expect.any(Array),
      });
    });
  });
});

describe("[クエスト] 翻訳の採点", () => {
  describe("異常系", () => {
    it("クエストセッションが無いとき、採点すると、404 になり、対象が見つからない旨が返る", async () => {
      const res = await request(makeApp()).post("/api/quest/score").send({ translation: "訳" });
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "resource not found" });
    });

    it("出題後に AI の呼び出しが失敗したとき、採点すると、502 になり、外部サービスが利用できない旨が返る", async () => {
      const app = makeApp({ llmError: new Error("llm down") });
      await request(app).get("/api/quest/new");
      const res = await request(app).post("/api/quest/score").send({ translation: "訳" });
      expect(res.status).toBe(502);
      expect(res.body).toEqual({ error: "external service unavailable" });
    });

    it("訳文が無いとき、採点すると、400 になり、訳文が必須である旨が返る", async () => {
      const res = await request(makeApp()).post("/api/quest/score").send({});
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "translation is required" });
    });
  });
});

describe("[レート制限・利用回数] 採点の利用上限", () => {
  describe("異常系", () => {
    describe("個人の利用上限に達しているとき", () => {
      it("採点すると、429 になり、個人の上限に達した旨が返る", async () => {
        const app = makeApp({ rateLimitKind: "user" });
        const res = await request(app).post("/api/quest/score").send({ translation: "訳" });
        expect(res.status).toBe(429);
        expect(res.body.error).toBe("user");
      });

      it("採点すると、429 の応答に、「そろそろ　研究に　戻るぞ。また　明日　来てくれ」というユーザー向けメッセージが含まれる", async () => {
        const app = makeApp({ rateLimitKind: "user" });
        const res = await request(app).post("/api/quest/score").send({ translation: "訳" });
        expect(res.body.message).toBe("そろそろ　研究に　戻るぞ。また　明日　来てくれ");
      });
    });

    describe("全体の利用上限に達しているとき", () => {
      it("採点すると、429 になり、全体の上限に達した旨が返る", async () => {
        const app = makeApp({ rateLimitKind: "global" });
        const res = await request(app).post("/api/quest/score").send({ translation: "訳" });
        expect(res.status).toBe(429);
        expect(res.body.error).toBe("global");
      });

      it("採点すると、429 の応答に、「今日は　たくさんの　トレーナーが　来ているぞ。また　明日　来てくれ」というユーザー向けメッセージが含まれる", async () => {
        const app = makeApp({ rateLimitKind: "global" });
        const res = await request(app).post("/api/quest/score").send({ translation: "訳" });
        expect(res.body.message).toBe("今日は　たくさんの　トレーナーが　来ているぞ。また　明日　来てくれ");
      });
    });
  });
});

describe("[レート制限・利用回数] AI 利用回数の取得", () => {
  describe("正常系", () => {
    it("取得すると、今日の利用回数が返る", async () => {
      const res = await request(makeApp()).get("/api/usage");
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(3);
    });

    it("取得すると、今日の利用上限が返る", async () => {
      const res = await request(makeApp()).get("/api/usage");
      expect(res.status).toBe(200);
      expect(res.body.limit).toBe(30);
    });
  });
});

describe("[リロード再開] 進行中のクエストの取得", () => {
  describe("正常系", () => {
    it("採点を終えた後に取得すると、名前当ての段階であることが返る", async () => {
      const app = makeApp();
      await request(app).get("/api/quest/new");
      await request(app).post("/api/quest/score").send({ translation: "はやい" });

      const res = await request(app).get("/api/quest/current");
      expect(res.status).toBe(200);
      expect(res.body.phase).toBe("guessing");
    });

    it("採点を終えた後に取得すると、採点で送った訳文が返る", async () => {
      const app = makeApp();
      await request(app).get("/api/quest/new");
      await request(app).post("/api/quest/score").send({ translation: "はやい" });

      const res = await request(app).get("/api/quest/current");
      expect(res.status).toBe(200);
      expect(res.body.user_translation).toBe("はやい");
    });
  });

  describe("異常系", () => {
    it("クエストセッションが無いとき、取得すると、404 になり、対象が見つからない旨が返る", async () => {
      const res = await request(makeApp()).get("/api/quest/current");
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "resource not found" });
    });
  });
});

describe("[名前当て] 名前当ての回答", () => {
  describe("異常系", () => {
    it("回答が無いとき、回答を送ると、400 になり、回答が必須である旨が返る", async () => {
      const res = await request(makeApp()).post("/api/quest/guess-name").send({});
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "guess is required" });
    });
  });
});

describe("[名前当て] 名前当てのヒント", () => {
  describe("正常系", () => {
    it("出題直後にヒントを要求すると、出題ポケモンのタイプ (くさ・どく) が返る", async () => {
      const app = makeApp();
      await request(app).get("/api/quest/new");
      const res = await request(app).post("/api/quest/hint").send({});
      expect(res.status).toBe(200);
      expect(res.body.types).toEqual(["grass", "poison"]);
    });

    it("出題直後にヒントを要求すると、残り挑戦回数は 2 回になる", async () => {
      const app = makeApp();
      await request(app).get("/api/quest/new");
      const res = await request(app).post("/api/quest/hint").send({});
      expect(res.status).toBe(200);
      expect(res.body.attempts_remaining).toBe(2);
    });
  });

  describe("異常系", () => {
    it("名前当てを 2 回間違えて残り挑戦回数が 1 回のとき、ヒントを要求すると、500 になり、サーバー内部のエラーである旨が返る", async () => {
      const app = makeApp();
      await request(app).get("/api/quest/new");
      await request(app).post("/api/quest/guess-name").send({ guess: "wrong1" });
      await request(app).post("/api/quest/guess-name").send({ guess: "wrong2" });
      const res = await request(app).post("/api/quest/hint").send({});
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: "internal server error" });
    });
  });
});

describe("[図鑑] 図鑑詳細の取得", () => {
  describe("異常系", () => {
    it("図鑑番号が数値でないとき、詳細を取得すると、400 になり、図鑑番号が不正である旨が返る", async () => {
      const res = await request(makeApp()).get("/api/pokedex/abc");
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "invalid pokemon id" });
    });

    it("図鑑に記録済みのポケモンについてポケモン情報の取得が失敗したとき、詳細を取得すると、502 になり、外部サービスが利用できない旨が返る", async () => {
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
  });
});

describe("[設定] 除外ポケモンの更新", () => {
  describe("正常系", () => {
    it("重複や順序を含む除外設定を保存すると、取得時は重複を除いた昇順の内容が返る", async () => {
      const app = makeApp();
      const put = await request(app).put("/api/settings/excluded-pokemon").send({ pokemon_ids: [7, 3, 3] });
      expect(put.status).toBe(200);

      // 重複排除・昇順に正規化されて保存される。世代は未設定なので全世代が返る
      const got = await request(app).get("/api/settings");
      expect(got.status).toBe(200);
      expect(got.body).toEqual({ excluded_pokemon_ids: [3, 7], enabled_generations: [1, 2, 3, 4, 5, 6, 7, 8] });
    });
  });

  describe("異常系", () => {
    it("除外ポケモンが配列でないとき、更新すると、400 になり、配列でなければならない旨が返る", async () => {
      const res = await request(makeApp()).put("/api/settings/excluded-pokemon").send({ pokemon_ids: "1" });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "excluded_pokemon_ids must be an array" });
    });

    it.each([
      ["最小値の 1 つ手前の", 0],
      ["最大値の 1 つ先の", 101],
    ])(
      "出題可能な図鑑番号の%s番号を除外ポケモンに指定したとき、更新すると、400 になり、その番号が図鑑に無い旨が返る",
      async (_position, id) => {
        const res = await request(makeApp()).put("/api/settings/excluded-pokemon").send({ pokemon_ids: [id] });
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: `pokemon id not in pokedex: ${id}` });
      },
    );

    it("除外ポケモンの数が上限を 1 つ超えるとき、更新すると、400 になり、上限を超えている旨が返る", async () => {
      const ids = Array.from({ length: 31 }, (_, i) => i + 1);
      const res = await request(makeApp()).put("/api/settings/excluded-pokemon").send({ pokemon_ids: ids });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "excluded_pokemon_ids exceeds limit (max 30)" });
    });
  });
});

describe("[設定] 出題世代の更新", () => {
  describe("正常系", () => {
    it("重複や順序を含む世代設定を保存すると、取得時は重複を除いた昇順の内容が返る", async () => {
      const app = makeApp();
      const put = await request(app).put("/api/settings/generations").send({ generations: [3, 1, 1] });
      expect(put.status).toBe(200);

      // 重複排除・昇順に正規化され、除外は未設定なので空で返る
      const got = await request(app).get("/api/settings");
      expect(got.status).toBe(200);
      expect(got.body).toEqual({ excluded_pokemon_ids: [], enabled_generations: [1, 3] });
    });
  });

  describe("異常系", () => {
    it("世代を 1 つも選ばないとき、更新すると、400 になり、1 つ以上の世代の選択が必要な旨が返る", async () => {
      const res = await request(makeApp()).put("/api/settings/generations").send({ generations: [] });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "at least one generation must be selected" });
    });

    it("第 1〜8 世代に無い世代番号を含むとき、更新すると、400 になり、存在しない世代である旨が返る", async () => {
      const res = await request(makeApp()).put("/api/settings/generations").send({ generations: [99] });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "unknown generation: 99 (must be one of 1,2,3,4,5,6,7,8)" });
    });
  });
});

describe("[チュートリアル] チュートリアル完了状態の取得と記録", () => {
  describe("正常系", () => {
    it("チュートリアルが未完了のとき、完了状態を取得すると、未完了として返る", async () => {
      const res = await request(makeApp()).get("/api/tutorial-status");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ tutorial_completed: false });
    });

    it("チュートリアルを完了にした後に、完了状態を取得すると、完了済みとして返る", async () => {
      const app = makeApp();
      const complete = await request(app).put("/api/tutorial-status/complete");
      expect(complete.status).toBe(200);

      const got = await request(app).get("/api/tutorial-status");
      expect(got.body).toEqual({ tutorial_completed: true });
    });
  });
});

describe("[チュートリアル] 固定シナリオのクエスト", () => {
  describe("出題", () => {
    describe("正常系", () => {
      it("出題すると、出題ポケモンは図鑑番号 25 のピカチュウになる", async () => {
        const res = await request(makeApp()).get("/api/tutorial/quest/new");
        expect(res.status).toBe(200);
        expect(res.body.pokemon_id).toBe(25);
      });

      it("出題すると、英文は「It is an Electric-type Mouse Pokémon.」になる", async () => {
        const res = await request(makeApp()).get("/api/tutorial/quest/new");
        expect(res.status).toBe(200);
        expect(res.body.description_en).toBe("It is an Electric-type Mouse Pokémon.");
      });
    });
  });

  describe("採点", () => {
    describe("正常系", () => {
      it("どのような訳文でも、採点すると、最終評価点は 99 になる", async () => {
        const app = makeApp();
        await request(app).get("/api/tutorial/quest/new");
        const res = await request(app).post("/api/tutorial/quest/score").send({ translation: "でたらめ" });
        expect(res.status).toBe(200);
        expect(res.body.score).toBe(99);
      });
    });

    describe("異常系", () => {
      it("個人の利用上限に達していても、採点すると、最終評価点は 99 になる", async () => {
        const app = makeApp({ rateLimitKind: "user" });
        await request(app).get("/api/tutorial/quest/new");
        const res = await request(app).post("/api/tutorial/quest/score").send({ translation: "でたらめ" });
        expect(res.status).toBe(200);
        expect(res.body.score).toBe(99);
      });
    });
  });

  describe("名前当て", () => {
    describe("正常系", () => {
      it("英語名「pikachu」で答えて正解すると、ハイパーボールが手に入る", async () => {
        const app = makeApp();
        await request(app).get("/api/tutorial/quest/new");
        const res = await request(app).post("/api/tutorial/quest/guess-name").send({ guess: "pikachu" });
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ correct: true, ball_type: "ultra" });
      });

      it("日本語名「ピカチュウ」で答えて正解すると、スーパーボールが手に入る", async () => {
        const app = makeApp();
        await request(app).get("/api/tutorial/quest/new");
        const res = await request(app).post("/api/tutorial/quest/guess-name").send({ guess: "ピカチュウ" });
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ correct: true, ball_type: "great" });
      });
    });
  });

  describe("捕獲", () => {
    async function proceedToCapture(app: ReturnType<typeof makeApp>) {
      await request(app).get("/api/tutorial/quest/new");
      await request(app).post("/api/tutorial/quest/score").send({ translation: "電気タイプのねずみポケモン" });
      await request(app).post("/api/tutorial/quest/guess-name").send({ guess: "ピカチュウ" });
      const capture = await request(app).post("/api/tutorial/quest/capture").send({});
      return capture;
    }

    describe("正常系", () => {
      it("採点と名前当てを終えた後に捕獲すると、必ず捕獲に成功する", async () => {
        const res = await proceedToCapture(makeApp());
        expect(res.status).toBe(200);
        expect(res.body.captured).toBe(true);
      });

      it("捕獲まで進めた後に図鑑を取得すると、ポケモンの一覧は空になる", async () => {
        const app = makeApp();
        await proceedToCapture(app);

        const pokedex = await request(app).get("/api/pokedex");
        expect(pokedex.status).toBe(200);
        expect(pokedex.body.pokemon).toHaveLength(0);
      });

      it("捕獲まで進めた後に図鑑を取得すると、捕獲数は 0 になる", async () => {
        const app = makeApp();
        await proceedToCapture(app);

        const pokedex = await request(app).get("/api/pokedex");
        expect(pokedex.status).toBe(200);
        expect(pokedex.body.captured_count).toBe(0);
      });
    });
  });
});
