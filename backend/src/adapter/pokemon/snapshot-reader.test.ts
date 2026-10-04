import { describe, it, expect } from "vitest";
import { createSnapshotReader } from "./snapshot-reader.js";

describe("[ポケモンデータ] スナップショットの読み込み元の選択", () => {
  describe("異常系", () => {
    it("読み込み元の指定が gs:// で始まり、バケット名だけでオブジェクトのパスが無いとき、オブジェクトのパスが無いことを示すエラーになる", () => {
      expect(() => createSnapshotReader("gs://bucket-only")).toThrow(/missing object path/);
    });
  });
});
