import { describe, it, expect } from "vitest";
import {
  QuestService,
  calculateCaptureRate,
  maskPokemonNameEN,
  maskPokemonNameJA,
} from "./quest-service.js";
import { NotFoundError, ExternalServiceError } from "../domain/errors.js";
import type {
  LLMClient,
  PokemonClient,
  PokemonConfig,
  RandomSource,
  UserSettingsRepository,
} from "../domain/ports.js";
import type { Pokemon } from "../domain/pokemon.js";

/**
 * 捕獲確率の仕様。式そのものは書き写さず、外から観測できる性質で確かめる。
 */
describe("calculateCaptureRate", () => {
  it("確率は下限 0 以上", () => {
    expect(calculateCaptureRate(0, 900, 1.0)).toBeGreaterThanOrEqual(0);
  });

  it("倍率で 1.0 を超える場合は 1.0 にクランプされる", () => {
    expect(calculateCaptureRate(100, 100, 3.0)).toBe(1);
  });

  it("スコアが高いほど捕獲確率が上がる (種族値合計/ボール固定)", () => {
    expect(calculateCaptureRate(90, 300, 1.0)).toBeGreaterThan(calculateCaptureRate(30, 300, 1.0));
  });

  it("種族値合計が高いほど捕獲確率が下がる (スコア/ボール固定)", () => {
    expect(calculateCaptureRate(50, 300, 1.0)).toBeGreaterThan(calculateCaptureRate(50, 680, 1.0));
  });

  it("ボール倍率が高いほど捕獲確率が上がる", () => {
    expect(calculateCaptureRate(0, 680, 3.0)).toBeGreaterThan(calculateCaptureRate(0, 680, 1.0));
  });

  it("スコア90 + スーパーボールなら種族値合計が高い(680)でもほぼ確実", () => {
    expect(calculateCaptureRate(90, 680, 2.0)).toBeGreaterThan(0.99);
  });
});

/**
 * 英語名の伏せ字仕様。純関数なので具体値で直接確かめる。
 */
