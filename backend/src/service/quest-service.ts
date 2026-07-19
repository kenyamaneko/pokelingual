import levenshtein from "js-levenshtein";
import { NotFoundError, ExternalServiceError, EmptyQuestPoolError } from "../domain/errors.js";
import { buildExcludedPokemonIDs } from "../domain/exclusion.js";
import { ALL_GENERATIONS, buildQuestPoolIDs } from "../domain/generation.js";
import { LEGENDARY_MYTHICAL_IDS } from "../domain/legendary.js";
import { findLocation, pickRandomLocations } from "../domain/location.js";
import { pickRandomSample } from "../domain/random.js";
import type {
  LLMClient,
  PokemonClient,
  QuestSessionStore,
  RandomSource,
  UserSettingsRepository,
} from "../domain/ports.js";
import type { AppEnvironment } from "../domain/environment.js";
import type { Pokemon } from "../domain/pokemon.js";
import { HINT_MOVE_COUNT, type QuestSession, type ScoreResult } from "../domain/quest.js";
import type {
  QuestNewResponse,
  QuestLocation,
  ScoreResponse,
  GuessResponse,
  CaptureResponse,
  SkipGuessResponse,
  HintResponse,
  QuestCurrentResponse,
  BallType,
} from "../../../shared/api-types/quest.js";

/** ポケモン名推測の最大試行回数。これを超えるとモンスターボール固定での捕獲フェーズへ。 */
const MAX_NAME_GUESS_ATTEMPTS = 3;

/** ヒント要求に必要な最小残り挑戦回数。消費後も1回は名前当てへの挑戦が残るようにする。 */
const MIN_REMAINING_ATTEMPTS_FOR_HINT = 2;

/** ヒントの最大開示回数。1回目でタイプ、2回目で技を開示する。 */
const MAX_HINT_REVEALS = 2;

/** LLM が返す翻訳スコアの許容範囲。プロンプト上 0-100 を指示しており、これを外れたら仕様違反。 */
const SCORE_MIN = 0;
const SCORE_MAX = 100;

/** 最終評価点変換: この値以下の素点は最終評価点 0 (効果なし) に切り下げる。 */
const SCORE_TRANSLATION_FLOOR = 10;
/** 最終評価点変換: 素点 (0-100) を最終評価点 (0-99) へ圧縮する係数。 */
const SCORE_TRANSLATION_SCALE = 1.1;

/** 最終評価点 (session.score) が実際に取りうる値の上限。 */
export const MAX_FINAL_SCORE = Math.round((SCORE_MAX - SCORE_TRANSLATION_FLOOR) * SCORE_TRANSLATION_SCALE);

// QuestNewResponse / ScoreResponse / GuessResponse / CaptureResponse の API 契約型は shared/api-types/quest.d.ts を参照

/** QuestService のチューニングパラメーター。env 経由で Config から供給される。 */
export interface QuestTuningConfig {
  /** Levenshtein あいまい一致を有効化する英語名の最小文字数。短い名前は誤検出が増えるため除外。 */
  fuzzyMatchMinNameLength: number;
  /** Levenshtein 距離がこの値以下なら正解扱い (タイプミス許容)。 */
  fuzzyMatchMaxDistance: number;
  /** ボール種別ごとの捕獲確率ボーナス (ロジットへの加算値)。master は確率計算をバイパスするため対象外。 */
  ballCaptureBonus: Record<Exclude<BallType, "master">, number>;
  /** 幻・伝説を抽選する確率 (場所によらず低確率で登場させる)。乱数の上位この割合が当たり。 */
  legendaryEncounterRate: number;
  /** 場所選択に一度に提示する場所の数。 */
  locationChoiceCount: number;
  /** 伝説・幻ポケモンをマスターボールで確定捕獲するために必要な最終評価点の下限。 */
  masterBallMinScore: number;
}

/**
 * クエストの出題・採点・名前推測・捕獲のドメインロジックを束ねるサービス。
 * セッションはユーザ ID ごとに QuestSessionStore へ保存する。
 */
export class QuestService {
  /**
   * @param pokemonClient ポケモン情報の取得クライアント。
   * @param llm 採点・講評に用いる LLM クライアント。
   * @param environment 実行環境。開発者除外 (prod 以外で適用) の判定に使う。
   * @param settingsRepo ユーザ設定リポジトリ。
   * @param random 乱数ソース。
   * @param sessionStore 進行中のクエストセッションを保存するストア。
   * @param tuning チューニングパラメーター。
   */
  constructor(
    private pokemonClient: PokemonClient,
    private llm: LLMClient,
    private environment: AppEnvironment,
    private settingsRepo: UserSettingsRepository,
    private random: RandomSource,
    private sessionStore: QuestSessionStore,
    private tuning: QuestTuningConfig,
  ) {}

