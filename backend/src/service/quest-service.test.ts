import { describe, it, expect } from "vitest";
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

describe("[本体:捕獲]捕獲確率の計算", () => {
  // ボール補正は設定値に依存しない純関数の引数のため、本番の設定値とは独立したテスト固有の値を使う
  const POKE_BONUS = 0;
  const GREAT_BONUS = 1.5;
  const ULTRA_BONUS = 3.0;

  describe("ボール補正がないとき", () => {
    describe("単体テスト", () => {
      describe("正常系", () => {
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
    });
  });

  describe("ボール補正が大きいとき", () => {
    describe("単体テスト", () => {
      describe("正常系", () => {
        it("最終評価点が99で種族値合計が200のとき、捕獲確率は1.0以下になる", () => {
          expect(
            calculateCaptureRate(99, 200, ULTRA_BONUS),
          ).toBeLessThanOrEqual(1);
        });

        it("最終評価点が99で種族値合計が680のとき、捕獲確率は0.99を超える", () => {
          expect(calculateCaptureRate(99, 680, ULTRA_BONUS)).toBeGreaterThan(
            0.99,
          );
        });
      });
    });
  });

  describe("単体テスト", () => {
    describe("正常系", () => {
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
});

describe("[本体:説明文]英語説明文のポケモン名の伏せ字", () => {
  describe("ポケモン名が Pikachu のとき", () => {
    describe("説明文のポケモン名を伏せ字にすると", () => {
      describe("単体テスト", () => {
        describe("正常系", () => {
          it("説明文が「Hello world」でポケモン名を含まないとき、伏せ字にした説明文は「Hello world」のままになる", () => {
            expect(maskPokemonNameEN("Hello world", "Pikachu")).toBe(
              "Hello world",
            );
          });

          it("ポケモン名が文中に出現する「A wild Pikachu appeared.」のとき、伏せ字にした説明文は「A wild this Pokémon appeared.」になる", () => {
            expect(
              maskPokemonNameEN("A wild Pikachu appeared.", "Pikachu"),
            ).toBe("A wild this Pokémon appeared.");
          });

          it("ポケモン名が文頭に出現する「Pikachu is yellow.」のとき、伏せ字にした説明文は「This Pokémon is yellow.」になる", () => {
            expect(maskPokemonNameEN("Pikachu is yellow.", "Pikachu")).toBe(
              "This Pokémon is yellow.",
            );
          });

          it("ポケモン名がピリオドの直後に出現する「Hello. Pikachu runs.」のとき、伏せ字にした説明文は「Hello. This Pokémon runs.」になる", () => {
            expect(maskPokemonNameEN("Hello. Pikachu runs.", "Pikachu")).toBe(
              "Hello. This Pokémon runs.",
            );
          });

          it("ポケモン名の直前に「Several」がある「Several Pikachu gather.」のとき、伏せ字にした説明文は「Several of these Pokémon gather.」になる", () => {
            expect(
              maskPokemonNameEN("Several Pikachu gather.", "Pikachu"),
            ).toBe("Several of these Pokémon gather.");
          });

          it("ポケモン名が複数回出現する「Pikachu and Pikachu」のとき、伏せ字にした説明文は「This Pokémon and this Pokémon」になる", () => {
            expect(maskPokemonNameEN("Pikachu and Pikachu", "Pikachu")).toBe(
              "This Pokémon and this Pokémon",
            );
          });

          it("ポケモン名と大文字小文字が異なる表記が出現する「A pikachu here」のとき、伏せ字にした説明文は「A this Pokémon here」になる", () => {
            expect(maskPokemonNameEN("A pikachu here", "Pikachu")).toBe(
              "A this Pokémon here",
            );
          });
        });
      });
    });
  });

  describe("ポケモン名が空文字のとき", () => {
    describe("説明文のポケモン名を伏せ字にすると", () => {
      describe("単体テスト", () => {
        describe("異常系", () => {
          it("説明文が「A wild creature.」のとき、伏せ字にした説明文は「A wild creature.」のままになる", () => {
            expect(maskPokemonNameEN("A wild creature.", "")).toBe(
              "A wild creature.",
            );
          });
        });
      });
    });
  });
});

describe("[本体:説明文]日本語説明文のポケモン名の伏せ字", () => {
  describe("ポケモン名が「ピカチュウ」のとき", () => {
    describe("説明文のポケモン名を伏せ字にすると", () => {
      describe("単体テスト", () => {
        describe("正常系", () => {
          it("ポケモン名が出現する「ピカチュウは黄色い」のとき、伏せ字にした説明文は「この ポケモンは黄色い」になる", () => {
            expect(maskPokemonNameJA("ピカチュウは黄色い", "ピカチュウ")).toBe(
              "この ポケモンは黄色い",
            );
          });

          it("ポケモン名が複数回出現する「ピカチュウとピカチュウ」のとき、伏せ字にした説明文は「この ポケモンとこの ポケモン」になる", () => {
            expect(
              maskPokemonNameJA("ピカチュウとピカチュウ", "ピカチュウ"),
            ).toBe("この ポケモンとこの ポケモン");
          });

          it("説明文が「あいうえお」でポケモン名を含まないとき、伏せ字にした説明文は「あいうえお」のままになる", () => {
            expect(maskPokemonNameJA("あいうえお", "ピカチュウ")).toBe(
              "あいうえお",
            );
          });
        });
      });
    });
  });

  describe("ポケモン名が空文字のとき", () => {
    describe("説明文のポケモン名を伏せ字にすると", () => {
      describe("単体テスト", () => {
        describe("異常系", () => {
          it("説明文が「あいうえお」のとき、伏せ字にした説明文は「あいうえお」のままになる", () => {
            expect(maskPokemonNameJA("あいうえお", "")).toBe("あいうえお");
          });
        });
      });
    });
  });
});

describe("[本体:採点]意味単位の判定値からの素点算出", () => {
  describe("意味単位の判定値から素点を算出すると", () => {
    describe("単体テスト", () => {
      describe("正常系", () => {
        it("意味単位が1件で判定値が0.6のとき、素点は60になる", () => {
          expect(computeScoreFromUnits([0.6])).toBe(60);
        });

        it("判定値が1.0、0.2、0.0の3件のとき、素点は40になる", () => {
          expect(computeScoreFromUnits([1.0, 0.2, 0.0])).toBe(40);
        });

        it("判定値が1.0、1.0、0.0の3件のとき、素点は四捨五入して67になる", () => {
          expect(computeScoreFromUnits([1.0, 1.0, 0.0])).toBe(67);
        });
      });
    });
  });

  describe("すべての意味単位の判定値が0.8のとき", () => {
    describe("意味単位の判定値から素点を算出すると", () => {
      describe("単体テスト", () => {
        describe("正常系", () => {
          it.each<[string, number[]]>([
            ["意味単位が1件のとき", [0.8]],
            ["意味単位が3件のとき", [0.8, 0.8, 0.8]],
          ])("%s、素点は80になる", (_situation, units) => {
            expect(computeScoreFromUnits(units)).toBe(80);
          });
        });
      });
    });
  });
});

describe("[本体:採点]素点から最終評価点への変換", () => {
  describe("素点を最終評価点に変換すると", () => {
    describe("単体テスト", () => {
      describe("正常系", () => {
        it("素点が0のとき、最終評価点は0になる", () => {
          expect(translateToFinalScore(0)).toBe(0);
        });

        it("素点が100のとき、最終評価点は99になる", () => {
          expect(translateToFinalScore(100)).toBe(99);
        });

        it("素点が10のとき、最終評価点は0になる", () => {
          expect(translateToFinalScore(10)).toBe(0);
        });

        it("素点が11のとき、最終評価点は1になる", () => {
          expect(translateToFinalScore(11)).toBe(1);
        });

        it("素点が15のとき、最終評価点は6になる", () => {
          expect(translateToFinalScore(15)).toBe(6);
        });
      });
    });
  });
});

describe("[本体:出題]クエストの出題", () => {
  describe("出題すると", () => {
    describe("単体テスト", () => {
      describe("正常系", () => {
        it("英語説明文が「Bulbasaur is green.」のポケモンのとき、出題結果の英語説明文は「This Pokémon is green.」になる", async () => {
          const service = makeService({
            pokemons: [makePokemon({ description_en: "Bulbasaur is green." })],
          });
          const res = await service.newQuest(USER_ID);
          expect(res.description_en).toBe("This Pokémon is green.");
        });

        it("図鑑番号1のポケモンだけがいるとき、出題結果の図鑑番号は1になる", async () => {
          const service = makeService();
          const res = await service.newQuest(USER_ID);
          expect(res.pokemon_id).toBe(1);
        });

        it("伝説ポケモンでないポケモンのとき、出題結果は伝説ポケモンではないと示される", async () => {
          const service = makeService();
          const res = await service.newQuest(USER_ID);
          expect(res.is_legendary).toBe(false);
        });

        it("図鑑番号5と6のポケモンがいて、図鑑番号5を除外しているとき、出題結果の図鑑番号は6になる", async () => {
          const service = makeService({
            pokemons: [makePokemon({ id: 5 }), makePokemon({ id: 6 })],
            excludedIDs: [5],
          });
          const res = await service.newQuest(USER_ID);
          expect(res.pokemon_id).toBe(6);
        });

        it("第1世代だけを選択していて、第3世代の図鑑番号300と第1世代の図鑑番号100のポケモンがいるとき、出題結果の図鑑番号は100になる", async () => {
          const service = makeService({
            pokemons: [makePokemon({ id: 300 }), makePokemon({ id: 100 })],
            enabledGenerations: [1],
          });
          const res = await service.newQuest(USER_ID);
          expect(res.pokemon_id).toBe(100);
        });

        it("第1世代と第3世代を選択していて、第3世代の図鑑番号300のポケモンがいるとき、出題結果の図鑑番号は300になる", async () => {
          const service = makeService({
            pokemons: [makePokemon({ id: 300 })],
            enabledGenerations: [1, 3],
          });
          const res = await service.newQuest(USER_ID);
          expect(res.pokemon_id).toBe(300);
        });

        it("出題世代を設定していなくて、第5世代の図鑑番号500のポケモンがいるとき、出題結果の図鑑番号は500になる", async () => {
          const service = makeService({
            pokemons: [makePokemon({ id: 500 })],
            enabledGenerations: null,
          });
          const res = await service.newQuest(USER_ID);
          expect(res.pokemon_id).toBe(500);
        });

        it("出題結果の名前当ての最大挑戦回数は3回になる", async () => {
          const service = makeService();
          const res = await service.newQuest(USER_ID);
          expect(res.max_guess_attempts).toBe(3);
        });

        it.each<[string, Pokemon["flavor_texts"]]>([
          [
            "バージョン別の説明文が「Alpha Bulbasaur runs.」の1件のとき",
            [
              {
                version_names: ["X"],
                description_en: "Alpha Bulbasaur runs.",
                description_ja: "フシギダネは 走る。",
              },
            ],
          ],
          [
            "バージョン別の説明文が「Alpha Bulbasaur runs.」(1件目) と「Beta text.」(2件目) の2件あり、抽選で1件目が選ばれるとき",
            [
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
          ],
        ])(
          "%s、出題結果の英語説明文は「Alpha this Pokémon runs.」になる",
          async (_given, flavorTexts) => {
            const service = makeService({
              pokemons: [makePokemon({ flavor_texts: flavorTexts })],
            });
            const res = await service.newQuest(USER_ID);
            expect(res.description_en).toBe("Alpha this Pokémon runs.");
          },
        );
      });

      describe("異常系", () => {
        it("図鑑番号1のポケモンだけが出題対象で、図鑑番号1から10を除外しているとき、出題できるポケモンがいないエラーになる", async () => {
          const service = makeService({
            pokemons: [makePokemon({ id: 1 })],
            excludedIDs: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
          });
          await expect(service.newQuest(USER_ID)).rejects.toBeInstanceOf(
            EmptyQuestPoolError,
          );
        });
      });
    });
  });

  describe("英語説明文が「A strange seed was planted on its back at birth. The plant sprouts and grows with this Pokémon.」のポケモンのとき", () => {
    describe("出題すると", () => {
      describe("単体テスト", () => {
        describe("正常系", () => {
          it.each<[string, Pokemon["flavor_texts"]]>([
            ["バージョン別の説明文の一覧が未設定のとき", undefined],
            ["バージョン別の説明文の一覧が0件のとき", []],
          ])(
            "%s、出題結果の英語説明文は「A strange seed was planted on its back at birth. The plant sprouts and grows with this Pokémon.」になる",
            async (_state, flavorTexts) => {
              const service = makeService({
                pokemons: [makePokemon({ flavor_texts: flavorTexts })],
              });
              const res = await service.newQuest(USER_ID);
              expect(res.description_en).toBe(
                "A strange seed was planted on its back at birth. The plant sprouts and grows with this Pokémon.",
              );
            },
          );
        });
      });
    });
  });

  describe("場所「廃墟の発電所」(でんき・はがね・どくタイプ) を選んだとき", () => {
    const LOCATION_ID = "ruined-powerplant";

    describe("出題すると", () => {
      describe("単体テスト", () => {
        describe("正常系", () => {
          it.each<[string, ServiceOverrides]>([
            [
              "でんきタイプの図鑑番号100とくさタイプの図鑑番号110のポケモンがいるとき",
              {
                pokemons: [
                  makePokemon({ id: 110, types: ["grass"] }),
                  makePokemon({ id: 100, types: ["electric"] }),
                ],
              },
            ],
            [
              "第1世代だけを選択していて、第6世代の図鑑番号700と第1世代の図鑑番号100の、どちらもでんきタイプのポケモンがいるとき",
              {
                pokemons: [
                  makePokemon({ id: 700, types: ["electric"] }),
                  makePokemon({ id: 100, types: ["electric"] }),
                ],
                enabledGenerations: [1],
              },
            ],
            [
              "幻・伝説の抽選に当たり、幻・伝説のポケモンがいなくて、でんきタイプの図鑑番号100のポケモンがいるとき",
              {
                pokemons: [makePokemon({ id: 100, types: ["electric"] })],
                randomValue: 0.995,
              },
            ],
          ])(
            "%s、出題結果の図鑑番号は100になる",
            async (_situation, overrides) => {
              const service = makeService(overrides);
              const res = await service.newQuest(USER_ID, LOCATION_ID);
              expect(res.pokemon_id).toBe(100);
            },
          );

          it("幻・伝説の抽選に当たり、でんきタイプの図鑑番号100とエスパータイプの図鑑番号150の伝説ポケモンがいるとき、出題結果の図鑑番号は150になる", async () => {
            const service = makeService({
              pokemons: [
                makePokemon({ id: 150, types: ["psychic"] }),
                makePokemon({ id: 100, types: ["electric"] }),
              ],
              randomValue: 0.995,
            });
            const res = await service.newQuest(USER_ID, LOCATION_ID);
            expect(res.pokemon_id).toBe(150);
          });
        });
      });
    });
  });
});

describe("[本体:採点]翻訳の採点", () => {
  describe("訳文を採点すると", () => {
    describe("単体テスト", () => {
      describe("正常系", () => {
        it("AI が意味単位1件の判定値0.7を返したとき、採点結果の最終評価点は66になる", async () => {
          const service = await startQuest({
            llmText: JSON.stringify({ units: [0.7], review: "よい" }),
          });
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
          const service = await startQuest({
            llmText: JSON.stringify({ units: [0.7], review: "よい" }),
          });
          const res = await service.scoreTranslation(USER_ID, "みどり");
          expect(res.review).toBe("よい");
        });

        it("日本語説明文が「フシギダネは 緑色だ。」でポケモン名がフシギダネのとき、採点結果の日本語説明文は「この ポケモンは 緑色だ。」になる", async () => {
          const service = await startQuest({
            pokemons: [
              makePokemon({ description_ja: "フシギダネは 緑色だ。" }),
            ],
          });
          const res = await service.scoreTranslation(USER_ID, "みどり");
          expect(res.description_ja).toBe("この ポケモンは 緑色だ。");
        });

        it("英語説明文が「Pikachu is yellow.」でポケモン名が Pikachu のとき、AI に渡す英文に伏せ字にした説明文「This Pokémon is yellow.」が含まれる", async () => {
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
        });
      });

      describe("異常系", () => {
        it("クエストセッションの保存先がエラー「boom」で読み込みに失敗するとき、保存先が返したエラー「boom」を原因とする外部サービス (クエストセッションの保存先) のエラーになる", async () => {
          const service = makeService({ sessionStoreError: new Error("boom") });
          const error = await getRejection(
            service.scoreTranslation(USER_ID, "訳"),
          );
          expect(error).toBeInstanceOf(ExternalServiceError);
          expect((error as ExternalServiceError).cause).toEqual(
            expect.objectContaining({ message: "boom" }),
          );
        });
      });
    });
  });

  describe("ユーザー「bob」が訳文を採点すると", () => {
    describe("単体テスト", () => {
      describe("異常系", () => {
        it.each<[string, (service: QuestService) => Promise<void>]>([
          ["どのユーザーにも進行中のクエストセッションがない", async () => {}],
          [
            "別のユーザー「alice」にだけ進行中のクエストセッションがある",
            async (service) => {
              await service.newQuest(USER_ID);
            },
          ],
        ])(
          "%sとき、クエストセッションが見つからないエラーになる",
          async (_situation, prepare) => {
            const service = makeService();
            await prepare(service);
            await expect(
              service.scoreTranslation("bob", "訳"),
            ).rejects.toBeInstanceOf(NotFoundError);
          },
        );
      });
    });
  });
});

describe("[外部連携:AI 呼び出し]採点応答の検証と再試行", () => {
  const NO_SCORING_UNITS = expect.objectContaining({
    message: "LLM returned no scoring units",
  });
  const EMPTY_REVIEW = expect.objectContaining({
    message: "LLM returned empty review",
  });

  describe("AI が2回続けて不正な応答を返すとき", () => {
    describe("訳文を採点すると", () => {
      describe("単体テスト", () => {
        describe("異常系", () => {
          it.each<[string, string]>([
            [
              "応答が JSON ではない「ごめん、わからない」",
              "ごめん、わからない",
            ],
            [
              '応答の JSON が途中で切れている ({"units": [0.7], "rev)',
              '{"units": [0.7], "rev',
            ],
          ])(
            "%sとき、AI の応答が JSON として読めないことを原因とする外部サービス (AI) のエラーになる",
            async (_content, llmText) => {
              const service = await startQuest({ llmText });
              const error = await getRejection(
                service.scoreTranslation(USER_ID, "訳"),
              );
              expect(error).toBeInstanceOf(ExternalServiceError);
              expect((error as ExternalServiceError).cause).toEqual(
                expect.any(SyntaxError),
              );
            },
          );

          it.each<[string, string]>([
            [
              "応答に判定値の項目がない (講評だけ「r」がある)",
              JSON.stringify({ review: "r" }),
            ],
            [
              "応答の判定値が一覧ではなく1つの数値0.7になっている",
              JSON.stringify({ units: 0.7, review: "r" }),
            ],
            [
              "応答の判定値が0件である",
              JSON.stringify({ units: [], review: "r" }),
            ],
          ])(
            "%sとき、判定値が無いことを原因とする外部サービス (AI) のエラーになる",
            async (_content, llmText) => {
              const service = await startQuest({ llmText });
              const error = await getRejection(
                service.scoreTranslation(USER_ID, "訳"),
              );
              expect(error).toBeInstanceOf(ExternalServiceError);
              expect((error as ExternalServiceError).cause).toEqual(
                NO_SCORING_UNITS,
              );
            },
          );

          it("応答の判定値に数値でない値「a」を含むとき、範囲外の判定値「a」を原因とする外部サービス (AI) のエラーになる", async () => {
            const service = await startQuest({
              llmText: JSON.stringify({ units: ["a"], review: "r" }),
            });
            const error = await getRejection(
              service.scoreTranslation(USER_ID, "訳"),
            );
            expect(error).toBeInstanceOf(ExternalServiceError);
            expect((error as ExternalServiceError).cause).toEqual(
              expect.objectContaining({
                message: "LLM returned out-of-range unit value: a",
              }),
            );
          });

          it("応答に0.0から1.0の範囲外の判定値 -0.1 を含むとき、範囲外の判定値「-0.1」を原因とする外部サービス (AI) のエラーになる", async () => {
            const service = await startQuest({
              llmText: JSON.stringify({ units: [-0.1], review: "r" }),
            });
            const error = await getRejection(
              service.scoreTranslation(USER_ID, "訳"),
            );
            expect(error).toBeInstanceOf(ExternalServiceError);
            expect((error as ExternalServiceError).cause).toEqual(
              expect.objectContaining({
                message: "LLM returned out-of-range unit value: -0.1",
              }),
            );
          });

          it("応答に0.0から1.0の範囲外の判定値 1.1 を含むとき、範囲外の判定値「1.1」を原因とする外部サービス (AI) のエラーになる", async () => {
            const service = await startQuest({
              llmText: JSON.stringify({ units: [1.1], review: "r" }),
            });
            const error = await getRejection(
              service.scoreTranslation(USER_ID, "訳"),
            );
            expect(error).toBeInstanceOf(ExternalServiceError);
            expect((error as ExternalServiceError).cause).toEqual(
              expect.objectContaining({
                message: "LLM returned out-of-range unit value: 1.1",
              }),
            );
          });

          it.each<[string, string]>([
            [
              "応答に講評の項目がない (判定値 0.7 の1件だけがある)",
              JSON.stringify({ units: [0.7] }),
            ],
            [
              "応答の講評が空文字である",
              JSON.stringify({ units: [0.7], review: "" }),
            ],
          ])(
            "%sとき、講評が空であることを原因とする外部サービス (AI) のエラーになる",
            async (_content, llmText) => {
              const service = await startQuest({ llmText });
              const error = await getRejection(
                service.scoreTranslation(USER_ID, "訳"),
              );
              expect(error).toBeInstanceOf(ExternalServiceError);
              expect((error as ExternalServiceError).cause).toEqual(
                EMPTY_REVIEW,
              );
            },
          );
        });
      });
    });
  });

  describe("AI の最初の応答が JSON ではなく、2回目の応答が判定値0.7の1件と講評「よい」の正しい形式のとき", () => {
    const llmTexts = [
      "ごめん、わからない",
      JSON.stringify({ units: [0.7], review: "よい" }),
    ];

    describe("訳文を採点すると", () => {
      describe("単体テスト", () => {
        describe("異常系", () => {
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
  });

  describe("訳文を採点すると", () => {
    describe("単体テスト", () => {
      describe("正常系", () => {
        it("AI が意味単位1件の判定値0.0を返したとき、採点結果の最終評価点は0になる", async () => {
          const service = await startQuest({
            llmText: JSON.stringify({ units: [0.0], review: "r" }),
          });
          const res = await service.scoreTranslation(USER_ID, "訳");
          expect(res.score).toBe(0);
        });
      });
    });
  });
});

describe("[本体:名前当て]名前当ての判定", () => {
  describe("英語名「Bulbasaur」、日本語名「フシギダネ」のポケモンを出題済みのとき", () => {
    describe("前に空白が2つ、後ろに空白が1つある小文字「bulbasaur」で答えると", () => {
      describe("単体テスト", () => {
        describe("正常系", () => {
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
      });
    });

    describe("日本語名「フシギダネ」で答えると", () => {
      describe("単体テスト", () => {
        describe("正常系", () => {
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
      });
    });

    describe("英語名があいまい一致の最小文字数以上のポケモンに、綴りがあいまい一致の許容距離ちょうどずれた「bulbasaxx」で答えると", () => {
      describe("単体テスト", () => {
        describe("正常系", () => {
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
      });
    });

    describe("1回目に「wrong」で答えると", () => {
      describe("単体テスト", () => {
        describe("正常系", () => {
          it("判定結果の残り挑戦回数は2回になる", async () => {
            const service = await startQuest();
            const res = await service.guessName(USER_ID, "wrong");
            expect(res).toMatchObject({ attempts_remaining: 2 });
          });
        });
      });
    });

    describe("名前当てで3回続けて外すと", () => {
      describe("単体テスト", () => {
        describe("正常系", () => {
          it("判定結果の残り挑戦回数は0回になる", async () => {
            const service = await startQuest();
            const res = await missThreeTimes(service);
            expect(res).toMatchObject({ attempts_remaining: 0 });
          });
        });
      });
    });
  });

  describe("英語名「Abra」、日本語名「ケーシィ」のポケモンを出題済みのとき", () => {
    const pokemons = [makePokemon({ name_en: "Abra", name_ja: "ケーシィ" })];

    describe("英語名の文字数があいまい一致の最小文字数ちょうどのポケモンに、綴りが許容距離以内の1文字ずれた「abrx」で答えると", () => {
      describe("単体テスト", () => {
        describe("正常系", () => {
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
      });
    });
  });

  describe("名前当てで答えると", () => {
    describe("単体テスト", () => {
      describe("正常系", () => {
        it.each<[string, Pokemon[], string]>([
          [
            "英語名があいまい一致の最小文字数以上のポケモン「Bulbasaur」で、答えの綴りがあいまい一致の許容距離を超えてずれた「bulbasxxx」のとき",
            [makePokemon()],
            "bulbasxxx",
          ],
          [
            "英語名があいまい一致の最小文字数に満たないポケモン「Mew」(日本語名「ミュウ」) で、答えの綴りが1文字ずれた「mex」のとき",
            [makePokemon({ name_en: "Mew", name_ja: "ミュウ" })],
            "mex",
          ],
          [
            "英語名「Bulbasaur」のポケモンで、答えの綴りが大きく異なる「wrong」のとき",
            [makePokemon()],
            "wrong",
          ],
        ])(
          "%s、判定結果は不正解になる",
          async (_situation, pokemons, guess) => {
            const service = await startQuest({ pokemons });
            const res = await service.guessName(USER_ID, guess);
            expect(res).toMatchObject({ correct: false });
          },
        );
      });
    });
  });

  describe("英語名「Bulbasaur」で正解済みのとき", () => {
    describe("別の名前「whatever」で答えると", () => {
      async function answerAgainAfterCorrect() {
        const service = await startQuest();
        await service.guessName(USER_ID, "bulbasaur");
        return service.guessName(USER_ID, "whatever");
      }

      describe("単体テスト", () => {
        describe("異常系", () => {
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
  });

  describe("伝説ポケモンの「Bulbasaur」を最終評価点70で採点済みのとき", () => {
    const options: ServiceOverrides = {
      pokemons: [makePokemon({ is_legendary: true })],
      llmText: AI_RESPONSE_FINAL_SCORE_70,
    };

    describe("英語名「bulbasaur」で答えると", () => {
      describe("単体テスト", () => {
        describe("正常系", () => {
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
      });
    });

    describe("英語名とあいまい一致する「bulbasaxx」で答えると", () => {
      describe("単体テスト", () => {
        describe("正常系", () => {
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
      });
    });
  });

  describe("幻ポケモンの「Bulbasaur」(日本語名「フシギダネ」) を最終評価点70で採点済みのとき", () => {
    const options: ServiceOverrides = {
      pokemons: [makePokemon({ is_mythical: true })],
      llmText: AI_RESPONSE_FINAL_SCORE_70,
    };

    describe("日本語名「フシギダネ」で答えると", () => {
      describe("単体テスト", () => {
        describe("正常系", () => {
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
      });
    });
  });

  describe("名前当てで3回続けて外すと", () => {
    describe("単体テスト", () => {
      describe("正常系", () => {
        const startCases: [string, () => Promise<QuestService>][] = [
          [
            "英語名「Bulbasaur」、日本語名「フシギダネ」のポケモンを出題済みのとき",
            () => startQuest(),
          ],
          [
            "伝説ポケモンの「Bulbasaur」を最終評価点70で採点済みのとき",
            () =>
              startScoredQuest({
                pokemons: [makePokemon({ is_legendary: true })],
                llmText: AI_RESPONSE_FINAL_SCORE_70,
              }),
          ],
        ];

        it.each(startCases)(
          "%s、判定結果は不正解になる",
          async (_given, start) => {
            const res = await missThreeTimes(await start());
            expect(res).toMatchObject({ correct: false });
          },
        );

        it.each(startCases)(
          "%s、判定結果のボールはモンスターボールになる",
          async (_given, start) => {
            const res = await missThreeTimes(await start());
            expect(res).toMatchObject({ ball_type: "poke" });
          },
        );
      });
    });
  });

  describe("英語名「bulbasaur」で答えると", () => {
    describe("単体テスト", () => {
      describe("正常系", () => {
        const startCases: [string, () => Promise<QuestService>][] = [
          [
            "伝説ポケモンの「Bulbasaur」を最終評価点69で採点済みのとき",
            () =>
              startScoredQuest({
                pokemons: [makePokemon({ is_legendary: true })],
                llmText: AI_RESPONSE_FINAL_SCORE_69,
              }),
          ],
          [
            "伝説でも幻でもないポケモンの「Bulbasaur」を最終評価点70で採点済みのとき",
            () => startScoredQuest({ llmText: AI_RESPONSE_FINAL_SCORE_70 }),
          ],
        ];

        it.each(startCases)(
          "%s、判定結果は正解になる",
          async (_given, start) => {
            const res = await (await start()).guessName(USER_ID, "bulbasaur");
            expect(res).toMatchObject({ correct: true });
          },
        );

        it.each(startCases)(
          "%s、判定結果のボールはハイパーボールになる",
          async (_given, start) => {
            const res = await (await start()).guessName(USER_ID, "bulbasaur");
            expect(res).toMatchObject({ ball_type: "ultra" });
          },
        );
      });
    });
  });

  describe("1回外したあとヒントを1回要求し、残り挑戦回数が1回のとき", () => {
    describe("もう一度外すと", () => {
      async function missAgainAfterHint() {
        const service = await startQuest();
        await service.guessName(USER_ID, "wrong1");
        await service.requestHint(USER_ID);
        return service.guessName(USER_ID, "wrong2");
      }

      describe("単体テスト", () => {
        describe("正常系", () => {
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
    });
  });
});

describe("[本体:名前当て]名前当てのヒント", () => {
  describe("タイプが「くさ」「どく」のポケモンを出題済みで、まだ名前当てをしていないとき", () => {
    describe("1回目のヒントを要求すると", () => {
      describe("単体テスト", () => {
        describe("正常系", () => {
          it("要求結果として、出題ポケモンのタイプ (くさ・どく) が開示される", async () => {
            const service = await startQuest({
              pokemons: [makePokemon({ types: ["grass", "poison"] })],
            });
            const res = await service.requestHint(USER_ID);
            expect(res).toEqual({
              types: ["grass", "poison"],
              attempts_remaining: expect.any(Number),
            });
          });

          it("要求結果の残り挑戦回数は2回になる", async () => {
            const service = await startQuest({
              pokemons: [makePokemon({ types: ["grass", "poison"] })],
            });
            const res = await service.requestHint(USER_ID);
            expect(res).toEqual({
              types: expect.any(Array),
              attempts_remaining: 2,
            });
          });
        });
      });
    });
  });

  describe("1回目のヒントを要求済みのとき", () => {
    describe("2回目のヒントを要求すると", () => {
      async function requestSecondHint(levelUpMoves: string[] | undefined) {
        const service = await startQuest({
          pokemons: [makePokemon({ level_up_moves: levelUpMoves })],
          randomValue: 0,
        });
        await service.requestHint(USER_ID);
        return service.requestHint(USER_ID);
      }

      describe("単体テスト", () => {
        describe("正常系", () => {
          it.each<[string, string[] | undefined]>([
            [
              "レベルアップで覚える技が3つあるポケモン (「たいあたり」「なきごえ」「つるのムチ」)",
              ["たいあたり", "なきごえ", "つるのムチ"],
            ],
            ["レベルアップで覚える技の情報が未設定のポケモン", undefined],
            ["レベルアップで覚える技の情報が0件のポケモン", []],
          ])(
            "%sでは、要求結果の残り挑戦回数は1回になる",
            async (_pokemon, levelUpMoves) => {
              const res = await requestSecondHint(levelUpMoves);
              expect(res).toEqual({
                moves: expect.any(Array),
                attempts_remaining: 1,
              });
            },
          );

          it("レベルアップで覚える技が「たいあたり」「なきごえ」「つるのムチ」のポケモンでは、要求結果として、その3つの技が開示される", async () => {
            const res = await requestSecondHint([
              "たいあたり",
              "なきごえ",
              "つるのムチ",
            ]);
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
              expect(res).toEqual({
                moves: [],
                attempts_remaining: expect.any(Number),
              });
            },
          );
        });
      });
    });
  });

  describe("レベルアップで覚える技が「たいあたり」「なきごえ」「つるのムチ」「やどりぎのタネ」の4つのポケモンに2回出会い、出会うたびの技の抽選結果が異なるとき", () => {
    describe("それぞれの出会いで2回目のヒントを要求すると", () => {
      describe("単体テスト", () => {
        describe("正常系", () => {
          it("要求結果で開示される技は、2回の出会いで互いに異なる", async () => {
            const candidates = [
              "たいあたり",
              "なきごえ",
              "つるのムチ",
              "やどりぎのタネ",
            ];
            const pokemons = [makePokemon({ level_up_moves: candidates })];

            const serviceA = await startQuest({ pokemons, randomValue: 0 });
            await serviceA.requestHint(USER_ID);
            const resA = await serviceA.requestHint(USER_ID);

            const serviceB = await startQuest({ pokemons, randomValue: 0.9 });
            await serviceB.requestHint(USER_ID);
            const resB = await serviceB.requestHint(USER_ID);

            expect(resA.moves).not.toEqual(resB.moves);
          });
        });
      });
    });
  });

  describe("名前当てで1回外して残り挑戦回数が2回のとき", () => {
    describe("ヒントを要求すると", () => {
      describe("単体テスト", () => {
        describe("正常系", () => {
          it("要求結果の残り挑戦回数は1回になる", async () => {
            const service = await startQuest();
            await service.guessName(USER_ID, "wrong");
            const res = await service.requestHint(USER_ID);
            expect(res.attempts_remaining).toBe(1);
          });
        });
      });
    });
  });

  describe("ヒントを要求すると", () => {
    describe("単体テスト", () => {
      describe("異常系", () => {
        it.each<[string, (service: QuestService) => Promise<void>]>([
          [
            "ヒントを2回要求済みのとき",
            async (service) => {
              await service.requestHint(USER_ID);
              await service.requestHint(USER_ID);
            },
          ],
          [
            "名前当てに正解済みのとき",
            async (service) => {
              await service.guessName(USER_ID, "bulbasaur");
            },
          ],
        ])(
          "%s、名前当てが済んでいるか、ヒントを使い切っているため要求できないエラーになる",
          async (_situation, prepare) => {
            const service = await startQuest();
            await prepare(service);
            await expect(service.requestHint(USER_ID)).rejects.toThrow(
              /already guessed or hints exhausted/,
            );
          },
        );

        it("名前当てで2回外して残り挑戦回数が1回のとき、残り挑戦回数が足りないエラーになる", async () => {
          const service = await startQuest();
          await service.guessName(USER_ID, "wrong1");
          await service.guessName(USER_ID, "wrong2");
          await expect(service.requestHint(USER_ID)).rejects.toThrow(
            /insufficient guess attempts remaining/,
          );
        });

        it("進行中のクエストセッションがないとき、クエストセッションが見つからないエラーになる", async () => {
          const service = makeService();
          await expect(service.requestHint("nobody")).rejects.toThrow(
            NotFoundError,
          );
        });
      });
    });
  });
});

describe("[本体:名前当て]名前当てのスキップ", () => {
  describe("名前当てをスキップすると", () => {
    describe("単体テスト", () => {
      describe("正常系", () => {
        it.each<[string, () => Promise<QuestService>]>([
          ["ポケモンを出題済みのとき", () => startQuest()],
          [
            "伝説ポケモンの「Bulbasaur」を最終評価点70で採点済みのとき",
            () =>
              startScoredQuest({
                pokemons: [makePokemon({ is_legendary: true })],
                llmText: AI_RESPONSE_FINAL_SCORE_70,
              }),
          ],
        ])(
          "%s、スキップ結果のボールはモンスターボールになる",
          async (_given, start) => {
            const service = await start();
            expect(await service.skipGuess(USER_ID)).toEqual({
              ball_type: "poke",
            });
          },
        );
      });
    });
  });

  describe("単体テスト", () => {
    describe("異常系", () => {
      it("進行中のクエストセッションがないとき、名前当てをスキップすると、クエストセッションが見つからないエラーになる", async () => {
        const service = makeService();
        await expect(service.skipGuess("nobody")).rejects.toThrow(
          NotFoundError,
        );
      });
    });
  });

  describe("英語名で正解してハイパーボールが確定済みのとき", () => {
    describe("名前当てをスキップすると", () => {
      describe("単体テスト", () => {
        describe("異常系", () => {
          it("スキップ結果のボールは確定済みのハイパーボールのままになる", async () => {
            const service = await startQuest();
            await service.guessName(USER_ID, "bulbasaur");
            expect(await service.skipGuess(USER_ID)).toEqual({
              ball_type: "ultra",
            });
          });
        });
      });
    });
  });

  describe("日本語名で正解してスーパーボールが確定済みのとき", () => {
    describe("名前当てをスキップすると", () => {
      describe("単体テスト", () => {
        describe("異常系", () => {
          it("スキップ結果のボールは確定済みのスーパーボールのままになる", async () => {
            const service = await startQuest();
            await service.guessName(USER_ID, "フシギダネ");
            expect(await service.skipGuess(USER_ID)).toEqual({
              ball_type: "great",
            });
          });
        });
      });
    });
  });
});

describe("[本体:捕獲]捕獲の実行", () => {
  describe("図鑑番号1、英語名「Bulbasaur」、種族値合計318のポケモンを最終評価点0のまま出題し、名前当てをスキップしてモンスターボールが確定済みのとき", () => {
    describe("捕獲すると", () => {
      async function captureAfterSkip(o: ServiceOverrides = {}) {
        const service = await startQuest(o);
        await service.skipGuess(USER_ID);
        return service.attemptCapture(USER_ID);
      }

      describe("単体テスト", () => {
        describe("正常系", () => {
          it("乱数が捕獲確率を下回るとき、捕獲結果は成功になる", async () => {
            const res = await captureAfterSkip();
            expect(res.captured).toBe(true);
          });

          it("捕獲結果のポケモンは、出題されたポケモン (図鑑番号1、英語名 Bulbasaur) になる", async () => {
            const res = await captureAfterSkip();
            expect(res).toMatchObject({ pokemon_id: 1, name_en: "Bulbasaur" });
          });

          it("捕獲結果の捕獲確率は0より大きくなる", async () => {
            const res = await captureAfterSkip();
            expect(res.probability).toBeGreaterThan(0);
          });
        });
      });
    });
  });

  describe("モンスターボールが確定済みのとき", () => {
    describe("捕獲すると", () => {
      describe("単体テスト", () => {
        describe("正常系", () => {
          it.each<[string, (service: QuestService) => Promise<unknown>]>([
            [
              "名前当てをスキップしたとき",
              (service) => service.skipGuess(USER_ID),
            ],
            [
              "名前当てで3回続けて外したとき",
              (service) => missThreeTimes(service),
            ],
          ])(
            "%s、捕獲結果のボールはモンスターボールになる",
            async (_given, decideBall) => {
              const service = await startQuest();
              await decideBall(service);
              const res = await service.attemptCapture(USER_ID);
              expect(res.ball_type).toBe("poke");
            },
          );
        });
      });
    });
  });

  describe("英語名で正解してハイパーボールが確定済みで、その後に名前当てをスキップしたとき", () => {
    describe("捕獲すると", () => {
      describe("単体テスト", () => {
        describe("異常系", () => {
          it("捕獲結果のボールはハイパーボールになる", async () => {
            const service = await startQuest();
            await service.guessName(USER_ID, "bulbasaur");
            await service.skipGuess(USER_ID);
            expect((await service.attemptCapture(USER_ID)).ball_type).toBe(
              "ultra",
            );
          });
        });
      });
    });
  });

  describe("日本語名で正解してスーパーボールが確定済みで、その後に名前当てをスキップしたとき", () => {
    describe("捕獲すると", () => {
      describe("単体テスト", () => {
        describe("異常系", () => {
          it("捕獲結果のボールはスーパーボールになる", async () => {
            const service = await startQuest();
            await service.guessName(USER_ID, "フシギダネ");
            await service.skipGuess(USER_ID);
            expect((await service.attemptCapture(USER_ID)).ball_type).toBe(
              "great",
            );
          });
        });
      });
    });
  });

  describe("種族値合計が680のポケモンを最終評価点0のまま出題し、名前当てをスキップしてモンスターボールが確定済みで、乱数が0.5のとき", () => {
    describe("捕獲すると", () => {
      describe("単体テスト", () => {
        describe("正常系", () => {
          it("捕獲結果は失敗になる", async () => {
            const service = await startQuest({
              pokemons: [makePokemon({ base_stat_total: 680 })],
              randomValue: 0.5,
            });
            await service.skipGuess(USER_ID);
            const res = await service.attemptCapture(USER_ID);
            expect(res.captured).toBe(false);
          });
        });
      });
    });
  });

  describe("種族値合計が680の伝説ポケモンを最終評価点70で採点し、英語名で正解してマスターボールが確定済みで、乱数が最大に近い値(0.9999)のとき", () => {
    describe("捕獲すると", () => {
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

      describe("単体テスト", () => {
        describe("正常系", () => {
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
    });
  });

  describe("単体テスト", () => {
    describe("異常系", () => {
      it("名前当てにもスキップにも応答していないとき、捕獲すると、ボールが未確定のエラーになる", async () => {
        const service = await startQuest();
        await expect(service.attemptCapture(USER_ID)).rejects.toThrow(
          /before a ball/,
        );
      });

      it("捕獲を1回行ったあとに、もう一度捕獲すると、クエストセッションが見つからないエラーになる", async () => {
        const service = await startQuest();
        await service.skipGuess(USER_ID);
        await service.attemptCapture(USER_ID);
        await expect(service.attemptCapture(USER_ID)).rejects.toThrow(
          NotFoundError,
        );
      });
    });
  });
});

describe("[本体:リロード再開]再開するクエストの段階と状態", () => {
  describe("図鑑番号150の伝説ポケモン (英語名「Mewtwo」、英語説明文「Mewtwo is powerful.」) を出題して、採点前のとき", () => {
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

    describe("進行中のクエストを再開すると", () => {
      describe("単体テスト", () => {
        describe("正常系", () => {
          it("再開結果の段階は訳文入力になる", async () => {
            const service = await startQuest(options);
            const res = await service.getCurrentQuest(USER_ID);
            expect(res).toEqual({
              phase: "translating",
              quest: expect.any(Object),
            });
          });

          it("再開結果のクエストは図鑑番号150のポケモンになる", async () => {
            const service = await startQuest(options);
            const res = await service.getCurrentQuest(USER_ID);
            expect(res).toMatchObject({ quest: { pokemon_id: 150 } });
          });

          it("再開結果のクエストの英語説明文は、ポケモン名を伏せ字にした「This Pokémon is powerful.」になる", async () => {
            const service = await startQuest(options);
            const res = await service.getCurrentQuest(USER_ID);
            expect(res).toMatchObject({
              quest: { description_en: "This Pokémon is powerful." },
            });
          });

          it("再開結果のクエストは伝説ポケモンと示される", async () => {
            const service = await startQuest(options);
            const res = await service.getCurrentQuest(USER_ID);
            expect(res).toMatchObject({ quest: { is_legendary: true } });
          });

          it("再開結果のクエストは幻ポケモンではないと示される", async () => {
            const service = await startQuest(options);
            const res = await service.getCurrentQuest(USER_ID);
            expect(res).toMatchObject({ quest: { is_mythical: false } });
          });

          it("再開結果のクエストの名前当ての最大挑戦回数は3回になる", async () => {
            const service = await startQuest(options);
            const res = await service.getCurrentQuest(USER_ID);
            expect(res).toMatchObject({ quest: { max_guess_attempts: 3 } });
          });
        });
      });
    });
  });

  describe("タイプが「くさ」「どく」、レベルアップで覚える技が「たいあたり」のポケモンを出題し、採点後で名前当てが未確定のとき", () => {
    async function scoreAndRequestHints(
      hintCount: number,
      o: ServiceOverrides = {},
    ) {
      const service = await startQuest({
        pokemons: [makePokemon({ level_up_moves: ["たいあたり"] })],
        randomValue: 0,
        ...o,
      });
      await service.scoreTranslation(USER_ID, "訳");
      for (let i = 0; i < hintCount; i++) await service.requestHint(USER_ID);
      return service.getCurrentQuest(USER_ID);
    }

    describe("進行中のクエストを再開すると", () => {
      describe("単体テスト", () => {
        describe("正常系", () => {
          it.each<[string, number]>([
            ["ヒントを1回も要求していないとき", 0],
            ["ヒントを1回要求済みのとき", 1],
            ["ヒントを2回要求済みのとき", 2],
          ])(
            "%s、再開結果の段階は名前当てになる",
            async (_hintStatus, hintCount) => {
              const res = await scoreAndRequestHints(hintCount);
              expect(res).toMatchObject({ phase: "guessing" });
            },
          );

          it("AI が意味単位1件の判定値0.7を返して採点したとき、再開結果の最終評価点は66になる", async () => {
            const res = await scoreAndRequestHints(0, {
              llmText: JSON.stringify({
                units: [0.7],
                review: "よい 翻訳だ。",
              }),
            });
            expect(res).toMatchObject({ score: { score: 66 } });
          });

          it("AI が講評「よい 翻訳だ。」を返して採点したとき、再開結果の講評は「よい 翻訳だ。」になる", async () => {
            const res = await scoreAndRequestHints(0, {
              llmText: JSON.stringify({
                units: [0.7],
                review: "よい 翻訳だ。",
              }),
            });
            expect(res).toMatchObject({ score: { review: "よい 翻訳だ。" } });
          });

          it("日本語説明文が「フシギダネは 緑色だ。」でポケモン名がフシギダネのとき、再開結果の日本語説明文は、ポケモン名を伏せ字にした「この ポケモンは 緑色だ。」になる", async () => {
            const res = await scoreAndRequestHints(0, {
              pokemons: [
                makePokemon({ description_ja: "フシギダネは 緑色だ。" }),
              ],
            });
            expect(res).toMatchObject({
              score: { description_ja: "この ポケモンは 緑色だ。" },
            });
          });

          it("訳文「みどり」を採点に送ったとき、再開結果のユーザーの訳文は「みどり」になる", async () => {
            const service = await startQuest();
            await service.scoreTranslation(USER_ID, "みどり");
            const res = await service.getCurrentQuest(USER_ID);
            expect(res).toMatchObject({ user_translation: "みどり" });
          });

          it.each<[string, number]>([
            ["ヒントを1回要求済みのとき", 1],
            ["ヒントを2回要求済みのとき", 2],
          ])(
            "%s、再開結果の開示済みのヒントとして、出題ポケモンのタイプ (くさ・どく) が示される",
            async (_hintStatus, hintCount) => {
              const res = await scoreAndRequestHints(hintCount);
              expect(res).toMatchObject({
                hint: { types: ["grass", "poison"] },
              });
            },
          );
        });
      });
    });

    describe("ヒントを1回も要求していないとき", () => {
      describe("進行中のクエストを再開すると", () => {
        describe("単体テスト", () => {
          describe("正常系", () => {
            it("再開結果の残り挑戦回数は3回になる", async () => {
              const res = await scoreAndRequestHints(0);
              expect(res).toMatchObject({ attempts_remaining: 3 });
            });

            it("再開結果の開示済みのヒントは無しになる", async () => {
              const res = await scoreAndRequestHints(0);
              expect(res).toMatchObject({ hint: null });
            });
          });
        });
      });
    });

    describe("ヒントを1回要求済みのとき", () => {
      describe("進行中のクエストを再開すると", () => {
        describe("単体テスト", () => {
          describe("正常系", () => {
            it("再開結果の開示済みのヒントの残り挑戦回数は2回になる", async () => {
              const res = await scoreAndRequestHints(1);
              expect(res).toMatchObject({ hint: { attempts_remaining: 2 } });
            });
          });
        });
      });
    });

    describe("ヒントを2回要求済みのとき", () => {
      describe("進行中のクエストを再開すると", () => {
        describe("単体テスト", () => {
          describe("正常系", () => {
            it("再開結果の開示済みのヒントとして、技「たいあたり」が示される", async () => {
              const res = await scoreAndRequestHints(2);
              expect(res).toMatchObject({ hint: { moves: ["たいあたり"] } });
            });

            it("再開結果の開示済みのヒントの残り挑戦回数は1回になる", async () => {
              const res = await scoreAndRequestHints(2);
              expect(res).toMatchObject({ hint: { attempts_remaining: 1 } });
            });
          });
        });
      });
    });
  });

  describe("進行中のクエストを再開すると", () => {
    describe("単体テスト", () => {
      describe("正常系", () => {
        it.each<[string, (service: QuestService) => Promise<unknown>]>([
          [
            "採点済みで、名前当てに正解してハイパーボールが確定済みのとき",
            async (service) => {
              await service.scoreTranslation(USER_ID, "訳");
              await service.guessName(USER_ID, "bulbasaur");
            },
          ],
          [
            "採点済みで、名前当てをスキップしてモンスターボールが確定済みのとき",
            async (service) => {
              await service.scoreTranslation(USER_ID, "訳");
              await service.skipGuess(USER_ID);
            },
          ],
          [
            "採点前に名前当てに正解してハイパーボールが確定済みのとき",
            async (service) => {
              await service.guessName(USER_ID, "bulbasaur");
            },
          ],
        ])(
          "%s、再開結果の段階は捕獲待機になる",
          async (_situation, decideBall) => {
            const service = await startQuest();
            await decideBall(service);
            const res = await service.getCurrentQuest(USER_ID);
            expect(res).toMatchObject({ phase: "capturing" });
          },
        );

        it.each<[string, (service: QuestService) => Promise<unknown>]>([
          [
            "採点済みで、名前当てに正解してハイパーボールが確定済みのとき",
            async (service) => {
              await service.scoreTranslation(USER_ID, "訳");
              await service.guessName(USER_ID, "bulbasaur");
            },
          ],
          [
            "採点前に名前当てに正解してハイパーボールが確定済みのとき",
            async (service) => {
              await service.guessName(USER_ID, "bulbasaur");
            },
          ],
        ])(
          "%s、再開結果の確定済みのボールはハイパーボールになる",
          async (_situation, decideBall) => {
            const service = await startQuest();
            await decideBall(service);
            const res = await service.getCurrentQuest(USER_ID);
            expect(res).toMatchObject({ ball_type: "ultra" });
          },
        );

        it("採点済みで、名前当てをスキップしてモンスターボールが確定済みのとき、再開結果の確定済みのボールはモンスターボールになる", async () => {
          const service = await startScoredQuest();
          await service.skipGuess(USER_ID);
          const res = await service.getCurrentQuest(USER_ID);
          expect(res).toMatchObject({ ball_type: "poke" });
        });
      });
    });
  });

  describe("単体テスト", () => {
    describe("異常系", () => {
      it("進行中のクエストセッションがないとき、進行中のクエストを再開すると、クエストセッションが見つからないエラーになる", async () => {
        const service = makeService();
        await expect(service.getCurrentQuest("nobody")).rejects.toBeInstanceOf(
          NotFoundError,
        );
      });
    });
  });
});
