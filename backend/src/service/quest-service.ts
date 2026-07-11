import levenshtein from "js-levenshtein";
import { NotFoundError, ExternalServiceError, EmptyQuestPoolError } from "../domain/errors.js";
import { buildExcludedPokemonIDs } from "../domain/exclusion.js";
import { ALL_GENERATIONS, buildQuestPoolIDs } from "../domain/generation.js";
import { LEGENDARY_MYTHICAL_IDS } from "../domain/legendary.js";
import { findLocation, pickRandomLocations, LOCATION_CHOICE_COUNT } from "../domain/location.js";
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
  QuestLocation,
  ScoreResponse,
  GuessResponse,
  CaptureResponse,
  SkipGuessResponse,
  BallType,
} from "../../../shared/api-types/quest.js";

/** ポケモン名推測の最大試行回数。これを超えるとモンスターボール固定での捕獲フェーズへ。 */
const MAX_NAME_GUESS_ATTEMPTS = 3;

/** Levenshtein あいまい一致を有効化する英語名の最小文字数。短い名前は誤検出が増えるため除外。 */
const FUZZY_MATCH_MIN_NAME_LENGTH = 4;

/** Levenshtein 距離がこの値以下なら正解扱い (タイプミス許容)。 */
const FUZZY_MATCH_MAX_DISTANCE = 2;

/** LLM が返す翻訳スコアの許容範囲。プロンプト上 0-100 を指示しており、これを外れたら仕様違反。 */
const SCORE_MIN = 0;
const SCORE_MAX = 100;

/** ボール種別ごとの捕獲確率倍率。 */
export const BALL_MULTIPLIER: Record<BallType, number> = {
  poke: 1.0,
  great: 2.0,
  ultra: 3.0,
};

/** 幻・伝説を抽選する確率 (場所によらず低確率で登場させる)。乱数の上位この割合が当たり。 */
const LEGENDARY_ENCOUNTER_RATE = 0.01;

// QuestNewResponse / ScoreResponse / GuessResponse / CaptureResponse の API 契約型は shared/api-types/quest.d.ts を参照

