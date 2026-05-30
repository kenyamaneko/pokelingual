import type { Firestore } from "@google-cloud/firestore";
import type { UserPokemonRepository } from "../domain/interfaces.js";
import type { UserPokemon } from "../types/index.js";

/** ユーザの図鑑進捗を Firestore に永続化する UserPokemonRepository 実装。 */
export class UserPokemonRepo implements UserPokemonRepository {
  private db: Firestore;

  constructor(db: Firestore) {
    this.db = db;
  }

  /** 遭遇/捕獲を 1 件記録する。既存ドキュメントがあれば集計値を更新する。 */
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
          last_captured_at: captured ? now : null,
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

  /** ユーザが遭遇したポケモン一覧をポケモンID昇順で返す。 */
  async getCollection(uid: string): Promise<UserPokemon[]> {
    const snapshot = await this.db
      .collection("users").doc(uid)
      .collection("pokemon")
      .orderBy("pokemon_id", "asc")
      .get();

    return snapshot.docs.map((doc) => doc.data() as UserPokemon);
  }

  /** 特定ポケモンのユーザ実績を取得する。未遭遇ならエラーを投げる。 */
  async getPokemon(uid: string, pokemonID: number): Promise<UserPokemon> {
    const doc = await this.db
      .collection("users").doc(uid)
      .collection("pokemon").doc(String(pokemonID))
      .get();

    if (!doc.exists) throw new Error(`pokemon not found: ${pokemonID}`);
    return doc.data() as UserPokemon;
  }
}
