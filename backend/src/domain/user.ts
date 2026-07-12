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

/** ユーザ設定。Firestore 永続化対象。各フィールドは null なら未設定。 */
export interface UserSettings {
  excluded_pokemon_ids: number[] | null;
  /** 出題対象の世代。null なら未設定 (= 全世代)。 */
  enabled_generations: number[] | null;
}

/** ユーザ本体 (users/{uid} ルートドキュメント)。Firestore 永続化対象。 */
export interface User {
  tutorial_completed: boolean;
}
