import levenshtein from "js-levenshtein";
import { NotFoundError, ExternalServiceError } from "../domain/errors.js";
import type {
  LLMClient,
  PokemonClient,
  PokemonConfig,
  RandomSource,
  UserSettingsRepository,
} from "../domain/ports.js";
import type { Pokemon } from "../domain/pokemon.js";
import type { QuestSession, ScoreResult } from "../domain/quest.js";
import type {
  QuestNewResponse,
  ScoreResponse,
  GuessResponse,
  CaptureResponse,
  SkipGuessResponse,
  BallType,
} from "../../../shared/api-types/quest.js";

/**
 * 出題抽選の最大試行回数 (初回を含む)。除外設定の最大数 (MAX_EXCLUDED_POKEMON_COUNT) と
 * maxPokemonID の関係から、この回数で実質衝突確率はゼロに収束する。
 */
const MAX_RANDOM_PICK_RETRY = 10;

/** ポケモン名推測の最大試行回数。これを超えるとポケボール固定での捕獲フェーズへ。 */
const MAX_NAME_GUESS_ATTEMPTS = 3;

/** Levenshtein あいまい一致を有効化する英語名の最小文字数。短い名前は誤検出が増えるため除外。 */
const FUZZY_MATCH_MIN_NAME_LENGTH = 4;

/** Levenshtein 距離がこの値以下なら正解扱い (タイプミス許容)。 */
const FUZZY_MATCH_MAX_DISTANCE = 2;

/** LLM が返す翻訳スコアの許容範囲。プロンプト上 0-100 を指示しており、これを外れたら仕様違反。 */
const SCORE_MIN = 0;
const SCORE_MAX = 100;

/** ボール種別ごとの捕獲確率倍率。great=英語名正解、ultra=日本語名正解、poke=不正解。 */
const BALL_MULTIPLIER: Record<BallType, number> = {
  poke: 1.0,
  great: 2.0,
  ultra: 3.0,
};

// QuestNewResponse / ScoreResponse / GuessResponse / CaptureResponse の API 契約型は shared/api-types/quest.d.ts を参照

/**
 * クエストの出題・採点・名前推測・捕獲のドメインロジックを束ねるサービス。
 * セッションはユーザ uid ごとにメモリ保持する。
 */
export class QuestService {
  private sessions = new Map<string, QuestSession>();

  /**
   * @param pokemonClient ポケモン情報の取得クライアント。
   * @param llm 採点・講評に用いる LLM クライアント。
   * @param pokemonConfig ポケモン関連のアプリ設定。
   * @param settingsRepo ユーザ設定リポジトリ。
   * @param random 乱数ソース。
   */
  constructor(
    private pokemonClient: PokemonClient,
    private llm: LLMClient,
    private pokemonConfig: PokemonConfig,
    private settingsRepo: UserSettingsRepository,
    private random: RandomSource,
  ) {}

