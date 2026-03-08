import levenshtein from "js-levenshtein";
import { NotFoundError, ExternalServiceError } from "../apperror/apperror.js";
import type { AIScorer, PokemonFetcher, UserSettingsRepository } from "../domain/interfaces.js";
import type { QuestSession, ChatContext, ChatMessage } from "../types/index.js";
import { defaultExcludedPokemonIDs } from "./pokeapi-service.js";

export interface QuestNewResponse {
  pokemon_id: number;
  description_en: string;
  is_legendary: boolean;
  is_mythical: boolean;
}

export interface ScoreResponse {
  score: number;
  review: string;
  description_ja: string;
}

export interface GuessResponse {
  correct: boolean;
  ball_type?: string;
  language?: string;
  fuzzy?: boolean;
  attempts_remaining: number;
  reveal_name_en?: string;
  reveal_name_ja?: string;
}

export interface CaptureResponse {
  captured: boolean;
  probability: number;
  pokemon_id: number;
  name_en: string;
  name_ja: string;
  sprite_url: string;
  score: number;
  description_en: string;
  description_ja: string;
  base_stat_total: number;
  ball_type: string;
  types: string[];
  height: number;
  weight: number;
  is_legendary: boolean;
  is_mythical: boolean;
}

export interface ChatRequest {
  context: ChatContext;
  messages: ChatMessage[];
}

export interface ChatResponse {
  reply: string;
}

export class QuestService {
  private pokemonFetcher: PokemonFetcher;
  private aiScorer: AIScorer;
  private settingsRepo: UserSettingsRepository;
  private sessions = new Map<string, QuestSession>();

  constructor(
    pokemonFetcher: PokemonFetcher,
    aiScorer: AIScorer,
    settingsRepo: UserSettingsRepository,
  ) {
    this.pokemonFetcher = pokemonFetcher;
    this.aiScorer = aiScorer;
    this.settingsRepo = settingsRepo;
  }

  async newQuest(uid: string): Promise<QuestNewResponse> {
    const excluded = new Set<number>();
    try {
      const settings = await this.settingsRepo.getSettings(uid);
      const ids = settings.excluded_pokemon_ids ?? defaultExcludedPokemonIDs;
      for (const id of ids) excluded.add(id);
    } catch { /* use empty set */ }

    let pokemon;
    for (let i = 0; i < 10; i++) {
      try {
        pokemon = await this.pokemonFetcher.getRandomPokemon();
      } catch (err) {
        throw new ExternalServiceError("PokeAPI", err as Error);
      }
      if (!excluded.has(pokemon.id)) break;
    }
    if (!pokemon) throw new ExternalServiceError("PokeAPI", new Error("failed to get pokemon"));

    let descEN = pokemon.description_en;
    let descJA = pokemon.description_ja;
    if (pokemon.flavor_texts && pokemon.flavor_texts.length > 0) {
      const pair = pokemon.flavor_texts[Math.floor(Math.random() * pokemon.flavor_texts.length)];
      descEN = pair.description_en;
      descJA = pair.description_ja;
    }

    const session: QuestSession = {
      pokemon_id: pokemon.id,
      description_en: descEN,
      description_ja: descJA,
      name_en: pokemon.name_en,
      name_ja: pokemon.name_ja,
      sprite_url: pokemon.sprite_url,
      base_stat_total: pokemon.base_stat_total,
      types: pokemon.types,
      height: pokemon.height,
      weight: pokemon.weight,
      is_legendary: pokemon.is_legendary,
      is_mythical: pokemon.is_mythical,
      score: 0,
      ball_type: "",
      guess_attempts: 0,
      name_guessed: false,
    };
    this.sessions.set(uid, session);

    return {
      pokemon_id: pokemon.id,
      description_en: maskPokemonNameEN(descEN, pokemon.name_en),
      is_legendary: pokemon.is_legendary,
      is_mythical: pokemon.is_mythical,
    };
  }

  async scoreTranslation(uid: string, translation: string): Promise<ScoreResponse> {
    const session = this.getSession(uid);

    let result;
    try {
      result = await this.aiScorer.scoreTranslation(session.description_en, translation);
    } catch (err) {
      throw new ExternalServiceError("Gemini", err as Error);
    }

    session.score = result.score;

    return {
      score: result.score,
      review: result.review,
      description_ja: maskPokemonNameJA(session.description_ja, session.name_ja),
    };
  }

