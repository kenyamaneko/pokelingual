import { describe, it, expect } from "vitest";
import { createSnapshotReader } from "./snapshot-reader.js";

describe("[本体:ポケモンデータ]スナップショットの読み込み元の選択", () => {
  describe("単体テスト", () => {
    describe("異常系", () => {
      it("読み込み元の指定が「gs://bucket-only」(バケット名だけでオブジェクトのパスが無い) のとき、読み込み元を選ぶと、オブジェクトのパスが無いことを示すエラーになる", () => {
        expect(() => createSnapshotReader("gs://bucket-only")).toThrow(/missing object path/);
      });
    });
  });
});
