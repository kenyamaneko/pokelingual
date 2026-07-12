import { describe, it, expect } from "vitest";
import {
  QuestService,
  calculateCaptureRate,
  maskPokemonNameEN,
  maskPokemonNameJA,
  BALL_MULTIPLIER,
} from "./quest-service.js";
import { NotFoundError, ExternalServiceError, EmptyQuestPoolError } from "../domain/errors.js";
import type { LLMClient, PokemonConfig, RandomSource, UserSettingsRepository } from "../domain/ports.js";
import type { Pokemon } from "../domain/pokemon.js";
import { makePokemon, makePokemonClient } from "../testing/pokemon-fixtures.js";

/**
 * 捕獲確率の仕様。式そのものは書き写さず、外から観測できる性質で確かめる。
 */
describe("捕獲確率の計算", () => {
  it("種族値合計が高くスコア0 + モンスターボールなら捕獲は困難 (確率は低い)", () => {
    expect(calculateCaptureRate(0, 680, 1.0)).toBeLessThan(0.05);
  });

  it("倍率で 1.0 を超える場合は、捕獲確率の上限 1.0 で頭打ちになる", () => {
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

  it("スコアとポケモンの種族値が同一ならモンスターボール<スーパーボール<ハイパーボールの順に捕獲確率が上がる", () => {
    const pokeRate = calculateCaptureRate(20, 500, BALL_MULTIPLIER.poke);
    const greatRate = calculateCaptureRate(20, 500, BALL_MULTIPLIER.great);
    const ultraRate = calculateCaptureRate(20, 500, BALL_MULTIPLIER.ultra);
    expect(greatRate).toBeGreaterThan(pokeRate);
    expect(ultraRate).toBeGreaterThan(greatRate);
  });

  it("スコア90 + スーパーボールなら種族値合計が高い (680) でもほぼ確実", () => {
    expect(calculateCaptureRate(90, 680, 2.0)).toBeGreaterThan(0.99);
  });
});

/**
 * 英語名の伏せ字仕様。純関数なので具体値で直接確かめる。
 */
describe("英語説明文のポケモン名マスク", () => {
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
describe("日本語説明文のポケモン名マスク", () => {
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
      o.llmRespond?.(prompt) ?? o.llmText ?? JSON.stringify({ score: 70, review: "よい 翻訳だ。" }),
  };
  const config: PokemonConfig = { maxPokemonID: 10, environment: "prod" };
  const settingsRepo: UserSettingsRepository = {
    getSettings: async () => ({
      excluded_pokemon_ids: o.excludedIDs ?? null,
      enabled_generations: o.enabledGenerations ?? null,
    }),
    updateExcludedPokemon: async () => {},
    updateEnabledGenerations: async () => {},
  };
  const random: RandomSource = { next: () => o.randomValue ?? 0 };
  return new QuestService(pokemonClient, llm, config, settingsRepo, random);
}

describe("クエストの出題", () => {
  it("出題される英語説明文は、ポケモン名が伏せ字になっている", async () => {
    const service = makeService();
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

  it("説明文が複数あるポケモンでは、そのうちの 1 つが選ばれて出題される", async () => {
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

  it("説明文の候補が無ければ、基本の説明文で出題する", async () => {
    const service = makeService({ pokemons: [makePokemon({ flavor_texts: undefined })] });
    const res = await service.newQuest("alice");
    expect(res.description_en).toBe("This Pokémon is fast.");
  });

  it("説明文の候補が空配列でも、基本の説明文で出題する", async () => {
    const service = makeService({ pokemons: [makePokemon({ flavor_texts: [] })] });
    const res = await service.newQuest("alice");
    expect(res.description_en).toBe("This Pokémon is fast.");
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

  it.each([-1, 101])("範囲外スコア %i は外部サービスのエラーとして拒否される", async (score) => {
    const service = makeService({ llmText: JSON.stringify({ score, review: "r" }) });
    await service.newQuest("alice");
    await expect(service.scoreTranslation("alice", "訳")).rejects.toBeInstanceOf(ExternalServiceError);
  });

  it("説明文にポケモン名が含まれるとき、AI に渡す英文はポケモン名を伏せたものになる (講評でのネタバレ防止)", async () => {
    let sentPrompt = "";
    const service = makeService({
      pokemons: [makePokemon({ name_en: "Pikachu", description_en: "Pikachu is yellow." })],
      llmRespond: (prompt) => {
        sentPrompt = prompt;
        return JSON.stringify({ score: 70, review: "よい 翻訳だ。" });
      },
    });
    await service.newQuest("alice");
    await service.scoreTranslation("alice", "訳");
    expect(sentPrompt).not.toContain("Pikachu");
  });

  it.each([
    ["AI 応答が JSON でないとき、外部サービスのエラーになる", "ごめん、わからない"],
    ["AI 応答の JSON が途中で切れているとき、外部サービスのエラーになる", '{"score": 70, "rev'],
    ["AI 応答にスコアが含まれないとき、外部サービスのエラーになる", JSON.stringify({ review: "r" })],
    [
      "AI 応答のスコアが数値でないとき、外部サービスのエラーになる",
      JSON.stringify({ score: "70", review: "r" }),
    ],
    ["AI 応答に講評が含まれないとき、外部サービスのエラーになる", JSON.stringify({ score: 70 })],
    [
      "AI 応答の講評が空文字のとき、外部サービスのエラーになる",
      JSON.stringify({ score: 70, review: "" }),
    ],
  ])("%s", async (_name, llmText) => {
    const service = makeService({ llmText });
    await service.newQuest("alice");
    await expect(service.scoreTranslation("alice", "訳")).rejects.toBeInstanceOf(ExternalServiceError);
  });
});

describe("名前当ての判定", () => {
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

  it("名前の綴りが 2 文字までずれていても正解になる", async () => {
    const service = makeService();
    await service.newQuest("alice");
    const res = service.guessName("alice", "testmxx");
    expect(res).toMatchObject({ correct: true, ball_type: "ultra", fuzzy: true });
  });

  it("名前の綴りが 3 文字ずれていると不正解になる", async () => {
    const service = makeService();
    await service.newQuest("alice");
    const res = service.guessName("alice", "testxxx");
    expect(res.correct).toBe(false);
  });

  it("名前が 3 文字のポケモンは、1 文字のずれでも不正解になる (あいまい一致の対象外)", async () => {
    const service = makeService({ pokemons: [makePokemon({ name_en: "Abc" })] });
    await service.newQuest("alice");
    expect(service.guessName("alice", "abd").correct).toBe(false);
  });

  it("名前が 4 文字のポケモンは、1 文字のずれなら正解になる (あいまい一致が有効)", async () => {
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
      ball_type: "poke",
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

describe("名前当てスキップと捕獲", () => {
  it("名前当てをスキップすると、モンスターボールが確定する", async () => {
    const service = makeService();
    await service.newQuest("alice");
    expect(service.skipGuess("alice")).toEqual({ ball_type: "poke" });
  });

  it("セッションが無いまま名前当てをスキップすると、セッション不明のエラーになる", () => {
    const service = makeService();
    expect(() => service.skipGuess("nobody")).toThrow(NotFoundError);
  });

  it("英語名正解 (ハイパーボール確定) 後に名前当てをスキップしても、ハイパーボールのまま捕獲できる", async () => {
    const service = makeService();
    await service.newQuest("alice");
    service.guessName("alice", "testmon");
    expect(service.skipGuess("alice")).toEqual({ ball_type: "ultra" });
    expect(service.attemptCapture("alice").ball_type).toBe("ultra");
  });

  it("日本語名正解 (スーパーボール確定) 後に名前当てをスキップしても、スーパーボールのまま捕獲できる", async () => {
    const service = makeService();
    await service.newQuest("alice");
    service.guessName("alice", "テストモン");
    expect(service.skipGuess("alice")).toEqual({ ball_type: "great" });
    expect(service.attemptCapture("alice").ball_type).toBe("great");
  });

  it("名前当てにもスキップにも応答していないまま捕獲しようとすると、エラーになる", async () => {
    const service = makeService();
    await service.newQuest("alice");
    expect(() => service.attemptCapture("alice")).toThrow(/before a ball/);
  });

  it("名前当てをスキップして捕獲すると、モンスターボールでの捕獲結果になる", async () => {
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

  it("乱数が捕獲確率を上回れば捕獲は失敗する (種族値680/スコア0/モンスターボールで確率は極小)", async () => {
    const service = makeService({
      pokemons: [makePokemon({ base_stat_total: 680 })],
      randomValue: 0.5,
    });
    await service.newQuest("alice");
    service.skipGuess("alice");
    const res = service.attemptCapture("alice");
    expect(res.captured).toBe(false);
  });

  it("捕獲するとセッションが消費され、2回目はセッション不明のエラーになる", async () => {
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
