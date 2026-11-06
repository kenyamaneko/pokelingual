import { describe, expect } from "vitest";
import {
  QuestService,
  calculateCaptureRate,
  computeScoreFromUnits,
  translateToFinalScore,
  maskPokemonNameEN,
  maskPokemonNameJA,
} from "./quest-service.js";
import {
  NotFoundError,
  ExternalServiceError,
  EmptyQuestPoolError,
} from "../domain/errors.js";
import type {
  LLMClient,
  RandomSource,
  UserSettingsRepository,
} from "../domain/ports.js";
import type { Pokemon } from "../domain/pokemon.js";
import { makePokemon, makePokemonClient } from "../testing/pokemon-fixtures.js";
import { makeInMemoryQuestSessionStore } from "../testing/session-store-fixture.js";
import { DEFAULT_QUEST_TUNING } from "../testing/quest-tuning-fixture.js";
import { defineCase, type Viewpoint } from "../test/defineCase.js";

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
      if (o.llmTexts)
        return o.llmTexts[Math.min(llmCallIndex++, o.llmTexts.length - 1)];
      return (
        o.llmRespond?.(prompt) ??
        o.llmText ??
        JSON.stringify({ units: [0.7], review: "よい 翻訳だ。" })
      );
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
  const sessionStore = makeInMemoryQuestSessionStore({
    error: o.sessionStoreError,
  });
  return new QuestService(
    pokemonClient,
    llm,
    settingsRepo,
    random,
    sessionStore,
    DEFAULT_QUEST_TUNING,
  );
}

const USER_ID = "alice";
const AI_RESPONSE_FINAL_SCORE_70 = JSON.stringify({
  units: [0.74],
  review: "よい",
});
const AI_RESPONSE_FINAL_SCORE_69 = JSON.stringify({
  units: [0.73],
  review: "よい",
});

async function startQuest(o: ServiceOverrides = {}): Promise<QuestService> {
  const service = makeService(o);
  await service.newQuest(USER_ID);
  return service;
}

async function startScoredQuest(
  o: ServiceOverrides = {},
): Promise<QuestService> {
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

const CAPTURE_RATE_PURPOSE = "捕獲待機画面でボールを使うために、";
const CALCULATE_CAPTURE_RATE = `${CAPTURE_RATE_PURPOSE}捕獲確率を計算する`;

describe("[本体:捕獲]捕獲確率の計算", () => {
  // ボール補正は設定値に依存しない純関数の引数のため、本番の設定値とは独立したテスト固有の値を使う
  const POKE_BONUS = 0;
  const GREAT_BONUS = 1.5;
  const ULTRA_BONUS = 3.0;

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["境界値"],
      steps: [
        {
          Given: "ボール補正がなく、最終評価点が0で種族値合計が680のとき",
          When: [CALCULATE_CAPTURE_RATE],
          Then: "捕獲確率は0.05未満になる",
        },
      ],
    },
    () => {
      expect(calculateCaptureRate(0, 680, POKE_BONUS)).toBeLessThan(0.05);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "ボール補正がなく、種族値合計が300のとき",
          When: [
            `${CAPTURE_RATE_PURPOSE}最終評価点が90の捕獲確率を計算する`,
            `${CAPTURE_RATE_PURPOSE}最終評価点が30の捕獲確率を計算する`,
          ],
          Then: "最終評価点が90の捕獲確率は、最終評価点が30の捕獲確率より高くなる",
        },
      ],
    },
    () => {
      expect(calculateCaptureRate(90, 300, POKE_BONUS)).toBeGreaterThan(
        calculateCaptureRate(30, 300, POKE_BONUS),
      );
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "ボール補正がなく、最終評価点が50のとき",
          When: [
            `${CAPTURE_RATE_PURPOSE}種族値合計が300の捕獲確率を計算する`,
            `${CAPTURE_RATE_PURPOSE}種族値合計が680の捕獲確率を計算する`,
          ],
          Then: "種族値合計が300の捕獲確率は、種族値合計が680の捕獲確率より高くなる",
        },
      ],
    },
    () => {
      expect(calculateCaptureRate(50, 300, POKE_BONUS)).toBeGreaterThan(
        calculateCaptureRate(50, 680, POKE_BONUS),
      );
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["境界値"],
      steps: [
        {
          Given: "ボール補正が大きく、最終評価点が99で種族値合計が200のとき",
          When: [CALCULATE_CAPTURE_RATE],
          Then: "捕獲確率は1.0以下になる",
        },
      ],
    },
    () => {
      expect(calculateCaptureRate(99, 200, ULTRA_BONUS)).toBeLessThanOrEqual(1);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["境界値"],
      steps: [
        {
          Given: "ボール補正が大きく、最終評価点が99で種族値合計が680のとき",
          When: [CALCULATE_CAPTURE_RATE],
          Then: "捕獲確率は0.99を超える",
        },
      ],
    },
    () => {
      expect(calculateCaptureRate(99, 680, ULTRA_BONUS)).toBeGreaterThan(0.99);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "最終評価点が0で種族値合計が680のとき",
          When: [
            `${CAPTURE_RATE_PURPOSE}ボール補正が大きい場合の捕獲確率を計算する`,
            `${CAPTURE_RATE_PURPOSE}ボール補正がない場合の捕獲確率を計算する`,
          ],
          Then: "ボール補正が大きい場合の捕獲確率は、ボール補正がない場合より高くなる",
        },
      ],
    },
    () => {
      expect(calculateCaptureRate(0, 680, ULTRA_BONUS)).toBeGreaterThan(
        calculateCaptureRate(0, 680, POKE_BONUS),
      );
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "最終評価点が20で種族値合計が500のとき",
          When: [
            `${CAPTURE_RATE_PURPOSE}ボール補正がない場合の捕獲確率を計算する`,
            `${CAPTURE_RATE_PURPOSE}ボール補正が小さい場合の捕獲確率を計算する`,
            `${CAPTURE_RATE_PURPOSE}ボール補正が大きい場合の捕獲確率を計算する`,
          ],
          Then: "捕獲確率は、ボール補正がない場合、小さい場合、大きい場合の順に高くなる",
        },
      ],
    },
    () => {
      const pokeRate = calculateCaptureRate(20, 500, POKE_BONUS);
      const greatRate = calculateCaptureRate(20, 500, GREAT_BONUS);
      const ultraRate = calculateCaptureRate(20, 500, ULTRA_BONUS);
      expect(greatRate).toBeGreaterThan(pokeRate);
      expect(ultraRate).toBeGreaterThan(greatRate);
    },
  );
});

const MASK_ENGLISH_DESCRIPTION = "クエスト画面に表示する英語説明文の、ポケモン名を伏せ字にする";
const MASK_JAPANESE_DESCRIPTION = "名前当て画面に表示する日本語説明文の、ポケモン名を伏せ字にする";

describe("[本体:名前当て]英語説明文のポケモン名の伏せ字", () => {
  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["件数・有無"],
      steps: [
        {
          Given: "ポケモン名が Pikachu で、説明文が「Hello world」でポケモン名を含まないとき",
          When: [MASK_ENGLISH_DESCRIPTION],
          Then: "伏せ字にした説明文は「Hello world」のままになる",
        },
      ],
    },
    () => {
      expect(maskPokemonNameEN("Hello world", "Pikachu")).toBe("Hello world");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "ポケモン名が Pikachu で、ポケモン名が文中に出現する「A wild Pikachu appeared.」のとき",
          When: [MASK_ENGLISH_DESCRIPTION],
          Then: "伏せ字にした説明文は「A wild this Pokémon appeared.」になる",
        },
      ],
    },
    () => {
      expect(maskPokemonNameEN("A wild Pikachu appeared.", "Pikachu")).toBe(
        "A wild this Pokémon appeared.",
      );
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "ポケモン名が Pikachu で、ポケモン名が文頭に出現する「Pikachu is yellow.」のとき",
          When: [MASK_ENGLISH_DESCRIPTION],
          Then: "伏せ字にした説明文は「This Pokémon is yellow.」になる",
        },
      ],
    },
    () => {
      expect(maskPokemonNameEN("Pikachu is yellow.", "Pikachu")).toBe("This Pokémon is yellow.");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "ポケモン名が Pikachu で、ポケモン名がピリオドの直後に出現する「Hello. Pikachu runs.」のとき",
          When: [MASK_ENGLISH_DESCRIPTION],
          Then: "伏せ字にした説明文は「Hello. This Pokémon runs.」になる",
        },
      ],
    },
    () => {
      expect(maskPokemonNameEN("Hello. Pikachu runs.", "Pikachu")).toBe("Hello. This Pokémon runs.");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "ポケモン名が Pikachu で、ポケモン名の直前に「Several」がある「Several Pikachu gather.」のとき",
          When: [MASK_ENGLISH_DESCRIPTION],
          Then: "伏せ字にした説明文は「Several of these Pokémon gather.」になる",
        },
      ],
    },
    () => {
      expect(maskPokemonNameEN("Several Pikachu gather.", "Pikachu")).toBe(
        "Several of these Pokémon gather.",
      );
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["件数・有無"],
      steps: [
        {
          Given: "ポケモン名が Pikachu で、ポケモン名が複数回出現する「Pikachu and Pikachu」のとき",
          When: [MASK_ENGLISH_DESCRIPTION],
          Then: "伏せ字にした説明文は「This Pokémon and this Pokémon」になる",
        },
      ],
    },
    () => {
      expect(maskPokemonNameEN("Pikachu and Pikachu", "Pikachu")).toBe("This Pokémon and this Pokémon");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "ポケモン名が Pikachu で、ポケモン名と大文字小文字が異なる表記が出現する「A pikachu here」のとき",
          When: [MASK_ENGLISH_DESCRIPTION],
          Then: "伏せ字にした説明文は「A this Pokémon here」になる",
        },
      ],
    },
    () => {
      expect(maskPokemonNameEN("A pikachu here", "Pikachu")).toBe("A this Pokémon here");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      観点: ["件数・有無", "エッジケース"],
      steps: [
        {
          Given: "ポケモン名が空文字で、説明文が「A wild creature.」のとき",
          When: [MASK_ENGLISH_DESCRIPTION],
          Then: "伏せ字にした説明文は「A wild creature.」のままになる",
        },
      ],
    },
    () => {
      expect(maskPokemonNameEN("A wild creature.", "")).toBe("A wild creature.");
    },
  );
});

