import { describe, it, expect, beforeEach } from "vitest";
import { UserPokemonRepo } from "./user-pokemon-repo.js";
import { requireFirestoreEmulator, clearFirestoreEmulator } from "./firestore-emulator-helper.js";

const db = requireFirestoreEmulator();

describe("UserPokemonRepo (Firestore emulator)", () => {
  beforeEach(clearFirestoreEmulator);

  it("未遭遇のポケモンに対する upsert は seen として記録される", async () => {
    const repo = new UserPokemonRepo(db);
    await repo.upsertEncounter("alice", 25, 70, false);

    const pokemon = await repo.getPokemon("alice", 25);
    expect(pokemon.pokemon_id).toBe(25);
    expect(pokemon.status).toBe("seen");
    expect(pokemon.total_encounters).toBe(1);
    expect(pokemon.total_captures).toBe(0);
    expect(pokemon.best_score).toBe(70);
    expect(pokemon.last_captured_at).toBeNull();
    expect(pokemon.last_encountered_at).toBeInstanceOf(Date);
  });

  it("未遭遇のポケモンに対する captured=true の upsert は captured として記録される", async () => {
    const repo = new UserPokemonRepo(db);
    await repo.upsertEncounter("alice", 25, 90, true);

    const pokemon = await repo.getPokemon("alice", 25);
    expect(pokemon.status).toBe("captured");
    expect(pokemon.total_encounters).toBe(1);
    expect(pokemon.total_captures).toBe(1);
    expect(pokemon.best_score).toBe(90);
    expect(pokemon.last_captured_at).toBeInstanceOf(Date);
  });

  it("seen のあとの seen upsert で total_encounters のみ増える", async () => {
    const repo = new UserPokemonRepo(db);
    await repo.upsertEncounter("alice", 25, 70, false);
    await repo.upsertEncounter("alice", 25, 60, false);

    const pokemon = await repo.getPokemon("alice", 25);
    expect(pokemon.status).toBe("seen");
    expect(pokemon.total_encounters).toBe(2);
    expect(pokemon.total_captures).toBe(0);
  });

  it("seen のあとの captured upsert で status が captured に昇格する", async () => {
    const repo = new UserPokemonRepo(db);
    await repo.upsertEncounter("alice", 25, 70, false);
    await repo.upsertEncounter("alice", 25, 95, true);

    const pokemon = await repo.getPokemon("alice", 25);
    expect(pokemon.status).toBe("captured");
    expect(pokemon.total_encounters).toBe(2);
    expect(pokemon.total_captures).toBe(1);
    expect(pokemon.last_captured_at).toBeInstanceOf(Date);
  });

  it("captured のあとの seen upsert でも status は captured のまま", async () => {
    const repo = new UserPokemonRepo(db);
    await repo.upsertEncounter("alice", 25, 95, true);
    await repo.upsertEncounter("alice", 25, 50, false);

    const pokemon = await repo.getPokemon("alice", 25);
    expect(pokemon.status).toBe("captured");
    expect(pokemon.total_encounters).toBe(2);
    expect(pokemon.total_captures).toBe(1);
  });

  it("best_score は過去最高値のみ更新する", async () => {
    const repo = new UserPokemonRepo(db);
    await repo.upsertEncounter("alice", 25, 80, false);
    await repo.upsertEncounter("alice", 25, 60, false);
    await repo.upsertEncounter("alice", 25, 90, true);
    await repo.upsertEncounter("alice", 25, 70, false);

    const pokemon = await repo.getPokemon("alice", 25);
    expect(pokemon.best_score).toBe(90);
  });

  it("getPokedex は pokemon_id 昇順で返す", async () => {
    const repo = new UserPokemonRepo(db);
    await repo.upsertEncounter("alice", 150, 80, true);
    await repo.upsertEncounter("alice", 1, 70, false);
    await repo.upsertEncounter("alice", 25, 90, true);

    const pokedex = await repo.getPokedex("alice");
    expect(pokedex.map((p) => p.pokemon_id)).toEqual([1, 25, 150]);
  });

  it("未遭遇ユーザーの getPokedex は空配列", async () => {
    const repo = new UserPokemonRepo(db);
    const pokedex = await repo.getPokedex("newcomer");
    expect(pokedex).toEqual([]);
  });

  it("あるユーザーの記録は別ユーザーから見えない", async () => {
    const repo = new UserPokemonRepo(db);
    await repo.upsertEncounter("alice", 25, 90, true);

    const bobPokedex = await repo.getPokedex("bob");
    expect(bobPokedex).toEqual([]);
  });

  it("未遭遇ポケモンへの getPokemon はエラー", async () => {
    const repo = new UserPokemonRepo(db);
    await expect(repo.getPokemon("alice", 25)).rejects.toThrow();
  });
});
