import type {
  ScoreResult,
  ChatContext,
  ChatMessage,
  Pokemon,
  UserPokemon,
  UserSettings,
} from "../types/index.js";

export interface AIScorer {
  scoreTranslation(englishText: string, japaneseTranslation: string): Promise<ScoreResult>;
  chat(chatCtx: ChatContext, messages: ChatMessage[]): Promise<string>;
}

export interface PokemonFetcher {
  getRandomPokemon(): Promise<Pokemon>;
  getPokemonByID(id: number): Promise<Pokemon>;
}

export interface UserPokemonRepository {
  upsertEncounter(uid: string, pokemonID: number, score: number, captured: boolean): Promise<void>;
  getCollection(uid: string): Promise<UserPokemon[]>;
  getPokemon(uid: string, pokemonID: number): Promise<UserPokemon>;
}

export interface UserSettingsRepository {
  getSettings(uid: string): Promise<UserSettings>;
  updateExcludedPokemon(uid: string, pokemonIDs: number[]): Promise<void>;
}