describe("[本体:名前当て]日本語説明文のポケモン名の伏せ字", () => {
  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "ポケモン名が「ピカチュウ」で、ポケモン名が出現する「ピカチュウは黄色い」のとき",
          When: [MASK_JAPANESE_DESCRIPTION],
          Then: "伏せ字にした説明文は「この ポケモンは黄色い」になる",
        },
      ],
    },
    () => {
      expect(maskPokemonNameJA("ピカチュウは黄色い", "ピカチュウ")).toBe("この ポケモンは黄色い");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["件数・有無"],
      steps: [
        {
          Given: "ポケモン名が「ピカチュウ」で、ポケモン名が複数回出現する「ピカチュウとピカチュウ」のとき",
          When: [MASK_JAPANESE_DESCRIPTION],
          Then: "伏せ字にした説明文は「この ポケモンとこの ポケモン」になる",
        },
      ],
    },
    () => {
      expect(maskPokemonNameJA("ピカチュウとピカチュウ", "ピカチュウ")).toBe("この ポケモンとこの ポケモン");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["件数・有無"],
      steps: [
        {
          Given: "ポケモン名が「ピカチュウ」で、説明文が「あいうえお」でポケモン名を含まないとき",
          When: [MASK_JAPANESE_DESCRIPTION],
          Then: "伏せ字にした説明文は「あいうえお」のままになる",
        },
      ],
    },
    () => {
      expect(maskPokemonNameJA("あいうえお", "ピカチュウ")).toBe("あいうえお");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      観点: ["件数・有無", "エッジケース"],
      steps: [
        {
          Given: "ポケモン名が空文字で、説明文が「あいうえお」のとき",
          When: [MASK_JAPANESE_DESCRIPTION],
          Then: "伏せ字にした説明文は「あいうえお」のままになる",
        },
      ],
    },
    () => {
      expect(maskPokemonNameJA("あいうえお", "")).toBe("あいうえお");
    },
  );
});

const COMPUTE_RAW_SCORE = "名前当て画面に採点結果を表示するために、意味単位の判定値から素点を算出する";

describe("[本体:採点]意味単位の判定値からの素点算出", () => {
  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["件数・有無"],
      steps: [
        {
          Given: "意味単位が1件で判定値が0.6のとき",
          When: [COMPUTE_RAW_SCORE],
          Then: "素点は60になる",
        },
      ],
    },
    () => {
      expect(computeScoreFromUnits([0.6])).toBe(60);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["境界値", "件数・有無"],
      steps: [
        {
          Given: "判定値が1.0、0.2、0.0の3件のとき",
          When: [COMPUTE_RAW_SCORE],
          Then: "素点は40になる",
        },
      ],
    },
    () => {
      expect(computeScoreFromUnits([1.0, 0.2, 0.0])).toBe(40);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["境界値", "件数・有無"],
      steps: [
        {
          Given: "判定値が1.0、1.0、0.0の3件のとき",
          When: [COMPUTE_RAW_SCORE],
          Then: "素点は四捨五入して67になる",
        },
      ],
    },
    () => {
      expect(computeScoreFromUnits([1.0, 1.0, 0.0])).toBe(67);
    },
  );

  for (const { given, units } of [
    { given: "すべての意味単位の判定値が0.8で、意味単位が1件のとき", units: [0.8] },
    { given: "すべての意味単位の判定値が0.8で、意味単位が3件のとき", units: [0.8, 0.8, 0.8] },
  ]) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "正常系",
        観点: ["件数・有無"],
        steps: [{ Given: given, When: [COMPUTE_RAW_SCORE], Then: "素点は80になる" }],
      },
      () => {
        expect(computeScoreFromUnits(units)).toBe(80);
      },
    );
  }
});

const CONVERT_TO_FINAL_SCORE = "名前当て画面に採点結果を表示するために、素点を最終評価点に変換する";

describe("[本体:採点]素点から最終評価点への変換", () => {
  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["境界値"],
      steps: [{ Given: "素点が0のとき", When: [CONVERT_TO_FINAL_SCORE], Then: "最終評価点は0になる" }],
    },
    () => {
      expect(translateToFinalScore(0)).toBe(0);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["境界値"],
      steps: [{ Given: "素点が100のとき", When: [CONVERT_TO_FINAL_SCORE], Then: "最終評価点は99になる" }],
    },
    () => {
      expect(translateToFinalScore(100)).toBe(99);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["境界値"],
      steps: [{ Given: "素点が10のとき", When: [CONVERT_TO_FINAL_SCORE], Then: "最終評価点は0になる" }],
    },
    () => {
      expect(translateToFinalScore(10)).toBe(0);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["境界値"],
      steps: [{ Given: "素点が11のとき", When: [CONVERT_TO_FINAL_SCORE], Then: "最終評価点は1になる" }],
    },
    () => {
      expect(translateToFinalScore(11)).toBe(1);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["同値分割"],
      steps: [{ Given: "素点が15のとき", When: [CONVERT_TO_FINAL_SCORE], Then: "最終評価点は6になる" }],
    },
    () => {
      expect(translateToFinalScore(15)).toBe(6);
    },
  );
});

const START_QUEST = "クエスト画面を開くために、クエストの出題を依頼する";

describe("[本体:クエスト]クエストの出題", () => {
  const LOCATION_ID = "ruined-powerplant";
  const LOCATION_GIVEN = "場所「廃墟の発電所」(でんき・はがね・どくタイプ) を選んでいて、";

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "英語説明文が「Bulbasaur is green.」のポケモンのとき",
          When: [START_QUEST],
          Then: "出題結果の英語説明文は「This Pokémon is green.」になる",
        },
      ],
    },
    async () => {
      const service = makeService({
        pokemons: [makePokemon({ description_en: "Bulbasaur is green." })],
      });
      const res = await service.newQuest(USER_ID);
      expect(res.description_en).toBe("This Pokémon is green.");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "図鑑番号1のポケモンだけがいるとき",
          When: [START_QUEST],
          Then: "出題結果の図鑑番号は1になる",
        },
      ],
    },
    async () => {
      const service = makeService();
      const res = await service.newQuest(USER_ID);
      expect(res.pokemon_id).toBe(1);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "伝説ポケモンでないポケモンのとき",
          When: [START_QUEST],
          Then: "出題結果は伝説ポケモンではないと示される",
        },
      ],
    },
    async () => {
      const service = makeService();
      const res = await service.newQuest(USER_ID);
      expect(res.is_legendary).toBe(false);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "図鑑番号5と6のポケモンがいて、図鑑番号5を除外しているとき",
          When: [START_QUEST],
          Then: "出題結果の図鑑番号は6になる",
        },
      ],
    },
    async () => {
      const service = makeService({
        pokemons: [makePokemon({ id: 5 }), makePokemon({ id: 6 })],
        excludedIDs: [5],
      });
      const res = await service.newQuest(USER_ID);
      expect(res.pokemon_id).toBe(6);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["件数・有無"],
      steps: [
        {
          Given: "第1世代だけを選択していて、第3世代の図鑑番号300と第1世代の図鑑番号100のポケモンがいるとき",
          When: [START_QUEST],
          Then: "出題結果の図鑑番号は100になる",
        },
      ],
    },
    async () => {
      const service = makeService({
        pokemons: [makePokemon({ id: 300 }), makePokemon({ id: 100 })],
        enabledGenerations: [1],
      });
      const res = await service.newQuest(USER_ID);
      expect(res.pokemon_id).toBe(100);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["件数・有無"],
      steps: [
        {
          Given: "第1世代と第3世代を選択していて、第3世代の図鑑番号300のポケモンがいるとき",
          When: [START_QUEST],
          Then: "出題結果の図鑑番号は300になる",
        },
      ],
    },
    async () => {
      const service = makeService({
        pokemons: [makePokemon({ id: 300 })],
        enabledGenerations: [1, 3],
      });
      const res = await service.newQuest(USER_ID);
      expect(res.pokemon_id).toBe(300);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["件数・有無"],
      steps: [
        {
          Given: "出題世代を設定していなくて、第5世代の図鑑番号500のポケモンがいるとき",
          When: [START_QUEST],
          Then: "出題結果の図鑑番号は500になる",
        },
      ],
    },
    async () => {
      const service = makeService({
        pokemons: [makePokemon({ id: 500 })],
        enabledGenerations: null,
      });
      const res = await service.newQuest(USER_ID);
      expect(res.pokemon_id).toBe(500);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ When: [START_QUEST], Then: "出題結果の名前当ての最大挑戦回数は3回になる" }],
    },
    async () => {
      const service = makeService();
      const res = await service.newQuest(USER_ID);
      expect(res.max_guess_attempts).toBe(3);
    },
  );

  for (const { given, flavorTexts } of [
    {
      given: "バージョン別の説明文が「Alpha Bulbasaur runs.」の1件のとき",
      flavorTexts: [
        {
          version_names: ["X"],
          description_en: "Alpha Bulbasaur runs.",
          description_ja: "フシギダネは 走る。",
        },
      ],
    },
    {
      given:
        "バージョン別の説明文が「Alpha Bulbasaur runs.」(1件目) と「Beta text.」(2件目) の2件あり、抽選で1件目が選ばれるとき",
      flavorTexts: [
        {
          version_names: ["X"],
          description_en: "Alpha Bulbasaur runs.",
          description_ja: "フシギダネは 走る。",
        },
        {
          version_names: ["Y"],
          description_en: "Beta text.",
          description_ja: "ベータ。",
        },
      ],
    },
  ] satisfies { given: string; flavorTexts: Pokemon["flavor_texts"] }[]) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "正常系",
        観点: ["件数・有無"],
        steps: [
          {
            Given: given,
            When: [START_QUEST],
            Then: "出題結果の英語説明文は「Alpha this Pokémon runs.」になる",
          },
        ],
      },
      async () => {
        const service = makeService({
          pokemons: [makePokemon({ flavor_texts: flavorTexts })],
        });
        const res = await service.newQuest(USER_ID);
        expect(res.description_en).toBe("Alpha this Pokémon runs.");
      },
    );
  }

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      観点: ["件数・有無"],
      steps: [
        {
          Given: "図鑑番号1のポケモンだけが出題対象で、図鑑番号1から10を除外しているとき",
          When: [START_QUEST],
          Then: "出題できるポケモンがいないエラーになる",
        },
      ],
    },
    async () => {
      const service = makeService({
        pokemons: [makePokemon({ id: 1 })],
        excludedIDs: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      });
      await expect(service.newQuest(USER_ID)).rejects.toBeInstanceOf(EmptyQuestPoolError);
    },
  );

  for (const { given, flavorTexts, 観点 } of [
    { given: "バージョン別の説明文の一覧が未設定のとき", flavorTexts: undefined, 観点: ["件数・有無", "エッジケース"] },
    { given: "バージョン別の説明文の一覧が0件のとき", flavorTexts: [], 観点: ["件数・有無"] },
  ] satisfies { given: string; flavorTexts: Pokemon["flavor_texts"]; 観点: readonly Viewpoint[] }[]) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "正常系",
        観点,
        steps: [
          {
            Given: `英語説明文が「A strange seed was planted on its back at birth. The plant sprouts and grows with this Pokémon.」のポケモンで、${given}`,
            When: [START_QUEST],
            Then: "出題結果の英語説明文は「A strange seed was planted on its back at birth. The plant sprouts and grows with this Pokémon.」になる",
          },
        ],
      },
      async () => {
        const service = makeService({
          pokemons: [makePokemon({ flavor_texts: flavorTexts })],
        });
        const res = await service.newQuest(USER_ID);
        expect(res.description_en).toBe(
          "A strange seed was planted on its back at birth. The plant sprouts and grows with this Pokémon.",
        );
      },
    );
  }

  for (const { given, overrides, 観点 } of [
    {
      given: "でんきタイプの図鑑番号100とくさタイプの図鑑番号110のポケモンがいるとき",
      overrides: {
        pokemons: [makePokemon({ id: 110, types: ["grass"] }), makePokemon({ id: 100, types: ["electric"] })],
      },
      観点: [],
    },
    {
      given:
        "第1世代だけを選択していて、第6世代の図鑑番号700と第1世代の図鑑番号100の、どちらもでんきタイプのポケモンがいるとき",
      overrides: {
        pokemons: [makePokemon({ id: 700, types: ["electric"] }), makePokemon({ id: 100, types: ["electric"] })],
        enabledGenerations: [1],
      },
      観点: [],
    },
    {
      given: "幻・伝説の抽選に当たっていて、幻・伝説のポケモンがいなくて、でんきタイプの図鑑番号100のポケモンがいるとき",
      overrides: {
        pokemons: [makePokemon({ id: 100, types: ["electric"] })],
        randomValue: 0.995,
      },
      観点: ["件数・有無"],
    },
  ] satisfies { given: string; overrides: ServiceOverrides; 観点: readonly Viewpoint[] }[]) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "正常系",
        観点,
        steps: [
          {
            Given: `${LOCATION_GIVEN}${given}`,
            When: [START_QUEST],
            Then: "出題結果の図鑑番号は100になる",
          },
        ],
      },
      async () => {
        const service = makeService(overrides);
        const res = await service.newQuest(USER_ID, LOCATION_ID);
        expect(res.pokemon_id).toBe(100);
      },
    );
  }

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: `${LOCATION_GIVEN}幻・伝説の抽選に当たっていて、でんきタイプの図鑑番号100とエスパータイプの図鑑番号150の伝説ポケモンがいるとき`,
          When: [START_QUEST],
          Then: "出題結果の図鑑番号は150になる",
        },
      ],
    },
    async () => {
      const service = makeService({
        pokemons: [makePokemon({ id: 150, types: ["psychic"] }), makePokemon({ id: 100, types: ["electric"] })],
        randomValue: 0.995,
      });
      const res = await service.newQuest(USER_ID, LOCATION_ID);
      expect(res.pokemon_id).toBe(150);
    },
  );
});