  /**
   * 出題ポケモンを抽選してセッションを開始し、マスク済み説明文を返す。
   * @param uid ユーザ ID。
   * @returns マスク済み説明文と伝説/幻フラグを含む出題レスポンス。
   */
  async newQuest(uid: string): Promise<QuestNewResponse> {
    const settings = await this.settingsRepo.getSettings(uid);
    const ids = settings.excluded_pokemon_ids ?? this.pokemonConfig.defaultExcludedPokemonIDs;
    const excluded = new Set<number>(ids);

    let pokemon: Pokemon | undefined;
    for (let i = 0; i < MAX_RANDOM_PICK_RETRY; i++) {
      let candidate: Pokemon;
      try {
        candidate = await this.pokemonClient.getRandomPokemon();
      } catch (err) {
        throw new ExternalServiceError("PokemonAPI", err as Error);
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
      const pair = pokemon.flavor_texts[Math.floor(this.random.next() * pokemon.flavor_texts.length)];
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
      ball_type: null,
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

  /**
   * LLM で翻訳を採点し、結果をセッションへ記録する。
   * @param uid ユーザ ID。
   * @param translation ユーザの日本語訳。
   * @returns スコア・講評・マスク済み日本語説明。
   */
  async scoreTranslation(uid: string, translation: string): Promise<ScoreResponse> {
    const session = this.getSession(uid);

    let result: ScoreResult;
    try {
      result = await this.scoreWithLLM(session.description_en, translation);
    } catch (err) {
      throw new ExternalServiceError("LLM", err as Error);
    }

    session.score = result.score;

    return {
      score: result.score,
      review: result.review,
      description_ja: maskPokemonNameJA(session.description_ja, session.name_ja),
    };
  }

  /**
   * LLM に採点を依頼し、スコア範囲を検証して返す。
   * @param englishText 出題の英語原文。
   * @param translation ユーザの日本語訳。
   * @returns スコアと講評。
   * @throws スコアが 0-100 の範囲外の場合。
   */
  private async scoreWithLLM(englishText: string, translation: string): Promise<ScoreResult> {
    const prompt = buildScorePrompt(englishText, translation);
    const text = await this.llm.generateText(prompt);
    const parsed: ScoreResult = JSON.parse(text);

    if (!Number.isFinite(parsed.score) || parsed.score < SCORE_MIN || parsed.score > SCORE_MAX) {
      throw new Error(`LLM returned out-of-range score: ${parsed.score}`);
    }
    return parsed;
  }

  /**
   * 名前推測を判定し、正解ならボール種別を確定、不正解なら残り試行を返す。
   * @param uid ユーザ ID。
   * @param guess ユーザの推測名 (英語または日本語)。
   * @returns 正誤・確定ボール種別・残り試行回数を含む判定結果。
   */
  guessName(uid: string, guess: string): GuessResponse {
    const session = this.getSession(uid);

    if (session.name_guessed) {
      return { correct: true, ball_type: session.ball_type ?? undefined, attempts_remaining: 0 };
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

    if (nameENNorm.length >= FUZZY_MATCH_MIN_NAME_LENGTH) {
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

  /**
   * 名前当てをスキップし、poke ボールを確定する。
   * @param uid ユーザ ID。
   * @returns 確定したボール種別 (常に poke)。
   */
  skipGuess(uid: string): SkipGuessResponse {
    const session = this.getSession(uid);
    session.ball_type = "poke";
    session.name_guessed = true;
    return { ball_type: "poke" };
  }

  /**
   * スコア・BST・ボール倍率から捕獲確率を算出し、抽選結果を返す。セッションは消費する。
   * @param uid ユーザ ID。
   * @returns 捕獲成否と表示用ポケモン情報。
   */
  attemptCapture(uid: string): CaptureResponse {
    const session = this.getSession(uid);

    if (session.ball_type === null) {
      // 名前当て/スキップを経ずに capture に到達するのは不正な状態 (フォールバックせず失敗させる)。
      throw new Error("capture attempted before a ball was selected (guess or skip required)");
    }
    const ballMultiplier = BALL_MULTIPLIER[session.ball_type];
    const probability = calculateCaptureRate(session.score, session.base_stat_total, ballMultiplier);
    const captured = this.random.next() < probability;

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

  /**
   * uid のアクティブなセッションを返す。
   * @param uid ユーザ ID。
   * @returns アクティブなクエストセッション。
   * @throws NotFoundError セッションが存在しない場合。
   */
  private getSession(uid: string): QuestSession {
    const session = this.sessions.get(uid);
    if (!session) throw new NotFoundError("no active quest session");
    return session;
  }
}

/**
 * 翻訳採点用のプロンプトを組み立てる。
 * @param englishText 出題の英語原文。
 * @param translation ユーザの日本語訳。
 * @returns LLM へ渡すプロンプト文字列。
 */
function buildScorePrompt(englishText: string, translation: string): string {
  return `You are an English-to-Japanese translation evaluator for a language learning app.

Original English text:
"${englishText}"

User's Japanese translation:
"${translation}"

Evaluate the translation and respond in EXACTLY this JSON format:
{
  "score": <integer 0-100>,
  "review": "<review in Japanese, 2-3 sentences>"
}

Scoring guidelines:
- 90-100: Accurate meaning, natural Japanese, minor issues at most
- 70-89: Core meaning preserved, some awkward phrasing or minor errors
- 50-69: Partially correct, missing important nuances or grammatical issues
- 30-49: Significant errors but some understanding shown
- 0-29: Major misunderstanding or mostly incorrect

Review guidelines:
- Write 2-3 short sentences in Japanese
- You are a kind, supportive Pokemon professor
- If the user left parts untranslated or omitted sections, understand they didn't know the meaning — they are NOT careless, they simply couldn't translate what they didn't understand. Guide them with explanations rather than pointing out "omissions"
- Include explanations of difficult English words/phrases (high school advanced level and above) that appear in the original text — briefly explain their meaning in Japanese
- Use simple kanji with spaces between words (e.g. "「friskily」は 元気よく 跳ね回る という 意味だよ。")
- End with a warm word of praise or encouragement, but vary the expression every time — never repeat the same closing phrase
- Keep the total review under 150 characters

Respond with ONLY the JSON, no other text.`;
}

/**
 * スコアと種族値合計から捕獲確率を返す。ロジスティック関数とボール倍率を合成する。
 * @param score 採点スコア (0-100)。
 * @param bst 種族値合計 (Base Stat Total)。
 * @param ballMultiplier ボール種別ごとの捕獲確率倍率。
 * @returns 0.0〜1.0 の捕獲確率。
 */
export function calculateCaptureRate(score: number, bst: number, ballMultiplier: number): number {
  // 種族値とスコアを 0〜10 程度に正規化。ロジット係数のスケールを揃えるため。
  const x = bst / 100.0;
  const s = score / 100.0;

  // ロジット係数はフィッティング済みモデル (docs/adr/010-bst-capture-formula.md が正典)。
  // 個々の係数に単独の意味は無いため、定数化せずマジックナンバーの例外としてインラインで持つ。
  // BST 高ほど捕獲難、スコア高ほど易、相互作用項で「強いポケモンは高スコアでないと捕まらない」を表現する。
  const logit = 2.5 - 0.34 * x - 0.17 * x * x + 14.5 * s - 4.2 * x * s + 0.52 * x * x * s;
  const baseRate = 1.0 / (1.0 + Math.exp(-logit));

  // ボール倍率を掛けた結果は 1.0 を超えうるので確率の上限でクランプする。
  return Math.min(1.0, baseRate * ballMultiplier);
}

const pluralHints = new Set([
  "several", "many", "multiple", "few", "these", "those", "numerous",
]);

/**
 * 説明文中のポケモン名英語表記を "this Pokémon" / "of these Pokémon" に置換する。
 * @param text 元の説明文。
 * @param name 伏せるポケモンの英語名。
 * @returns 名前を代名詞に置換した説明文。
 */
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

/**
 * 説明文中のポケモン名日本語表記を "この ポケモン" に置換する。
 * @param text 元の説明文。
 * @param name 伏せるポケモンの日本語名。
 * @returns 名前を置換した説明文。
 */
export function maskPokemonNameJA(text: string, name: string): string {
  if (!name) return text;
  return text.replaceAll(name, "この ポケモン");
}
