import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { questApi } from "../api/questApi";
import { useUsage } from "../contexts/UsageContext";
import type {
  QuestNewResponse,
  QuestLocation,
  ScoreResponse,
  GuessResponse,
  CaptureResponse,
  BallType,
} from "../../../shared/api-types/quest";

export type { BallType };

/** クエストフェーズの遷移ステート。 */
export type QuestPhase =
  | "selectLocation"
  | "loading"
  | "translating"
  | "guessing"
  | "capturing"
  | "revealing"
  | "result"
  | "error";

/** useQuest フックの戻り値。フェーズ・各種データ・操作を提供する。 */
export interface UseQuestResult {
  phase: QuestPhase;
  quest: QuestNewResponse | null;
  locations: QuestLocation[];
  score: ScoreResponse | null;
  guessResult: GuessResponse | null;
  captureResult: CaptureResponse | null;
  userTranslation: string;
  ballType: BallType | null;
  error: string | null;

  startNewQuest: () => Promise<void>;
  selectLocation: (locationId: string) => Promise<void>;
  submitTranslation: (translation: string) => Promise<void>;
  submitGuess: (guess: string) => Promise<void>;
  skipGuess: () => Promise<void>;
  proceedToCapture: () => void;
  capture: () => Promise<void>;
  revealCaptureResult: () => void;
}

/**
 * エラーがレート制限 (429) 由来かを判定する。
 * (429 は UsageProvider がグローバルにモーダル表示するため、各ページのエラー文言は出さない)
 * @param err 捕捉したエラー。
 * @returns 429 レスポンスなら true。
 */
function isRateLimitError(err: unknown): boolean {
  return axios.isAxiosError(err) && err.response?.status === 429;
}

/**
 * エラーがセッション切断 (404) 由来かを判定する。
 * @param err 捕捉したエラー。
 * @returns 404 レスポンスなら true。
 */
function isSessionLostError(err: unknown): boolean {
  return axios.isAxiosError(err) && err.response?.status === 404;
}

/**
 * エラーをユーザ向けの日本語メッセージに変換する。
 * @param err 捕捉したエラー。
 * @param fallback 分類できない場合に使う既定メッセージ。
 * @returns ユーザ向けエラーメッセージ。
 */
function getErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    if (!err.response) {
      return "サーバーに接続できません。ネットワークを確認してください";
    }
    const status = err.response.status;
    if (status === 401) {
      return "認証に失敗しました。ログインし直してください";
    }
    if (status === 403) {
      return "アクセス権がありません";
    }
    if (status === 502) {
      return "外部サービスが応答しません。しばらく待ってから、もう一度試してください";
    }
    if (status === 404) {
      return "セッションが切断されました。次のポケモンを探してください";
    }
    if (status === 409) {
      return "今の設定では出会えるポケモンがいません。設定を見直してください";
    }
    return `${fallback}（${status}）`;
  }
  return fallback;
}

/**
 * クエストセッションの状態管理 + API 呼び出し + フェーズ遷移をまとめたフック。
 * @returns フェーズ・各種データ・操作関数を含むクエスト状態。
 */
export function useQuest(): UseQuestResult {
  const [phase, setPhase] = useState<QuestPhase>("selectLocation");
  const [quest, setQuest] = useState<QuestNewResponse | null>(null);
  const [locations, setLocations] = useState<QuestLocation[]>([]);
  const [score, setScore] = useState<ScoreResponse | null>(null);
  const [guessResult, setGuessResult] = useState<GuessResponse | null>(null);
  const [captureResult, setCaptureResult] = useState<CaptureResponse | null>(null);
  const [userTranslation, setUserTranslation] = useState("");
  const [ballType, setBallType] = useState<BallType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { refresh: refreshUsage } = useUsage();

  const startNewQuest = useCallback(async () => {
    setPhase("selectLocation");
    setQuest(null);
    setScore(null);
    setGuessResult(null);
    setCaptureResult(null);
    setUserTranslation("");
    setBallType(null);
    setError(null);
    setLocations([]);

    try {
      const res = await questApi.getLocations();
      setLocations(res.data.locations);
    } catch (err) {
      setError(getErrorMessage(err, "場所の読み込みに失敗しました。もう一度試してください。続く場合はお問い合わせください"));
      setPhase("error");
    }
  }, []);

  const selectLocation = useCallback(async (locationId: string) => {
    setPhase("loading");
    setError(null);
    try {
      const res = await questApi.newQuest(locationId);
      setQuest(res.data);
      setPhase("translating");
    } catch (err) {
      setError(getErrorMessage(err, "データの読み込みに失敗しました。もう一度試してください。続く場合はお問い合わせください"));
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    startNewQuest(); // eslint-disable-line react-hooks/set-state-in-effect -- initial data fetch on mount
  }, [startNewQuest]);

  const handleActionError = (err: unknown, fallback: string) => {
    if (isRateLimitError(err)) return;
    setError(getErrorMessage(err, fallback));
    if (isSessionLostError(err)) {
      // セッション切断は同じセッションで再試行できないので、リスタート導線のある画面へ移す。
      setPhase("error");
    }
  };

  const submitTranslation = async (translation: string) => {
    try {
      setUserTranslation(translation);
      const res = await questApi.scoreTranslation(translation);
      setScore(res.data);
      setPhase("guessing");
      refreshUsage();
    } catch (err) {
      handleActionError(err, "採点に失敗しました");
    }
  };

  const submitGuess = async (guess: string) => {
    try {
      const res = await questApi.guessName(guess);
      setGuessResult(res.data);
      if (res.data.ball_type) {
        setBallType(res.data.ball_type);
      }
    } catch (err) {
      handleActionError(err, "名前の判定に失敗しました");
    }
  };

  const skipGuess = async () => {
    // 名前推測スキップはサーバに明示し、poke ボールを確定してから捕獲フェーズへ進む。
    try {
      const res = await questApi.skipGuess();
      setBallType(res.data.ball_type);
      setPhase("capturing");
    } catch (err) {
      handleActionError(err, "スキップに失敗しました");
    }
  };

  // ballType は guessName のレスポンスで既に確定している。ここで API を呼び直すと
  // 確定済みのボールを上書きしてしまう経路になるため、ローカルの状態遷移だけで進める。
  const proceedToCapture = () => {
    setPhase("capturing");
  };

  const capture = async () => {
    try {
      const res = await questApi.attemptCapture();
      setCaptureResult(res.data);
      setPhase("revealing");
    } catch (err) {
      handleActionError(err, "捕獲の判定に失敗しました");
    }
  };

  // 捕獲成否は capture() 時点で確定済み。演出 (CaptureEffect) の再生完了を
  // 受けて結果画面へ進むだけなので、API を呼び直さずローカルの状態遷移で進める。
  const revealCaptureResult = () => {
    setPhase("result");
  };

  return {
    phase,
    quest,
    locations,
    score,
    guessResult,
    captureResult,
    userTranslation,
    ballType,
    error,
    startNewQuest,
    selectLocation,
    submitTranslation,
    submitGuess,
    skipGuess,
    proceedToCapture,
    capture,
    revealCaptureResult,
  };
}
