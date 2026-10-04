import { describe, it, expect } from "vitest";
import {
  QuestService,
  calculateCaptureRate,
  computeScoreFromUnits,
  translateToFinalScore,
  maskPokemonNameEN,
  maskPokemonNameJA,
} from "./quest-service.js";
import { NotFoundError, ExternalServiceError, EmptyQuestPoolError } from "../domain/errors.js";
import type { LLMClient, RandomSource, UserSettingsRepository } from "../domain/ports.js";
import type { Pokemon } from "../domain/pokemon.js";
import { makePokemon, makePokemonClient } from "../testing/pokemon-fixtures.js";
import { makeInMemoryQuestSessionStore } from "../testing/session-store-fixture.js";
import { DEFAULT_QUEST_TUNING } from "../testing/quest-tuning-fixture.js";

interface ServiceOverrides {
  /** 出題の抽選元になるポケモンの一覧。 */
  pokemons?: Pokemon[];
  /** LLM が返すテキスト。 */
  llmText?: string;
  llmTexts?: string[];
  /** LLM が返すテキストをプロンプト内容から動的に組み立てたい場合に使う (llmTexts 未指定時のみ使われ、指定時は llmText より優先)。 */
  llmRespond?: (prompt: string) => string;
  /** ユーザーごとの除外する図鑑番号 (null は未設定)。 */
  excludedIDs?: number[] | null;
  /** 出題対象の世代 (null = 未設定 = 全世代)。 */
  enabledGenerations?: number[] | null;
  /** 乱数値。 */
  randomValue?: number;
  /** セッションストアが投げるエラー (指定時は get/set/delete がこのエラーを投げる)。 */
  sessionStoreError?: Error;
}

/**
 * スタブを注入した QuestService を組み立てる。
 */
function makeService(o: ServiceOverrides = {}): QuestService {
  const pool = o.pokemons ?? [makePokemon()];
  const pokemonClient = makePokemonClient(pool);
  let llmCallIndex = 0;
  const llm: LLMClient = {
    generateText: async (prompt) => {
      if (o.llmTexts) return o.llmTexts[Math.min(llmCallIndex++, o.llmTexts.length - 1)];
      return o.llmRespond?.(prompt) ?? o.llmText ?? JSON.stringify({ units: [0.7], review: "よい 翻訳だ。" });
    },
  };
  const settingsRepo: UserSettingsRepository = {
    getSettings: async () => ({
      excluded_pokemon_ids: o.excludedIDs ?? null,
      enabled_generations: o.enabledGenerations ?? null,
    }),
    updateExcludedPokemon: async () => {},
    updateEnabledGenerations: async () => {},
  };
  const random: RandomSource = { next: () => o.randomValue ?? 0 };
  const sessionStore = makeInMemoryQuestSessionStore({ error: o.sessionStoreError });
  return new QuestService(pokemonClient, llm, settingsRepo, random, sessionStore, DEFAULT_QUEST_TUNING);
}

const USER_ID = "alice";
const AI_RESPONSE_FINAL_SCORE_70 = JSON.stringify({ units: [0.74], review: "よい" });
const AI_RESPONSE_FINAL_SCORE_69 = JSON.stringify({ units: [0.73], review: "よい" });

async function startQuest(o: ServiceOverrides = {}): Promise<QuestService> {
  const service = makeService(o);
  await service.newQuest(USER_ID);
  return service;
}

async function startScoredQuest(o: ServiceOverrides = {}): Promise<QuestService> {
  const service = await startQuest(o);
  await service.scoreTranslation(USER_ID, "訳");
  return service;
}

async function getRejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => undefined,
    (error: unknown) => error,
  );
}

async function missThreeTimes(service: QuestService) {
  await service.guessName(USER_ID, "wrong1");
  await service.guessName(USER_ID, "wrong2");
  return service.guessName(USER_ID, "wrong3");
}

describe("[捕獲] 捕獲確率の計算", () => {
  // ボール補正は設定値に依存しない純関数の引数のため、本番の設定値とは独立したテスト固有の値を使う
  const POKE_BONUS = 0;
  const GREAT_BONUS = 1.5;
  const ULTRA_BONUS = 3.0;

  describe("正常系", () => {
    describe("ボール補正がないとき", () => {
      it("最終評価点が0で種族値合計が680のとき、捕獲確率は0.05未満になる", () => {
        expect(calculateCaptureRate(0, 680, POKE_BONUS)).toBeLessThan(0.05);
      });

      it("種族値合計が300のとき、最終評価点が90の捕獲確率は、最終評価点が30の捕獲確率より高くなる", () => {
        expect(calculateCaptureRate(90, 300, POKE_BONUS)).toBeGreaterThan(
          calculateCaptureRate(30, 300, POKE_BONUS),
        );
      });

      it("最終評価点が50のとき、種族値合計が300の捕獲確率は、種族値合計が680の捕獲確率より高くなる", () => {
        expect(calculateCaptureRate(50, 300, POKE_BONUS)).toBeGreaterThan(
          calculateCaptureRate(50, 680, POKE_BONUS),
        );
      });
    });

    describe("ボール補正が大きいとき", () => {
      it("最終評価点が99で種族値合計が200のとき、捕獲確率は1.0以下になる", () => {
        expect(calculateCaptureRate(99, 200, ULTRA_BONUS)).toBeLessThanOrEqual(1);
      });

      it("最終評価点が99で種族値合計が680のとき、捕獲確率は0.99を超える", () => {
        expect(calculateCaptureRate(99, 680, ULTRA_BONUS)).toBeGreaterThan(0.99);
      });
    });

    it("最終評価点が0で種族値合計が680のとき、ボール補正が大きい場合の捕獲確率は、ボール補正がない場合より高くなる", () => {
      expect(calculateCaptureRate(0, 680, ULTRA_BONUS)).toBeGreaterThan(
        calculateCaptureRate(0, 680, POKE_BONUS),
      );
    });

    it("最終評価点が20で種族値合計が500のとき、捕獲確率はボール補正がない場合、小さい場合、大きい場合の順に高くなる", () => {
      const pokeRate = calculateCaptureRate(20, 500, POKE_BONUS);
      const greatRate = calculateCaptureRate(20, 500, GREAT_BONUS);
      const ultraRate = calculateCaptureRate(20, 500, ULTRA_BONUS);
      expect(greatRate).toBeGreaterThan(pokeRate);
      expect(ultraRate).toBeGreaterThan(greatRate);
    });
  });
});

