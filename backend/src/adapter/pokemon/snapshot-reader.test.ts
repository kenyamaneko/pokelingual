import { describe, it, expect } from "vitest";
import { createSnapshotReader } from "./snapshot-reader.js";

describe("[ポケモンデータ] スナップショットの読み込み元の選択", () => {
  it("gs:// でオブジェクトのパスが無いと、エラーになる", () => {
    expect(() => createSnapshotReader("gs://bucket-only")).toThrow(/missing object path/);
  });
});
