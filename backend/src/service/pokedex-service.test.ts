import { describe, it, expect } from "vitest";
import { PokedexService } from "./pokedex-service.js";
import { ExternalServiceError } from "../domain/errors.js";
import type {
  PokemonClient,
  PokemonConfig,
  UserPokemonRepository,
  UserSettingsRepository,
} from "../domain/ports.js";
import type { Pokemon } from "../domain/pokemon.js";
import type { UserPokemon } from "../domain/user.js";

// 依存 (Firestore リポジトリ / PokeAPI クライアント) は外部境界なのでポート経由のスタブで注入する。

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

/**
 * テスト用のダミー図鑑レコードを作る。
 * @param overrides 上書きするフィールド。
 * @returns ダミー図鑑レコード。
 */
function makeUserPokemon(overrides: Partial<UserPokemon> = {}): UserPokemon {
  return {
    pokemon_id: 1,
    status: "captured",
    total_captures: 2,
    total_encounters: 3,
    last_captured_at: null,
    last_encountered_at: new Date("2026-01-02T03:04:05Z"),
    best_score: 80,
    ...overrides,
  };
}

interface ServiceOverrides {
  /** リポジトリが返す図鑑レコード一覧。 */
  records?: UserPokemon[];
  /** メタ情報の取得が失敗するポケモン ID の集合。 */
  failingIDs?: number[];
  /** ユーザーが設定で除外した図鑑 ID。 */
  excludedIDs?: number[];
}

/**
 * スタブを注入した PokedexService を組み立てる。
 * @param o スタブの挙動の上書き。
 * @returns テスト対象のサービス。
 */
function makeService(o: ServiceOverrides = {}): PokedexService {
  const failing = new Set(o.failingIDs ?? []);
  const repo: UserPokemonRepository = {
    upsertEncounter: async () => {},
    getPokedex: async () => o.records ?? [],
    getPokemon: async (_userId, pokemonID) => {
      const found = (o.records ?? []).find((r) => r.pokemon_id === pokemonID);
      if (!found) throw new Error(`not found: ${pokemonID}`);
      return found;
    },
  };
  const pokemonClient: PokemonClient = {
    getPokemonByID: async (id) => {
      if (failing.has(id)) throw new Error("pokeapi down");
      // メタ情報を id ごとに区別可能にし、どの図鑑レコードにどのポケモンの情報が乗ったかを検証できるようにする。
      return makePokemon({
        id,
        name_en: `Testmon-${id}`,
        name_ja: `テストモン${id}`,
        sprite_url: `https://example.com/${id}.png`,
      });
    },
    // PokedexService は出題抽選を使わないため、提供 ID は空でよい (getPokemonByID のみ利用)。
    getServableIDs: () => [],
  };
  const settingsRepo: UserSettingsRepository = {
    getSettings: async () => ({ excluded_pokemon_ids: o.excludedIDs ?? null, enabled_generations: null }),
    updateExcludedPokemon: async () => {},
    updateEnabledGenerations: async () => {},
  };
  // 図鑑表示は環境非依存に確かめたいので prod (開発者除外なし) 固定。maxPokemonID は本サービスでは未使用のためダミー。
  const config: PokemonConfig = { maxPokemonID: 10, environment: "prod" };
  return new PokedexService(repo, pokemonClient, settingsRepo, config);
}