const SCORE_TRANSLATION = "クエスト画面で、訳文の採点を依頼する";

describe("[本体:採点]翻訳の採点", () => {
  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["件数・有無"],
      steps: [
        {
          Given: "AI が意味単位1件の判定値0.7を返すとき",
          When: [SCORE_TRANSLATION],
          Then: "採点結果の最終評価点は66になる",
        },
      ],
    },
    async () => {
      const service = await startQuest({
        llmText: JSON.stringify({ units: [0.7], review: "よい" }),
      });
      const res = await service.scoreTranslation(USER_ID, "みどり");
      expect(res.score).toBe(66);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["件数・有無"],
      steps: [
        {
          Given: "AI が判定値1.0、0.6、0.2の3件を返すとき",
          When: [SCORE_TRANSLATION],
          Then: "採点結果の最終評価点は55になる",
        },
      ],
    },
    async () => {
      const service = await startQuest({
        llmText: JSON.stringify({ units: [1.0, 0.6, 0.2], review: "r" }),
      });
      const res = await service.scoreTranslation(USER_ID, "訳");
      expect(res.score).toBe(55);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "AI が講評「よい」を返すとき",
          When: [SCORE_TRANSLATION],
          Then: "採点結果の講評は「よい」になる",
        },
      ],
    },
    async () => {
      const service = await startQuest({
        llmText: JSON.stringify({ units: [0.7], review: "よい" }),
      });
      const res = await service.scoreTranslation(USER_ID, "みどり");
      expect(res.review).toBe("よい");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "日本語説明文が「フシギダネは 緑色だ。」でポケモン名がフシギダネのとき",
          When: [SCORE_TRANSLATION],
          Then: "採点結果の日本語説明文は「この ポケモンは 緑色だ。」になる",
        },
      ],
    },
    async () => {
      const service = await startQuest({
        pokemons: [makePokemon({ description_ja: "フシギダネは 緑色だ。" })],
      });
      const res = await service.scoreTranslation(USER_ID, "みどり");
      expect(res.description_ja).toBe("この ポケモンは 緑色だ。");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "英語説明文が「Pikachu is yellow.」でポケモン名が Pikachu のとき",
          When: [SCORE_TRANSLATION],
          Then: "AI に渡す英文に、伏せ字にした説明文「This Pokémon is yellow.」が含まれる",
        },
      ],
    },
    async () => {
      let sentPrompt = "";
      const service = await startQuest({
        pokemons: [
          makePokemon({
            name_en: "Pikachu",
            description_en: "Pikachu is yellow.",
          }),
        ],
        llmRespond: (prompt) => {
          sentPrompt = prompt;
          return JSON.stringify({ units: [0.7], review: "よい 翻訳だ。" });
        },
      });
      await service.scoreTranslation(USER_ID, "訳");
      expect(sentPrompt).toContain("This Pokémon is yellow.");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      観点: ["外部依存の失敗"],
      steps: [
        {
          Given: "クエストセッションの保存先がエラー「boom」で読み込みに失敗するとき",
          When: [SCORE_TRANSLATION],
          Then: "保存先が返したエラー「boom」を原因とする外部サービス (クエストセッションの保存先) のエラーになる",
        },
      ],
    },
    async () => {
      const service = makeService({ sessionStoreError: new Error("boom") });
      const error = await getRejection(service.scoreTranslation(USER_ID, "訳"));
      expect(error).toBeInstanceOf(ExternalServiceError);
      expect((error as ExternalServiceError).cause).toEqual(expect.objectContaining({ message: "boom" }));
    },
  );

  for (const { given, prepare, viewpoints } of [
    {
      given: "どのユーザーにも進行中のクエストセッションがないとき",
      prepare: async () => {},
      viewpoints: ["エッジケース"],
    },
    {
      given: "別のユーザー「alice」にだけ進行中のクエストセッションがあるとき",
      prepare: async (service: QuestService) => {
        await service.newQuest(USER_ID);
      },
      viewpoints: [],
    },
  ] satisfies { given: string; prepare: (service: QuestService) => Promise<void>; viewpoints: readonly Viewpoint[] }[]) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "異常系",
        観点: viewpoints,
        steps: [
          {
            Given: given,
            When: ["ユーザー「bob」がクエスト画面で、訳文の採点を依頼する"],
            Then: "クエストセッションが見つからないエラーになる",
          },
        ],
      },
      async () => {
        const service = makeService();
        await prepare(service);
        await expect(service.scoreTranslation("bob", "訳")).rejects.toBeInstanceOf(NotFoundError);
      },
    );
  }
});