describe("maskPokemonNameEN", () => {
  it("name が空なら原文のまま", () => {
    expect(maskPokemonNameEN("A wild creature.", "")).toBe("A wild creature.");
  });

  it("name が本文に無ければ原文のまま", () => {
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

  it("複数箇所すべて置換する", () => {
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
describe("maskPokemonNameJA", () => {
  it("本文中のポケモン名を「この ポケモン」に置換する", () => {
    expect(maskPokemonNameJA("ピカチュウは黄色い", "ピカチュウ")).toBe("この ポケモンは黄色い");
  });

  it("複数箇所すべて置換する", () => {
    expect(maskPokemonNameJA("ピカチュウとピカチュウ", "ピカチュウ")).toBe(
      "この ポケモンとこの ポケモン",
    );
  });

  it("name が空なら原文のまま", () => {
    expect(maskPokemonNameJA("あいうえお", "")).toBe("あいうえお");
  });

  it("name が本文に無ければ原文のまま", () => {
    expect(maskPokemonNameJA("あいうえお", "ピカチュウ")).toBe("あいうえお");
  });
});

// ============================================================
// セッションを持つメソッド群 (newQuest / scoreTranslation / guessName / skipGuess / attemptCapture)。
// 依存はポート経由のスタブで注入する (モックにするのは外部境界のみ)。ダミー値を使用。
// ============================================================

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

interface ServiceOverrides {
  /** getRandomPokemon が順に返すポケモン (尽きたら最後を返し続ける)。 */
  pokemons?: Pokemon[];
  /** getRandomPokemon が投げるエラー。 */
  pokemonError?: Error;
  /** LLM が返すテキスト。 */
  llmText?: string;
  /** per-user 除外 ID (null = 未設定)。 */
  excludedIDs?: number[] | null;
  /** 乱数値。 */
  randomValue?: number;
}

/**
 * スタブを注入した QuestService を組み立てる。
 * @param o スタブの挙動の上書き。
 * @returns テスト対象のサービス。
 */
function makeService(o: ServiceOverrides = {}): QuestService {
  const queue = [...(o.pokemons ?? [makePokemon()])];
  const pokemonClient: PokemonClient = {
    getRandomPokemon: async () => {
      if (o.pokemonError) throw o.pokemonError;
      return queue.length > 1 ? queue.shift()! : queue[0];
    },
    getPokemonByID: async () => makePokemon(),
  };
  const llm: LLMClient = {
    generateText: async () => o.llmText ?? JSON.stringify({ score: 70, review: "よい 翻訳だ。" }),
  };
  const config: PokemonConfig = { maxPokemonID: 10, environment: "prod" };
  const settingsRepo: UserSettingsRepository = {
    getSettings: async () => ({ excluded_pokemon_ids: o.excludedIDs ?? null }),
    updateExcludedPokemon: async () => {},
  };
  const random: RandomSource = { next: () => o.randomValue ?? 0 };
  return new QuestService(pokemonClient, llm, config, settingsRepo, random);
}

describe("QuestService.newQuest", () => {
  it("説明文のポケモン名をマスクして出題を返す", async () => {
    const service = makeService();
    const res = await service.newQuest("alice");
    expect(res.pokemon_id).toBe(1);
    expect(res.description_en).toBe("This Pokémon is fast.");
    expect(res.is_legendary).toBe(false);
  });

  it("per-user 除外に含まれる ID は出題されない (次の候補が選ばれる)", async () => {
    const service = makeService({
      pokemons: [makePokemon({ id: 5 }), makePokemon({ id: 6 })],
      excludedIDs: [5],
    });
    const res = await service.newQuest("alice");
    expect(res.pokemon_id).toBe(6);
  });

  it("候補が全て除外ならリトライ上限でエラー", async () => {
    const service = makeService({ pokemons: [makePokemon({ id: 5 })], excludedIDs: [5] });
    await expect(service.newQuest("alice")).rejects.toThrow(/failed to pick/);
  });

  it("ポケモン取得の失敗は ExternalServiceError として伝わる", async () => {
    const service = makeService({ pokemonError: new Error("api down") });
    await expect(service.newQuest("alice")).rejects.toBeInstanceOf(ExternalServiceError);
  });

  it("flavor_texts があれば乱数で選んだペアの説明文を使う (乱数0 = 先頭)", async () => {
    const service = makeService({
      pokemons: [
        makePokemon({
          flavor_texts: [
            { version_names: ["X"], description_en: "Alpha Testmon runs.", description_ja: "テストモンは 走る。" },
            { version_names: ["Y"], description_en: "Beta text.", description_ja: "ベータ。" },
          ],
        }),
      ],
    });
    const res = await service.newQuest("alice");
    expect(res.description_en).toBe("Alpha this Pokémon runs.");
  });

  it("flavor_texts が無ければ基本の説明文で出題する", async () => {
    const service = makeService({ pokemons: [makePokemon({ flavor_texts: undefined })] });
    const res = await service.newQuest("alice");
    expect(res.description_en).toBe("This Pokémon is fast.");
  });

  it("flavor_texts が空配列でも基本の説明文で出題する", async () => {
    const service = makeService({ pokemons: [makePokemon({ flavor_texts: [] })] });
    const res = await service.newQuest("alice");
    expect(res.description_en).toBe("This Pokémon is fast.");
  });
});

describe("QuestService.scoreTranslation", () => {
  it("セッションが無ければ NotFoundError", async () => {
    const service = makeService();
    await expect(service.scoreTranslation("nobody", "訳")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("スコア・講評・マスク済み日本語説明を返す", async () => {
    const service = makeService({ llmText: JSON.stringify({ score: 70, review: "よい" }) });
    await service.newQuest("alice");
    const res = await service.scoreTranslation("alice", "はやい");
    expect(res.score).toBe(70);
    expect(res.review).toBe("よい");
    expect(res.description_ja).toBe("この ポケモンは 速い。");
  });

  it.each([0, 100])("スコア %i は受理される", async (score) => {
    const service = makeService({ llmText: JSON.stringify({ score, review: "r" }) });
    await service.newQuest("alice");
    const res = await service.scoreTranslation("alice", "訳");
    expect(res.score).toBe(score);
  });

  it.each([-1, 101])("範囲外スコア %i は ExternalServiceError として拒否される", async (score) => {
    const service = makeService({ llmText: JSON.stringify({ score, review: "r" }) });
    await service.newQuest("alice");
    await expect(service.scoreTranslation("alice", "訳")).rejects.toBeInstanceOf(ExternalServiceError);
  });

  it.each([
    { name: "JSON 以外のテキスト", llmText: "ごめん、わからない" },
    { name: "途中で切れた JSON", llmText: '{"score": 70, "rev' },
    { name: "score が欠落した JSON", llmText: JSON.stringify({ review: "r" }) },
    { name: "score が数値でない JSON", llmText: JSON.stringify({ score: "70", review: "r" }) },
    { name: "review が欠落した JSON", llmText: JSON.stringify({ score: 70 }) },
    { name: "review が空文字の JSON", llmText: JSON.stringify({ score: 70, review: "" }) },
  ])("LLM が $name を返したら ExternalServiceError", async ({ llmText }) => {
    const service = makeService({ llmText });
    await service.newQuest("alice");
    await expect(service.scoreTranslation("alice", "訳")).rejects.toBeInstanceOf(ExternalServiceError);
  });
});

describe("QuestService.guessName", () => {
  it("英語名の完全一致はハイパーボール (大文字小文字・前後空白を無視)", async () => {
    const service = makeService();
    await service.newQuest("alice");
    const res = service.guessName("alice", "  testmon ");
    expect(res).toMatchObject({ correct: true, ball_type: "ultra", language: "en" });
  });

  it("日本語名の一致はスーパーボール", async () => {
    const service = makeService();
    await service.newQuest("alice");
    const res = service.guessName("alice", "テストモン");
    expect(res).toMatchObject({ correct: true, ball_type: "great", language: "ja" });
  });

  it("あいまい一致: Levenshtein 距離2 は正解 (fuzzy)", async () => {
    const service = makeService();
    await service.newQuest("alice");
    const res = service.guessName("alice", "testmxx");
    expect(res).toMatchObject({ correct: true, ball_type: "ultra", fuzzy: true });
  });

  it("あいまい一致: 距離3 は不正解", async () => {
    const service = makeService();
    await service.newQuest("alice");
    const res = service.guessName("alice", "testxxx");
    expect(res.correct).toBe(false);
  });

  it("名前3文字はあいまい一致の対象外 (距離1でも不正解)", async () => {
    const service = makeService({ pokemons: [makePokemon({ name_en: "Abc" })] });
    await service.newQuest("alice");
    expect(service.guessName("alice", "abd").correct).toBe(false);
  });

  it("名前4文字はあいまい一致が有効 (距離1で正解)", async () => {
    const service = makeService({ pokemons: [makePokemon({ name_en: "Abcd" })] });
    await service.newQuest("alice");
    expect(service.guessName("alice", "abce")).toMatchObject({ correct: true, fuzzy: true });
  });

  it("不正解なら残り試行回数が減って返る", async () => {
    const service = makeService();
    await service.newQuest("alice");
    const res = service.guessName("alice", "wrong");
    expect(res).toMatchObject({ correct: false, attempts_remaining: 2 });
  });

  it("3回目の不正解で正解名が公開されモンスターボールが確定する", async () => {
    const service = makeService();
    await service.newQuest("alice");
    service.guessName("alice", "wrong1");
    service.guessName("alice", "wrong2");
    const res = service.guessName("alice", "wrong3");
    expect(res).toMatchObject({
      correct: false,
      attempts_remaining: 0,
      reveal_name_en: "Testmon",
      reveal_name_ja: "テストモン",
    });
    expect(service.attemptCapture("alice").ball_type).toBe("poke");
  });

  it("正解済みで再送信すると確定済みボールを返す", async () => {
    const service = makeService();
    await service.newQuest("alice");
    service.guessName("alice", "testmon");
    const res = service.guessName("alice", "whatever");
    expect(res).toMatchObject({ correct: true, ball_type: "ultra", attempts_remaining: 0 });
  });
});

describe("QuestService.skipGuess / attemptCapture", () => {
  it("skip するとモンスターボールが確定する", async () => {
    const service = makeService();
    await service.newQuest("alice");
    expect(service.skipGuess("alice")).toEqual({ ball_type: "poke" });
  });

  it("セッションが無い skip は NotFoundError", () => {
    const service = makeService();
    expect(() => service.skipGuess("nobody")).toThrow(NotFoundError);
  });

  it("ボール未確定 (名前当ても skip もしていない) の capture はエラー", async () => {
    const service = makeService();
    await service.newQuest("alice");
    expect(() => service.attemptCapture("alice")).toThrow(/before a ball/);
  });

  it("skip 後の capture はモンスターボールで捕獲結果を返す (乱数0 = 必ず捕獲)", async () => {
    const service = makeService();
    await service.newQuest("alice");
    service.skipGuess("alice");
    const res = service.attemptCapture("alice");
    expect(res).toMatchObject({
      captured: true,
      pokemon_id: 1,
      name_en: "Testmon",
      ball_type: "poke",
    });
    expect(res.probability).toBeGreaterThan(0);
  });

  it("capture でセッションが消費され、2回目は NotFoundError", async () => {
    const service = makeService();
    await service.newQuest("alice");
    service.skipGuess("alice");
    service.attemptCapture("alice");
    expect(() => service.attemptCapture("alice")).toThrow(NotFoundError);
  });

  it("セッションはユーザごとに分離される", async () => {
    const service = makeService();
    await service.newQuest("alice");
    await expect(service.scoreTranslation("bob", "訳")).rejects.toBeInstanceOf(NotFoundError);
  });
});
