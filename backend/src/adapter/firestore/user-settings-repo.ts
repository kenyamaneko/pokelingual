import type { Firestore } from "@google-cloud/firestore";
import type { UserSettingsRepository } from "../../domain/ports.js";
import type { UserSettings } from "../../domain/user.js";

/** ユーザ設定 (除外ポケモン等) を Firestore に永続化する UserSettingsRepository 実装。 */
export class UserSettingsRepo implements UserSettingsRepository {
  private db: Firestore;

  /**
   * @param db Firestore クライアント。
   */
  constructor(db: Firestore) {
    this.db = db;
  }

  /**
   * ユーザ設定ドキュメントへの参照を返す。
   * @param userId ユーザ ID。
   * @returns users/{userId}/settings/preferences への DocumentReference。
   */
  private getSettingsRef(userId: string) {
    return this.db.collection("users").doc(userId).collection("settings").doc("preferences");
  }

  /**
   * ユーザ設定を取得する。未保存なら excluded_pokemon_ids が null の値を返す。
   * @param userId ユーザ ID。
   * @returns ユーザ設定。
   */
  async getSettings(userId: string): Promise<UserSettings> {
    const doc = await this.getSettingsRef(userId).get();
    if (!doc.exists) {
      return { excluded_pokemon_ids: null };
    }
    const data = doc.data() as UserSettings;
    return data;
  }

  /**
   * 除外ポケモンID リストを上書き保存する。
   * @param userId ユーザ ID。
   * @param pokemonIDs 除外するポケモン ID の配列。
   */
  async updateExcludedPokemon(userId: string, pokemonIDs: number[]): Promise<void> {
    await this.getSettingsRef(userId).set(
      { excluded_pokemon_ids: pokemonIDs },
      { merge: true },
    );
  }
}
