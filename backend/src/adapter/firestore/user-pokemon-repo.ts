import type { Firestore, DocumentData } from "@google-cloud/firestore";
import { Timestamp } from "@google-cloud/firestore";
import type { UserPokemonRepository } from "../../domain/ports.js";
import type { UserPokemon } from "../../domain/user.js";

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

      const existing = toUserPokemon(doc.data()!);
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

    return snapshot.docs.map((doc) => toUserPokemon(doc.data()));
  }

  /** 特定ポケモンのユーザ実績を取得する。未遭遇ならエラーを投げる。 */
  async getPokemon(uid: string, pokemonID: number): Promise<UserPokemon> {
    const doc = await this.db
      .collection("users").doc(uid)
      .collection("pokemon").doc(String(pokemonID))
      .get();

    if (!doc.exists) throw new Error(`pokemon not found: ${pokemonID}`);
    return toUserPokemon(doc.data()!);
  }
}

// Firestore は Date を Timestamp として永続化するため、読み出し時に Date へ戻す。
// 型定義 (UserPokemon) は Date を約束しているので、型と実体を揃えるために中央集約する。
function toUserPokemon(data: DocumentData): UserPokemon {
  return {
    pokemon_id: data.pokemon_id,
    status: data.status,
    total_captures: data.total_captures,
    total_encounters: data.total_encounters,
    last_captured_at: data.last_captured_at instanceof Timestamp ? data.last_captured_at.toDate() : null,
    last_encountered_at: (data.last_encountered_at as Timestamp).toDate(),
    best_score: data.best_score,
  };
}