describe("[外部連携:AI]採点応答の検証と再試行", () => {
  const NO_SCORING_UNITS = expect.objectContaining({
    message: "LLM returned no scoring units",
  });
  const EMPTY_REVIEW = expect.objectContaining({
    message: "LLM returned empty review",
  });

  const UNREADABLE_JSON_CASES: { given: string; llmText: string; 観点: readonly Viewpoint[] }[] = [
    {
      given: "AI が2回続けて、JSON ではない「ごめん、わからない」を返すとき",
      llmText: "ごめん、わからない",
      観点: ["外部依存の失敗"],
    },
    {
      given: 'AI が2回続けて、JSON が途中で切れている ({"units": [0.7], "rev) を返すとき',
      llmText: '{"units": [0.7], "rev',
      観点: ["外部依存の失敗"],
    },
  ];

  for (const { given, llmText, 観点 } of UNREADABLE_JSON_CASES) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "異常系",
        観点,
        steps: [
          {
            Given: given,
            When: [SCORE_TRANSLATION],
            Then: "AI の応答が JSON として読めないことを原因とする外部サービス (AI) のエラーになる",
          },
        ],
      },
      async () => {
        const service = await startQuest({ llmText });
        const error = await getRejection(service.scoreTranslation(USER_ID, "訳"));
        expect(error).toBeInstanceOf(ExternalServiceError);
        expect((error as ExternalServiceError).cause).toEqual(expect.any(SyntaxError));
      },
    );
  }

  const NO_SCORING_UNITS_CASES: { given: string; llmText: string; 観点: readonly Viewpoint[] }[] = [
    {
      given: "AI が2回続けて、判定値の項目がなく講評だけ「r」がある応答を返すとき",
      llmText: JSON.stringify({ review: "r" }),
      観点: ["外部依存の失敗", "件数・有無"],
    },
    {
      given: "AI が2回続けて、判定値が一覧ではなく1つの数値0.7になっている応答を返すとき",
      llmText: JSON.stringify({ units: 0.7, review: "r" }),
      観点: ["外部依存の失敗"],
    },
    {
      given: "AI が2回続けて、判定値が0件の応答を返すとき",
      llmText: JSON.stringify({ units: [], review: "r" }),
      観点: ["外部依存の失敗", "件数・有無"],
    },
  ];

  for (const { given, llmText, 観点 } of NO_SCORING_UNITS_CASES) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "異常系",
        観点,
        steps: [
          {
            Given: given,
            When: [SCORE_TRANSLATION],
            Then: "判定値が無いことを原因とする外部サービス (AI) のエラーになる",
          },
        ],
      },
      async () => {
        const service = await startQuest({ llmText });
        const error = await getRejection(service.scoreTranslation(USER_ID, "訳"));
        expect(error).toBeInstanceOf(ExternalServiceError);
        expect((error as ExternalServiceError).cause).toEqual(NO_SCORING_UNITS);
      },
    );
  }

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      観点: ["外部依存の失敗"],
      steps: [
        {
          Given: "AI が2回続けて、判定値に数値でない値「a」を含む応答を返すとき",
          When: [SCORE_TRANSLATION],
          Then: "範囲外の判定値「a」を原因とする外部サービス (AI) のエラーになる",
        },
      ],
    },
    async () => {
      const service = await startQuest({
        llmText: JSON.stringify({ units: ["a"], review: "r" }),
      });
      const error = await getRejection(service.scoreTranslation(USER_ID, "訳"));
      expect(error).toBeInstanceOf(ExternalServiceError);
      expect((error as ExternalServiceError).cause).toEqual(
        expect.objectContaining({
          message: "LLM returned out-of-range unit value: a",
        }),
      );
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      観点: ["外部依存の失敗", "境界値"],
      steps: [
        {
          Given: "AI が2回続けて、0.0から1.0の範囲外の判定値 -0.1 を含む応答を返すとき",
          When: [SCORE_TRANSLATION],
          Then: "範囲外の判定値「-0.1」を原因とする外部サービス (AI) のエラーになる",
        },
      ],
    },
    async () => {
      const service = await startQuest({
        llmText: JSON.stringify({ units: [-0.1], review: "r" }),
      });
      const error = await getRejection(service.scoreTranslation(USER_ID, "訳"));
      expect(error).toBeInstanceOf(ExternalServiceError);
      expect((error as ExternalServiceError).cause).toEqual(
        expect.objectContaining({
          message: "LLM returned out-of-range unit value: -0.1",
        }),
      );
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      観点: ["外部依存の失敗", "境界値"],
      steps: [
        {
          Given: "AI が2回続けて、0.0から1.0の範囲外の判定値 1.1 を含む応答を返すとき",
          When: [SCORE_TRANSLATION],
          Then: "範囲外の判定値「1.1」を原因とする外部サービス (AI) のエラーになる",
        },
      ],
    },
    async () => {
      const service = await startQuest({
        llmText: JSON.stringify({ units: [1.1], review: "r" }),
      });
      const error = await getRejection(service.scoreTranslation(USER_ID, "訳"));
      expect(error).toBeInstanceOf(ExternalServiceError);
      expect((error as ExternalServiceError).cause).toEqual(
        expect.objectContaining({
          message: "LLM returned out-of-range unit value: 1.1",
        }),
      );
    },
  );

  const EMPTY_REVIEW_CASES: { given: string; llmText: string; 観点: readonly Viewpoint[] }[] = [
    {
      given: "AI が2回続けて、講評の項目がなく判定値 0.7 の1件だけがある応答を返すとき",
      llmText: JSON.stringify({ units: [0.7] }),
      観点: ["外部依存の失敗", "件数・有無"],
    },
    {
      given: "AI が2回続けて、講評が空文字の応答を返すとき",
      llmText: JSON.stringify({ units: [0.7], review: "" }),
      観点: ["外部依存の失敗", "件数・有無"],
    },
  ];

  for (const { given, llmText, 観点 } of EMPTY_REVIEW_CASES) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "異常系",
        観点,
        steps: [
          {
            Given: given,
            When: [SCORE_TRANSLATION],
            Then: "講評が空であることを原因とする外部サービス (AI) のエラーになる",
          },
        ],
      },
      async () => {
        const service = await startQuest({ llmText });
        const error = await getRejection(service.scoreTranslation(USER_ID, "訳"));
        expect(error).toBeInstanceOf(ExternalServiceError);
        expect((error as ExternalServiceError).cause).toEqual(EMPTY_REVIEW);
      },
    );
  }

  const RETRIED_THEN_VALID_GIVEN =
    "AI の最初の応答が JSON ではなく、2回目の応答が判定値0.7の1件と講評「よい」の正しい形式のとき";
  const retriedThenValidTexts = ["ごめん、わからない", JSON.stringify({ units: [0.7], review: "よい" })];

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      観点: ["外部依存の失敗", "回復確認"],
      steps: [
        {
          Given: RETRIED_THEN_VALID_GIVEN,
          When: [SCORE_TRANSLATION],
          Then: "採点結果の最終評価点は66になる",
        },
      ],
    },
    async () => {
      const service = await startQuest({ llmTexts: retriedThenValidTexts });
      const res = await service.scoreTranslation(USER_ID, "訳");
      expect(res.score).toBe(66);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      観点: ["外部依存の失敗", "回復確認"],
      steps: [
        {
          Given: RETRIED_THEN_VALID_GIVEN,
          When: [SCORE_TRANSLATION],
          Then: "採点結果の講評は「よい」になる",
        },
      ],
    },
    async () => {
      const service = await startQuest({ llmTexts: retriedThenValidTexts });
      const res = await service.scoreTranslation(USER_ID, "訳");
      expect(res.review).toBe("よい");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["境界値"],
      steps: [
        {
          Given: "AI が意味単位1件の判定値0.0を返すとき",
          When: [SCORE_TRANSLATION],
          Then: "採点結果の最終評価点は0になる",
        },
      ],
    },
    async () => {
      const service = await startQuest({
        llmText: JSON.stringify({ units: [0.0], review: "r" }),
      });
      const res = await service.scoreTranslation(USER_ID, "訳");
      expect(res.score).toBe(0);
    },
  );
});

const ASKED_BULBASAUR = "英語名「Bulbasaur」、日本語名「フシギダネ」のポケモンを出題済みのとき";
const LEGENDARY_SCORED_70 = "伝説ポケモンの「Bulbasaur」を最終評価点70で採点済みのとき";
const MISS_THREE_TIMES = "名前当て画面で、誤った名前で3回続けて答える";
const ANSWER_BULBASAUR = "名前当て画面で、英語名「bulbasaur」で答える";
const BALL_ULTRA = "判定結果のボールはハイパーボールになる";
const BALL_MASTER = "判定結果のボールはマスターボールになる";
const RESULT_CORRECT = "判定結果は正解になる";
const RESULT_INCORRECT = "判定結果は不正解になる";
const RESULT_FUZZY = "判定結果は、あいまい一致による正解になる";
const RESULT_LANGUAGE_EN = "判定結果で、正解した名前の言語は英語になる";
const RESULT_LANGUAGE_JA = "判定結果で、正解した名前の言語は日本語になる";

