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

/**
 * 捕獲確率の仕様。式そのものは書き写さず、外から観測できる性質で確かめる。
 * ボール補正は QuestService の設定値から独立した純関数の引数のため、テスト固有のダミー値で確かめる。
 */
describe("捕獲確率の計算", () => {
  const POKE_BONUS = 0;
  const GREAT_BONUS = 1.5;
  const ULTRA_BONUS = 3.0;

  it("種族値合計が高く最終評価点0 + ボール補正なしなら捕獲は困難 (確率は低い)", () => {
    expect(calculateCaptureRate(0, 680, POKE_BONUS)).toBeLessThan(0.05);
  });

  it("最終評価点・種族値合計・ボール補正が最も捕獲しやすい組み合わせでも、捕獲確率は1.0を超えない", () => {
    expect(calculateCaptureRate(99, 200, ULTRA_BONUS)).toBeLessThanOrEqual(1);
  });

  it("同じ種族値合計・同じボール補正なら、最終評価点が高いほど捕獲確率が上がる", () => {
    expect(calculateCaptureRate(90, 300, POKE_BONUS)).toBeGreaterThan(
      calculateCaptureRate(30, 300, POKE_BONUS),
    );
  });

  it("同じ最終評価点・同じボール補正なら、種族値合計が高いほど捕獲確率が下がる", () => {
    expect(calculateCaptureRate(50, 300, POKE_BONUS)).toBeGreaterThan(
      calculateCaptureRate(50, 680, POKE_BONUS),
    );
  });

  it("ボール補正が大きいほど捕獲確率が上がる", () => {
    expect(calculateCaptureRate(0, 680, ULTRA_BONUS)).toBeGreaterThan(
      calculateCaptureRate(0, 680, POKE_BONUS),
    );
  });

  it("最終評価点とポケモンの種族値が同一なら、ボール補正が大きいほど段階的に捕獲確率が上がる", () => {
    const pokeRate = calculateCaptureRate(20, 500, POKE_BONUS);
    const greatRate = calculateCaptureRate(20, 500, GREAT_BONUS);
    const ultraRate = calculateCaptureRate(20, 500, ULTRA_BONUS);
    expect(greatRate).toBeGreaterThan(pokeRate);
    expect(ultraRate).toBeGreaterThan(greatRate);
  });

  it("最終評価点が上限 (99) + 大きいボール補正なら、種族値合計が高い (680) でもほぼ確実に捕獲できる", () => {
    expect(calculateCaptureRate(99, 680, ULTRA_BONUS)).toBeGreaterThan(0.99);
  });
});

/**
 * 英語名の伏せ字仕様。純関数なので具体値で直接確かめる。
 */
describe("[ポケモン名マスク] 英語説明文のポケモン名マスク", () => {
  it("ポケモン名が空文字なら原文のまま", () => {
    expect(maskPokemonNameEN("A wild creature.", "")).toBe("A wild creature.");
  });

  it("ポケモン名が本文に無ければ原文のまま", () => {
    expect(maskPokemonNameEN("Hello world", "Pikachu")).toBe("Hello world");
  });

  it("文中の出現は小文字始まりの this Pokémon に置換", () => {
    expect(maskPokemonNameEN("A wild Pikachu appeared.", "Pikachu")).toBe(
      "A wild this Pokémon appeared.",
    );
  });

  it("文頭の出現は大文字始まりの This Pokémon に置換", () => {
    expect(maskPokemonNameEN("Pikachu is yellow.", "Pikachu")).toBe("This Pokémon is yellow.");
  });

  it("文末記号 (.!?) の直後も文頭扱いで大文字化", () => {
    expect(maskPokemonNameEN("Hello. Pikachu runs.", "Pikachu")).toBe("Hello. This Pokémon runs.");
  });

  it("複数形ヒント (several 等) の直後は of these Pokémon に置換", () => {
    expect(maskPokemonNameEN("Several Pikachu gather.", "Pikachu")).toBe(
      "Several of these Pokémon gather.",
    );
  });

  it("ポケモン名が本文に複数回現れるとき、すべて置換される", () => {
    expect(maskPokemonNameEN("Pikachu and Pikachu", "Pikachu")).toBe(
      "This Pokémon and this Pokémon",
    );
  });

  it("大文字小文字を無視して一致する", () => {
    expect(maskPokemonNameEN("A pikachu here", "Pikachu")).toBe("A this Pokémon here");
  });
});

/**
 * 日本語名の伏せ字仕様。
 */