describe("[説明文] 英語説明文のポケモン名の伏せ字", () => {
  describe("正常系", () => {
    describe("ポケモン名が Pikachu のとき", () => {
      it("説明文「Hello world」にポケモン名が含まれないとき、伏せ字にした説明文は原文のままになる", () => {
        expect(maskPokemonNameEN("Hello world", "Pikachu")).toBe("Hello world");
      });

      it("ポケモン名が文中に出現するとき、「A wild Pikachu appeared.」は「A wild this Pokémon appeared.」になる", () => {
        expect(maskPokemonNameEN("A wild Pikachu appeared.", "Pikachu")).toBe(
          "A wild this Pokémon appeared.",
        );
      });

      it("ポケモン名が文頭に出現するとき、「Pikachu is yellow.」は「This Pokémon is yellow.」になる", () => {
        expect(maskPokemonNameEN("Pikachu is yellow.", "Pikachu")).toBe("This Pokémon is yellow.");
      });

      it("ポケモン名がピリオドの直後に出現するとき、「Hello. Pikachu runs.」は「Hello. This Pokémon runs.」になる", () => {
        expect(maskPokemonNameEN("Hello. Pikachu runs.", "Pikachu")).toBe("Hello. This Pokémon runs.");
      });

      it("ポケモン名の直前に「Several」があるとき、「Several Pikachu gather.」は「Several of these Pokémon gather.」になる", () => {
        expect(maskPokemonNameEN("Several Pikachu gather.", "Pikachu")).toBe(
          "Several of these Pokémon gather.",
        );
      });

      it("ポケモン名が複数回出現するとき、「Pikachu and Pikachu」は「This Pokémon and this Pokémon」になる", () => {
        expect(maskPokemonNameEN("Pikachu and Pikachu", "Pikachu")).toBe(
          "This Pokémon and this Pokémon",
        );
      });

      it("ポケモン名と大文字小文字が異なる表記が出現するとき、「A pikachu here」は「A this Pokémon here」になる", () => {
        expect(maskPokemonNameEN("A pikachu here", "Pikachu")).toBe("A this Pokémon here");
      });
    });
  });

  describe("異常系", () => {
    it("ポケモン名が空文字のとき、「A wild creature.」の伏せ字にした説明文は原文のままになる", () => {
      expect(maskPokemonNameEN("A wild creature.", "")).toBe("A wild creature.");
    });
  });
});

describe("[説明文] 日本語説明文のポケモン名の伏せ字", () => {
  describe("正常系", () => {
    describe("ポケモン名が「ピカチュウ」のとき", () => {
      it("ポケモン名が説明文に出現するとき、「ピカチュウは黄色い」は「この ポケモンは黄色い」になる", () => {
        expect(maskPokemonNameJA("ピカチュウは黄色い", "ピカチュウ")).toBe("この ポケモンは黄色い");
      });

      it("ポケモン名が複数回出現するとき、「ピカチュウとピカチュウ」は「この ポケモンとこの ポケモン」になる", () => {
        expect(maskPokemonNameJA("ピカチュウとピカチュウ", "ピカチュウ")).toBe(
          "この ポケモンとこの ポケモン",
        );
      });

      it("説明文「あいうえお」にポケモン名が含まれないとき、伏せ字にした説明文は原文のままになる", () => {
        expect(maskPokemonNameJA("あいうえお", "ピカチュウ")).toBe("あいうえお");
      });
    });
  });

  describe("異常系", () => {
    it("ポケモン名が空文字のとき、「あいうえお」の伏せ字にした説明文は原文のままになる", () => {
      expect(maskPokemonNameJA("あいうえお", "")).toBe("あいうえお");
    });
  });
});

describe("[採点] 意味単位の判定値からの素点算出", () => {
  describe("正常系", () => {
    it("意味単位が1件で判定値が0.6のとき、素点は60になる", () => {
      expect(computeScoreFromUnits([0.6])).toBe(60);
    });

    it("判定値が1.0、0.2、0.0の3件のとき、素点は40になる", () => {
      expect(computeScoreFromUnits([1.0, 0.2, 0.0])).toBe(40);
    });

    describe("判定値の平均が0.8のとき", () => {
      it.each([
        [1, [0.8]],
        [3, [0.8, 0.8, 0.8]],
      ])("意味単位が%i件のとき、素点は80になる", (_count, units) => {
        expect(computeScoreFromUnits(units)).toBe(80);
      });
    });

    it("判定値が1.0、1.0、0.0の3件のとき、素点は四捨五入して67になる", () => {
      expect(computeScoreFromUnits([1.0, 1.0, 0.0])).toBe(67);
    });
  });
});

describe("[採点] 素点から最終評価点への変換", () => {
  describe("正常系", () => {
    it.each([
      [0, 0],
      [100, 99],
      [10, 0],
      [11, 1],
      [15, 6],
    ])("素点が%iのとき、最終評価点は%iになる", (rawScore, finalScore) => {
      expect(translateToFinalScore(rawScore)).toBe(finalScore);
    });
  });
});