  guessName(uid: string, guess: string): GuessResponse {
    const session = this.getSession(uid);

    if (session.name_guessed) {
      return { correct: true, ball_type: session.ball_type, attempts_remaining: 0 };
    }

    session.guess_attempts++;
    const guessNorm = guess.trim().toLowerCase();
    const nameENNorm = session.name_en.toLowerCase();
    const guessJA = guess.trim();

    if (guessNorm === nameENNorm) {
      session.ball_type = "ultra";
      session.name_guessed = true;
      return { correct: true, ball_type: "ultra", language: "en", attempts_remaining: 3 - session.guess_attempts };
    }

    if (guessJA === session.name_ja) {
      session.ball_type = "great";
      session.name_guessed = true;
      return { correct: true, ball_type: "great", language: "ja", attempts_remaining: 3 - session.guess_attempts };
    }

    if (nameENNorm.length > 3) {
      const dist = levenshtein(guessNorm, nameENNorm);
      if (dist <= 2) {
        session.ball_type = "ultra";
        session.name_guessed = true;
        return { correct: true, ball_type: "ultra", language: "en", fuzzy: true, attempts_remaining: 3 - session.guess_attempts };
      }
    }

    const remaining = 3 - session.guess_attempts;
    if (remaining <= 0) {
      session.ball_type = "poke";
      session.name_guessed = true;
      return { correct: false, attempts_remaining: 0, reveal_name_en: session.name_en, reveal_name_ja: session.name_ja };
    }

    return { correct: false, attempts_remaining: remaining };
  }

  attemptCapture(uid: string): CaptureResponse {
    const session = this.getSession(uid);

    let ballMultiplier = 1.0;
    if (session.ball_type === "great") ballMultiplier = 2.0;
    if (session.ball_type === "ultra") ballMultiplier = 3.0;

    const probability = calculateCaptureRate(session.score, session.base_stat_total, ballMultiplier);
    const captured = Math.random() < probability;

    this.sessions.delete(uid);

    return {
      captured,
      probability,
      pokemon_id: session.pokemon_id,
      name_en: session.name_en,
      name_ja: session.name_ja,
      sprite_url: session.sprite_url,
      score: session.score,
      description_en: session.description_en,
      description_ja: session.description_ja,
      base_stat_total: session.base_stat_total,
      ball_type: session.ball_type,
      types: session.types,
      height: session.height,
      weight: session.weight,
      is_legendary: session.is_legendary,
      is_mythical: session.is_mythical,
    };
  }

  private getSession(uid: string): QuestSession {
    const session = this.sessions.get(uid);
    if (!session) throw new NotFoundError("no active quest session");
    return session;
  }
}

export function calculateCaptureRate(score: number, bst: number, ballMultiplier: number): number {
  const x = bst / 100.0;
  const s = score / 100.0;

  const logit = 2.5 - 0.34 * x - 0.17 * x * x + 14.5 * s - 4.2 * x * s + 0.52 * x * x * s;
  let rate = 1.0 / (1.0 + Math.exp(-logit));

  rate *= ballMultiplier;
  if (rate > 1.0) rate = 1.0;
  return rate;
}

const pluralHints = new Set([
  "several", "many", "multiple", "few", "these", "those", "numerous",
]);

export function maskPokemonNameEN(text: string, name: string): string {
  if (!name) return text;

  const lower = text.toLowerCase();
  const lowerName = name.toLowerCase();
  let result = "";
  let i = 0;

  while (i < lower.length) {
    const idx = lower.indexOf(lowerName, i);
    if (idx === -1) {
      result += text.slice(i);
      break;
    }

    result += text.slice(i, idx);

    let plural = false;
    if (idx > 0) {
      const preceding = text.slice(0, idx).trimEnd();
      const spaceIdx = preceding.lastIndexOf(" ");
      const prevWord = (spaceIdx >= 0 ? preceding.slice(spaceIdx + 1) : preceding).toLowerCase();
      plural = pluralHints.has(prevWord);
    }

    let atStart = idx === 0;
    if (!atStart) {
      const before = text.slice(0, idx).trimEnd();
      if (before.length > 0 && ".!?".includes(before[before.length - 1])) {
        atStart = true;
      }
    }

    let replacement = plural ? "of these Pokémon" : "this Pokémon";
    if (atStart) {
      replacement = replacement[0].toUpperCase() + replacement.slice(1);
    }

    result += replacement;
    i = idx + lowerName.length;
  }

  return result;
}

export function maskPokemonNameJA(text: string, name: string): string {
  if (!name) return text;
  return text.replaceAll(name, "この ポケモン");
}