describe("[本体:名前当て]名前当ての判定", () => {
  const ABRA_POKEMONS = [makePokemon({ name_en: "Abra", name_ja: "ケーシィ" })];
  const LEGENDARY_SCORED_OPTIONS: ServiceOverrides = {
    pokemons: [makePokemon({ is_legendary: true })],
    llmText: AI_RESPONSE_FINAL_SCORE_70,
  };
  const MYTHICAL_SCORED_OPTIONS: ServiceOverrides = {
    pokemons: [makePokemon({ is_mythical: true })],
    llmText: AI_RESPONSE_FINAL_SCORE_70,
  };
  const MISS_THREE_TIMES_START_CASES: { given: string; start: () => Promise<QuestService> }[] = [
    { given: ASKED_BULBASAUR, start: () => startQuest() },
    {
      given: LEGENDARY_SCORED_70,
      start: () =>
        startScoredQuest({
          pokemons: [makePokemon({ is_legendary: true })],
          llmText: AI_RESPONSE_FINAL_SCORE_70,
        }),
    },
  ];
  const ANSWER_BULBASAUR_START_CASES: {
    given: string;
    start: () => Promise<QuestService>;
    viewpoints?: readonly Viewpoint[];
  }[] = [
    {
      given: "伝説ポケモンの「Bulbasaur」を最終評価点69で採点済みのとき",
      viewpoints: ["境界値"],
      start: () =>
        startScoredQuest({
          pokemons: [makePokemon({ is_legendary: true })],
          llmText: AI_RESPONSE_FINAL_SCORE_69,
        }),
    },
    {
      given: "伝説でも幻でもないポケモンの「Bulbasaur」を最終評価点70で採点済みのとき",
      start: () => startScoredQuest({ llmText: AI_RESPONSE_FINAL_SCORE_70 }),
    },
  ];

  async function answerAgainAfterCorrect() {
    const service = await startQuest();
    await service.guessName(USER_ID, "bulbasaur");
    return service.guessName(USER_ID, "whatever");
  }

  async function missAgainAfterHint() {
    const service = await startQuest();
    await service.guessName(USER_ID, "wrong1");
    await service.requestHint(USER_ID);
    return service.guessName(USER_ID, "wrong2");
  }

  const SPACED_LOWERCASE_ENGLISH_NAME = "名前当て画面で、前に空白が2つ、後ろに空白が1つある小文字「bulbasaur」で答える";

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: ASKED_BULBASAUR, When: [SPACED_LOWERCASE_ENGLISH_NAME], Then: RESULT_CORRECT }],
    },
    async () => {
      const service = await startQuest();
      const res = await service.guessName(USER_ID, "  bulbasaur ");
      expect(res).toMatchObject({ correct: true });
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: ASKED_BULBASAUR, When: [SPACED_LOWERCASE_ENGLISH_NAME], Then: BALL_ULTRA }],
    },
    async () => {
      const service = await startQuest();
      const res = await service.guessName(USER_ID, "  bulbasaur ");
      expect(res).toMatchObject({ ball_type: "ultra" });
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: ASKED_BULBASAUR, When: [SPACED_LOWERCASE_ENGLISH_NAME], Then: RESULT_LANGUAGE_EN }],
    },
    async () => {
      const service = await startQuest();
      const res = await service.guessName(USER_ID, "  bulbasaur ");
      expect(res).toMatchObject({ language: "en" });
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: ASKED_BULBASAUR, When: ["名前当て画面で、日本語名「フシギダネ」で答える"], Then: RESULT_CORRECT }],
    },
    async () => {
      const service = await startQuest();
      const res = await service.guessName(USER_ID, "フシギダネ");
      expect(res).toMatchObject({ correct: true });
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: ASKED_BULBASAUR,
          When: ["名前当て画面で、日本語名「フシギダネ」で答える"],
          Then: "判定結果のボールはスーパーボールになる",
        },
      ],
    },
    async () => {
      const service = await startQuest();
      const res = await service.guessName(USER_ID, "フシギダネ");
      expect(res).toMatchObject({ ball_type: "great" });
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: ASKED_BULBASAUR, When: ["名前当て画面で、日本語名「フシギダネ」で答える"], Then: RESULT_LANGUAGE_JA }],
    },
    async () => {
      const service = await startQuest();
      const res = await service.guessName(USER_ID, "フシギダネ");
      expect(res).toMatchObject({ language: "ja" });
    },
  );

  const FUZZY_BULBASAUR_GIVEN =
    "英語名「Bulbasaur」、日本語名「フシギダネ」で、英語名があいまい一致の最小文字数以上のポケモンを出題済みのとき";
  const WITHIN_FUZZY_DISTANCE_SPELLING = "名前当て画面で、綴りがあいまい一致の許容距離ちょうどずれた「bulbasaxx」で答える";

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["境界値"],
      steps: [{ Given: FUZZY_BULBASAUR_GIVEN, When: [WITHIN_FUZZY_DISTANCE_SPELLING], Then: RESULT_CORRECT }],
    },
    async () => {
      const service = await startQuest();
      const res = await service.guessName(USER_ID, "bulbasaxx");
      expect(res).toMatchObject({ correct: true });
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["境界値"],
      steps: [{ Given: FUZZY_BULBASAUR_GIVEN, When: [WITHIN_FUZZY_DISTANCE_SPELLING], Then: BALL_ULTRA }],
    },
    async () => {
      const service = await startQuest();
      const res = await service.guessName(USER_ID, "bulbasaxx");
      expect(res).toMatchObject({ ball_type: "ultra" });
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["境界値"],
      steps: [{ Given: FUZZY_BULBASAUR_GIVEN, When: [WITHIN_FUZZY_DISTANCE_SPELLING], Then: RESULT_FUZZY }],
    },
    async () => {
      const service = await startQuest();
      const res = await service.guessName(USER_ID, "bulbasaxx");
      expect(res).toMatchObject({ fuzzy: true });
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: ASKED_BULBASAUR,
          When: ["名前当て画面で、1回目に「wrong」で答える"],
          Then: "判定結果の残り挑戦回数は2回になる",
        },
      ],
    },
    async () => {
      const service = await startQuest();
      const res = await service.guessName(USER_ID, "wrong");
      expect(res).toMatchObject({ attempts_remaining: 2 });
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["境界値"],
      steps: [{ Given: ASKED_BULBASAUR, When: [MISS_THREE_TIMES], Then: "判定結果の残り挑戦回数は0回になる" }],
    },
    async () => {
      const service = await startQuest();
      const res = await missThreeTimes(service);
      expect(res).toMatchObject({ attempts_remaining: 0 });
    },
  );

  const ABRA_GIVEN =
    "英語名「Abra」、日本語名「ケーシィ」で、英語名の文字数があいまい一致の最小文字数ちょうどのポケモンを出題済みのとき";
  const ONE_CHARACTER_OFF_SPELLING = "名前当て画面で、綴りが許容距離以内の1文字ずれた「abrx」で答える";

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["境界値"],
      steps: [{ Given: ABRA_GIVEN, When: [ONE_CHARACTER_OFF_SPELLING], Then: RESULT_CORRECT }],
    },
    async () => {
      const service = await startQuest({ pokemons: ABRA_POKEMONS });
      const res = await service.guessName(USER_ID, "abrx");
      expect(res).toMatchObject({ correct: true });
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["境界値"],
      steps: [{ Given: ABRA_GIVEN, When: [ONE_CHARACTER_OFF_SPELLING], Then: RESULT_FUZZY }],
    },
    async () => {
      const service = await startQuest({ pokemons: ABRA_POKEMONS });
      const res = await service.guessName(USER_ID, "abrx");
      expect(res).toMatchObject({ fuzzy: true });
    },
  );

  for (const { given, when, pokemons, guess, viewpoints } of [
    {
      given: "英語名があいまい一致の最小文字数以上のポケモン「Bulbasaur」を出題済みのとき",
      when: "名前当て画面で、あいまい一致の許容距離を超えてずれた綴り「bulbasxxx」で答える",
      pokemons: [makePokemon()],
      guess: "bulbasxxx",
      viewpoints: ["境界値"] as const,
    },
    {
      given: "英語名があいまい一致の最小文字数に満たないポケモン「Mew」(日本語名「ミュウ」) を出題済みのとき",
      when: "名前当て画面で、1文字ずれた綴り「mex」で答える",
      pokemons: [makePokemon({ name_en: "Mew", name_ja: "ミュウ" })],
      guess: "mex",
      viewpoints: ["境界値"] as const,
    },
    {
      given: "英語名「Bulbasaur」のポケモンを出題済みのとき",
      when: "名前当て画面で、大きく異なる綴り「wrong」で答える",
      pokemons: [makePokemon()],
      guess: "wrong",
      viewpoints: ["同値分割"] as const,
    },
  ]) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "正常系",
        観点: viewpoints,
        steps: [{ Given: given, When: [when], Then: RESULT_INCORRECT }],
      },
      async () => {
        const service = await startQuest({ pokemons });
        const res = await service.guessName(USER_ID, guess);
        expect(res).toMatchObject({ correct: false });
      },
    );
  }

  const ANSWER_AGAIN_GIVEN = "英語名「Bulbasaur」で正解済みのとき";
  const ANSWER_WHATEVER = "名前当て画面で、別の名前「whatever」で答える";

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      観点: ["エッジケース"],
      steps: [{ Given: ANSWER_AGAIN_GIVEN, When: [ANSWER_WHATEVER], Then: RESULT_CORRECT }],
    },
    async () => {
      const res = await answerAgainAfterCorrect();
      expect(res).toMatchObject({ correct: true });
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      観点: ["エッジケース"],
      steps: [
        {
          Given: ANSWER_AGAIN_GIVEN,
          When: [ANSWER_WHATEVER],
          Then: "判定結果のボールは確定済みのハイパーボールのままになる",
        },
      ],
    },
    async () => {
      const res = await answerAgainAfterCorrect();
      expect(res).toMatchObject({ ball_type: "ultra" });
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      観点: ["エッジケース"],
      steps: [{ Given: ANSWER_AGAIN_GIVEN, When: [ANSWER_WHATEVER], Then: "判定結果の残り挑戦回数は0回になる" }],
    },
    async () => {
      const res = await answerAgainAfterCorrect();
      expect(res).toMatchObject({ attempts_remaining: 0 });
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["境界値"],
      steps: [{ Given: LEGENDARY_SCORED_70, When: [ANSWER_BULBASAUR], Then: RESULT_CORRECT }],
    },
    async () => {
      const service = await startScoredQuest(LEGENDARY_SCORED_OPTIONS);
      const res = await service.guessName(USER_ID, "bulbasaur");
      expect(res).toMatchObject({ correct: true });
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["境界値"],
      steps: [{ Given: LEGENDARY_SCORED_70, When: [ANSWER_BULBASAUR], Then: BALL_MASTER }],
    },
    async () => {
      const service = await startScoredQuest(LEGENDARY_SCORED_OPTIONS);
      const res = await service.guessName(USER_ID, "bulbasaur");
      expect(res).toMatchObject({ ball_type: "master" });
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["境界値"],
      steps: [{ Given: LEGENDARY_SCORED_70, When: [ANSWER_BULBASAUR], Then: RESULT_LANGUAGE_EN }],
    },
    async () => {
      const service = await startScoredQuest(LEGENDARY_SCORED_OPTIONS);
      const res = await service.guessName(USER_ID, "bulbasaur");
      expect(res).toMatchObject({ language: "en" });
    },
  );

  const FUZZY_ENGLISH_NAME = "名前当て画面で、英語名とあいまい一致する「bulbasaxx」で答える";

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["境界値"],
      steps: [{ Given: LEGENDARY_SCORED_70, When: [FUZZY_ENGLISH_NAME], Then: RESULT_CORRECT }],
    },
    async () => {
      const service = await startScoredQuest(LEGENDARY_SCORED_OPTIONS);
      const res = await service.guessName(USER_ID, "bulbasaxx");
      expect(res).toMatchObject({ correct: true });
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["境界値"],
      steps: [{ Given: LEGENDARY_SCORED_70, When: [FUZZY_ENGLISH_NAME], Then: BALL_MASTER }],
    },
    async () => {
      const service = await startScoredQuest(LEGENDARY_SCORED_OPTIONS);
      const res = await service.guessName(USER_ID, "bulbasaxx");
      expect(res).toMatchObject({ ball_type: "master" });
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["境界値"],
      steps: [{ Given: LEGENDARY_SCORED_70, When: [FUZZY_ENGLISH_NAME], Then: RESULT_FUZZY }],
    },
    async () => {
      const service = await startScoredQuest(LEGENDARY_SCORED_OPTIONS);
      const res = await service.guessName(USER_ID, "bulbasaxx");
      expect(res).toMatchObject({ fuzzy: true });
    },
  );

  const MYTHICAL_SCORED_70 = "幻ポケモンの「Bulbasaur」(日本語名「フシギダネ」) を最終評価点70で採点済みのとき";
  const ANSWER_JAPANESE_NAME = "名前当て画面で、日本語名「フシギダネ」で答える";

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["境界値"],
      steps: [{ Given: MYTHICAL_SCORED_70, When: [ANSWER_JAPANESE_NAME], Then: RESULT_CORRECT }],
    },
    async () => {
      const service = await startScoredQuest(MYTHICAL_SCORED_OPTIONS);
      const res = await service.guessName(USER_ID, "フシギダネ");
      expect(res).toMatchObject({ correct: true });
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["境界値"],
      steps: [{ Given: MYTHICAL_SCORED_70, When: [ANSWER_JAPANESE_NAME], Then: BALL_MASTER }],
    },
    async () => {
      const service = await startScoredQuest(MYTHICAL_SCORED_OPTIONS);
      const res = await service.guessName(USER_ID, "フシギダネ");
      expect(res).toMatchObject({ ball_type: "master" });
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["境界値"],
      steps: [{ Given: MYTHICAL_SCORED_70, When: [ANSWER_JAPANESE_NAME], Then: RESULT_LANGUAGE_JA }],
    },
    async () => {
      const service = await startScoredQuest(MYTHICAL_SCORED_OPTIONS);
      const res = await service.guessName(USER_ID, "フシギダネ");
      expect(res).toMatchObject({ language: "ja" });
    },
  );

  for (const { given, start } of MISS_THREE_TIMES_START_CASES) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "正常系",
        観点: ["境界値"],
        steps: [{ Given: given, When: [MISS_THREE_TIMES], Then: RESULT_INCORRECT }],
      },
      async () => {
        const res = await missThreeTimes(await start());
        expect(res).toMatchObject({ correct: false });
      },
    );
  }

  for (const { given, start } of MISS_THREE_TIMES_START_CASES) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "正常系",
        観点: ["境界値"],
        steps: [{ Given: given, When: [MISS_THREE_TIMES], Then: "判定結果のボールはモンスターボールになる" }],
      },
      async () => {
        const res = await missThreeTimes(await start());
        expect(res).toMatchObject({ ball_type: "poke" });
      },
    );
  }

  for (const { given, start, viewpoints } of ANSWER_BULBASAUR_START_CASES) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "正常系",
        観点: viewpoints,
        steps: [{ Given: given, When: [ANSWER_BULBASAUR], Then: RESULT_CORRECT }],
      },
      async () => {
        const res = await (await start()).guessName(USER_ID, "bulbasaur");
        expect(res).toMatchObject({ correct: true });
      },
    );
  }

  for (const { given, start, viewpoints } of ANSWER_BULBASAUR_START_CASES) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "正常系",
        観点: viewpoints,
        steps: [{ Given: given, When: [ANSWER_BULBASAUR], Then: BALL_ULTRA }],
      },
      async () => {
        const res = await (await start()).guessName(USER_ID, "bulbasaur");
        expect(res).toMatchObject({ ball_type: "ultra" });
      },
    );
  }

  const HINT_THEN_MISS_GIVEN = "名前当てを1回外していて、ヒントを1回要求済みで、残り挑戦回数が1回のとき";
  const MISS_AGAIN = "名前当て画面で、もう一度誤った名前で答える";

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["境界値"],
      steps: [{ Given: HINT_THEN_MISS_GIVEN, When: [MISS_AGAIN], Then: RESULT_INCORRECT }],
    },
    async () => {
      const res = await missAgainAfterHint();
      expect(res).toMatchObject({ correct: false });
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["境界値"],
      steps: [
        { Given: HINT_THEN_MISS_GIVEN, When: [MISS_AGAIN], Then: "判定結果のボールはモンスターボールになる" },
      ],
    },
    async () => {
      const res = await missAgainAfterHint();
      expect(res).toMatchObject({ ball_type: "poke" });
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["境界値"],
      steps: [{ Given: HINT_THEN_MISS_GIVEN, When: [MISS_AGAIN], Then: "判定結果の残り挑戦回数は0回になる" }],
    },
    async () => {
      const res = await missAgainAfterHint();
      expect(res).toMatchObject({ attempts_remaining: 0 });
    },
  );
});