describe("[出題] クエストの出題", () => {
  describe("正常系", () => {
    it("英語説明文が「Bulbasaur is green.」のポケモンを出題すると、出題結果の英語説明文は「This Pokémon is green.」になる", async () => {
      const service = makeService({
        pokemons: [makePokemon({ description_en: "Bulbasaur is green." })],
      });
      const res = await service.newQuest(USER_ID);
      expect(res.description_en).toBe("This Pokémon is green.");
    });

    it("図鑑番号1のポケモンだけがいるとき、出題結果は図鑑番号1のポケモンになる", async () => {
      const service = makeService();
      const res = await service.newQuest(USER_ID);
      expect(res.pokemon_id).toBe(1);
    });

    it("伝説ポケモンでないポケモンを出題すると、出題結果は伝説ポケモンではないと示される", async () => {
      const service = makeService();
      const res = await service.newQuest(USER_ID);
      expect(res.is_legendary).toBe(false);
    });

    it("図鑑番号5と6のポケモンがいて、図鑑番号5を除外しているとき、出題結果は図鑑番号6のポケモンになる", async () => {
      const service = makeService({
        pokemons: [makePokemon({ id: 5 }), makePokemon({ id: 6 })],
        excludedIDs: [5],
      });
      const res = await service.newQuest(USER_ID);
      expect(res.pokemon_id).toBe(6);
    });

    it("第1世代だけを選択していて、第3世代の図鑑番号300と第1世代の図鑑番号100のポケモンがいるとき、出題結果は図鑑番号100のポケモンになる", async () => {
      const service = makeService({
        pokemons: [makePokemon({ id: 300 }), makePokemon({ id: 100 })],
        enabledGenerations: [1],
      });
      const res = await service.newQuest(USER_ID);
      expect(res.pokemon_id).toBe(100);
    });

    it("第1世代と第3世代を選択していて、第3世代の図鑑番号300のポケモンがいるとき、出題結果は図鑑番号300のポケモンになる", async () => {
      const service = makeService({
        pokemons: [makePokemon({ id: 300 })],
        enabledGenerations: [1, 3],
      });
      const res = await service.newQuest(USER_ID);
      expect(res.pokemon_id).toBe(300);
    });

    it("出題世代を設定していないとき、第5世代の図鑑番号500のポケモンがいれば、出題結果は図鑑番号500のポケモンになる", async () => {
      const service = makeService({
        pokemons: [makePokemon({ id: 500 })],
        enabledGenerations: null,
      });
      const res = await service.newQuest(USER_ID);
      expect(res.pokemon_id).toBe(500);
    });

    it("出題すると、出題結果で名前当ての最大挑戦回数は3回と示される", async () => {
      const service = makeService();
      const res = await service.newQuest(USER_ID);
      expect(res.max_guess_attempts).toBe(3);
    });

    it("ポケモンの説明文が複数あるとき、出題結果の英語説明文は、いずれか1件の説明文のポケモン名を伏せ字にしたものになる", async () => {
      const service = makeService({
        pokemons: [
          makePokemon({
            flavor_texts: [
              { version_names: ["X"], description_en: "Alpha Bulbasaur runs.", description_ja: "フシギダネは 走る。" },
              { version_names: ["Y"], description_en: "Beta text.", description_ja: "ベータ。" },
            ],
          }),
        ],
      });
      const res = await service.newQuest(USER_ID);
      expect(res.description_en).toBe("Alpha this Pokémon runs.");
    });

    it.each<[string, Pokemon["flavor_texts"]]>([
      ["未設定", undefined],
      ["0件", []],
    ])(
      "ポケモンの説明文の一覧が%sのとき、出題結果の英語説明文は、基本の説明文のポケモン名を伏せ字にしたものになる",
      async (_state, flavorTexts) => {
        const service = makeService({ pokemons: [makePokemon({ flavor_texts: flavorTexts })] });
        const res = await service.newQuest(USER_ID);
        expect(res.description_en).toBe(
          "A strange seed was planted on its back at birth. The plant sprouts and grows with this Pokémon.",
        );
      },
    );

    describe("場所「廃墟の発電所」(でんき・はがね・どくタイプ) を選んで出題するとき", () => {
      const LOCATION_ID = "ruined-powerplant";

      it("でんきタイプの図鑑番号100とくさタイプの図鑑番号110のポケモンがいるとき、出題結果は図鑑番号100のポケモンになる", async () => {
        const service = makeService({
          pokemons: [
            makePokemon({ id: 110, types: ["grass"] }),
            makePokemon({ id: 100, types: ["electric"] }),
          ],
        });
        const res = await service.newQuest(USER_ID, LOCATION_ID);
        expect(res.pokemon_id).toBe(100);
      });

      it("第1世代だけを選択していて、第6世代の図鑑番号700と第1世代の図鑑番号100の、どちらもでんきタイプのポケモンがいるとき、出題結果は図鑑番号100のポケモンになる", async () => {
        const service = makeService({
          pokemons: [
            makePokemon({ id: 700, types: ["electric"] }),
            makePokemon({ id: 100, types: ["electric"] }),
          ],
          enabledGenerations: [1],
        });
        const res = await service.newQuest(USER_ID, LOCATION_ID);
        expect(res.pokemon_id).toBe(100);
      });

      it("幻・伝説の抽選に当たったとき、場所のタイプに合う図鑑番号100 (でんきタイプ) のポケモンがいても、出題結果は図鑑番号150 (エスパータイプ) の伝説ポケモンになる", async () => {
        const service = makeService({
          pokemons: [makePokemon({ id: 150, types: ["psychic"] }), makePokemon({ id: 100, types: ["electric"] })],
          randomValue: 0.995,
        });
        const res = await service.newQuest(USER_ID, LOCATION_ID);
        expect(res.pokemon_id).toBe(150);
      });

      it("幻・伝説の抽選に当たっても、幻・伝説のポケモンがいないとき、出題結果は場所のタイプに合う図鑑番号100 (でんきタイプ) のポケモンになる", async () => {
        const service = makeService({
          pokemons: [makePokemon({ id: 100, types: ["electric"] })],
          randomValue: 0.995,
        });
        const res = await service.newQuest(USER_ID, LOCATION_ID);
        expect(res.pokemon_id).toBe(100);
      });
    });
  });

  describe("異常系", () => {
    it("出題できるポケモンがすべて除外されているとき、出題すると、出題できるポケモンがいないエラーになる", async () => {
      const service = makeService({
        pokemons: [makePokemon({ id: 1 })],
        excludedIDs: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      });
      await expect(service.newQuest(USER_ID)).rejects.toBeInstanceOf(EmptyQuestPoolError);
    });
  });
});

