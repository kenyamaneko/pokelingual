import { describe, it, expect } from "vitest";
import { buildExcludedPokemonIDs } from "./exclusion.js";

describe("[出題] 出題除外の決定", () => {
  it("ユーザー設定が未設定なら何も除外しない", () => {
    expect(buildExcludedPokemonIDs(null)).toEqual(new Set());
  });

  it("ユーザー設定で指定した ID を除外する", () => {
    expect(buildExcludedPokemonIDs([10, 20])).toEqual(new Set([10, 20]));
  });
});