const REQUEST_HINT = "名前当て画面で、ヒントを要求する";
const REQUEST_SECOND_HINT = "名前当て画面で、2回目のヒントを要求する";

describe("[本体:名前当て]名前当てのヒント", () => {
  async function requestSecondHint(levelUpMoves: string[] | undefined) {
    const service = await startQuest({
      pokemons: [makePokemon({ level_up_moves: levelUpMoves })],
      randomValue: 0,
    });
    await service.requestHint(USER_ID);
    return service.requestHint(USER_ID);
  }

  const FIRST_HINT_GIVEN = "タイプが「くさ」「どく」のポケモンを出題済みで、まだ名前当てをしていないとき";

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: FIRST_HINT_GIVEN,
          When: ["名前当て画面で、1回目のヒントを要求する"],
          Then: "要求結果として、出題ポケモンのタイプ (くさ・どく) が開示される",
        },
      ],
    },
    async () => {
      const service = await startQuest({
        pokemons: [makePokemon({ types: ["grass", "poison"] })],
      });
      const res = await service.requestHint(USER_ID);
      expect(res).toEqual({
        types: ["grass", "poison"],
        attempts_remaining: expect.any(Number),
      });
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: FIRST_HINT_GIVEN,
          When: ["名前当て画面で、1回目のヒントを要求する"],
          Then: "要求結果の残り挑戦回数は2回になる",
        },
      ],
    },
    async () => {
      const service = await startQuest({
        pokemons: [makePokemon({ types: ["grass", "poison"] })],
      });
      const res = await service.requestHint(USER_ID);
      expect(res).toEqual({
        types: expect.any(Array),
        attempts_remaining: 2,
      });
    },
  );

  for (const { given, levelUpMoves, viewpoints } of [
    {
      given: "レベルアップで覚える技が3つあるポケモン (「たいあたり」「なきごえ」「つるのムチ」)",
      levelUpMoves: ["たいあたり", "なきごえ", "つるのムチ"],
      viewpoints: ["件数・有無"],
    },
    {
      given: "レベルアップで覚える技の情報が未設定のポケモン",
      levelUpMoves: undefined,
      viewpoints: ["件数・有無", "エッジケース"],
    },
    {
      given: "レベルアップで覚える技の情報が0件のポケモン",
      levelUpMoves: [],
      viewpoints: ["件数・有無", "エッジケース"],
    },
  ] satisfies { given: string; levelUpMoves: string[] | undefined; viewpoints: readonly Viewpoint[] }[]) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "正常系",
        観点: viewpoints,
        steps: [
          {
            Given: `1回目のヒントを要求済みで、${given}のとき`,
            When: [REQUEST_SECOND_HINT],
            Then: "要求結果の残り挑戦回数は1回になる",
          },
        ],
      },
      async () => {
        const res = await requestSecondHint(levelUpMoves);
        expect(res).toEqual({
          moves: expect.any(Array),
          attempts_remaining: 1,
        });
      },
    );
  }

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["件数・有無"],
      steps: [
        {
          Given: "1回目のヒントを要求済みで、レベルアップで覚える技が「たいあたり」「なきごえ」「つるのムチ」のポケモンのとき",
          When: [REQUEST_SECOND_HINT],
          Then: "要求結果として、「たいあたり」「なきごえ」「つるのムチ」の3つの技が開示される",
        },
      ],
    },
    async () => {
      const res = await requestSecondHint(["たいあたり", "なきごえ", "つるのムチ"]);
      expect(res).toEqual({
        moves: ["たいあたり", "なきごえ", "つるのムチ"],
        attempts_remaining: expect.any(Number),
      });
    },
  );

  for (const { state, levelUpMoves } of [
    { state: "未設定", levelUpMoves: undefined },
    { state: "0件", levelUpMoves: [] },
  ] satisfies { state: string; levelUpMoves: string[] | undefined }[]) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "正常系",
        観点: ["件数・有無", "エッジケース"],
        steps: [
          {
            Given: `1回目のヒントを要求済みで、レベルアップで覚える技の情報が${state}のポケモンのとき`,
            When: [REQUEST_SECOND_HINT],
            Then: "要求結果で開示される技は0件になる",
          },
        ],
      },
      async () => {
        const res = await requestSecondHint(levelUpMoves);
        expect(res).toEqual({
          moves: [],
          attempts_remaining: expect.any(Number),
        });
      },
    );
  }

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given:
            "レベルアップで覚える技が「たいあたり」「なきごえ」「つるのムチ」「やどりぎのタネ」の4つのポケモンで、出会うたびの技の抽選結果が異なるとき",
          When: ["名前当て画面で、それぞれの出会いの2回目のヒントを要求する"],
          Then: "要求結果で開示される技は、2回の出会いで互いに異なる",
        },
      ],
    },
    async () => {
      const candidates = ["たいあたり", "なきごえ", "つるのムチ", "やどりぎのタネ"];
      const pokemons = [makePokemon({ level_up_moves: candidates })];

      const serviceA = await startQuest({ pokemons, randomValue: 0 });
      await serviceA.requestHint(USER_ID);
      const resA = await serviceA.requestHint(USER_ID);

      const serviceB = await startQuest({ pokemons, randomValue: 0.9 });
      await serviceB.requestHint(USER_ID);
      const resB = await serviceB.requestHint(USER_ID);

      expect(resA.moves).not.toEqual(resB.moves);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["境界値"],
      steps: [
        {
          Given: "名前当てを1回外していて、残り挑戦回数が2回のとき",
          When: [REQUEST_HINT],
          Then: "要求結果の残り挑戦回数は1回になる",
        },
      ],
    },
    async () => {
      const service = await startQuest();
      await service.guessName(USER_ID, "wrong");
      const res = await service.requestHint(USER_ID);
      expect(res.attempts_remaining).toBe(1);
    },
  );

  for (const { given, prepare } of [
    {
      given: "ヒントを2回要求済みのとき",
      prepare: async (service: QuestService) => {
        await service.requestHint(USER_ID);
        await service.requestHint(USER_ID);
      },
    },
    {
      given: "名前当てに正解済みのとき",
      prepare: async (service: QuestService) => {
        await service.guessName(USER_ID, "bulbasaur");
      },
    },
  ] satisfies { given: string; prepare: (service: QuestService) => Promise<void> }[]) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "異常系",
        観点: ["エッジケース"],
        steps: [
          {
            Given: given,
            When: [REQUEST_HINT],
            Then: "名前当てが済んでいるか、ヒントを使い切っているため要求できないエラーになる",
          },
        ],
      },
      async () => {
        const service = await startQuest();
        await prepare(service);
        await expect(service.requestHint(USER_ID)).rejects.toThrow(/already guessed or hints exhausted/);
      },
    );
  }

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      観点: ["境界値"],
      steps: [
        {
          Given: "名前当てを2回外していて、残り挑戦回数が1回のとき",
          When: [REQUEST_HINT],
          Then: "残り挑戦回数が足りないエラーになる",
        },
      ],
    },
    async () => {
      const service = await startQuest();
      await service.guessName(USER_ID, "wrong1");
      await service.guessName(USER_ID, "wrong2");
      await expect(service.requestHint(USER_ID)).rejects.toThrow(/insufficient guess attempts remaining/);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      観点: ["エッジケース"],
      steps: [
        {
          Given: "進行中のクエストセッションがないとき",
          When: [REQUEST_HINT],
          Then: "クエストセッションが見つからないエラーになる",
        },
      ],
    },
    async () => {
      const service = makeService();
      await expect(service.requestHint("nobody")).rejects.toThrow(NotFoundError);
    },
  );
});

const SKIP_GUESS = "名前当て画面で、名前当てをスキップする";

