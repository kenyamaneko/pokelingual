import type { Firestore } from "@google-cloud/firestore";
import type { UserPokemonRepository } from "../domain/interfaces.js";
import type { UserPokemon } from "../types/index.js";

export class UserPokemonRepo implements UserPokemonRepository {
  private db: Firestore;

  constructor(db: Firestore) {
    this.db = db;
  }

  async upsertEncounter(uid: string, pokemonID: number, score: number, captured: boolean): Promise<void> {
    const ref = this.db
      .collection("users").doc(uid)
      .collection("pokemon").doc(String(pokemonID));

    await this.db.runTransaction(async (tx) => {
      const doc = await tx.get(ref);

      if (!doc.exists) {
        const now = new Date();
        const data: UserPokemon = {
          pokemon_id: pokemonID,
          status: captured ? "captured" : "seen",
          total_captures: captured ? 1 : 0,
          total_encounters: 1,
          last_captured_at: captured ? now : new Date(0),
          last_encountered_at: now,
          best_score: score,
        };
        tx.set(ref, data);
        return;
      }

      const existing = doc.data() as UserPokemon;
      const now = new Date();

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

      tx.set(ref, existing);
    });
  }

  async getCollection(uid: string): Promise<UserPokemon[]> {
    const snapshot = await this.db
      .collection("users").doc(uid)
      .collection("pokemon")
      .orderBy("pokemon_id", "asc")
      .get();

    return snapshot.docs.map((doc) => doc.data() as UserPokemon);
  }

  async getPokemon(uid: string, pokemonID: number): Promise<UserPokemon> {
    const doc = await this.db
      .collection("users").doc(uid)
      .collection("pokemon").doc(String(pokemonID))
      .get();

    if (!doc.exists) throw new Error(`pokemon not found: ${pokemonID}`);
    return doc.data() as UserPokemon;
  }
}