describe("[採点] 翻訳の採点", () => {
  describe("正常系", () => {
    it("AI が意味単位1件の判定値0.7を返したとき、採点結果の最終評価点は66になる", async () => {
      const service = await startQuest({ llmText: JSON.stringify({ units: [0.7], review: "よい" }) });
      const res = await service.scoreTranslation(USER_ID, "みどり");
      expect(res.score).toBe(66);
    });

    it("AI が判定値1.0、0.6、0.2の3件を返したとき、採点結果の最終評価点は55になる", async () => {
      const service = await startQuest({
        llmText: JSON.stringify({ units: [1.0, 0.6, 0.2], review: "r" }),
      });
      const res = await service.scoreTranslation(USER_ID, "訳");
      expect(res.score).toBe(55);
    });

    it("AI が講評「よい」を返したとき、採点結果の講評は「よい」になる", async () => {
      const service = await startQuest({ llmText: JSON.stringify({ units: [0.7], review: "よい" }) });
      const res = await service.scoreTranslation(USER_ID, "みどり");
      expect(res.review).toBe("よい");
    });

    it("日本語説明文が「フシギダネは 緑色だ。」でポケモン名がフシギダネのとき、採点結果の日本語説明文は「この ポケモンは 緑色だ。」になる", async () => {
      const service = await startQuest({
        pokemons: [makePokemon({ description_ja: "フシギダネは 緑色だ。" })],
      });
      const res = await service.scoreTranslation(USER_ID, "みどり");
      expect(res.description_ja).toBe("この ポケモンは 緑色だ。");
    });

    it("英語説明文が「Pikachu is yellow.」でポケモン名が Pikachu のとき、AI に渡す英文に伏せ字にした説明文「This Pokémon is yellow.」が含まれる", async () => {
      let sentPrompt = "";
      const service = await startQuest({
        pokemons: [makePokemon({ name_en: "Pikachu", description_en: "Pikachu is yellow." })],
        llmRespond: (prompt) => {
          sentPrompt = prompt;
          return JSON.stringify({ units: [0.7], review: "よい 翻訳だ。" });
        },
      });
      await service.scoreTranslation(USER_ID, "訳");
      expect(sentPrompt).toContain("This Pokémon is yellow.");
    });
  });

  describe("異常系", () => {
    it.each<[string, (service: QuestService) => Promise<void>]>([
      ["どのユーザーにも進行中のクエストセッションがない", async () => {}],
      [
        "採点するユーザーには進行中のクエストセッションがなく、別のユーザーにだけある",
        async (service) => {
          await service.newQuest(USER_ID);
        },
      ],
    ])(
      "%sとき、採点すると、クエストセッションが見つからないエラーになる",
      async (_situation, prepare) => {
        const service = makeService();
        await prepare(service);
        await expect(service.scoreTranslation("bob", "訳")).rejects.toBeInstanceOf(NotFoundError);
      },
    );

    it("クエストセッションの読み込みに失敗するとき、採点すると、外部サービスのエラーになる", async () => {
      const service = makeService({ sessionStoreError: new Error("boom") });
      const error = await getRejection(service.scoreTranslation(USER_ID, "訳"));
      expect(error).toBeInstanceOf(ExternalServiceError);
      expect((error as ExternalServiceError).cause).toEqual(expect.objectContaining({ message: "boom" }));
    });

    describe("AI が2回続けて不正な応答を返すとき", () => {
      const NO_SCORING_UNITS = expect.objectContaining({ message: "LLM returned no scoring units" });
      const EMPTY_REVIEW = expect.objectContaining({ message: "LLM returned empty review" });

      it.each<[string, string, unknown]>([
        ["応答が JSON ではない", "ごめん、わからない", expect.any(SyntaxError)],
        ["応答の JSON が途中で切れている", '{"units": [0.7], "rev', expect.any(SyntaxError)],
        ["応答に判定値の項目がない", JSON.stringify({ review: "r" }), NO_SCORING_UNITS],
        ["応答の判定値が一覧ではなく1つの数値になっている", JSON.stringify({ units: 0.7, review: "r" }), NO_SCORING_UNITS],
        ["応答の判定値が0件である", JSON.stringify({ units: [], review: "r" }), NO_SCORING_UNITS],
        ["応答の判定値に数値でない値を含む", JSON.stringify({ units: ["a"], review: "r" }), expect.objectContaining({ message: "LLM returned out-of-range unit value: a" })],
        ["応答に講評の項目がない", JSON.stringify({ units: [0.7] }), EMPTY_REVIEW],
        ["応答の講評が空文字である", JSON.stringify({ units: [0.7], review: "" }), EMPTY_REVIEW],
        ["応答に0.0から1.0の範囲外の判定値 -0.1 を含む", JSON.stringify({ units: [-0.1], review: "r" }), expect.objectContaining({ message: "LLM returned out-of-range unit value: -0.1" })],
        ["応答に0.0から1.0の範囲外の判定値 1.1 を含む", JSON.stringify({ units: [1.1], review: "r" }), expect.objectContaining({ message: "LLM returned out-of-range unit value: 1.1" })],
      ])("%sとき、採点すると、外部サービスのエラーになる", async (_content, llmText, cause) => {
        const service = await startQuest({ llmText });
        const error = await getRejection(service.scoreTranslation(USER_ID, "訳"));
        expect(error).toBeInstanceOf(ExternalServiceError);
        expect((error as ExternalServiceError).cause).toEqual(cause);
      });
    });

    describe("AI の最初の応答が JSON でなく、2回目の応答が正しい形式のとき", () => {
      const llmTexts = ["ごめん、わからない", JSON.stringify({ units: [0.7], review: "よい" })];

      it("採点結果の最終評価点は66になる", async () => {
        const service = await startQuest({ llmTexts });
        const res = await service.scoreTranslation(USER_ID, "訳");
        expect(res.score).toBe(66);
      });

      it("採点結果の講評は「よい」になる", async () => {
        const service = await startQuest({ llmTexts });
        const res = await service.scoreTranslation(USER_ID, "訳");
        expect(res.review).toBe("よい");
      });
    });
  });
});

describe("[名前当て] 名前当ての判定", () => {
  describe("正常系", () => {
    describe("英語名「Bulbasaur」のポケモンに、小文字で前後に空白のある「 bulbasaur 」と答えたとき", () => {
      it("判定結果は正解になる", async () => {
        const service = await startQuest();
        const res = await service.guessName(USER_ID, "  bulbasaur ");
        expect(res).toMatchObject({ correct: true });
      });

      it("判定結果のボールはハイパーボールになる", async () => {
        const service = await startQuest();
        const res = await service.guessName(USER_ID, "  bulbasaur ");
        expect(res).toMatchObject({ ball_type: "ultra" });
      });

      it("判定結果で、正解した名前の言語は英語になる", async () => {
        const service = await startQuest();
        const res = await service.guessName(USER_ID, "  bulbasaur ");
        expect(res).toMatchObject({ language: "en" });
      });
    });

    describe("日本語名「フシギダネ」と答えたとき", () => {
      it("判定結果は正解になる", async () => {
        const service = await startQuest();
        const res = await service.guessName(USER_ID, "フシギダネ");
        expect(res).toMatchObject({ correct: true });
      });

      it("判定結果のボールはスーパーボールになる", async () => {
        const service = await startQuest();
        const res = await service.guessName(USER_ID, "フシギダネ");
        expect(res).toMatchObject({ ball_type: "great" });
      });

      it("判定結果で、正解した名前の言語は日本語になる", async () => {
        const service = await startQuest();
        const res = await service.guessName(USER_ID, "フシギダネ");
        expect(res).toMatchObject({ language: "ja" });
      });
    });

    describe("英語名が4文字以上のポケモン「Bulbasaur」に、綴りが2文字ずれた「bulbasaxx」と答えたとき", () => {
      it("判定結果は正解になる", async () => {
        const service = await startQuest();
        const res = await service.guessName(USER_ID, "bulbasaxx");
        expect(res).toMatchObject({ correct: true });
      });

      it("判定結果のボールはハイパーボールになる", async () => {
        const service = await startQuest();
        const res = await service.guessName(USER_ID, "bulbasaxx");
        expect(res).toMatchObject({ ball_type: "ultra" });
      });

      it("判定結果は、あいまい一致による正解になる", async () => {
        const service = await startQuest();
        const res = await service.guessName(USER_ID, "bulbasaxx");
        expect(res).toMatchObject({ fuzzy: true });
      });
    });

    describe("英語名が4文字のポケモン「Abra」に、綴りが1文字ずれた「abrx」と答えたとき", () => {
      const pokemons = [makePokemon({ name_en: "Abra", name_ja: "ケーシィ" })];

      it("判定結果は正解になる", async () => {
        const service = await startQuest({ pokemons });
        const res = await service.guessName(USER_ID, "abrx");
        expect(res).toMatchObject({ correct: true });
      });

      it("判定結果は、あいまい一致による正解になる", async () => {
        const service = await startQuest({ pokemons });
        const res = await service.guessName(USER_ID, "abrx");
        expect(res).toMatchObject({ fuzzy: true });
      });
    });

    it.each<[string, Pokemon[], string]>([
      ["英語名が4文字以上のポケモン「Bulbasaur」に、綴りが3文字ずれた「bulbasxxx」と答えたとき", [makePokemon()], "bulbasxxx"],
      ["英語名が3文字のポケモン「Mew」に、綴りが1文字ずれた「mex」と答えたとき", [makePokemon({ name_en: "Mew", name_ja: "ミュウ" })], "mex"],
      ["綴りが大きく異なる「wrong」と答えたとき", [makePokemon()], "wrong"],
    ])("%s、判定結果は不正解になる", async (_situation, pokemons, guess) => {
      const service = await startQuest({ pokemons });
      const res = await service.guessName(USER_ID, guess);
      expect(res).toMatchObject({ correct: false });
    });

    it("1回目に「wrong」と答えて外したとき、判定結果の残り挑戦回数は2回になる", async () => {
      const service = await startQuest();
      const res = await service.guessName(USER_ID, "wrong");
      expect(res).toMatchObject({ attempts_remaining: 2 });
    });

    describe("3回続けて外したとき", () => {
      it("判定結果は不正解になる", async () => {
        const service = await startQuest();
        const res = await missThreeTimes(service);
        expect(res).toMatchObject({ correct: false });
      });

      it("判定結果のボールはモンスターボールになる", async () => {
        const service = await startQuest();
        const res = await missThreeTimes(service);
        expect(res).toMatchObject({ ball_type: "poke" });
      });

      it("判定結果の残り挑戦回数は0回になる", async () => {
        const service = await startQuest();
        const res = await missThreeTimes(service);
        expect(res).toMatchObject({ attempts_remaining: 0 });
      });

      it("その後に捕獲すると、捕獲結果のボールはモンスターボールになる", async () => {
        const service = await startQuest();
        await missThreeTimes(service);
        const res = await service.attemptCapture(USER_ID);
        expect(res.ball_type).toBe("poke");
      });
    });
  });

  describe("異常系", () => {
    describe("英語名で正解済みのときに、別の名前「whatever」で答えたとき", () => {
      async function answerAgainAfterCorrect() {
        const service = await startQuest();
        await service.guessName(USER_ID, "bulbasaur");
        return service.guessName(USER_ID, "whatever");
      }

      it("判定結果は正解になる", async () => {
        const res = await answerAgainAfterCorrect();
        expect(res).toMatchObject({ correct: true });
      });

      it("判定結果のボールは確定済みのハイパーボールのままになる", async () => {
        const res = await answerAgainAfterCorrect();
        expect(res).toMatchObject({ ball_type: "ultra" });
      });

      it("判定結果の残り挑戦回数は0回になる", async () => {
        const res = await answerAgainAfterCorrect();
        expect(res).toMatchObject({ attempts_remaining: 0 });
      });
    });
  });
});

