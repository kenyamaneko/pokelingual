import { describe, expect } from "vitest";
import { createSnapshotReader } from "./snapshot-reader.js";
import { defineCase } from "../../test/defineCase.js";

describe("[本体:ポケモンデータ]スナップショットの読み込み元の選択", () => {
  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      steps: [
        {
          Given: "読み込み元の指定が「gs://bucket-only」(バケット名だけでオブジェクトのパスが無い) のとき",
          When: ["読み込み元を選ぶ"],
          Then: "オブジェクトのパスが無いことを示すエラーになる",
        },
      ],
    },
    () => {
      expect(() => createSnapshotReader("gs://bucket-only")).toThrow(/missing object path/);
    },
  );
});