describe("[ポケモン名マスク] 日本語説明文のポケモン名マスク", () => {
  it("本文中のポケモン名を「この ポケモン」に置換する", () => {
    expect(maskPokemonNameJA("ピカチュウは黄色い", "ピカチュウ")).toBe("この ポケモンは黄色い");
  });

  it("ポケモン名が本文に複数回現れるとき、すべて置換される", () => {
    expect(maskPokemonNameJA("ピカチュウとピカチュウ", "ピカチュウ")).toBe(
      "この ポケモンとこの ポケモン",
    );
  });

  it("ポケモン名が空文字なら原文のまま", () => {
    expect(maskPokemonNameJA("あいうえお", "")).toBe("あいうえお");
  });

  it("ポケモン名が本文に無ければ原文のまま", () => {
    expect(maskPokemonNameJA("あいうえお", "ピカチュウ")).toBe("あいうえお");
  });
});

/**
 * 採点単位の判定値配列からスコアを算出する仕様。純関数なので具体値で直接確かめる。
 */
describe("採点単位からのスコア算出", () => {
  it("単位が1件で判定値が0.6のとき、スコアは60になる", () => {
    expect(computeScoreFromUnits([0.6])).toBe(60);
  });

  it("判定値が1.0, 0.2, 0.0の3件のとき、平均の40がスコアになる", () => {
    expect(computeScoreFromUnits([1.0, 0.2, 0.0])).toBe(40);
  });

  it("判定値の平均が0.8のとき、単位が1件ならスコアは80になる", () => {
    expect(computeScoreFromUnits([0.8])).toBe(80);
  });

  it("判定値の平均が0.8のとき、単位が3件でもスコアは80になる", () => {
    expect(computeScoreFromUnits([0.8, 0.8, 0.8])).toBe(80);
  });

  it("判定値の平均に端数が出るとき、四捨五入した整数がスコアになる", () => {
    expect(computeScoreFromUnits([1.0, 1.0, 0.0])).toBe(67);
  });
});

/**
 * 素点から最終評価点への変換仕様。純関数なので具体値で直接確かめる。
 */
describe("最終評価点変換", () => {
  it.each([
    [0, 0],
    [100, 99],
    [10, 0],
    [11, 1],
    [15, 6],
  ])("素点が %i のとき、最終評価点は %i になる", (rawScore, finalScore) => {
    expect(translateToFinalScore(rawScore)).toBe(finalScore);
  });
});

// ============================================================
// セッションを持つメソッド群 (newQuest / scoreTranslation / guessName / skipGuess / attemptCapture)。
// 依存はポート経由のスタブで注入する (モックにするのは外部境界のみ)。ダミー値を使用。
// ============================================================