describe("[名前当て] マスターボール確定捕獲", () => {
  describe("正常系", () => {
    describe("伝説ポケモンで最終評価点が70のとき", () => {
      const options: ServiceOverrides = {
        pokemons: [makePokemon({ is_legendary: true })],
        llmText: AI_RESPONSE_FINAL_SCORE_70,
      };

      describe("英語名で正解したとき", () => {
        it("判定結果は正解になる", async () => {
          const service = await startScoredQuest(options);
          const res = await service.guessName(USER_ID, "bulbasaur");
          expect(res).toMatchObject({ correct: true });
        });

        it("判定結果のボールはマスターボールになる", async () => {
          const service = await startScoredQuest(options);
          const res = await service.guessName(USER_ID, "bulbasaur");
          expect(res).toMatchObject({ ball_type: "master" });
        });

        it("判定結果で、正解した名前の言語は英語になる", async () => {
          const service = await startScoredQuest(options);
          const res = await service.guessName(USER_ID, "bulbasaur");
          expect(res).toMatchObject({ language: "en" });
        });
      });

      describe("英語名とあいまい一致する「bulbasaxx」で答えたとき", () => {
        it("判定結果は正解になる", async () => {
          const service = await startScoredQuest(options);
          const res = await service.guessName(USER_ID, "bulbasaxx");
          expect(res).toMatchObject({ correct: true });
        });

        it("判定結果のボールはマスターボールになる", async () => {
          const service = await startScoredQuest(options);
          const res = await service.guessName(USER_ID, "bulbasaxx");
          expect(res).toMatchObject({ ball_type: "master" });
        });

        it("判定結果は、あいまい一致による正解になる", async () => {
          const service = await startScoredQuest(options);
          const res = await service.guessName(USER_ID, "bulbasaxx");
          expect(res).toMatchObject({ fuzzy: true });
        });
      });

      describe("3回続けて外したとき", () => {
        it("判定結果は不正解になる", async () => {
          const service = await startScoredQuest(options);
          const res = await missThreeTimes(service);
          expect(res).toMatchObject({ correct: false });
        });

        it("判定結果のボールはモンスターボールになる", async () => {
          const service = await startScoredQuest(options);
          const res = await missThreeTimes(service);
          expect(res).toMatchObject({ ball_type: "poke" });
        });
      });

      it("名前当てをスキップすると、スキップ結果のボールはモンスターボールになる", async () => {
        const service = await startScoredQuest(options);
        expect(await service.skipGuess(USER_ID)).toEqual({ ball_type: "poke" });
      });

      describe("英語名で正解してマスターボールが確定済みで、乱数が最大に近い値のとき、捕獲すると", () => {
        const captureOptions: ServiceOverrides = {
          pokemons: [makePokemon({ is_legendary: true, base_stat_total: 680 })],
          llmText: AI_RESPONSE_FINAL_SCORE_70,
          randomValue: 0.9999,
        };

        async function captureAfterCorrectGuess() {
          const service = await startScoredQuest(captureOptions);
          await service.guessName(USER_ID, "bulbasaur");
          return service.attemptCapture(USER_ID);
        }

        it("捕獲結果は成功になる", async () => {
          const res = await captureAfterCorrectGuess();
          expect(res).toMatchObject({ captured: true });
        });

        it("捕獲結果の捕獲確率は1.0になる", async () => {
          const res = await captureAfterCorrectGuess();
          expect(res).toMatchObject({ probability: 1.0 });
        });

        it("捕獲結果のボールはマスターボールになる", async () => {
          const res = await captureAfterCorrectGuess();
          expect(res).toMatchObject({ ball_type: "master" });
        });
      });
    });

    describe("伝説ポケモンで最終評価点が69のとき、英語名で正解したとき", () => {
      const options: ServiceOverrides = {
        pokemons: [makePokemon({ is_legendary: true })],
        llmText: AI_RESPONSE_FINAL_SCORE_69,
      };

      it("判定結果は正解になる", async () => {
        const service = await startScoredQuest(options);
        const res = await service.guessName(USER_ID, "bulbasaur");
        expect(res).toMatchObject({ correct: true });
      });

      it("判定結果のボールはハイパーボールになる", async () => {
        const service = await startScoredQuest(options);
        const res = await service.guessName(USER_ID, "bulbasaur");
        expect(res).toMatchObject({ ball_type: "ultra" });
      });
    });

    describe("幻ポケモンで最終評価点が70のとき、日本語名「フシギダネ」で正解したとき", () => {
      const options: ServiceOverrides = {
        pokemons: [makePokemon({ is_mythical: true })],
        llmText: AI_RESPONSE_FINAL_SCORE_70,
      };

      it("判定結果は正解になる", async () => {
        const service = await startScoredQuest(options);
        const res = await service.guessName(USER_ID, "フシギダネ");
        expect(res).toMatchObject({ correct: true });
      });

      it("判定結果のボールはマスターボールになる", async () => {
        const service = await startScoredQuest(options);
        const res = await service.guessName(USER_ID, "フシギダネ");
        expect(res).toMatchObject({ ball_type: "master" });
      });

      it("判定結果で、正解した名前の言語は日本語になる", async () => {
        const service = await startScoredQuest(options);
        const res = await service.guessName(USER_ID, "フシギダネ");
        expect(res).toMatchObject({ language: "ja" });
      });
    });

    describe("伝説でも幻でもないポケモンで最終評価点が70のとき、英語名で正解したとき", () => {
      const options: ServiceOverrides = { llmText: AI_RESPONSE_FINAL_SCORE_70 };

      it("判定結果は正解になる", async () => {
        const service = await startScoredQuest(options);
        const res = await service.guessName(USER_ID, "bulbasaur");
        expect(res).toMatchObject({ correct: true });
      });

      it("判定結果のボールはハイパーボールになる", async () => {
        const service = await startScoredQuest(options);
        const res = await service.guessName(USER_ID, "bulbasaur");
        expect(res).toMatchObject({ ball_type: "ultra" });
      });
    });
  });
});