describe("[本体:名前当て]名前当てのスキップ", () => {
  for (const { given, start } of [
    { given: "ポケモンを出題済みのとき", start: () => startQuest() },
    {
      given: LEGENDARY_SCORED_70,
      start: () =>
        startScoredQuest({
          pokemons: [makePokemon({ is_legendary: true })],
          llmText: AI_RESPONSE_FINAL_SCORE_70,
        }),
    },
  ] satisfies { given: string; start: () => Promise<QuestService> }[]) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "正常系",
        steps: [{ Given: given, When: [SKIP_GUESS], Then: "スキップ結果のボールはモンスターボールになる" }],
      },
      async () => {
        const service = await start();
        expect(await service.skipGuess(USER_ID)).toEqual({
          ball_type: "poke",
        });
      },
    );
  }

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      観点: ["エッジケース"],
      steps: [
        {
          Given: "進行中のクエストセッションがないとき",
          When: [SKIP_GUESS],
          Then: "クエストセッションが見つからないエラーになる",
        },
      ],
    },
    async () => {
      const service = makeService();
      await expect(service.skipGuess("nobody")).rejects.toThrow(NotFoundError);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      観点: ["エッジケース"],
      steps: [
        {
          Given: "英語名で正解済みで、ハイパーボールが確定済みのとき",
          When: [SKIP_GUESS],
          Then: "スキップ結果のボールは確定済みのハイパーボールのままになる",
        },
      ],
    },
    async () => {
      const service = await startQuest();
      await service.guessName(USER_ID, "bulbasaur");
      expect(await service.skipGuess(USER_ID)).toEqual({
        ball_type: "ultra",
      });
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      観点: ["エッジケース"],
      steps: [
        {
          Given: "日本語名で正解済みで、スーパーボールが確定済みのとき",
          When: [SKIP_GUESS],
          Then: "スキップ結果のボールは確定済みのスーパーボールのままになる",
        },
      ],
    },
    async () => {
      const service = await startQuest();
      await service.guessName(USER_ID, "フシギダネ");
      expect(await service.skipGuess(USER_ID)).toEqual({
        ball_type: "great",
      });
    },
  );
});

const ATTEMPT_CAPTURE = "捕獲待機画面で、ボールを使って捕獲する";

describe("[本体:捕獲]捕獲の実行", () => {
  const MASTER_BALL_CAPTURE_OPTIONS: ServiceOverrides = {
    pokemons: [makePokemon({ is_legendary: true, base_stat_total: 680 })],
    llmText: AI_RESPONSE_FINAL_SCORE_70,
    randomValue: 0.9999,
  };

  async function captureAfterSkip(o: ServiceOverrides = {}) {
    const service = await startQuest(o);
    await service.skipGuess(USER_ID);
    return service.attemptCapture(USER_ID);
  }

  async function captureAfterCorrectGuess() {
    const service = await startScoredQuest(MASTER_BALL_CAPTURE_OPTIONS);
    await service.guessName(USER_ID, "bulbasaur");
    return service.attemptCapture(USER_ID);
  }

  const POKE_BALL_CAPTURE_GIVEN =
    "図鑑番号1、英語名「Bulbasaur」、種族値合計318のポケモンを最終評価点0のまま出題済みで、名前当てをスキップ済みで、モンスターボールが確定済みのとき";

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given:
            "図鑑番号1、英語名「Bulbasaur」、種族値合計318のポケモンを最終評価点0のまま出題済みで、名前当てをスキップ済みで、モンスターボールが確定済みで、乱数が捕獲確率を下回るとき",
          When: [ATTEMPT_CAPTURE],
          Then: "捕獲結果は成功になる",
        },
      ],
    },
    async () => {
      const res = await captureAfterSkip();
      expect(res.captured).toBe(true);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: POKE_BALL_CAPTURE_GIVEN,
          When: [ATTEMPT_CAPTURE],
          Then: "捕獲結果のポケモンは、出題されたポケモン (図鑑番号1、英語名 Bulbasaur) になる",
        },
      ],
    },
    async () => {
      const res = await captureAfterSkip();
      expect(res).toMatchObject({ pokemon_id: 1, name_en: "Bulbasaur" });
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: POKE_BALL_CAPTURE_GIVEN,
          When: [ATTEMPT_CAPTURE],
          Then: "捕獲結果の捕獲確率は0より大きくなる",
        },
      ],
    },
    async () => {
      const res = await captureAfterSkip();
      expect(res.probability).toBeGreaterThan(0);
    },
  );

  for (const { given, decideBall, viewpoints } of [
    {
      given: "名前当てをスキップ済みで、モンスターボールが確定済みのとき",
      decideBall: (service: QuestService) => service.skipGuess(USER_ID),
      viewpoints: [],
    },
    {
      given: "名前当てで3回続けて外していて、モンスターボールが確定済みのとき",
      decideBall: (service: QuestService) => missThreeTimes(service),
      viewpoints: ["境界値"],
    },
  ] satisfies {
    given: string;
    decideBall: (service: QuestService) => Promise<unknown>;
    viewpoints: readonly Viewpoint[];
  }[]) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "正常系",
        観点: viewpoints,
        steps: [{ Given: given, When: [ATTEMPT_CAPTURE], Then: "捕獲結果のボールはモンスターボールになる" }],
      },
      async () => {
        const service = await startQuest();
        await decideBall(service);
        const res = await service.attemptCapture(USER_ID);
        expect(res.ball_type).toBe("poke");
      },
    );
  }

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      steps: [
        {
          Given: "英語名で正解済みで、ハイパーボールが確定済みで、名前当てをスキップ済みのとき",
          When: [ATTEMPT_CAPTURE],
          Then: "捕獲結果のボールはハイパーボールになる",
        },
      ],
    },
    async () => {
      const service = await startQuest();
      await service.guessName(USER_ID, "bulbasaur");
      await service.skipGuess(USER_ID);
      expect((await service.attemptCapture(USER_ID)).ball_type).toBe("ultra");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      steps: [
        {
          Given: "日本語名で正解済みで、スーパーボールが確定済みで、名前当てをスキップ済みのとき",
          When: [ATTEMPT_CAPTURE],
          Then: "捕獲結果のボールはスーパーボールになる",
        },
      ],
    },
    async () => {
      const service = await startQuest();
      await service.guessName(USER_ID, "フシギダネ");
      await service.skipGuess(USER_ID);
      expect((await service.attemptCapture(USER_ID)).ball_type).toBe("great");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given:
            "種族値合計が680のポケモンを最終評価点0のまま出題済みで、名前当てをスキップ済みで、モンスターボールが確定済みで、乱数が0.5のとき",
          When: [ATTEMPT_CAPTURE],
          Then: "捕獲結果は失敗になる",
        },
      ],
    },
    async () => {
      const service = await startQuest({
        pokemons: [makePokemon({ base_stat_total: 680 })],
        randomValue: 0.5,
      });
      await service.skipGuess(USER_ID);
      const res = await service.attemptCapture(USER_ID);
      expect(res.captured).toBe(false);
    },
  );

  const MASTER_BALL_CAPTURE_GIVEN =
    "種族値合計が680の伝説ポケモンを最終評価点70で採点済みで、英語名で正解済みで、マスターボールが確定済みで、乱数が最大に近い値(0.9999)のとき";

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["境界値", "エッジケース"],
      steps: [{ Given: MASTER_BALL_CAPTURE_GIVEN, When: [ATTEMPT_CAPTURE], Then: "捕獲結果は成功になる" }],
    },
    async () => {
      const res = await captureAfterCorrectGuess();
      expect(res).toMatchObject({ captured: true });
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["境界値", "エッジケース"],
      steps: [{ Given: MASTER_BALL_CAPTURE_GIVEN, When: [ATTEMPT_CAPTURE], Then: "捕獲結果の捕獲確率は1.0になる" }],
    },
    async () => {
      const res = await captureAfterCorrectGuess();
      expect(res).toMatchObject({ probability: 1.0 });
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["境界値", "エッジケース"],
      steps: [
        { Given: MASTER_BALL_CAPTURE_GIVEN, When: [ATTEMPT_CAPTURE], Then: "捕獲結果のボールはマスターボールになる" },
      ],
    },
    async () => {
      const res = await captureAfterCorrectGuess();
      expect(res).toMatchObject({ ball_type: "master" });
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      steps: [
        {
          Given: "名前当てにもスキップにも応答していないとき",
          When: [ATTEMPT_CAPTURE],
          Then: "ボールが未確定のエラーになる",
        },
      ],
    },
    async () => {
      const service = await startQuest();
      await expect(service.attemptCapture(USER_ID)).rejects.toThrow(/before a ball/);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      steps: [
        {
          Given: "名前当てをスキップ済みで、捕獲が1回済んでいるとき",
          When: ["捕獲待機画面で、もう一度ボールを使って捕獲する"],
          Then: "クエストセッションが見つからないエラーになる",
        },
      ],
    },
    async () => {
      const service = await startQuest();
      await service.skipGuess(USER_ID);
      await service.attemptCapture(USER_ID);
      await expect(service.attemptCapture(USER_ID)).rejects.toThrow(NotFoundError);
    },
  );
});

const RESUME_QUEST = "リロードしたクエスト画面で、進行中のクエストを再開する";