/**
 * クエストの出題・採点・名前推測・捕獲のドメインロジックを束ねるサービス。
 * セッションはユーザ ID ごとにメモリ保持する。
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
   * @param userId ユーザ ID。
   * @param locationId 選択された探索場所 ID (未指定ならタイプ非限定)。
   * @returns マスク済み説明文と伝説/幻フラグを含む出題レスポンス。
   */
  async newQuest(userId: string, locationId?: string): Promise<QuestNewResponse> {
    const settings = await this.settingsRepo.getSettings(userId);
    const excluded = buildExcludedPokemonIDs(this.pokemonConfig.environment, settings.excluded_pokemon_ids);
    const generations = settings.enabled_generations ?? ALL_GENERATIONS;
    const generationPool = buildQuestPoolIDs(generations, excluded);

    const candidates = await this.pickQuestCandidates(locationId, generationPool);
    if (candidates.length === 0) {
      // 画面が最低1世代・除外上限で空プールを防ぐため通常は到達しない。防御的に案内エラーにする。
      throw new EmptyQuestPoolError();
    }
    const pokemonID = candidates[Math.floor(this.random.next() * candidates.length)];

    let pokemon: Pokemon;
    try {
      pokemon = await this.pokemonClient.getPokemonByID(pokemonID);
    } catch (err) {
      throw new ExternalServiceError("PokemonAPI", err as Error);
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
    this.sessions.set(userId, session);

    return {
      pokemon_id: pokemon.id,
      description_en: maskPokemonNameEN(descEN, pokemon.name_en),
      is_legendary: pokemon.is_legendary,
      is_mythical: pokemon.is_mythical,
    };
  }

  /**
   * 出題候補の図鑑番号を決める。低確率で幻・伝説プール、通常は場所のタイプで絞る。
   * @param locationId 選択された探索場所 ID (未指定ならタイプ非限定)。
   * @param generationPool 世代・除外を反映した出題プール。
   * @returns 出題候補の図鑑番号 (データソースの提供順)。
   */
  private async pickQuestCandidates(locationId: string | undefined, generationPool: Set<number>): Promise<number[]> {
    const servableIDs = this.pokemonClient.getServableIDs();
    const isLegendaryDraw = this.random.next() >= 1 - LEGENDARY_ENCOUNTER_RATE;
    if (isLegendaryDraw) {
      const legendary = servableIDs.filter((id) => generationPool.has(id) && LEGENDARY_MYTHICAL_IDS.has(id));
      if (legendary.length > 0) return legendary;
      // 伝説抽選に当たったこと自体をユーザーに悟らせたくないので、対象がいなくてもエラーにせず通常抽選に落とす。
    }
    return this.pickLocationCandidates(locationId, generationPool, servableIDs);
  }

  /**
   * 選んだ場所のタイプに合う出題候補を返す。場所未指定・未知 ID ならタイプ非限定。
   * @param locationId 探索場所 ID。
   * @param generationPool 世代・除外を反映した出題プール。
   * @param servableIDs データソースが提供できる図鑑番号。
   * @returns 出題候補の図鑑番号。
   */
  private async pickLocationCandidates(
    locationId: string | undefined,
    generationPool: Set<number>,
    servableIDs: readonly number[],
  ): Promise<number[]> {
    const location = locationId === undefined ? undefined : findLocation(locationId);
    if (!location) {
      return servableIDs.filter((id) => generationPool.has(id));
    }
    const typeIDs = new Set<number>();
    for (const type of location.types) {
      for (const id of await this.pokemonClient.getIDsByType(type)) typeIDs.add(id);
    }
    return servableIDs.filter((id) => generationPool.has(id) && typeIDs.has(id));
  }

  /**
   * 場所選択に提示する候補をランダムに返す。
   * @returns ランダムに選ばれた探索場所の配列。
   */
  getLocations(): QuestLocation[] {
    return pickRandomLocations(this.random, LOCATION_CHOICE_COUNT);
  }

  /**
   * LLM で翻訳を採点し、結果をセッションへ記録する。
   * @param userId ユーザ ID。
   * @param translation ユーザの日本語訳。
   * @returns スコア・講評・マスク済み日本語説明。
   */
  async scoreTranslation(userId: string, translation: string): Promise<ScoreResponse> {
    const session = this.getSession(userId);
    // 原文のままだと講評でポケモン名がネタバレしうるため、マスク済みの英文を渡す。
    const maskedDescriptionEN = maskPokemonNameEN(session.description_en, session.name_en);

    let result: ScoreResult;
    try {
      result = await this.scoreWithLLM(maskedDescriptionEN, translation);
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
   * LLM に採点を依頼し、スコアと講評を検証して返す。
   * @param englishText 出題の英語原文。
   * @param translation ユーザの日本語訳。
   * @returns スコアと講評。
   * @throws スコアが 0-100 の範囲外、または講評が欠落している場合。
   */
  private async scoreWithLLM(englishText: string, translation: string): Promise<ScoreResult> {
    const prompt = buildScorePrompt(englishText, translation);
    const text = await this.llm.generateText(prompt);
    const parsed: ScoreResult = JSON.parse(text);

    if (!Number.isFinite(parsed.score) || parsed.score < SCORE_MIN || parsed.score > SCORE_MAX) {
      throw new Error(`LLM returned out-of-range score: ${parsed.score}`);
    }
    // 講評の欠落を undefined のまま通すと画面に空の講評が出る。フォールバックせずエラーにする
    if (typeof parsed.review !== "string" || parsed.review === "") {
      throw new Error("LLM returned empty review");
    }
    return parsed;
  }

  /**
   * 名前推測を判定し、正解ならボール種別を確定、不正解なら残り試行を返す。
   * @param userId ユーザ ID。
   * @param guess ユーザの推測名 (英語または日本語)。
   * @returns 正誤・確定ボール種別・残り試行回数を含む判定結果。
   */
  guessName(userId: string, guess: string): GuessResponse {
    const session = this.getSession(userId);

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
      return {
        correct: false,
        ball_type: "poke",
        attempts_remaining: 0,
        reveal_name_en: session.name_en,
        reveal_name_ja: session.name_ja,
      };
    }

    return { correct: false, attempts_remaining: remaining };
  }

  /**
   * 名前当てをスキップして、ボールを確定する。名前当てが完了済みのセッションに対して
   * 呼ばれた場合は上書きせず、確定済みのボール種別をそのまま返す。
   * @param userId ユーザ ID。
   * @returns 確定したボール種別。
   */
  skipGuess(userId: string): SkipGuessResponse {
    const session = this.getSession(userId);
    if (session.name_guessed) {
      // 通常の動作では、名前確定後にフロントエンドからこの API が呼ばれることはない。
      // それでも呼ばれた場合に上書きしないのは、backend が先にデプロイされる構成で残る
      // 旧フロントエンドの呼び出しに対しても、確定済みのボールを壊さないための防御的な実装。
      return { ball_type: session.ball_type! };
    }
    session.ball_type = "poke";
    session.name_guessed = true;
    return { ball_type: "poke" };
  }

  /**
   * スコア・種族値合計・ボール倍率から捕獲確率を算出し、抽選結果を返す。セッションは消費する。
   * @param userId ユーザ ID。
   * @returns 捕獲成否と表示用ポケモン情報。
   */
  attemptCapture(userId: string): CaptureResponse {
    const session = this.getSession(userId);

    if (session.ball_type === null) {
      // 名前当て/スキップを経ずに capture に到達するのは不正な状態 (フォールバックせず失敗させる)。
      throw new Error("capture attempted before a ball was selected (guess or skip required)");
    }
    const ballMultiplier = BALL_MULTIPLIER[session.ball_type];
    const probability = calculateCaptureRate(session.score, session.base_stat_total, ballMultiplier);
    const captured = this.random.next() < probability;

    this.sessions.delete(userId);

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
   * userId のアクティブなセッションを返す。
   * @param userId ユーザ ID。
   * @returns アクティブなクエストセッション。
   * @throws NotFoundError セッションが存在しない場合。
   */
  private getSession(userId: string): QuestSession {
    const session = this.sessions.get(userId);
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
 * @param baseStatTotal 種族値合計。
 * @param ballMultiplier ボール種別ごとの捕獲確率倍率。
 * @returns 0.0〜1.0 の捕獲確率。
 */
export function calculateCaptureRate(score: number, baseStatTotal: number, ballMultiplier: number): number {
  // 種族値とスコアを 0〜10 程度に正規化。ロジット係数のスケールを揃えるため。
  const x = baseStatTotal / 100.0;
  const s = score / 100.0;

  // ロジット係数はフィッティング済みモデルの値。個々の係数に単独の意味は無いため、
  // 定数化せずマジックナンバーの例外としてインラインで持つ。
  // 種族値合計が高いほど捕獲難、スコア高ほど易、相互作用項で「強いポケモンは高スコアでないと捕まらない」を表現する。
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