describe("[名前当て] 名前当てのヒント", () => {
  describe("正常系", () => {
    describe("まだ名前当てをしていないとき、1回目のヒントを要求すると", () => {
      it("要求結果として、出題ポケモンのタイプ (くさ・どく) が開示される", async () => {
        const service = await startQuest({ pokemons: [makePokemon({ types: ["grass", "poison"] })] });
        const res = await service.requestHint(USER_ID);
        expect(res).toEqual({ types: ["grass", "poison"], attempts_remaining: expect.any(Number) });
      });

      it("要求結果の残り挑戦回数は2回になる", async () => {
        const service = await startQuest({ pokemons: [makePokemon({ types: ["grass", "poison"] })] });
        const res = await service.requestHint(USER_ID);
        expect(res).toEqual({ types: expect.any(Array), attempts_remaining: 2 });
      });
    });

    describe("1回目のヒントを要求済みのとき、2回目のヒントを要求すると", () => {
      async function requestSecondHint(levelUpMoves: string[] | undefined) {
        const service = await startQuest({
          pokemons: [makePokemon({ level_up_moves: levelUpMoves })],
          randomValue: 0,
        });
        await service.requestHint(USER_ID);
        return service.requestHint(USER_ID);
      }

      it.each<[string, string[] | undefined]>([
        ["レベルアップで覚える技が3つあるポケモン", ["たいあたり", "なきごえ", "つるのムチ"]],
        ["レベルアップで覚える技の情報が未設定のポケモン", undefined],
        ["レベルアップで覚える技の情報が0件のポケモン", []],
      ])("%sでは、要求結果の残り挑戦回数は1回になる", async (_pokemon, levelUpMoves) => {
        const res = await requestSecondHint(levelUpMoves);
        expect(res).toEqual({ moves: expect.any(Array), attempts_remaining: 1 });
      });

      it("レベルアップで覚える技が「たいあたり」「なきごえ」「つるのムチ」のポケモンでは、要求結果として、その3つの技が開示される", async () => {
        const res = await requestSecondHint(["たいあたり", "なきごえ", "つるのムチ"]);
        expect(res).toEqual({
          moves: ["たいあたり", "なきごえ", "つるのムチ"],
          attempts_remaining: expect.any(Number),
        });
      });

      it.each<[string, string[] | undefined]>([
        ["未設定", undefined],
        ["0件", []],
      ])(
        "レベルアップで覚える技の情報が%sのポケモンでは、要求結果で開示される技は0件になる",
        async (_state, levelUpMoves) => {
          const res = await requestSecondHint(levelUpMoves);
          expect(res).toEqual({ moves: [], attempts_remaining: expect.any(Number) });
        },
      );
    });

    it("技の抽選結果が異なる2回のクエストで同じポケモンに出会い、それぞれ2回目のヒントを要求したとき、要求結果で開示される技は互いに異なる", async () => {
      const candidates = ["たいあたり", "なきごえ", "つるのムチ", "やどりぎのタネ"];
      const pokemons = [makePokemon({ level_up_moves: candidates })];

      const serviceA = await startQuest({ pokemons, randomValue: 0 });
      await serviceA.requestHint(USER_ID);
      const resA = await serviceA.requestHint(USER_ID);

      const serviceB = await startQuest({ pokemons, randomValue: 0.9 });
      await serviceB.requestHint(USER_ID);
      const resB = await serviceB.requestHint(USER_ID);

      expect(resA.moves).not.toEqual(resB.moves);
    });

    it("名前当てで1回外して残り挑戦回数が2回のとき、ヒントを要求すると、要求結果の残り挑戦回数は1回になる", async () => {
      const service = await startQuest();
      await service.guessName(USER_ID, "wrong");
      const res = await service.requestHint(USER_ID);
      expect(res.attempts_remaining).toBe(1);
    });

    describe("1回外したあとヒントを1回要求し、残り挑戦回数が1回のとき、もう一度外すと", () => {
      async function missAgainAfterHint() {
        const service = await startQuest();
        await service.guessName(USER_ID, "wrong1");
        await service.requestHint(USER_ID);
        return service.guessName(USER_ID, "wrong2");
      }

      it("判定結果は不正解になる", async () => {
        const res = await missAgainAfterHint();
        expect(res).toMatchObject({ correct: false });
      });

      it("判定結果のボールはモンスターボールになる", async () => {
        const res = await missAgainAfterHint();
        expect(res).toMatchObject({ ball_type: "poke" });
      });

      it("判定結果の残り挑戦回数は0回になる", async () => {
        const res = await missAgainAfterHint();
        expect(res).toMatchObject({ attempts_remaining: 0 });
      });
    });
  });

  describe("異常系", () => {
    it("ヒントを2回要求済みのとき、3回目を要求すると、名前当てが済んでいるか、ヒントを使い切っているエラーになる", async () => {
      const service = await startQuest();
      await service.requestHint(USER_ID);
      await service.requestHint(USER_ID);
      await expect(service.requestHint(USER_ID)).rejects.toThrow(/already guessed or hints exhausted/);
    });

    it("名前当てで2回外して残り挑戦回数が1回のとき、ヒントを要求すると、残り挑戦回数が足りないエラーになる", async () => {
      const service = await startQuest();
      await service.guessName(USER_ID, "wrong1");
      await service.guessName(USER_ID, "wrong2");
      await expect(service.requestHint(USER_ID)).rejects.toThrow(/insufficient guess attempts remaining/);
    });

    it("名前当てに正解済みのとき、ヒントを要求すると、名前当てが済んでいるか、ヒントを使い切っているエラーになる", async () => {
      const service = await startQuest();
      await service.guessName(USER_ID, "bulbasaur");
      await expect(service.requestHint(USER_ID)).rejects.toThrow(/already guessed or hints exhausted/);
    });

    it("進行中のクエストセッションがないとき、ヒントを要求すると、クエストセッションが見つからないエラーになる", async () => {
      const service = makeService();
      await expect(service.requestHint("nobody")).rejects.toThrow(NotFoundError);
    });
  });
});