describe("[本体:クエスト]再開するクエストの段階と状態", () => {
  const MEWTWO_OPTIONS: ServiceOverrides = {
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

  const MEWTWO_BEFORE_SCORING_GIVEN =
    "図鑑番号150の伝説ポケモン (英語名「Mewtwo」、英語説明文「Mewtwo is powerful.」) を出題済みで、採点前のとき";

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        { Given: MEWTWO_BEFORE_SCORING_GIVEN, When: [RESUME_QUEST], Then: "再開結果の段階は訳文入力になる" },
      ],
    },
    async () => {
      const service = await startQuest(MEWTWO_OPTIONS);
      const res = await service.getCurrentQuest(USER_ID);
      expect(res).toEqual({
        phase: "translating",
        quest: expect.any(Object),
      });
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: MEWTWO_BEFORE_SCORING_GIVEN,
          When: [RESUME_QUEST],
          Then: "再開結果のクエストは図鑑番号150のポケモンになる",
        },
      ],
    },
    async () => {
      const service = await startQuest(MEWTWO_OPTIONS);
      const res = await service.getCurrentQuest(USER_ID);
      expect(res).toMatchObject({ quest: { pokemon_id: 150 } });
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: MEWTWO_BEFORE_SCORING_GIVEN,
          When: [RESUME_QUEST],
          Then: "再開結果のクエストの英語説明文は、ポケモン名を伏せ字にした「This Pokémon is powerful.」になる",
        },
      ],
    },
    async () => {
      const service = await startQuest(MEWTWO_OPTIONS);
      const res = await service.getCurrentQuest(USER_ID);
      expect(res).toMatchObject({
        quest: { description_en: "This Pokémon is powerful." },
      });
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: MEWTWO_BEFORE_SCORING_GIVEN,
          When: [RESUME_QUEST],
          Then: "再開結果のクエストは伝説ポケモンと示される",
        },
      ],
    },
    async () => {
      const service = await startQuest(MEWTWO_OPTIONS);
      const res = await service.getCurrentQuest(USER_ID);
      expect(res).toMatchObject({ quest: { is_legendary: true } });
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: MEWTWO_BEFORE_SCORING_GIVEN,
          When: [RESUME_QUEST],
          Then: "再開結果のクエストは幻ポケモンではないと示される",
        },
      ],
    },
    async () => {
      const service = await startQuest(MEWTWO_OPTIONS);
      const res = await service.getCurrentQuest(USER_ID);
      expect(res).toMatchObject({ quest: { is_mythical: false } });
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: MEWTWO_BEFORE_SCORING_GIVEN,
          When: [RESUME_QUEST],
          Then: "再開結果のクエストの名前当ての最大挑戦回数は3回になる",
        },
      ],
    },
    async () => {
      const service = await startQuest(MEWTWO_OPTIONS);
      const res = await service.getCurrentQuest(USER_ID);
      expect(res).toMatchObject({ quest: { max_guess_attempts: 3 } });
    },
  );

  const SCORED_UNGUESSED_GIVEN =
    "タイプが「くさ」「どく」、レベルアップで覚える技が「たいあたり」のポケモンを出題済みで、採点済みで、名前当てが未確定で、";

  for (const { hintStatus, hintCount } of [
    { hintStatus: "ヒントを1回も要求していないとき", hintCount: 0 },
    { hintStatus: "ヒントを1回要求済みのとき", hintCount: 1 },
    { hintStatus: "ヒントを2回要求済みのとき", hintCount: 2 },
  ]) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "正常系",
        観点: ["件数・有無"],
        steps: [
          {
            Given: `${SCORED_UNGUESSED_GIVEN}${hintStatus}`,
            When: [RESUME_QUEST],
            Then: "再開結果の段階は名前当てになる",
          },
        ],
      },
      async () => {
        const res = await scoreAndRequestHints(hintCount);
        expect(res).toMatchObject({ phase: "guessing" });
      },
    );
  }

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: `${SCORED_UNGUESSED_GIVEN}AI が採点で意味単位1件の判定値0.7を返しているとき`,
          When: [RESUME_QUEST],
          Then: "再開結果の最終評価点は66になる",
        },
      ],
    },
    async () => {
      const res = await scoreAndRequestHints(0, {
        llmText: JSON.stringify({
          units: [0.7],
          review: "よい 翻訳だ。",
        }),
      });
      expect(res).toMatchObject({ score: { score: 66 } });
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: `${SCORED_UNGUESSED_GIVEN}AI が採点で講評「よい 翻訳だ。」を返しているとき`,
          When: [RESUME_QUEST],
          Then: "再開結果の講評は「よい 翻訳だ。」になる",
        },
      ],
    },
    async () => {
      const res = await scoreAndRequestHints(0, {
        llmText: JSON.stringify({
          units: [0.7],
          review: "よい 翻訳だ。",
        }),
      });
      expect(res).toMatchObject({ score: { review: "よい 翻訳だ。" } });
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: `${SCORED_UNGUESSED_GIVEN}日本語説明文が「フシギダネは 緑色だ。」でポケモン名がフシギダネのとき`,
          When: [RESUME_QUEST],
          Then: "再開結果の日本語説明文は、ポケモン名を伏せ字にした「この ポケモンは 緑色だ。」になる",
        },
      ],
    },
    async () => {
      const res = await scoreAndRequestHints(0, {
        pokemons: [makePokemon({ description_ja: "フシギダネは 緑色だ。" })],
      });
      expect(res).toMatchObject({
        score: { description_ja: "この ポケモンは 緑色だ。" },
      });
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: `${SCORED_UNGUESSED_GIVEN}採点した訳文が「みどり」のとき`,
          When: [RESUME_QUEST],
          Then: "再開結果のユーザーの訳文は「みどり」になる",
        },
      ],
    },
    async () => {
      const service = await startQuest();
      await service.scoreTranslation(USER_ID, "みどり");
      const res = await service.getCurrentQuest(USER_ID);
      expect(res).toMatchObject({ user_translation: "みどり" });
    },
  );

  for (const { hintStatus, hintCount } of [
    { hintStatus: "ヒントを1回要求済みのとき", hintCount: 1 },
    { hintStatus: "ヒントを2回要求済みのとき", hintCount: 2 },
  ]) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "正常系",
        観点: ["件数・有無"],
        steps: [
          {
            Given: `${SCORED_UNGUESSED_GIVEN}${hintStatus}`,
            When: [RESUME_QUEST],
            Then: "再開結果の開示済みのヒントとして、出題ポケモンのタイプ (くさ・どく) が示される",
          },
        ],
      },
      async () => {
        const res = await scoreAndRequestHints(hintCount);
        expect(res).toMatchObject({
          hint: { types: ["grass", "poison"] },
        });
      },
    );
  }

  const NO_HINT_REQUESTED_GIVEN = `${SCORED_UNGUESSED_GIVEN}ヒントを1回も要求していないとき`;

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["件数・有無"],
      steps: [
        {
          Given: NO_HINT_REQUESTED_GIVEN,
          When: [RESUME_QUEST],
          Then: "再開結果の残り挑戦回数は3回になる",
        },
      ],
    },
    async () => {
      const res = await scoreAndRequestHints(0);
      expect(res).toMatchObject({ attempts_remaining: 3 });
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["件数・有無"],
      steps: [
        {
          Given: NO_HINT_REQUESTED_GIVEN,
          When: [RESUME_QUEST],
          Then: "再開結果の開示済みのヒントは無しになる",
        },
      ],
    },
    async () => {
      const res = await scoreAndRequestHints(0);
      expect(res).toMatchObject({ hint: null });
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["件数・有無"],
      steps: [
        {
          Given: `${SCORED_UNGUESSED_GIVEN}ヒントを1回要求済みのとき`,
          When: [RESUME_QUEST],
          Then: "再開結果の開示済みのヒントの残り挑戦回数は2回になる",
        },
      ],
    },
    async () => {
      const res = await scoreAndRequestHints(1);
      expect(res).toMatchObject({ hint: { attempts_remaining: 2 } });
    },
  );

  const TWO_HINTS_REQUESTED_GIVEN = `${SCORED_UNGUESSED_GIVEN}ヒントを2回要求済みのとき`;

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["件数・有無"],
      steps: [
        {
          Given: TWO_HINTS_REQUESTED_GIVEN,
          When: [RESUME_QUEST],
          Then: "再開結果の開示済みのヒントとして、技「たいあたり」が示される",
        },
      ],
    },
    async () => {
      const res = await scoreAndRequestHints(2);
      expect(res).toMatchObject({ hint: { moves: ["たいあたり"] } });
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["件数・有無"],
      steps: [
        {
          Given: TWO_HINTS_REQUESTED_GIVEN,
          When: [RESUME_QUEST],
          Then: "再開結果の開示済みのヒントの残り挑戦回数は1回になる",
        },
      ],
    },
    async () => {
      const res = await scoreAndRequestHints(2);
      expect(res).toMatchObject({ hint: { attempts_remaining: 1 } });
    },
  );

  for (const { given, decideBall, 観点 } of [
    {
      given: "採点済みで、名前当てに正解済みで、ハイパーボールが確定済みのとき",
      decideBall: async (service: QuestService) => {
        await service.scoreTranslation(USER_ID, "訳");
        await service.guessName(USER_ID, "bulbasaur");
      },
      観点: [],
    },
    {
      given: "採点済みで、名前当てをスキップ済みで、モンスターボールが確定済みのとき",
      decideBall: async (service: QuestService) => {
        await service.scoreTranslation(USER_ID, "訳");
        await service.skipGuess(USER_ID);
      },
      観点: [],
    },
    {
      given: "採点前で、名前当てに正解済みで、ハイパーボールが確定済みのとき",
      decideBall: async (service: QuestService) => {
        await service.guessName(USER_ID, "bulbasaur");
      },
      観点: ["エッジケース"],
    },
  ] satisfies {
    given: string;
    decideBall: (service: QuestService) => Promise<unknown>;
    観点: readonly Viewpoint[];
  }[]) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "正常系",
        観点,
        steps: [{ Given: given, When: [RESUME_QUEST], Then: "再開結果の段階は捕獲待機になる" }],
      },
      async () => {
        const service = await startQuest();
        await decideBall(service);
        const res = await service.getCurrentQuest(USER_ID);
        expect(res).toMatchObject({ phase: "capturing" });
      },
    );
  }

  for (const { given, decideBall, 観点 } of [
    {
      given: "採点済みで、名前当てに正解済みで、ハイパーボールが確定済みのとき",
      decideBall: async (service: QuestService) => {
        await service.scoreTranslation(USER_ID, "訳");
        await service.guessName(USER_ID, "bulbasaur");
      },
      観点: [],
    },
    {
      given: "採点前で、名前当てに正解済みで、ハイパーボールが確定済みのとき",
      decideBall: async (service: QuestService) => {
        await service.guessName(USER_ID, "bulbasaur");
      },
      観点: ["エッジケース"],
    },
  ] satisfies {
    given: string;
    decideBall: (service: QuestService) => Promise<unknown>;
    観点: readonly Viewpoint[];
  }[]) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "正常系",
        観点,
        steps: [{ Given: given, When: [RESUME_QUEST], Then: "再開結果の確定済みのボールはハイパーボールになる" }],
      },
      async () => {
        const service = await startQuest();
        await decideBall(service);
        const res = await service.getCurrentQuest(USER_ID);
        expect(res).toMatchObject({ ball_type: "ultra" });
      },
    );
  }

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "採点済みで、名前当てをスキップ済みで、モンスターボールが確定済みのとき",
          When: [RESUME_QUEST],
          Then: "再開結果の確定済みのボールはモンスターボールになる",
        },
      ],
    },
    async () => {
      const service = await startScoredQuest();
      await service.skipGuess(USER_ID);
      const res = await service.getCurrentQuest(USER_ID);
      expect(res).toMatchObject({ ball_type: "poke" });
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      steps: [
        {
          Given: "進行中のクエストセッションがないとき",
          When: [RESUME_QUEST],
          Then: "クエストセッションが見つからないエラーになる",
        },
      ],
    },
    async () => {
      const service = makeService();
      await expect(service.getCurrentQuest("nobody")).rejects.toBeInstanceOf(NotFoundError);
    },
  );
});
