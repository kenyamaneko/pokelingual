export interface UserPokemon {
  pokemon_id: number;
  status: string;
  total_captures: number;
  total_encounters: number;
  last_captured_at: Date;
  last_encountered_at: Date;
  best_score: number;
}

export interface UserSettings {
  excluded_pokemon_ids: number[] | null;
}