describe("[名前当て] 名前当てのスキップ", () => {
  describe("正常系", () => {
    it("名前当てをスキップすると、スキップ結果のボールはモンスターボールになる", async () => {
      const service = await startQuest();
      expect(await service.skipGuess(USER_ID)).toEqual({ ball_type: "poke" });
    });
  });

  describe("異常系", () => {
    it("進行中のクエストセッションがないとき、名前当てをスキップすると、クエストセッションが見つからないエラーになる", async () => {
      const service = makeService();
      await expect(service.skipGuess("nobody")).rejects.toThrow(NotFoundError);
    });

    describe("英語名で正解してハイパーボールが確定済みのとき、名前当てをスキップすると", () => {
      it("スキップ結果のボールは確定済みのハイパーボールのままになる", async () => {
        const service = await startQuest();
        await service.guessName(USER_ID, "bulbasaur");
        expect(await service.skipGuess(USER_ID)).toEqual({ ball_type: "ultra" });
      });

      it("その後に捕獲すると、捕獲結果のボールはハイパーボールになる", async () => {
        const service = await startQuest();
        await service.guessName(USER_ID, "bulbasaur");
        await service.skipGuess(USER_ID);
        expect((await service.attemptCapture(USER_ID)).ball_type).toBe("ultra");
      });
    });

    describe("日本語名で正解してスーパーボールが確定済みのとき、名前当てをスキップすると", () => {
      it("スキップ結果のボールは確定済みのスーパーボールのままになる", async () => {
        const service = await startQuest();
        await service.guessName(USER_ID, "フシギダネ");
        expect(await service.skipGuess(USER_ID)).toEqual({ ball_type: "great" });
      });

      it("その後に捕獲すると、捕獲結果のボールはスーパーボールになる", async () => {
        const service = await startQuest();
        await service.guessName(USER_ID, "フシギダネ");
        await service.skipGuess(USER_ID);
        expect((await service.attemptCapture(USER_ID)).ball_type).toBe("great");
      });
    });
  });
});

describe("[捕獲] 捕獲の実行", () => {
  describe("正常系", () => {
    describe("名前当てをスキップしてモンスターボールが確定済みのとき、捕獲すると", () => {
      async function captureAfterSkip(o: ServiceOverrides = {}) {
        const service = await startQuest(o);
        await service.skipGuess(USER_ID);
        return service.attemptCapture(USER_ID);
      }

      it("乱数が捕獲確率を下回るとき、捕獲結果は成功になる", async () => {
        const res = await captureAfterSkip();
        expect(res.captured).toBe(true);
      });

      it("捕獲結果のポケモンは、出題されたポケモン (図鑑番号1、英語名 Bulbasaur) になる", async () => {
        const res = await captureAfterSkip();
        expect(res).toMatchObject({ pokemon_id: 1, name_en: "Bulbasaur" });
      });

      it("捕獲結果のボールはモンスターボールになる", async () => {
        const res = await captureAfterSkip();
        expect(res.ball_type).toBe("poke");
      });

      it("捕獲結果の捕獲確率は0より大きくなる", async () => {
        const res = await captureAfterSkip();
        expect(res.probability).toBeGreaterThan(0);
      });

      it("種族値合計が680のポケモンで、乱数が捕獲確率を上回るとき、捕獲結果は失敗になる", async () => {
        const res = await captureAfterSkip({
          pokemons: [makePokemon({ base_stat_total: 680 })],
          randomValue: 0.5,
        });
        expect(res.captured).toBe(false);
      });
    });
  });

  describe("異常系", () => {
    it("名前当てにもスキップにも応答していないとき、捕獲すると、ボールが未確定のエラーになる", async () => {
      const service = await startQuest();
      await expect(service.attemptCapture(USER_ID)).rejects.toThrow(/before a ball/);
    });

    it("捕獲を1回行ったあとに、もう一度捕獲すると、クエストセッションが見つからないエラーになる", async () => {
      const service = await startQuest();
      await service.skipGuess(USER_ID);
      await service.attemptCapture(USER_ID);
      await expect(service.attemptCapture(USER_ID)).rejects.toThrow(NotFoundError);
    });
  });
});

