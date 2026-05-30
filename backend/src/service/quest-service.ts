import levenshtein from "js-levenshtein";
import { NotFoundError, ExternalServiceError } from "../apperror/apperror.js";
import type { AIScorer, PokemonFetcher, UserSettingsRepository } from "../domain/interfaces.js";
import type { Pokemon, QuestSession, ChatContext, ChatMessage } from "../types/index.js";

/**
 * 出題抽選のリトライ上限。除外設定の最大数 (MAX_EXCLUDED_POKEMON_COUNT) と
 * maxPokemonID の関係から、この回数で実質衝突確率はゼロに収束する。
 */
const MAX_RANDOM_PICK_RETRY = 10;

/** ポケモン名推測の最大試行回数。これを超えるとポケボール固定での捕獲フェーズへ。 */
const MAX_NAME_GUESS_ATTEMPTS = 3;

/** Levenshtein あいまい一致を有効化する英語名の最小文字数。短い名前は誤検出が増えるため除外。 */
const FUZZY_MATCH_MIN_NAME_LENGTH = 3;

/** Levenshtein 距離がこの値以下なら正解扱い (タイプミス許容)。 */
const FUZZY_MATCH_MAX_DISTANCE = 2;

/** ボール種別ごとの捕獲確率倍率。great=英語名正解、ultra=日本語名正解、poke=不正解。 */
const BALL_MULTIPLIER: Record<string, number> = {
  poke: 1.0,
  great: 2.0,
  ultra: 3.0,
};

/** 新しい出題ポケモンのレスポンス。ポケモン名はマスク済みの説明文を含む。 */
export interface QuestNewResponse {
  pokemon_id: number;
  description_en: string;
  is_legendary: boolean;
  is_mythical: boolean;
}

/** 翻訳採点結果。スコア・講評・日本語版説明 (マスク済み) を返す。 */
export interface ScoreResponse {
  score: number;
  review: string;
  description_ja: string;
}

/** 名前推測の判定結果。正解時は付与ボール種別、不正解時は残り試行回数を返す。 */
export interface GuessResponse {
  correct: boolean;
  ball_type?: string;
  language?: string;
  fuzzy?: boolean;
  attempts_remaining: number;
  reveal_name_en?: string;
  reveal_name_ja?: string;
}

/** 捕獲試行結果。捕獲成否と表示用のポケモン情報を含む。 */
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

/** オーキド博士チャットへのリクエスト。会話履歴と現クエストのコンテキストを含む。 */
export interface ChatRequest {
  context: ChatContext;
  messages: ChatMessage[];
}

/** オーキド博士チャットのレスポンス。 */
export interface ChatResponse {
  reply: string;
}

/**
 * クエストの出題・採点・名前推測・捕獲のドメインロジックを束ねるサービス。
 * セッションはユーザ uid ごとにメモリ保持する。
 */
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

  /** 出題ポケモンを抽選してセッションを開始し、マスク済み説明文を返す。 */
  async newQuest(uid: string): Promise<QuestNewResponse> {
    const settings = await this.settingsRepo.getSettings(uid);
    const ids = settings.excluded_pokemon_ids ?? this.pokemonFetcher.getDefaultExcludedPokemonIDs();
    const excluded = new Set<number>(ids);

    let pokemon: Pokemon | undefined;
    for (let i = 0; i < MAX_RANDOM_PICK_RETRY; i++) {
      let candidate: Pokemon;
      try {
        candidate = await this.pokemonFetcher.getRandomPokemon();
      } catch (err) {
        throw new ExternalServiceError("PokeAPI", err as Error);
      }
      if (!excluded.has(candidate.id)) {
        pokemon = candidate;
        break;
      }
    }
    if (!pokemon) {
      throw new Error(`failed to pick non-excluded pokemon after ${MAX_RANDOM_PICK_RETRY} attempts (excluded=${excluded.size})`);
    }

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

  /** AIScorer で翻訳を採点し、結果をセッションへ記録する。 */
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

  /** 名前推測を判定し、正解ならボール種別を確定、不正解なら残り試行を返す。 */
  guessName(uid: string, guess: string): GuessResponse {
    const session = this.getSession(uid);

    if (session.name_guessed) {
      return { correct: true, ball_type: session.ball_type, attempts_remaining: 0 };
    }

    session.guess_attempts++;
    const guessNorm = guess.trim().toLowerCase();
    const nameENNorm = session.name_en.toLowerCase();
    const guessJA = guess.trim();

    const remaining = MAX_NAME_GUESS_ATTEMPTS - session.guess_attempts;

    if (guessNorm === nameENNorm) {
      session.ball_type = "ultra";
      session.name_guessed = true;
      return { correct: true, ball_type: "ultra", language: "en", attempts_remaining: remaining };
    }

    if (guessJA === session.name_ja) {
      session.ball_type = "great";
      session.name_guessed = true;
      return { correct: true, ball_type: "great", language: "ja", attempts_remaining: remaining };
    }

    if (nameENNorm.length > FUZZY_MATCH_MIN_NAME_LENGTH) {
      const dist = levenshtein(guessNorm, nameENNorm);
      if (dist <= FUZZY_MATCH_MAX_DISTANCE) {
        session.ball_type = "ultra";
        session.name_guessed = true;
        return { correct: true, ball_type: "ultra", language: "en", fuzzy: true, attempts_remaining: remaining };
      }
    }

    if (remaining <= 0) {
      session.ball_type = "poke";
      session.name_guessed = true;
      return { correct: false, attempts_remaining: 0, reveal_name_en: session.name_en, reveal_name_ja: session.name_ja };
    }

    return { correct: false, attempts_remaining: remaining };
  }

  /** スコア・BST・ボール倍率から捕獲確率を算出し、抽選結果を返す。セッションは消費する。 */
  attemptCapture(uid: string): CaptureResponse {
    const session = this.getSession(uid);

    const ballMultiplier = BALL_MULTIPLIER[session.ball_type] ?? BALL_MULTIPLIER.poke;
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

/** スコアと種族値合計から捕獲確率を返す。ロジスティック関数とボール倍率を合成する。 */
export function calculateCaptureRate(score: number, bst: number, ballMultiplier: number): number {
  // 種族値とスコアを 0〜10 程度に正規化。ロジット係数のスケールを揃えるため。
  const x = bst / 100.0;
  const s = score / 100.0;

  // ロジット係数は ARCHITECTURE.md の捕獲確率モデル参照。BST 高ほど捕獲難、スコア高ほど易、
  // 相互作用項で「強いポケモンは高スコアでないと捕まらない」挙動を表現する。
  const logit = 2.5 - 0.34 * x - 0.17 * x * x + 14.5 * s - 4.2 * x * s + 0.52 * x * x * s;
  const baseRate = 1.0 / (1.0 + Math.exp(-logit));

  // ボール倍率を掛けた結果は 1.0 を超えうるので確率の上限でクランプする。
  return Math.min(1.0, baseRate * ballMultiplier);
}

const pluralHints = new Set([
  "several", "many", "multiple", "few", "these", "those", "numerous",
]);

/** 説明文中のポケモン名英語表記を "this Pokémon" / "of these Pokémon" に置換する。 */
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

/** 説明文中のポケモン名日本語表記を "この ポケモン" に置換する。 */
export function maskPokemonNameJA(text: string, name: string): string {
  if (!name) return text;
  return text.replaceAll(name, "この ポケモン");
}
