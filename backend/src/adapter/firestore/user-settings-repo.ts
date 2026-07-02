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
   * @param uid ユーザ ID。
   * @returns users/{uid}/settings/preferences への DocumentReference。
   */
  private settingsRef(uid: string) {
    return this.db.collection("users").doc(uid).collection("settings").doc("preferences");
  }

  /**
   * ユーザ設定を取得する。未保存なら excluded_pokemon_ids が null の値を返す。
   * @param uid ユーザ ID。
   * @returns ユーザ設定。
   */
  async getSettings(uid: string): Promise<UserSettings> {
    const doc = await this.settingsRef(uid).get();
    if (!doc.exists) {
      return { excluded_pokemon_ids: null };
    }
    const data = doc.data() as UserSettings;
    return data;
  }

  /**
   * 除外ポケモンID リストを上書き保存する。
   * @param uid ユーザ ID。
   * @param pokemonIDs 除外するポケモン ID の配列。
   */
  async updateExcludedPokemon(uid: string, pokemonIDs: number[]): Promise<void> {
    await this.settingsRef(uid).set(
      { excluded_pokemon_ids: pokemonIDs },
      { merge: true },
    );
  }
}
