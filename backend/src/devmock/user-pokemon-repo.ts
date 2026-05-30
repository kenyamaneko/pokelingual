import type { UserPokemonRepository } from "../domain/interfaces.js";
import type { UserPokemon } from "../types/index.js";

/** ローカル開発用のインメモリ UserPokemonRepository 実装。 */
export class MockUserPokemonRepo implements UserPokemonRepository {
  private data = new Map<string, Map<number, UserPokemon>>();

  async upsertEncounter(uid: string, pokemonID: number, score: number, captured: boolean): Promise<void> {
    if (!this.data.has(uid)) this.data.set(uid, new Map());
    const userMap = this.data.get(uid)!;

    const now = new Date();
    const existing = userMap.get(pokemonID);

    if (!existing) {
      userMap.set(pokemonID, {
        pokemon_id: pokemonID,
        status: captured ? "captured" : "seen",
        total_captures: captured ? 1 : 0,
        total_encounters: 1,
        last_captured_at: captured ? now : null,
        last_encountered_at: now,
        best_score: score,
      });
      return;
    }

    existing.total_encounters++;
    existing.last_encountered_at = now;
    if (captured) {
      existing.total_captures++;
      existing.status = "captured";
      existing.last_captured_at = now;
    }
    if (score > existing.best_score) {
      existing.best_score = score;
    }
  }

  async getCollection(uid: string): Promise<UserPokemon[]> {
    const userMap = this.data.get(uid);
    if (!userMap) return [];
    return [...userMap.values()].sort((a, b) => a.pokemon_id - b.pokemon_id);
  }

  async getPokemon(uid: string, pokemonID: number): Promise<UserPokemon> {
    const userMap = this.data.get(uid);
    const pokemon = userMap?.get(pokemonID);
    if (!pokemon) throw new Error("pokemon not found");
    return pokemon;
  }
}