  /**
   * 出題ポケモンを抽選してセッションを開始し、マスク済み説明文を返す。
   * @param userId ユーザ ID。
   * @param locationId 選択された探索場所 ID (未指定ならタイプ非限定)。
   * @returns マスク済み説明文と伝説/幻フラグを含む出題レスポンス。
   */
  async newQuest(userId: string, locationId?: string): Promise<QuestNewResponse> {
    const settings = await this.settingsRepo.getSettings(userId);
    const excluded = buildExcludedPokemonIDs(this.environment, settings.excluded_pokemon_ids);
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
      throw new ExternalServiceError("pokemon data", err as Error);
    }

    let descEN = pokemon.description_en;
    let descJA = pokemon.description_ja;
    if (pokemon.flavor_texts && pokemon.flavor_texts.length > 0) {
      const pair = pokemon.flavor_texts[Math.floor(this.random.next() * pokemon.flavor_texts.length)];
      descEN = pair.description_en;
      descJA = pair.description_ja;
    }

    // 技ヒントは出会うたびに開示内容が変わるよう、クエスト開始時に候補からランダムに選ぶ
    const hintMoves = pokemon.level_up_moves
      ? pickRandomSample(pokemon.level_up_moves, HINT_MOVE_COUNT, this.random)
      : undefined;

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
      hint_moves: hintMoves,
      score: 0,
      ball_type: null,
      guess_attempts: 0,
      name_guessed: false,
      hint_reveal_count: 0,
    };
    await this.saveSession(userId, session);

    return {
      pokemon_id: pokemon.id,
      description_en: maskPokemonNameEN(descEN, pokemon.name_en),
      is_legendary: pokemon.is_legendary,
      is_mythical: pokemon.is_mythical,
      max_guess_attempts: MAX_NAME_GUESS_ATTEMPTS,
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
    const isLegendaryDraw = this.random.next() >= 1 - this.tuning.legendaryEncounterRate;
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
    return pickRandomLocations(this.random, this.tuning.locationChoiceCount);
  }

  /**
   * LLM で翻訳を採点し、結果をセッションへ記録する。
   * @param userId ユーザ ID。
   * @param translation ユーザの日本語訳。
   * @returns スコア・講評・マスク済み日本語説明。
   */
  async scoreTranslation(userId: string, translation: string): Promise<ScoreResponse> {
    const session = await this.loadSession(userId);
    // 原文のままだと講評でポケモン名がネタバレしうるため、マスク済みの英文を渡す。
    const maskedDescriptionEN = maskPokemonNameEN(session.description_en, session.name_en);

    let result: ScoreResult;
    try {
      result = await this.scoreWithLLM(maskedDescriptionEN, translation);
    } catch (err) {
      throw new ExternalServiceError("LLM", err as Error);
    }

    session.score = translateToFinalScore(result.score);
    session.user_translation = translation;
    session.review = result.review;
    await this.saveSession(userId, session);

    return {
      score: session.score,
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
  async guessName(userId: string, guess: string): Promise<GuessResponse> {
    const session = await this.loadSession(userId);

    if (session.name_guessed) {
      return { correct: true, ball_type: session.ball_type ?? undefined, attempts_remaining: 0 };
    }

    session.guess_attempts++;
    const guessNorm = guess.trim().toLowerCase();
    const nameENNorm = session.name_en.toLowerCase();
    const guessJA = guess.trim();

    const remaining = MAX_NAME_GUESS_ATTEMPTS - session.guess_attempts;
    const masterEligible =
      (session.is_legendary || session.is_mythical) && session.score >= this.tuning.masterBallMinScore;

    // 分岐ごとに保存を書くと、分岐を追加・変更したときに保存の書き忘れに気づけない。
    // 応答を変数に確定してから最後に一度だけ保存し、書き忘れが起きない形にする。
    let response: GuessResponse;
    if (guessNorm === nameENNorm) {
      const ballType = masterEligible ? "master" : "ultra";
      session.ball_type = ballType;
      session.name_guessed = true;
      response = { correct: true, ball_type: ballType, language: "en", attempts_remaining: remaining };
    } else if (guessJA === session.name_ja) {
      const ballType = masterEligible ? "master" : "great";
      session.ball_type = ballType;
      session.name_guessed = true;
      response = { correct: true, ball_type: ballType, language: "ja", attempts_remaining: remaining };
    } else if (
      nameENNorm.length >= this.tuning.fuzzyMatchMinNameLength &&
      levenshtein(guessNorm, nameENNorm) <= this.tuning.fuzzyMatchMaxDistance
    ) {
      const ballType = masterEligible ? "master" : "ultra";
      session.ball_type = ballType;
      session.name_guessed = true;
      response = { correct: true, ball_type: ballType, language: "en", fuzzy: true, attempts_remaining: remaining };
    } else if (remaining <= 0) {
      session.ball_type = "poke";
      session.name_guessed = true;
      response = { correct: false, ball_type: "poke", attempts_remaining: 0 };
    } else {
      response = { correct: false, attempts_remaining: remaining };
    }

    await this.saveSession(userId, session);
    return response;
  }

  /**
   * ヒントを要求する。名前推測の挑戦回数を1回消費し、1回目はタイプ、2回目は技を返す。
   * レベルアップで覚える技が無いポケモンでは、2回目も技を0件として返す。
   * @param userId ユーザ ID。
   * @returns 今回開示された情報 (タイプまたは技) と消費後の残り挑戦回数。
   * @throws 名前当てが完了済み、ヒントを2回開示済み、または残り挑戦回数が不足している場合
   * (正しく実装されたフロントエンドからは到達しない不正な呼び出し)。
   */
  async requestHint(userId: string): Promise<HintResponse> {
    const session = await this.loadSession(userId);

    if (session.name_guessed || session.hint_reveal_count >= MAX_HINT_REVEALS) {
      throw new Error("hint requested on a session that cannot accept one (already guessed or hints exhausted)");
    }
    const remaining = MAX_NAME_GUESS_ATTEMPTS - session.guess_attempts;
    if (remaining < MIN_REMAINING_ATTEMPTS_FOR_HINT) {
      throw new Error("hint requested with insufficient guess attempts remaining");
    }
    const isSecondReveal = session.hint_reveal_count === 1;

    session.guess_attempts++;
    session.hint_reveal_count++;
    const attemptsRemaining = MAX_NAME_GUESS_ATTEMPTS - session.guess_attempts;
    await this.saveSession(userId, session);

    return isSecondReveal
      ? { moves: session.hint_moves ?? [], attempts_remaining: attemptsRemaining }
      : { types: session.types, attempts_remaining: attemptsRemaining };
  }

  /**
   * 名前当てをスキップして、ボールを確定する。名前当てが完了済みのセッションに対して
   * 呼ばれた場合は上書きせず、確定済みのボール種別をそのまま返す。
   * @param userId ユーザ ID。
   * @returns 確定したボール種別。
   */
  async skipGuess(userId: string): Promise<SkipGuessResponse> {
    const session = await this.loadSession(userId);
    if (session.name_guessed) {
      // 通常の動作では、名前確定後にフロントエンドからこの API が呼ばれることはない。
      // それでも呼ばれた場合に上書きしないのは、backend が先にデプロイされる構成で残る
      // 旧フロントエンドの呼び出しに対しても、確定済みのボールを壊さないための防御的な実装。
      return { ball_type: session.ball_type! };
    }
    session.ball_type = "poke";
    session.name_guessed = true;
    await this.saveSession(userId, session);
    return { ball_type: "poke" };
  }

  /**
   * スコア・種族値合計・ボール補正から捕獲確率を算出し、抽選結果を返す。マスターボールは
   * 確率計算をバイパスして確定捕獲する。呼び出し後はセッションが失効し、
   * 同じユーザでの再度の呼び出しはできない。
   * @param userId ユーザ ID。
   * @returns 捕獲成否と表示用ポケモン情報。
   */
  async attemptCapture(userId: string): Promise<CaptureResponse> {
    const session = await this.loadSession(userId);
    const ballType = session.ball_type;

    if (ballType === null) {
      // 名前当て/スキップを経ずに capture に到達するのは不正な状態 (フォールバックせず失敗させる)。
      throw new Error("capture attempted before a ball was selected (guess or skip required)");
    }

    let probability: number;
    let captured: boolean;
    if (ballType === "master") {
      probability = 1.0;
      captured = true;
    } else {
      const ballBonus = this.tuning.ballCaptureBonus[ballType];
      probability = calculateCaptureRate(session.score, session.base_stat_total, ballBonus);
      captured = this.random.next() < probability;
    }

    await this.deleteSession(userId);

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
      ball_type: ballType,
      types: session.types,
      height: session.height,
      weight: session.weight,
      is_legendary: session.is_legendary,
      is_mythical: session.is_mythical,
    };
  }

  /**
   * 進行中のクエストセッションを、離脱したフェーズから再開するための状態として返す。
   * @param userId ユーザ ID。
   * @returns 現在のフェーズと、そのフェーズの表示に必要な状態。
   * @throws NotFoundError セッションが存在しない場合。
   */
  async getCurrentQuest(userId: string): Promise<QuestCurrentResponse> {
    const session = await this.loadSession(userId);
    const quest: QuestNewResponse = {
      pokemon_id: session.pokemon_id,
      description_en: maskPokemonNameEN(session.description_en, session.name_en),
      is_legendary: session.is_legendary,
      is_mythical: session.is_mythical,
      max_guess_attempts: MAX_NAME_GUESS_ATTEMPTS,
    };

    if (session.ball_type !== null) {
      return { phase: "capturing", quest, ball_type: session.ball_type };
    }

    if (typeof session.review === "string") {
      const attemptsRemaining = MAX_NAME_GUESS_ATTEMPTS - session.guess_attempts;
      const hint: HintResponse | null =
        session.hint_reveal_count >= 1
          ? {
              types: session.types,
              moves: session.hint_reveal_count >= 2 ? (session.hint_moves ?? []) : undefined,
              attempts_remaining: attemptsRemaining,
            }
          : null;
      return {
        phase: "guessing",
        quest,
        score: {
          score: session.score,
          review: session.review,
          description_ja: maskPokemonNameJA(session.description_ja, session.name_ja),
        },
        // review と user_translation は scoreTranslation で必ず同時に書かれるため non-null
        user_translation: session.user_translation!,
        attempts_remaining: attemptsRemaining,
        hint,
      };
    }

    return { phase: "translating", quest };
  }

  /**
   * userId のアクティブなセッションを読み込む。
   * @param userId ユーザ ID。
   * @returns アクティブなクエストセッション。
   * @throws ExternalServiceError ストアの読み込みが失敗した場合。
   * @throws NotFoundError セッションが存在しない場合。
   */
  private async loadSession(userId: string): Promise<QuestSession> {
    let session: QuestSession | null;
    try {
      session = await this.sessionStore.get(userId);
    } catch (err) {
      throw new ExternalServiceError("session store", err as Error);
    }
    if (!session) throw new NotFoundError("no active quest session");
    return session;
  }

  /**
   * userId のセッションを保存する。
   * @param userId ユーザ ID。
   * @param session 保存するクエストセッション。
   * @throws ExternalServiceError ストアの書き込みが失敗した場合。
   */
  private async saveSession(userId: string, session: QuestSession): Promise<void> {
    try {
      await this.sessionStore.set(userId, session);
    } catch (err) {
      throw new ExternalServiceError("session store", err as Error);
    }
  }

  /**
   * userId のセッションを削除する。
   * @param userId ユーザ ID。
   * @throws ExternalServiceError ストアの削除が失敗した場合。
   */
  private async deleteSession(userId: string): Promise<void> {
    try {
      await this.sessionStore.delete(userId);
    } catch (err) {
      throw new ExternalServiceError("session store", err as Error);
    }
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
- Punctuation usage (commas, periods, 読点・句点 etc.) is NOT a scoring criterion — never deduct points for it or mention it in the review

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
 * スコアと種族値合計から捕獲確率を返す。ロジスティック関数にボール補正を加算で合成する。
 * @param score 採点スコア (最終評価点、0-99)。
 * @param baseStatTotal 種族値合計。
 * @param ballBonus ボール種別ごとの捕獲確率ボーナス (ロジットへの加算値)。
 * @returns 0.0〜1.0 の捕獲確率。
 */
export function calculateCaptureRate(score: number, baseStatTotal: number, ballBonus: number): number {
  // 種族値とスコアを 0〜10 程度に正規化。ロジット係数のスケールを揃えるため。
  const x = baseStatTotal / 100.0;
  const s = score / 100.0;

  // ロジット係数はフィッティング済みモデルの値。個々の係数に単独の意味は無いため、
  // 定数化せずマジックナンバーの例外としてインラインで持つ。
  // 種族値合計が高いほど捕獲難、スコア高ほど易、相互作用項で「強いポケモンは高スコアでないと捕まらない」を表現する。
  // ボール補正はロジットへの加算のため、シグモイドの値域 (0.0〜1.0) を超えず、上限クランプが不要になる。
  // Stryker disable next-line all
  const logitBase =
    -19.007 + 6.522 * x - 0.724 * x * x + 43.926 * s - 14.214 * x * s + 1.369 * x * x * s;
  const logit = logitBase + ballBonus;
  return 1.0 / (1.0 + Math.exp(-logit));
}

/**
 * LLM が返した素点 (0-100) を最終評価点 (0-99) に変換する。ポケモン世界の「瀕死にすると
 * 捕まえられない」という世界観に合わせ、最終評価が満点に達しないようにする。
 * @param rawScore LLM が返した素点 (0-100)。
 * @returns 最終評価点 (0-99)。
 */
function translateToFinalScore(rawScore: number): number {
  return Math.max(0, Math.round((rawScore - SCORE_TRANSLATION_FLOOR) * SCORE_TRANSLATION_SCALE));
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
