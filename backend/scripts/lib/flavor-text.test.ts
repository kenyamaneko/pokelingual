import { describe, expect } from "vitest";
import { buildFlavorTextPairs } from "./flavor-text.js";
import type { FlavorTextSource } from "./flavor-text.js";
import { defineCase, type Viewpoint } from "../../src/test/defineCase.js";

function entry(version: string, language: string, text: string): FlavorTextSource {
  return { version, language, text };
}

const BUILD_PAIRS = "英日説明文ペアの一覧を構築する";

describe("[外部連携:ポケモンデータ提供元]英日説明文ペアの構築", () => {
  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "バージョン X の英語の説明文「A strange seed was planted on its back at birth. The plant sprouts and grows with this Pokémon.」と日本語の説明文「生まれたときから　背中に 不思議な　タネが　植えてあって 体と　ともに　育つという。」が揃っているとき",
          When: [BUILD_PAIRS],
          Then: "説明文ペアの一覧は、バージョン名 X・英語「A strange seed was planted on its back at birth. The plant sprouts and grows with this Pokémon.」・日本語「生まれたときから　背中に 不思議な　タネが　植えてあって 体と　ともに　育つという。」の 1 組になる",
        },
      ],
    },
    () => {
      const pairs = buildFlavorTextPairs([entry("x", "en", "A strange seed was planted on its back at birth. The plant sprouts and grows with this Pokémon."), entry("x", "ja", "生まれたときから　背中に 不思議な　タネが　植えてあって 体と　ともに　育つという。")]);
      expect(pairs).toEqual([
        { version_names: ["X"], description_en: "A strange seed was planted on its back at birth. The plant sprouts and grows with this Pokémon.", description_ja: "生まれたときから　背中に 不思議な　タネが　植えてあって 体と　ともに　育つという。" },
      ]);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "同じバージョンに、通常表記の日本語の説明文「生まれたときから　背中に 不思議な　タネが　植えてあって 体と　ともに　育つという。」とかな表記の日本語の説明文「うまれたときから　せなかに ふしぎな　タネが　うえてあって からだと　ともに　そだつという。」が両方あるとき",
          When: [BUILD_PAIRS],
          Then: "説明文ペアの日本語の説明文は「生まれたときから　背中に 不思議な　タネが　植えてあって 体と　ともに　育つという。」になる",
        },
      ],
    },
    () => {
      const pairs = buildFlavorTextPairs([
        entry("x", "en", "A strange seed was planted on its back at birth. The plant sprouts and grows with this Pokémon."),
        entry("x", "ja-Hrkt", "うまれたときから　せなかに ふしぎな　タネが　うえてあって からだと　ともに　そだつという。"),
        entry("x", "ja", "生まれたときから　背中に 不思議な　タネが　植えてあって 体と　ともに　育つという。"),
      ]);
      expect(pairs[0].description_ja).toBe("生まれたときから　背中に 不思議な　タネが　植えてあって 体と　ともに　育つという。");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "通常表記の日本語の説明文が無く、かな表記の日本語の説明文「うまれたときから　せなかに ふしぎな　タネが　うえてあって からだと　ともに　そだつという。」だけがあるとき",
          When: [BUILD_PAIRS],
          Then: "説明文ペアの日本語の説明文は「うまれたときから　せなかに ふしぎな　タネが　うえてあって からだと　ともに　そだつという。」になる",
        },
      ],
    },
    () => {
      const pairs = buildFlavorTextPairs([entry("x", "en", "A strange seed was planted on its back at birth. The plant sprouts and grows with this Pokémon."), entry("x", "ja-Hrkt", "うまれたときから　せなかに ふしぎな　タネが　うえてあって からだと　ともに　そだつという。")]);
      expect(pairs[0].description_ja).toBe("うまれたときから　せなかに ふしぎな　タネが　うえてあって からだと　ともに　そだつという。");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "バージョン X と Y の英語の説明文が「A strange seed was planted on its back at birth. The plant sprouts and grows with this Pokémon.」、日本語の説明文が「生まれたときから　背中に 不思議な　タネが　植えてあって 体と　ともに　育つという。」でそれぞれ同じとき",
          When: [BUILD_PAIRS],
          Then: "説明文ペアの一覧は、バージョン名 X・Y をまとめた 1 組になる",
        },
      ],
    },
    () => {
      const pairs = buildFlavorTextPairs([
        entry("x", "en", "A strange seed was planted on its back at birth. The plant sprouts and grows with this Pokémon."),
        entry("x", "ja", "生まれたときから　背中に 不思議な　タネが　植えてあって 体と　ともに　育つという。"),
        entry("y", "en", "A strange seed was planted on its back at birth. The plant sprouts and grows with this Pokémon."),
        entry("y", "ja", "生まれたときから　背中に 不思議な　タネが　植えてあって 体と　ともに　育つという。"),
      ]);
      expect(pairs).toHaveLength(1);
      expect(pairs[0].version_names).toEqual(["X", "Y"]);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "説明文がソード、X の順に並んでいるとき",
          When: [BUILD_PAIRS],
          Then: "説明文ペアの一覧は X、ソードの順に並ぶ",
        },
      ],
    },
    () => {
      const pairs = buildFlavorTextPairs([
        entry("sword", "en", "While it is young, it uses the nutrients that are stored in the seed on its back in order to grow."),
        entry("sword", "ja", "生まれてから　しばらくの　あいだは 背中の　タネから　栄養を　もらって 大きく　育つ。"),
        entry("x", "en", "A strange seed was planted on its back at birth. The plant sprouts and grows with this POKéMON."),
        entry("x", "ja", "うまれたときから　せなかに ふしぎな　タネが　うえてあって からだと　ともに　そだつという。"),
      ]);
      expect(pairs.map((p) => p.version_names[0])).toEqual(["X", "ソード"]);
    },
  );

  const EMPTY_PAIRS_CASES: { given: string; entries: FlavorTextSource[]; 観点: readonly Viewpoint[] }[] = [
    {
      given: "図鑑に表示しないバージョン red の英語の説明文「A strange seed was planted on its back at birth. The plant sprouts and grows with this POKéMON.」と日本語の説明文「うまれたときから　せなかに ふしぎな　タネが　うえてあって からだと　ともに　そだつという。」だけがあるとき",
      entries: [entry("red", "en", "A strange seed was planted on its back at birth. The plant sprouts and grows with this POKéMON."), entry("red", "ja", "うまれたときから　せなかに ふしぎな　タネが　うえてあって からだと　ともに　そだつという。")],
      観点: [],
    },
    {
      given: "バージョン X に日本語の説明文「生まれたときから　背中に 不思議な　タネが　植えてあって 体と　ともに　育つという。」だけがあるとき",
      entries: [entry("x", "ja", "生まれたときから　背中に 不思議な　タネが　植えてあって 体と　ともに　育つという。")],
      観点: ["件数・有無", "エッジケース"],
    },
    {
      given: "バージョン X に英語の説明文「A strange seed was planted on its back at birth. The plant sprouts and grows with this Pokémon.」だけがあるとき",
      entries: [entry("x", "en", "A strange seed was planted on its back at birth. The plant sprouts and grows with this Pokémon.")],
      観点: ["件数・有無", "エッジケース"],
    },
    { given: "説明文が 1 件も無いとき", entries: [], 観点: ["件数・有無", "エッジケース"] },
  ];

  for (const { given, entries, 観点 } of EMPTY_PAIRS_CASES) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "正常系",
        観点,
        steps: [{ Given: given, When: [BUILD_PAIRS], Then: "説明文ペアの一覧は空になる" }],
      },
      () => {
        expect(buildFlavorTextPairs([...entries])).toEqual([]);
      },
    );
  }
});
