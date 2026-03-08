import type { Firestore } from "@google-cloud/firestore";
import type { UserSettingsRepository } from "../domain/interfaces.js";
import type { UserSettings } from "../types/index.js";

export class UserSettingsRepo implements UserSettingsRepository {
  private db: Firestore;

  constructor(db: Firestore) {
    this.db = db;
  }

  private settingsRef(uid: string) {
    return this.db.collection("users").doc(uid).collection("settings").doc("preferences");
  }

  async getSettings(uid: string): Promise<UserSettings> {
    const doc = await this.settingsRef(uid).get();
    if (!doc.exists) {
      return { excluded_pokemon_ids: null };
    }
    const data = doc.data() as UserSettings;
    return data;
  }

  async updateExcludedPokemon(uid: string, pokemonIDs: number[]): Promise<void> {
    await this.settingsRef(uid).set(
      { excluded_pokemon_ids: pokemonIDs },
      { merge: true },
    );
  }
}