interface ServiceOverrides {
  /** getRandomPokemon の抽選元プール (allowedIds に含まれるものから乱数で選ぶ)。 */
  pokemons?: Pokemon[];
  /** LLM が返すテキスト。 */
  llmText?: string;
  /** LLM が返すテキストをプロンプト内容から動的に組み立てたい場合に使う (指定時は llmText より優先)。 */
  llmRespond?: (prompt: string) => string;
  /** per-user 除外 ID (null = 未設定)。 */
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
 * @param o スタブの挙動の上書き。
 * @returns テスト対象のサービス。
 */
function makeService(o: ServiceOverrides = {}): QuestService {
  const pool = o.pokemons ?? [makePokemon()];
  const pokemonClient = makePokemonClient(pool);
  const llm: LLMClient = {
    generateText: async (prompt) =>
      o.llmRespond?.(prompt) ?? o.llmText ?? JSON.stringify({ units: [0.7], review: "よい 翻訳だ。" }),
  };
  // 出題ロジックは環境非依存に確かめたいので prod (開発者除外なし) 固定。
  const environment = "prod" as const;
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
  return new QuestService(pokemonClient, llm, environment, settingsRepo, random, sessionStore, DEFAULT_QUEST_TUNING);
}

describe("[出題] クエストの出題", () => {
  it("出題される英語説明文は、ポケモン名が伏せ字になっている", async () => {
    const service = makeService({
      pokemons: [makePokemon({ description_en: "Bulbasaur is fast." })],
    });
    const res = await service.newQuest("alice");
    expect(res.pokemon_id).toBe(1);
    expect(res.description_en).toBe("This Pokémon is fast.");
    expect(res.is_legendary).toBe(false);
  });

  it("ユーザーごとの除外に含まれる ID は出題プールから除かれ、除外外の候補が出題される", async () => {
    const service = makeService({
      pokemons: [makePokemon({ id: 5 }), makePokemon({ id: 6 })],
      excludedIDs: [5],
    });
    const res = await service.newQuest("alice");
    expect(res.pokemon_id).toBe(6);
  });

  it("選択世代のポケモンだけが出題され、他世代は出題されない", async () => {
    // 100=第1世代, 300=第3世代 の範囲に入るダミー ID
    const service = makeService({
      pokemons: [makePokemon({ id: 300 }), makePokemon({ id: 100 })],
      enabledGenerations: [1],
    });
    const res = await service.newQuest("alice");
    expect(res.pokemon_id).toBe(100);
  });

  it("選択世代に含まれる世代のポケモンは出題対象になる", async () => {
    const service = makeService({
      pokemons: [makePokemon({ id: 300 })],
      enabledGenerations: [1, 3],
    });
    const res = await service.newQuest("alice");
    expect(res.pokemon_id).toBe(300);
  });

  // 未設定 (null) は「こだわりなし = 全世代」。画面は GET で全チェック表示になる (空配列 [] とは別で、
  // 空は設定画面の最低1世代バリデーションが防ぐ)。
  it("世代未設定なら全世代が出題対象になる", async () => {
    const service = makeService({
      pokemons: [makePokemon({ id: 500 })],
      enabledGenerations: null,
    });
    const res = await service.newQuest("alice");
    expect(res.pokemon_id).toBe(500);
  });

  // 画面は最低1世代・除外上限で空プールを防ぐため通常は到達しない防御的経路。到達時は
  // EmptyQuestPoolError → 409 → 画面で「今の設定では出会えるポケモンがいません。設定を見直して」と案内される。
  it("全ポケモンを除外していて出題プールが空のとき、出題できないエラーになる", async () => {
    const service = makeService({
      pokemons: [makePokemon({ id: 1 })],
      excludedIDs: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    });
    await expect(service.newQuest("alice")).rejects.toBeInstanceOf(EmptyQuestPoolError);
  });

  it("出題レスポンスには、名前当ての最大挑戦回数が含まれる", async () => {
    const service = makeService();
    const res = await service.newQuest("alice");
    expect(res.max_guess_attempts).toBe(3);
  });

  it("説明文が複数あるポケモンでは、そのうちの 1 つが選ばれて出題される", async () => {
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
    const res = await service.newQuest("alice");
    expect(res.description_en).toBe("Alpha this Pokémon runs.");
  });

  it("説明文の候補が無ければ、基本の説明文で出題する", async () => {
    const service = makeService({ pokemons: [makePokemon({ flavor_texts: undefined })] });
    const res = await service.newQuest("alice");
    expect(res.description_en).toBe(
      "A strange seed was planted on its back at birth. The plant sprouts and grows with this Pokémon.",
    );
  });

  it("説明文の候補が空配列でも、基本の説明文で出題する", async () => {
    const service = makeService({ pokemons: [makePokemon({ flavor_texts: [] })] });
    const res = await service.newQuest("alice");
    expect(res.description_en).toBe(
      "A strange seed was planted on its back at birth. The plant sprouts and grows with this Pokémon.",
    );
  });

  it("選んだ場所のタイプを持つポケモンだけが出題される", async () => {
    const service = makeService({
      pokemons: [
        makePokemon({ id: 110, types: ["grass"] }),
        makePokemon({ id: 100, types: ["electric"] }),
      ],
    });
    const res = await service.newQuest("alice", "ruined-powerplant");
    expect(res.pokemon_id).toBe(100);
  });

  it("選んだ場所のタイプでも、選択していない世代のポケモンは出題されない", async () => {
    const service = makeService({
      pokemons: [
        makePokemon({ id: 700, types: ["electric"] }),
        makePokemon({ id: 100, types: ["electric"] }),
      ],
      enabledGenerations: [1],
    });
    const res = await service.newQuest("alice", "ruined-powerplant");
    expect(res.pokemon_id).toBe(100);
  });

  it("幻・伝説の抽選に当たると場所を無視して伝説プールから出題される", async () => {
    const service = makeService({
      pokemons: [makePokemon({ id: 150, types: ["psychic"] }), makePokemon({ id: 100, types: ["electric"] })],
      randomValue: 0.995,
    });
    const res = await service.newQuest("alice", "ruined-powerplant");
    expect(res.pokemon_id).toBe(150);
  });

  it("伝説抽選に当たっても、選択世代に伝説がいなければ場所抽選にフォールバックする", async () => {
    const service = makeService({
      pokemons: [makePokemon({ id: 100, types: ["electric"] })],
      randomValue: 0.995,
    });
    const res = await service.newQuest("alice", "ruined-powerplant");
    expect(res.pokemon_id).toBe(100);
  });
});

describe("翻訳の採点", () => {
  it("セッションが無いまま採点すると、セッション不明のエラーになる", async () => {
    const service = makeService();
    await expect(service.scoreTranslation("nobody", "訳")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("最終評価点・講評・マスク済み日本語説明を返す", async () => {
    const service = makeService({
      pokemons: [makePokemon({ description_ja: "フシギダネは 速い。" })],
      llmText: JSON.stringify({ units: [0.7], review: "よい" }),
    });
    await service.newQuest("alice");
    const res = await service.scoreTranslation("alice", "はやい");
    expect(res.score).toBe(66);
    expect(res.review).toBe("よい");
    expect(res.description_ja).toBe("この ポケモンは 速い。");
  });

  it("複数の判定単位が返されたとき、その平均から最終評価点が算出される", async () => {
    const service = makeService({
      llmText: JSON.stringify({ units: [1.0, 0.6, 0.2], review: "r" }), // 平均60→最終評価点55
    });
    await service.newQuest("alice");
    const res = await service.scoreTranslation("alice", "訳");
    expect(res.score).toBe(55);
  });

  it.each([-0.1, 1.1])(
    "範囲外の判定値 %s を含む応答は外部サービスのエラーとして拒否される",
    async (value) => {
      const service = makeService({ llmText: JSON.stringify({ units: [value], review: "r" }) });
      await service.newQuest("alice");
      await expect(service.scoreTranslation("alice", "訳")).rejects.toBeInstanceOf(ExternalServiceError);
    },
  );

  it("説明文にポケモン名が含まれるとき、AI に渡す英文はポケモン名を伏せたものになる (講評でのネタバレ防止)", async () => {
    let sentPrompt = "";
    const service = makeService({
      pokemons: [makePokemon({ name_en: "Pikachu", description_en: "Pikachu is yellow." })],
      llmRespond: (prompt) => {
        sentPrompt = prompt;
        return JSON.stringify({ units: [0.7], review: "よい 翻訳だ。" });
      },
    });
    await service.newQuest("alice");
    await service.scoreTranslation("alice", "訳");
    expect(sentPrompt).not.toContain("Pikachu");
  });

  it.each([
    ["AI 応答が JSON でないとき、外部サービスのエラーになる", "ごめん、わからない"],
    ["AI 応答の JSON が途中で切れているとき、外部サービスのエラーになる", '{"units": [0.7], "rev'],
    ["AI 応答に判定単位が含まれないとき、外部サービスのエラーになる", JSON.stringify({ review: "r" })],
    [
      "AI 応答の判定単位が配列でないとき、外部サービスのエラーになる",
      JSON.stringify({ units: 0.7, review: "r" }),
    ],
    [
      "AI 応答の判定単位が空配列のとき、外部サービスのエラーになる",
      JSON.stringify({ units: [], review: "r" }),
    ],
    [
      "AI 応答の判定単位に数値でない要素が含まれるとき、外部サービスのエラーになる",
      JSON.stringify({ units: ["a"], review: "r" }),
    ],
    ["AI 応答に講評が含まれないとき、外部サービスのエラーになる", JSON.stringify({ units: [0.7] })],
    [
      "AI 応答の講評が空文字のとき、外部サービスのエラーになる",
      JSON.stringify({ units: [0.7], review: "" }),
    ],
  ])("%s", async (_name, llmText) => {
    const service = makeService({ llmText });
    await service.newQuest("alice");
    await expect(service.scoreTranslation("alice", "訳")).rejects.toBeInstanceOf(ExternalServiceError);
  });
});

describe("セッションストアの障害", () => {
  it("セッションストアの読み込みが失敗するとき、採点すると外部サービスのエラーになる", async () => {
    const service = makeService({ sessionStoreError: new Error("boom") });
    await expect(service.scoreTranslation("alice", "訳")).rejects.toBeInstanceOf(ExternalServiceError);
  });
});

describe("[名前当て] 名前当ての判定", () => {
  it("英語名の完全一致はハイパーボール (大文字小文字・前後空白を無視)", async () => {
    const service = makeService();
    await service.newQuest("alice");
    const res = await service.guessName("alice", "  bulbasaur ");
    expect(res).toMatchObject({ correct: true, ball_type: "ultra", language: "en" });
  });

  it("日本語名の一致はスーパーボール", async () => {
    const service = makeService();
    await service.newQuest("alice");
    const res = await service.guessName("alice", "フシギダネ");
    expect(res).toMatchObject({ correct: true, ball_type: "great", language: "ja" });
  });

  it("名前が 4 文字以上のとき、綴りが 2 文字までずれていても正解になる", async () => {
    const service = makeService();
    await service.newQuest("alice");
    const res = await service.guessName("alice", "bulbasaxx");
    expect(res).toMatchObject({ correct: true, ball_type: "ultra", fuzzy: true });
  });

  it("名前が 4 文字以上のとき、綴りが 3 文字ずれていると不正解になる", async () => {
    const service = makeService();
    await service.newQuest("alice");
    const res = await service.guessName("alice", "bulbasxxx");
    expect(res.correct).toBe(false);
  });

  it("名前が 3 文字のポケモンは、1 文字のずれでも不正解になる (あいまい一致の対象外)", async () => {
    const service = makeService({ pokemons: [makePokemon({ name_en: "Abc" })] });
    await service.newQuest("alice");
    expect((await service.guessName("alice", "abd")).correct).toBe(false);
  });

  it("名前が 4 文字のポケモンは、1 文字のずれなら正解になる (あいまい一致が有効)", async () => {
    const service = makeService({ pokemons: [makePokemon({ name_en: "Abcd" })] });
    await service.newQuest("alice");
    expect(await service.guessName("alice", "abce")).toMatchObject({ correct: true, fuzzy: true });
  });

  it("不正解なら残り試行回数が減って返る", async () => {
    const service = makeService();
    await service.newQuest("alice");
    const res = await service.guessName("alice", "wrong");
    expect(res).toMatchObject({ correct: false, attempts_remaining: 2 });
  });

  it("3回目の不正解でモンスターボールが確定する", async () => {
    const service = makeService();
    await service.newQuest("alice");
    await service.guessName("alice", "wrong1");
    await service.guessName("alice", "wrong2");
    const res = await service.guessName("alice", "wrong3");
    expect(res).toMatchObject({ correct: false, ball_type: "poke", attempts_remaining: 0 });
    expect((await service.attemptCapture("alice")).ball_type).toBe("poke");
  });

  it("正解済みで再送信すると確定済みボールを返す", async () => {
    const service = makeService();
    await service.newQuest("alice");
    await service.guessName("alice", "bulbasaur");
    const res = await service.guessName("alice", "whatever");
    expect(res).toMatchObject({ correct: true, ball_type: "ultra", attempts_remaining: 0 });
  });
});

describe("[名前当て] マスターボール確定捕獲", () => {
  it("伝説ポケモンで最終評価点が70のとき、英語名の正解でマスターボールになる", async () => {
    const service = makeService({
      pokemons: [makePokemon({ is_legendary: true })],
      llmText: JSON.stringify({ units: [0.74], review: "よい" }), // 最終評価点70
    });
    await service.newQuest("alice");
    await service.scoreTranslation("alice", "訳");
    const res = await service.guessName("alice", "bulbasaur");
    expect(res).toMatchObject({ correct: true, ball_type: "master", language: "en" });
  });

  it("伝説ポケモンで最終評価点が70のとき、英語名のあいまい一致でもマスターボールになる", async () => {
    const service = makeService({
      pokemons: [makePokemon({ is_legendary: true })],
      llmText: JSON.stringify({ units: [0.74], review: "よい" }), // 最終評価点70
    });
    await service.newQuest("alice");
    await service.scoreTranslation("alice", "訳");
    const res = await service.guessName("alice", "bulbasaxx");
    expect(res).toMatchObject({ correct: true, ball_type: "master", fuzzy: true });
  });

  it("伝説ポケモンで最終評価点が69のとき、英語名の正解でもハイパーボールのまま", async () => {
    const service = makeService({
      pokemons: [makePokemon({ is_legendary: true })],
      llmText: JSON.stringify({ units: [0.73], review: "よい" }), // 最終評価点69
    });
    await service.newQuest("alice");
    await service.scoreTranslation("alice", "訳");
    const res = await service.guessName("alice", "bulbasaur");
    expect(res).toMatchObject({ correct: true, ball_type: "ultra" });
  });

  it("幻ポケモンで最終評価点が70のとき、日本語名の正解でマスターボールになる", async () => {
    const service = makeService({
      pokemons: [makePokemon({ is_mythical: true })],
      llmText: JSON.stringify({ units: [0.74], review: "よい" }), // 最終評価点70
    });
    await service.newQuest("alice");
    await service.scoreTranslation("alice", "訳");
    const res = await service.guessName("alice", "フシギダネ");
    expect(res).toMatchObject({ correct: true, ball_type: "master", language: "ja" });
  });

  it("伝説でも幻でもないポケモンは、最終評価点が70でも名前当て正解でハイパーボールのまま", async () => {
    const service = makeService({
      llmText: JSON.stringify({ units: [0.74], review: "よい" }), // 最終評価点70
    });
    await service.newQuest("alice");
    await service.scoreTranslation("alice", "訳");
    const res = await service.guessName("alice", "bulbasaur");
    expect(res).toMatchObject({ correct: true, ball_type: "ultra" });
  });

  it("伝説ポケモンで最終評価点が70でも、名前当てを外し続けるとモンスターボールが確定する", async () => {
    const service = makeService({
      pokemons: [makePokemon({ is_legendary: true })],
      llmText: JSON.stringify({ units: [0.74], review: "よい" }), // 最終評価点70
    });
    await service.newQuest("alice");
    await service.scoreTranslation("alice", "訳");
    await service.guessName("alice", "wrong1");
    await service.guessName("alice", "wrong2");
    const res = await service.guessName("alice", "wrong3");
    expect(res).toMatchObject({ correct: false, ball_type: "poke" });
  });

  it("伝説ポケモンで最終評価点が70でも、名前当てをスキップするとモンスターボールが確定する", async () => {
    const service = makeService({
      pokemons: [makePokemon({ is_legendary: true })],
      llmText: JSON.stringify({ units: [0.74], review: "よい" }), // 最終評価点70
    });
    await service.newQuest("alice");
    await service.scoreTranslation("alice", "訳");
    expect(await service.skipGuess("alice")).toEqual({ ball_type: "poke" });
  });

  it("マスターボールでの捕獲は乱数によらず必ず成功し、捕獲確率は1.0になる", async () => {
    const service = makeService({
      pokemons: [makePokemon({ is_legendary: true, base_stat_total: 680 })],
      llmText: JSON.stringify({ units: [0.74], review: "よい" }), // 最終評価点70
      randomValue: 0.9999,
    });
    await service.newQuest("alice");
    await service.scoreTranslation("alice", "訳");
    await service.guessName("alice", "bulbasaur");
    const res = await service.attemptCapture("alice");
    expect(res).toMatchObject({ captured: true, probability: 1.0, ball_type: "master" });
  });
});

describe("[名前当て] 名前当てのヒント", () => {
  it("まだ一度も推測していないとき、1回目のヒントを要求すると出題ポケモンのタイプが返り、残り試行回数が1減る", async () => {
    const service = makeService({ pokemons: [makePokemon({ types: ["grass", "poison"] })] });
    await service.newQuest("alice");
    const res = await service.requestHint("alice");
    expect(res).toEqual({ types: ["grass", "poison"], attempts_remaining: 2 });
  });

  it("1回目のヒントに続けて2回目を要求すると、レベルアップで覚える技が返り、残り試行回数がさらに1減る", async () => {
    const service = makeService({
      pokemons: [makePokemon({ level_up_moves: ["たいあたり", "なきごえ", "つるのムチ"] })],
      randomValue: 0,
    });
    await service.newQuest("alice");
    await service.requestHint("alice");
    const res = await service.requestHint("alice");
    expect(res).toEqual({ moves: ["たいあたり", "なきごえ", "つるのムチ"], attempts_remaining: 1 });
  });

  it("同じポケモンでも、クエストごとに開示される技が変わりうる", async () => {
    const candidates = ["たいあたり", "なきごえ", "つるのムチ", "やどりぎのタネ"];
    const pokemons = [makePokemon({ level_up_moves: candidates })];

    const serviceA = makeService({ pokemons, randomValue: 0 });
    await serviceA.newQuest("alice");
    await serviceA.requestHint("alice");
    const resA = await serviceA.requestHint("alice");

    const serviceB = makeService({ pokemons, randomValue: 0.9 });
    await serviceB.newQuest("alice");
    await serviceB.requestHint("alice");
    const resB = await serviceB.requestHint("alice");

    expect(resA.moves).not.toEqual(resB.moves);
  });

  it("ヒントを2回要求済みのとき、3回目を要求するとエラーになる", async () => {
    const service = makeService();
    await service.newQuest("alice");
    await service.requestHint("alice");
    await service.requestHint("alice");
    await expect(service.requestHint("alice")).rejects.toThrow(/already guessed or hints exhausted/);
  });

  it("1回不正解で残り2回のとき、ヒントを要求できる", async () => {
    const service = makeService();
    await service.newQuest("alice");
    await service.guessName("alice", "wrong");
    const res = await service.requestHint("alice");
    expect(res.attempts_remaining).toBe(1);
  });

  it("2回不正解で残り1回のとき、ヒントを要求するとエラーになる", async () => {
    const service = makeService();
    await service.newQuest("alice");
    await service.guessName("alice", "wrong1");
    await service.guessName("alice", "wrong2");
    await expect(service.requestHint("alice")).rejects.toThrow(/insufficient guess attempts remaining/);
  });

  it("名前当てが正解済みのとき、ヒントを要求するとエラーになる", async () => {
    const service = makeService();
    await service.newQuest("alice");
    await service.guessName("alice", "bulbasaur");
    await expect(service.requestHint("alice")).rejects.toThrow(/already guessed or hints exhausted/);
  });

  it("セッションが無いままヒントを要求すると、セッション不明のエラーになる", async () => {
    const service = makeService();
    await expect(service.requestHint("nobody")).rejects.toThrow(NotFoundError);
  });

  it("レベルアップで覚える技が無いポケモンで2回目のヒントを要求すると、技0件が返る", async () => {
    const service = makeService({ pokemons: [makePokemon({ level_up_moves: undefined })] });
    await service.newQuest("alice");
    await service.requestHint("alice");
    const res = await service.requestHint("alice");
    expect(res).toEqual({ moves: [], attempts_remaining: 1 });
  });

  it("レベルアップで覚える技が0件のポケモンで2回目のヒントを要求すると、技0件が返る", async () => {
    const service = makeService({ pokemons: [makePokemon({ level_up_moves: [] })] });
    await service.newQuest("alice");
    await service.requestHint("alice");
    const res = await service.requestHint("alice");
    expect(res).toEqual({ moves: [], attempts_remaining: 1 });
  });

  it("残り2回でヒントを使い切った直後に不正解にすると、試行が尽きてモンスターボールが確定する", async () => {
    const service = makeService();
    await service.newQuest("alice");
    await service.guessName("alice", "wrong1");
    await service.requestHint("alice");
    const res = await service.guessName("alice", "wrong2");
    expect(res).toMatchObject({ correct: false, ball_type: "poke", attempts_remaining: 0 });
  });
});

describe("[名前当て] 名前当てスキップと捕獲", () => {
  it("名前当てをスキップすると、モンスターボールが確定する", async () => {
    const service = makeService();
    await service.newQuest("alice");
    expect(await service.skipGuess("alice")).toEqual({ ball_type: "poke" });
  });

  it("セッションが無いまま名前当てをスキップすると、セッション不明のエラーになる", async () => {
    const service = makeService();
    await expect(service.skipGuess("nobody")).rejects.toThrow(NotFoundError);
  });

  it("英語名正解 (ハイパーボール確定) 後に名前当てをスキップしても、ハイパーボールのまま捕獲できる", async () => {
    const service = makeService();
    await service.newQuest("alice");
    await service.guessName("alice", "bulbasaur");
    expect(await service.skipGuess("alice")).toEqual({ ball_type: "ultra" });
    expect((await service.attemptCapture("alice")).ball_type).toBe("ultra");
  });

  it("日本語名正解 (スーパーボール確定) 後に名前当てをスキップしても、スーパーボールのまま捕獲できる", async () => {
    const service = makeService();
    await service.newQuest("alice");
    await service.guessName("alice", "フシギダネ");
    expect(await service.skipGuess("alice")).toEqual({ ball_type: "great" });
    expect((await service.attemptCapture("alice")).ball_type).toBe("great");
  });

  it("名前当てにもスキップにも応答していないまま捕獲しようとすると、エラーになる", async () => {
    const service = makeService();
    await service.newQuest("alice");
    await expect(service.attemptCapture("alice")).rejects.toThrow(/before a ball/);
  });

  it("名前当てをスキップして捕獲すると、モンスターボールでの捕獲結果になる", async () => {
    const service = makeService();
    await service.newQuest("alice");
    await service.skipGuess("alice");
    const res = await service.attemptCapture("alice");
    expect(res).toMatchObject({
      captured: true,
      pokemon_id: 1,
      name_en: "Bulbasaur",
      ball_type: "poke",
    });
    expect(res.probability).toBeGreaterThan(0);
  });

  it("捕獲確率を乱数が上回ると、捕獲は失敗する", async () => {
    const service = makeService({
      pokemons: [makePokemon({ base_stat_total: 680 })],
      randomValue: 0.5,
    });
    await service.newQuest("alice");
    await service.skipGuess("alice");
    const res = await service.attemptCapture("alice");
    expect(res.captured).toBe(false);
  });

  it("捕獲するとセッションが消費され、2回目はセッション不明のエラーになる", async () => {
    const service = makeService();
    await service.newQuest("alice");
    await service.skipGuess("alice");
    await service.attemptCapture("alice");
    await expect(service.attemptCapture("alice")).rejects.toThrow(NotFoundError);
  });

  it("セッションはユーザごとに分離される", async () => {
    const service = makeService();
    await service.newQuest("alice");
    await expect(service.scoreTranslation("bob", "訳")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("[リロード再開] 現在のクエスト取得", () => {
  it("セッションが無いまま取得すると、セッション不明のエラーになる", async () => {
    const service = makeService();
    await expect(service.getCurrentQuest("nobody")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("採点前 (未採点) は訳文入力の段階として復元され、説明文のポケモン名は伏せられている", async () => {
    const service = makeService({
      pokemons: [makePokemon({ description_en: "Bulbasaur is fast.", is_legendary: true })],
    });
    await service.newQuest("alice");
    const res = await service.getCurrentQuest("alice");
    expect(res).toEqual({
      phase: "translating",
      quest: {
        pokemon_id: 1,
        description_en: "This Pokémon is fast.",
        is_legendary: true,
        is_mythical: false,
        max_guess_attempts: 3,
      },
    });
  });

  it("採点後 (名前当て未確定) は、得点・講評・ユーザーの訳文・伏せ字済みの日本語説明を保持した状態に復元される", async () => {
    const service = makeService({
      pokemons: [makePokemon({ description_ja: "フシギダネは 速い。" })],
      llmText: JSON.stringify({ score: 70, review: "よい 翻訳だ。" }),
    });
    await service.newQuest("alice");
    await service.scoreTranslation("alice", "はやい");
    const res = await service.getCurrentQuest("alice");
    expect(res).toMatchObject({
      phase: "guessing",
      score: { score: 66, review: "よい 翻訳だ。", description_ja: "この ポケモンは 速い。" },
      user_translation: "はやい",
      attempts_remaining: 3,
      hint: null,
    });
  });

  it.each([
    [0, null],
    [1, { types: ["grass", "poison"], attempts_remaining: 2 }],
    [2, { types: ["grass", "poison"], moves: ["たいあたり"], attempts_remaining: 1 }],
  ])("ヒントを%i回開示済みのとき、名前当ての段階への復元結果に開示済みの情報が反映される", async (revealCount, expectedHint) => {
    const service = makeService({
      pokemons: [makePokemon({ level_up_moves: ["たいあたり"] })],
      randomValue: 0,
    });
    await service.newQuest("alice");
    await service.scoreTranslation("alice", "訳");
    for (let i = 0; i < revealCount; i++) await service.requestHint("alice");
    const res = await service.getCurrentQuest("alice");
    expect(res).toMatchObject({ phase: "guessing", hint: expectedHint });
  });

  it("名前当て正解でボールが確定すると、確定済みのボール種別を保持した捕獲待機の段階として復元される", async () => {
    const service = makeService();
    await service.newQuest("alice");
    await service.scoreTranslation("alice", "訳");
    await service.guessName("alice", "bulbasaur");
    const res = await service.getCurrentQuest("alice");
    expect(res).toMatchObject({ phase: "capturing", ball_type: "ultra" });
  });

  it("名前当てをスキップしてボールが確定した場合も、確定済みのボール種別を保持した捕獲待機の段階として復元される", async () => {
    const service = makeService();
    await service.newQuest("alice");
    await service.scoreTranslation("alice", "訳");
    await service.skipGuess("alice");
    const res = await service.getCurrentQuest("alice");
    expect(res).toMatchObject({ phase: "capturing", ball_type: "poke" });
  });

  it("採点前に名前当てが完了した異常系でも、確定済みのボール種別を保持した捕獲待機の段階として復元される (ボールの確定を採点済みかより優先して判定する)", async () => {
    const service = makeService();
    await service.newQuest("alice");
    await service.guessName("alice", "bulbasaur");
    const res = await service.getCurrentQuest("alice");
    expect(res).toMatchObject({ phase: "capturing", ball_type: "ultra" });
  });
});
