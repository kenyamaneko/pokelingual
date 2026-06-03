/** ユーザごとのポケモン実績レコード (図鑑エントリ)。Firestore 永続化対象。 */
export interface UserPokemon {
  pokemon_id: number;
  status: string;
  total_captures: number;
  total_encounters: number;
  /** 未捕獲なら null。Date 特殊値で未捕獲を表現しないため。 */
  last_captured_at: Date | null;
  last_encountered_at: Date;
  best_score: number;
}

/** ユーザ設定。Firestore 永続化対象。excluded_pokemon_ids が null なら未設定。 */
export interface UserSettings {
  excluded_pokemon_ids: number[] | null;
}
