import { describe, it, expect, beforeEach } from "vitest";
import { UserPokemonRepo } from "./user-pokemon-repo.js";
import { requireFirestoreEmulator, clearFirestoreEmulator } from "./firestore-emulator-helper.js";

const db = requireFirestoreEmulator();

describe("図鑑記録の保存", () => {
  beforeEach(clearFirestoreEmulator);

  it("初めて遭遇したポケモンは、遭遇済みとして記録される", async () => {
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

  it("初めて捕獲したポケモンは、捕獲済みとして記録される", async () => {
    const repo = new UserPokemonRepo(db);
    await repo.upsertEncounter("alice", 25, 90, true);

    const pokemon = await repo.getPokemon("alice", 25);
    expect(pokemon.status).toBe("captured");
    expect(pokemon.total_encounters).toBe(1);
    expect(pokemon.total_captures).toBe(1);
    expect(pokemon.best_score).toBe(90);
    expect(pokemon.last_captured_at).toBeInstanceOf(Date);
  });

  it("遭遇済みのポケモンに再度遭遇すると、遭遇回数だけが増える", async () => {
    const repo = new UserPokemonRepo(db);
    await repo.upsertEncounter("alice", 25, 70, false);
    await repo.upsertEncounter("alice", 25, 60, false);

    const pokemon = await repo.getPokemon("alice", 25);
    expect(pokemon.status).toBe("seen");
    expect(pokemon.total_encounters).toBe(2);
    expect(pokemon.total_captures).toBe(0);
  });

  it("遭遇済みのポケモンを捕獲すると、記録が捕獲済みに昇格する", async () => {
    const repo = new UserPokemonRepo(db);
    await repo.upsertEncounter("alice", 25, 70, false);
    await repo.upsertEncounter("alice", 25, 95, true);

    const pokemon = await repo.getPokemon("alice", 25);
    expect(pokemon.status).toBe("captured");
    expect(pokemon.total_encounters).toBe(2);
    expect(pokemon.total_captures).toBe(1);
    expect(pokemon.last_captured_at).toBeInstanceOf(Date);
  });

  it("捕獲済みのポケモンに再度遭遇しても、捕獲済みのまま変わらない", async () => {
    const repo = new UserPokemonRepo(db);
    await repo.upsertEncounter("alice", 25, 95, true);
    await repo.upsertEncounter("alice", 25, 50, false);

    const pokemon = await repo.getPokemon("alice", 25);
    expect(pokemon.status).toBe("captured");
    expect(pokemon.total_encounters).toBe(2);
    expect(pokemon.total_captures).toBe(1);
  });

  it("採点スコアが過去最高を上回ったときだけ、図鑑の最高スコアが更新される", async () => {
    const repo = new UserPokemonRepo(db);
    await repo.upsertEncounter("alice", 25, 80, false);
    await repo.upsertEncounter("alice", 25, 60, false);
    await repo.upsertEncounter("alice", 25, 90, true);
    await repo.upsertEncounter("alice", 25, 70, false);

    const pokemon = await repo.getPokemon("alice", 25);
    expect(pokemon.best_score).toBe(90);
  });

  it("登録した図鑑記録は図鑑番号の昇順で返る", async () => {
    const repo = new UserPokemonRepo(db);
    await repo.upsertEncounter("alice", 150, 80, true);
    await repo.upsertEncounter("alice", 1, 70, false);
    await repo.upsertEncounter("alice", 25, 90, true);

    const pokedex = await repo.getPokedex("alice");
    expect(pokedex.map((p) => p.pokemon_id)).toEqual([1, 25, 150]);
  });

  it("まだ何も記録していないユーザーの図鑑は空配列になる", async () => {
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

  it("未遭遇のポケモンの記録を取得しようとすると、エラーになる", async () => {
    const repo = new UserPokemonRepo(db);
    await expect(repo.getPokemon("alice", 25)).rejects.toThrow();
  });
});