describe("[リロード再開] 現在のクエスト取得", () => {
  describe("正常系", () => {
    describe("図鑑番号150の伝説ポケモン (英語説明文「Mewtwo is powerful.」) を出題して、採点前のとき", () => {
      const options: ServiceOverrides = {
        pokemons: [
          makePokemon({
            id: 150,
            name_en: "Mewtwo",
            name_ja: "ミュウツー",
            description_en: "Mewtwo is powerful.",
            base_stat_total: 680,
            types: ["psychic"],
            height: 20,
            weight: 1220,
            level_up_moves: ["かなしばり", "ねんりき", "スピードスター"],
            is_legendary: true,
          }),
        ],
      };

      it("取得結果の段階は訳文入力になる", async () => {
        const service = await startQuest(options);
        const res = await service.getCurrentQuest(USER_ID);
        expect(res).toEqual({ phase: "translating", quest: expect.any(Object) });
      });

      it("取得結果のクエストは図鑑番号150のポケモンになる", async () => {
        const service = await startQuest(options);
        const res = await service.getCurrentQuest(USER_ID);
        expect(res).toMatchObject({ quest: { pokemon_id: 150 } });
      });

      it("取得結果のクエストの英語説明文は、ポケモン名を伏せ字にした「This Pokémon is powerful.」になる", async () => {
        const service = await startQuest(options);
        const res = await service.getCurrentQuest(USER_ID);
        expect(res).toMatchObject({ quest: { description_en: "This Pokémon is powerful." } });
      });

      it("取得結果のクエストは伝説ポケモンで、幻ではない", async () => {
        const service = await startQuest(options);
        const res = await service.getCurrentQuest(USER_ID);
        expect(res).toMatchObject({ quest: { is_legendary: true, is_mythical: false } });
      });

      it("取得結果のクエストの名前当ての最大挑戦回数は3回になる", async () => {
        const service = await startQuest(options);
        const res = await service.getCurrentQuest(USER_ID);
        expect(res).toMatchObject({ quest: { max_guess_attempts: 3 } });
      });
    });

    describe("採点後で名前当てが未確定のとき", () => {
      async function scoreAndRequestHints(hintCount: number, o: ServiceOverrides = {}) {
        const service = await startQuest({
          pokemons: [makePokemon({ level_up_moves: ["たいあたり"] })],
          randomValue: 0,
          ...o,
        });
        await service.scoreTranslation(USER_ID, "訳");
        for (let i = 0; i < hintCount; i++) await service.requestHint(USER_ID);
        return service.getCurrentQuest(USER_ID);
      }

      it.each([
        ["ヒントを1回も要求していないとき", 0],
        ["ヒントを1回要求済みのとき", 1],
        ["ヒントを2回要求済みのとき", 2],
      ])("%s、取得結果の段階は名前当てになる", async (_hintStatus, hintCount) => {
        const res = await scoreAndRequestHints(hintCount);
        expect(res).toMatchObject({ phase: "guessing" });
      });

      it("AI が意味単位1件の判定値0.7を返して採点したとき、取得結果の最終評価点は66になる", async () => {
        const res = await scoreAndRequestHints(0, {
          llmText: JSON.stringify({ units: [0.7], review: "よい 翻訳だ。" }),
        });
        expect(res).toMatchObject({ score: { score: 66 } });
      });

      it("AI が講評「よい 翻訳だ。」を返して採点したとき、取得結果の講評は「よい 翻訳だ。」になる", async () => {
        const res = await scoreAndRequestHints(0, {
          llmText: JSON.stringify({ units: [0.7], review: "よい 翻訳だ。" }),
        });
        expect(res).toMatchObject({ score: { review: "よい 翻訳だ。" } });
      });

      it("日本語説明文が「フシギダネは 緑色だ。」でポケモン名がフシギダネのとき、取得結果の日本語説明文は、ポケモン名を伏せ字にした「この ポケモンは 緑色だ。」になる", async () => {
        const res = await scoreAndRequestHints(0, {
          pokemons: [makePokemon({ description_ja: "フシギダネは 緑色だ。" })],
        });
        expect(res).toMatchObject({ score: { description_ja: "この ポケモンは 緑色だ。" } });
      });

      it("訳文「みどり」を採点に送ったとき、取得結果のユーザーの訳文は「みどり」になる", async () => {
        const service = await startQuest();
        await service.scoreTranslation(USER_ID, "みどり");
        const res = await service.getCurrentQuest(USER_ID);
        expect(res).toMatchObject({ user_translation: "みどり" });
      });

      it("名前当てもヒントもまだ行っていないとき、取得結果の残り挑戦回数は3回になる", async () => {
        const res = await scoreAndRequestHints(0);
        expect(res).toMatchObject({ attempts_remaining: 3 });
      });

      it("ヒントを1回も要求していないとき、取得結果の開示済みのヒントは無しになる", async () => {
        const res = await scoreAndRequestHints(0);
        expect(res).toMatchObject({ hint: null });
      });

      it.each([
        ["ヒントを1回要求済み", 1],
        ["ヒントを2回要求済み", 2],
      ])(
        "%sのとき、取得結果の開示済みのヒントとして、出題ポケモンのタイプ (くさ・どく) が示される",
        async (_hintStatus, hintCount) => {
          const res = await scoreAndRequestHints(hintCount);
          expect(res).toMatchObject({ hint: { types: ["grass", "poison"] } });
        },
      );

      it("ヒントを1回要求済みのとき、取得結果の開示済みのヒントの残り挑戦回数は2回になる", async () => {
        const res = await scoreAndRequestHints(1);
        expect(res).toMatchObject({ hint: { attempts_remaining: 2 } });
      });

      it("レベルアップで覚える技が「たいあたり」のポケモンで、ヒントを2回要求済みのとき、取得結果の開示済みのヒントとして、技「たいあたり」が示される", async () => {
        const res = await scoreAndRequestHints(2);
        expect(res).toMatchObject({ hint: { moves: ["たいあたり"] } });
      });

      it("ヒントを2回要求済みのとき、取得結果の開示済みのヒントの残り挑戦回数は1回になる", async () => {
        const res = await scoreAndRequestHints(2);
        expect(res).toMatchObject({ hint: { attempts_remaining: 1 } });
      });
    });

    describe("名前当てでボールが確定済みのとき", () => {
      const cases: [string, (service: QuestService) => Promise<void>][] = [
        [
          "名前当てに正解してハイパーボールが確定済み",
          async (service) => {
            await service.guessName(USER_ID, "bulbasaur");
          },
        ],
        [
          "名前当てをスキップしてモンスターボールが確定済み",
          async (service) => {
            await service.skipGuess(USER_ID);
          },
        ],
      ];

      it.each(cases)("%sのとき、取得結果の段階は捕獲待機になる", async (_situation, decideBall) => {
        const service = await startScoredQuest();
        await decideBall(service);
        const res = await service.getCurrentQuest(USER_ID);
        expect(res).toMatchObject({ phase: "capturing" });
      });

      it("名前当てに正解してハイパーボールが確定済みのとき、取得結果の確定済みのボールはハイパーボールになる", async () => {
        const service = await startScoredQuest();
        await service.guessName(USER_ID, "bulbasaur");
        const res = await service.getCurrentQuest(USER_ID);
        expect(res).toMatchObject({ ball_type: "ultra" });
      });

      it("名前当てをスキップしてモンスターボールが確定済みのとき、取得結果の確定済みのボールはモンスターボールになる", async () => {
        const service = await startScoredQuest();
        await service.skipGuess(USER_ID);
        const res = await service.getCurrentQuest(USER_ID);
        expect(res).toMatchObject({ ball_type: "poke" });
      });
    });
  });

  describe("異常系", () => {
    it("進行中のクエストセッションがないとき、現在のクエストを取得すると、クエストセッションが見つからないエラーになる", async () => {
      const service = makeService();
      await expect(service.getCurrentQuest("nobody")).rejects.toBeInstanceOf(NotFoundError);
    });

    describe("採点前に名前当てに正解してハイパーボールが確定済みのとき", () => {
      it("取得結果の段階は捕獲待機になる", async () => {
        const service = await startQuest();
        await service.guessName(USER_ID, "bulbasaur");
        const res = await service.getCurrentQuest(USER_ID);
        expect(res).toMatchObject({ phase: "capturing" });
      });

      it("取得結果の確定済みのボールはハイパーボールになる", async () => {
        const service = await startQuest();
        await service.guessName(USER_ID, "bulbasaur");
        const res = await service.getCurrentQuest(USER_ID);
        expect(res).toMatchObject({ ball_type: "ultra" });
      });
    });
  });
});