describe("PokedexService.getPokedex", () => {
  it("図鑑が 0 件なら空の一覧と unavailable_count=0 を返す", async () => {
    const res = await makeService().getPokedex("alice");
    expect(res.entries).toEqual([]);
    expect(res.unavailable_count).toBe(0);
  });

  it("1 件の図鑑レコードにポケモンのメタ情報を付与して返す", async () => {
    const service = makeService({
      records: [makeUserPokemon({ pokemon_id: 7, best_score: 90 })],
    });
    const res = await service.getPokedex("alice");
    expect(res.entries).toEqual([
      {
        pokemon_id: 7,
        name_en: "Testmon-7",
        name_ja: "テストモン7",
        sprite_url: "https://example.com/7.png",
        status: "captured",
        total_captures: 2,
        best_score: 90,
      },
    ]);
    expect(res.unavailable_count).toBe(0);
  });

  it("複数件の図鑑レコードそれぞれにメタ情報を付与し、順序を保って返す", async () => {
    const service = makeService({
      records: [
        makeUserPokemon({ pokemon_id: 7, status: "captured", total_captures: 5, best_score: 90 }),
        makeUserPokemon({ pokemon_id: 8, status: "seen", total_captures: 0, best_score: 40 }),
      ],
    });
    const res = await service.getPokedex("alice");
    expect(res.entries).toEqual([
      {
        pokemon_id: 7,
        name_en: "Testmon-7",
        name_ja: "テストモン7",
        sprite_url: "https://example.com/7.png",
        status: "captured",
        total_captures: 5,
        best_score: 90,
      },
      {
        pokemon_id: 8,
        name_en: "Testmon-8",
        name_ja: "テストモン8",
        sprite_url: "https://example.com/8.png",
        status: "seen",
        total_captures: 0,
        best_score: 40,
      },
    ]);
    expect(res.unavailable_count).toBe(0);
  });

  it("複数件中 1 件だけメタ情報の取得に失敗したら、成功分の一覧と unavailable_count=1 を返す", async () => {
    const service = makeService({
      records: [
        makeUserPokemon({ pokemon_id: 1 }),
        makeUserPokemon({ pokemon_id: 2 }),
        makeUserPokemon({ pokemon_id: 3 }),
      ],
      failingIDs: [2],
    });
    const res = await service.getPokedex("alice");
    expect(res.entries.map((e) => e.pokemon_id)).toEqual([1, 3]);
    expect(res.unavailable_count).toBe(1);
  });

  it("全件のメタ情報取得に失敗したら、空の一覧と全件分の unavailable_count を返す", async () => {
    const service = makeService({
      records: [makeUserPokemon({ pokemon_id: 1 }), makeUserPokemon({ pokemon_id: 2 })],
      failingIDs: [1, 2],
    });
    const res = await service.getPokedex("alice");
    expect(res.entries).toEqual([]);
    expect(res.unavailable_count).toBe(2);
  });

  it("ユーザーが除外に指定した図鑑 ID は一覧に含めない", async () => {
    const service = makeService({
      records: [
        makeUserPokemon({ pokemon_id: 1 }),
        makeUserPokemon({ pokemon_id: 2 }),
        makeUserPokemon({ pokemon_id: 3 }),
      ],
      excludedIDs: [2],
    });
    const res = await service.getPokedex("alice");
    expect(res.entries.map((e) => e.pokemon_id)).toEqual([1, 3]);
    expect(res.unavailable_count).toBe(0);
  });
});

describe("PokedexService.getPokemonDetail", () => {
  it("ユーザ実績とポケモン詳細を合成して返す (時刻は ISO 8601 文字列)", async () => {
    const service = makeService({
      records: [
        makeUserPokemon({
          pokemon_id: 7,
          last_captured_at: new Date("2026-03-04T05:06:07Z"),
          last_encountered_at: new Date("2026-03-05T06:07:08Z"),
        }),
      ],
    });
    const res = await service.getPokemonDetail("alice", 7);
    expect(res).toMatchObject({
      pokemon_id: 7,
      status: "captured",
      total_captures: 2,
      total_encounters: 3,
      last_captured_at: "2026-03-04T05:06:07.000Z",
      last_encountered_at: "2026-03-05T06:07:08.000Z",
      best_score: 80,
      name_en: "Testmon-7",
      name_ja: "テストモン7",
      types: ["normal"],
    });
  });

  it("未捕獲 (last_captured_at が null) なら null のまま返す", async () => {
    const service = makeService({
      records: [makeUserPokemon({ pokemon_id: 7, last_captured_at: null })],
    });
    const res = await service.getPokemonDetail("alice", 7);
    expect(res.last_captured_at).toBeNull();
  });

  it("ポケモン詳細の取得に失敗したら ExternalServiceError として伝わる", async () => {
    const service = makeService({
      records: [makeUserPokemon({ pokemon_id: 7 })],
      failingIDs: [7],
    });
    await expect(service.getPokemonDetail("alice", 7)).rejects.toBeInstanceOf(
      ExternalServiceError,
    );
  });
});
