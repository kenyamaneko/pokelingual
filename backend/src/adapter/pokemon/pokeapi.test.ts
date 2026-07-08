import { describe, it, expect } from "vitest";
import { cleanFlavorText, PokeAPIClient } from "./pokeapi.js";
import type { HttpGet, PokemonConfig } from "../../domain/ports.js";

describe("cleanFlavorText", () => {
  it("改行・改ページ・復帰をスペースに置換する", () => {
    expect(cleanFlavorText("A\fB\nC\rD")).toBe("A B C D");
  });

  it("連続スペースを 1 つに畳み、前後をトリムする", () => {
    expect(cleanFlavorText("  A   B  ")).toBe("A B");
  });
});

/**
 * PokeAPI の species / pokemon エンドポイントを模した fake トランスポートを注入したクライアントを組み立てる。
 * @param typeNames pokemon エンドポイントが返すタイプ名の一覧。
 * @returns テスト対象のクライアント。
 */
function makeClientWithTypes(typeNames: string[]): PokeAPIClient {
  const speciesBody = {
    id: 1,
    is_legendary: false,
    is_mythical: false,
    names: [
      { name: "Testmon", language: { name: "en" } },
      { name: "テストモン", language: { name: "ja" } },
    ],
    flavor_text_entries: [
      { flavor_text: "Fast.", language: { name: "en" }, version: { name: "x" } },
      { flavor_text: "はやい。", language: { name: "ja" }, version: { name: "x" } },
    ],
  };
  const pokemonBody = {
    sprites: {
      front_default: "https://example.com/front.png",
      other: { "official-artwork": { front_default: "https://example.com/artwork.png" } },
    },
    stats: [{ base_stat: 100 }],
    types: typeNames.map((name) => ({ type: { name } })),
    height: 4,
    weight: 60,
  };
  // HTTP トランスポート (外部境界) を fake に差し替えて注入する
  const httpGet: HttpGet = async (url) => ({
    ok: true,
    status: 200,
    json: async () => (url.includes("pokemon-species") ? speciesBody : pokemonBody),
  });
  const config: PokemonConfig = { maxPokemonID: 10, environment: "prod" };
  return new PokeAPIClient(config, httpGet);
}

describe("タイプ名の実行時検証 (PokeAPI 境界)", () => {
  it("既知のタイプ名は受理され types に反映される", async () => {
    const pokemon = await makeClientWithTypes(["grass", "poison"]).getPokemonByID(1);
    expect(pokemon.types).toEqual(["grass", "poison"]);
  });

  it("未知のタイプ名はエラーにする (意図しない値のまま通さない)", async () => {
    await expect(makeClientWithTypes(["shadow"]).getPokemonByID(1)).rejects.toThrow(
      /unknown pokemon type/,
    );
  });
});

/**
 * このデータソースは 1..maxPokemonID の図鑑番号を提供する (抽選はサービス側が行う)。
 */
describe("PokeAPIClient.getServableIDs", () => {
  it("1 から maxPokemonID までの図鑑番号を提供する", () => {
    const ids = makeClientWithTypes(["normal"]).getServableIDs();
    expect(ids).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});

/**
 * /type/{name} のレスポンスから、指定タイプのポケモンの図鑑番号を取り出す。
 */
describe("PokeAPIClient.getIDsByType", () => {
  it("指定タイプの図鑑番号を上限内で返す (URL から ID を取り出す)", async () => {
    const httpGet: HttpGet = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        pokemon: [
          { pokemon: { url: "https://pokeapi.co/api/v2/pokemon/25/" } },
          { pokemon: { url: "https://pokeapi.co/api/v2/pokemon/500/" } },
          { pokemon: { url: "https://pokeapi.co/api/v2/pokemon/6/" } },
        ],
      }),
    });
    const client = new PokeAPIClient({ maxPokemonID: 100, environment: "prod" }, httpGet);
    // 500 は上限 (100) を超えるので除外される
    expect(await client.getIDsByType("electric")).toEqual([25, 6]);
  });
});
