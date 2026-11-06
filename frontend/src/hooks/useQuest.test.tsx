import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, expect } from "vitest";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import type { User } from "firebase/auth";
import type {
  QuestNewResponse,
  QuestLocation,
  ScoreResponse,
  GuessResponse,
  CaptureResponse,
} from "../../../shared/api-types/quest";
import { server, apiUrl, countRequests } from "../test/mswServer";
import { AuthContext } from "../contexts/AuthContext";
import { UsageProvider } from "../contexts/UsageContext";
import { useQuest } from "./useQuest";
import { defineCase } from "../test/defineCase";

const fakeUser = { uid: "trainer-test" } as unknown as User;

/** AuthContext + UsageProvider を被せる renderHook 用ラッパー。useQuest が依存する UsageContext を本物のまま通す。 */
function Wrapper({ children }: { children: ReactNode }) {
  const auth = {
    user: fakeUser,
    loading: false,
    login: async () => {},
    signup: async () => {},
    loginWithGoogle: async () => {},
    resetPassword: async () => {},
    logout: async () => {},
  };
  return (
    <AuthContext.Provider value={auth}>
      <UsageProvider>{children}</UsageProvider>
    </AuthContext.Provider>
  );
}

const questResp: QuestNewResponse = {
  pokemon_id: 25,
  description_en: "A wild creature.",
  is_legendary: false,
  is_mythical: false,
  max_guess_attempts: 3,
};

const scoreResp: ScoreResponse = {
  score: 75,
  review: "review",
  description_ja: "ja desc",
};

const captureResp: CaptureResponse = {
  captured: true,
  probability: 0.9,
  pokemon_id: 25,
  name_en: "Pikachu",
  name_ja: "ピカチュウ",
  sprite_url: "https://example.com/pikachu.png",
  score: 75,
  description_en: "desc en",
  description_ja: "desc ja",
  base_stat_total: 320,
  ball_type: "ultra",
  types: ["electric"],
  height: 4,
  weight: 60,
  is_legendary: false,
  is_mythical: false,
};

const grasslandLocation: QuestLocation = {
  id: "test-place",
  name: "テスト草原",
  description: "テスト用の場所",
  types: ["normal"],
};

/**
 * GET /quest/new が指定の出題を返す状態をモックする。
 * @param resp 返す出題レスポンス。
 */
function mockNewQuest(resp: QuestNewResponse = questResp) {
  server.use(http.get(apiUrl("/quest/new"), () => HttpResponse.json(resp)));
}

/** GET /quest/locations が「テスト草原」の 1 件を返す状態をモックする。 */
function mockGrasslandLocation() {
  server.use(
    http.get(apiUrl("/quest/locations"), () =>
      HttpResponse.json({ locations: [grasslandLocation] }),
    ),
  );
}

/** GET /quest/current が 404 (進行中のセッションが無い) を返す状態をモックする。 */
function mockNoQuestInProgress() {
  server.use(
    http.get(
      apiUrl("/quest/current"),
      () => new HttpResponse(null, { status: 404 }),
    ),
  );
}

/**
 * useQuest をマウントし、最初の場所を選んで出題を開始した状態にする。
 * @returns renderHook の戻り値。
 */
async function mountAndSelectLocation() {
  const hook = renderHook(() => useQuest(), { wrapper: Wrapper });
  await waitFor(() =>
    expect(hook.result.current.locations.length).toBeGreaterThan(0),
  );
  await act(async () => {
    await hook.result.current.selectLocation(
      hook.result.current.locations[0].id,
    );
  });
  return hook;
}

/**
 * 出題を得て翻訳の入力画面の段階になるまで進めた useQuest をマウントする。
 * @returns renderHook の戻り値。
 */
async function mountInTranslating() {
  mockNewQuest();
  const hook = await mountAndSelectLocation();
  await waitFor(() => expect(hook.result.current.phase).toBe("translating"));
  return hook;
}

type QuestHook = ReturnType<typeof useQuest>;

const guessCorrect: GuessResponse = {
  correct: true,
  ball_type: "ultra",
  language: "en",
  attempts_remaining: 2,
};

const captureFailed: CaptureResponse = {
  captured: false,
  probability: 0.2,
  pokemon_id: 25,
  name_en: "Pikachu",
  name_ja: "ピカチュウ",
  sprite_url: "https://example.com/p.png",
  score: 40,
  description_en: "x",
  description_ja: "y",
  base_stat_total: 320,
  ball_type: "poke",
  types: ["electric"],
  height: 4,
  weight: 60,
  is_legendary: false,
  is_mythical: false,
};

interface CommunicationOperation {
  path: string;
  when: string;
  successResponse: string;
  call: (r: QuestHook) => Promise<unknown>;
  buildSuccess: () => Response;
  recoveredOutcome: string;
  expectRecovered: (r: QuestHook) => void;
}

const translationOperation: CommunicationOperation = {
  path: "/quest/score",
  when: "出題を得た直後の翻訳の入力画面で、翻訳を送信して採点を依頼する",
  successResponse: "最終評価点 75、講評「review」、日本語版の説明「ja desc」の採点結果",
  call: (r) => r.submitTranslation("yaku"),
  buildSuccess: () => HttpResponse.json(scoreResp),
  recoveredOutcome:
    "表示画面が名前当て画面になり、採点結果は、最終評価点 75、講評「review」、日本語版の説明「ja desc」になる",
  expectRecovered: (r) => {
    expect(r.phase).toBe("guessing");
    expect(r.score).toEqual(scoreResp);
  },
};

const guessOperation: CommunicationOperation = {
  path: "/quest/guess-name",
  when: "出題を得た直後の翻訳の入力画面で、名前当ての回答として名前を送信する",
  successResponse: "不正解、残り挑戦回数 2 の名前当ての結果",
  call: (r) => r.submitGuess("Pikachu"),
  buildSuccess: () =>
    HttpResponse.json({ correct: false, attempts_remaining: 2 }),
  recoveredOutcome: "名前当ての結果は、不正解、残り挑戦回数 2 になる",
  expectRecovered: (r) => {
    expect(r.guessResult).toEqual({ correct: false, attempts_remaining: 2 });
  },
};

const hintOperation: CommunicationOperation = {
  path: "/quest/hint",
  when: "出題を得た直後の翻訳の入力画面で、ヒントを要求する",
  successResponse: "タイプ「でんき」、残り挑戦回数 2 のヒント",
  call: (r) => r.requestHint(),
  buildSuccess: () =>
    HttpResponse.json({ types: ["electric"], attempts_remaining: 2 }),
  recoveredOutcome: "ヒントの内容は、タイプ「でんき」、残り挑戦回数 2 になる",
  expectRecovered: (r) => {
    expect(r.hintResult).toEqual({
      types: ["electric"],
      attempts_remaining: 2,
    });
  },
};

const captureOperation: CommunicationOperation = {
  path: "/quest/capture",
  when: "出題を得た直後の翻訳の入力画面で、捕獲を実行する",
  successResponse:
    "捕獲成功、捕獲確率 0.9、ピカチュウ (図鑑番号 25)、最終評価点 75、ハイパーボールの捕獲結果",
  call: (r) => r.capture(),
  buildSuccess: () => HttpResponse.json(captureResp),
  recoveredOutcome:
    "表示画面が捕獲演出画面になり、捕獲結果は、捕獲成功、捕獲確率 0.9、ピカチュウ (図鑑番号 25)、最終評価点 75、ハイパーボールになる",
  expectRecovered: (r) => {
    expect(r.phase).toBe("revealing");
    expect(r.captureResult).toEqual(captureResp);
  },
};

const skipGuessOperation: CommunicationOperation = {
  path: "/quest/skip-guess",
  when: "出題を得た直後の翻訳の入力画面で、名前当てをスキップする",
  successResponse: "モンスターボール",
  call: (r) => r.skipGuess(),
  buildSuccess: () => HttpResponse.json({ ball_type: "poke" }),
  recoveredOutcome:
    "表示画面が捕獲待機画面になり、獲得したボールはモンスターボールになる",
  expectRecovered: (r) => {
    expect(r.phase).toBe("capturing");
    expect(r.ballType).toBe("poke");
  },
};

async function startNewQuestAfterProgress() {
  mockNoQuestInProgress();
  server.use(
    http.post(apiUrl("/quest/score"), () => HttpResponse.json(scoreResp)),
    http.post(apiUrl("/quest/guess-name"), () =>
      HttpResponse.json(guessCorrect),
    ),
    http.post(apiUrl("/quest/hint"), () =>
      HttpResponse.json({ types: ["normal"], attempts_remaining: 2 }),
    ),
  );
  const hook = await mountInTranslating();
  await act(async () => {
    await hook.result.current.submitTranslation("テスト");
  });
  await act(async () => {
    await hook.result.current.submitGuess("Pikachu");
  });
  await act(async () => {
    await hook.result.current.requestHint();
  });
  mockNewQuest({ ...questResp, pokemon_id: 1 });
  await act(async () => {
    await hook.result.current.startNewQuest();
  });
  return hook;
}

const QUEST_DETAIL = "図鑑番号 25、英語の説明文「A wild creature.」、伝説でも幻でもない、最大挑戦回数 3";
const QUEST_FROM_BACKEND = `${QUEST_DETAIL}の出題`;
const NO_QUEST_IN_PROGRESS = "現在のクエストの問い合わせが 404 (進行中のセッションが無い) を返し";
const GRASSLAND_FROM_BACKEND = "バックエンドが場所「テスト草原」の 1 件を返す";

const SELECT_LOCATION = "場所の選択画面で、場所を選んで出題を開始する";
const RESELECT_LOCATION = "場所の選択画面で、場所を選び直して出題を開始する";
const RETURN_FROM_ERROR_SCREEN = "エラー画面で、「もう一度探す」を押して場所の選択画面に戻る";
const OPEN_QUEST_SCREEN_TO_START = "クエスト画面を開いて、新しいクエストを開始する";
const OPEN_QUEST_SCREEN_TO_RESUME = "クエスト画面を開いて、進行中のクエストを再開する";
const IN_TRANSLATING = "出題を得た直後の翻訳の入力画面で、";

const TRANSLATING_SCREEN = "呼び出し元に返る表示画面が翻訳の入力画面になる";
const GUESSING_SCREEN = "呼び出し元に返る表示画面が名前当て画面になる";
const CAPTURING_SCREEN = "呼び出し元に返る表示画面が捕獲待機画面になる";
const ERROR_SCREEN = "呼び出し元に返る表示画面がエラー画面になる";
const SELECT_LOCATION_SCREEN = "呼び出し元に返る表示画面が場所の選択画面になる";
const GRASSLAND_LIST = "呼び出し元に返る場所の一覧は、「テスト草原」の 1 件になる";
const ERROR_MESSAGE_CLEARED = "エラーメッセージが消える";
const QUEST_CONTENT = `呼び出し元に返る出題の内容は、${QUEST_DETAIL}になる`;
const SCORE_CONTENT =
  "呼び出し元に返る採点結果は、最終評価点 75、講評「review」、日本語版の説明「ja desc」になる";
const HINT_CONTENT = "呼び出し元に返るヒントの内容は、タイプ「でんき」、残り挑戦回数 2 になる";
const ULTRA_BALL = "呼び出し元に返る獲得したボールはハイパーボールになる";

const NEW_QUEST_FAILURE_MESSAGES = [
  { status: 401, message: "認証に失敗しました" },
  { status: 403, message: "アクセス権がありません" },
  { status: 404, message: "セッションが切断されました" },
  { status: 502, message: "外部サービスが応答しません" },
];

function mockNewQuestFailure() {
  server.use(
    http.get(apiUrl("/quest/new"), () => HttpResponse.json({}, { status: 500 })),
  );
}

async function selectLocationWhenNewQuestFails(status: number) {
  server.use(
    http.get(apiUrl("/quest/new"), () => HttpResponse.json({}, { status })),
  );

  const { result } = await mountAndSelectLocation();
  await waitFor(() => expect(result.current.phase).toBe("error"));
  return result;
}

const newQuestFailures = [
  {
    cause: "出題の取得が 500 で失敗するとき",
    fail: () =>
      server.use(
        http.get(apiUrl("/quest/new"), () => HttpResponse.json({}, { status: 500 })),
      ),
  },
  {
    cause: "出題の取得が 401 で失敗するとき",
    fail: () =>
      server.use(
        http.get(apiUrl("/quest/new"), () => HttpResponse.json({}, { status: 401 })),
      ),
  },
  {
    cause: "出題の取得が 403 で失敗するとき",
    fail: () =>
      server.use(
        http.get(apiUrl("/quest/new"), () => HttpResponse.json({}, { status: 403 })),
      ),
  },
  {
    cause: "出題の取得が 404 で失敗するとき",
    fail: () =>
      server.use(
        http.get(apiUrl("/quest/new"), () => HttpResponse.json({}, { status: 404 })),
      ),
  },
  {
    cause: "ネットワークが切れていて、出題の取得に応答が無いとき",
    fail: () => server.use(http.get(apiUrl("/quest/new"), () => HttpResponse.error())),
  },
];

async function retryAfterNewQuestFailure(fail: () => void) {
  fail();
  const failed = await mountAndSelectLocation();
  await waitFor(() => expect(failed.result.current.phase).toBe("error"));

  mockNoQuestInProgress();
  mockNewQuest();
  await act(async () => {
    await failed.result.current.startNewQuest();
  });
  await waitFor(() => expect(failed.result.current.locations.length).toBeGreaterThan(0));
  await act(async () => {
    await failed.result.current.selectLocation(failed.result.current.locations[0].id);
  });
  return failed.result;
}

describe("[本体:クエスト]場所選択と出題の開始", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        { Given: "バックエンドが出題を返すとき", When: [SELECT_LOCATION], Then: TRANSLATING_SCREEN },
      ],
    },
    async () => {
      mockNewQuest();

      const { result } = await mountAndSelectLocation();

      await waitFor(() => expect(result.current.phase).toBe("translating"));
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: `バックエンドが${QUEST_FROM_BACKEND}を返すとき`,
          When: [SELECT_LOCATION],
          Then: QUEST_CONTENT,
        },
      ],
    },
    async () => {
      mockNewQuest();

      const { result } = await mountAndSelectLocation();

      await waitFor(() => expect(result.current.quest).toEqual(questResp));
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      観点: ["外部依存の失敗"],
      steps: [
        {
          Given: "出題の取得が 500 で失敗するとき",
          When: [SELECT_LOCATION],
          Then: ERROR_SCREEN,
        },
      ],
    },
    async () => {
      mockNewQuestFailure();

      const { result } = await mountAndSelectLocation();

      await waitFor(() => expect(result.current.phase).toBe("error"));
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      観点: ["外部依存の失敗"],
      steps: [
        {
          Given: "出題の取得が 500 で失敗するとき",
          When: [SELECT_LOCATION],
          Then: "エラーメッセージに「データの読み込みに失敗しました」が含まれる",
        },
      ],
    },
    async () => {
      mockNewQuestFailure();

      const { result } = await mountAndSelectLocation();
      await waitFor(() => expect(result.current.phase).toBe("error"));

      expect(result.current.error).toContain("データの読み込みに失敗しました");
    },
  );

  for (const { status, message } of NEW_QUEST_FAILURE_MESSAGES) {
    defineCase(
      {
        種別: "部品間結合テスト",
        正常異常: "異常系",
        観点: ["外部依存の失敗"],
        steps: [
          {
            Given: `出題の取得が ${status} で失敗するとき`,
            When: [SELECT_LOCATION],
            Then: `エラーメッセージに「${message}」が含まれる`,
          },
        ],
      },
      async () => {
        const result = await selectLocationWhenNewQuestFails(status);

        expect(result.current.error).toContain(message);
      },
    );
  }

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      観点: ["外部依存の失敗"],
      steps: [
        {
          Given: "ネットワークが切れていて、出題の取得に応答が無いとき",
          When: [SELECT_LOCATION],
          Then: "エラーメッセージに「サーバーに接続できません」が含まれる",
        },
      ],
    },
    async () => {
      server.use(http.get(apiUrl("/quest/new"), () => HttpResponse.error()));

      const { result } = await mountAndSelectLocation();
      await waitFor(() => expect(result.current.phase).toBe("error"));

      expect(result.current.error).toContain("サーバーに接続できません");
    },
  );

  for (const { cause, fail } of newQuestFailures) {
    defineCase(
      {
        種別: "部品間結合テスト",
        正常異常: "異常系",
        観点: ["外部依存の失敗", "回復確認"],
        steps: [
          { Given: cause, When: [SELECT_LOCATION], Then: ERROR_SCREEN },
          {
            Given: `${NO_QUEST_IN_PROGRESS}、バックエンドが${QUEST_FROM_BACKEND}を返すとき`,
            When: [RETURN_FROM_ERROR_SCREEN, RESELECT_LOCATION],
            Then: TRANSLATING_SCREEN,
          },
        ],
      },
      async () => {
        const result = await retryAfterNewQuestFailure(fail);

        await waitFor(() => expect(result.current.phase).toBe("translating"));
      },
    );

    defineCase(
      {
        種別: "部品間結合テスト",
        正常異常: "異常系",
        観点: ["外部依存の失敗", "回復確認"],
        steps: [
          { Given: cause, When: [SELECT_LOCATION], Then: ERROR_SCREEN },
          {
            Given: `${NO_QUEST_IN_PROGRESS}、バックエンドが${QUEST_FROM_BACKEND}を返すとき`,
            When: [RETURN_FROM_ERROR_SCREEN, RESELECT_LOCATION],
            Then: ERROR_MESSAGE_CLEARED,
          },
        ],
      },
      async () => {
        const result = await retryAfterNewQuestFailure(fail);

        await waitFor(() => expect(result.current.phase).toBe("translating"));
        expect(result.current.error).toBeNull();
      },
    );
  }
});

const SCORE_FROM_BACKEND =
  "バックエンドが最終評価点 75、講評「review」、日本語版の説明「ja desc」の採点結果を返すとき";
const SUBMIT_TRANSLATION = "翻訳の入力画面で、翻訳「テスト翻訳」を送信して採点を依頼する";

async function submitTranslationSuccessfully() {
  server.use(http.post(apiUrl("/quest/score"), () => HttpResponse.json(scoreResp)));
  const { result } = await mountInTranslating();
  await act(async () => {
    await result.current.submitTranslation("テスト翻訳");
  });
  return result;
}

describe("[本体:採点]翻訳の採点", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [{ Given: SCORE_FROM_BACKEND, When: [SUBMIT_TRANSLATION], Then: GUESSING_SCREEN }],
    },
    async () => {
      const result = await submitTranslationSuccessfully();

      expect(result.current.phase).toBe("guessing");
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [{ Given: SCORE_FROM_BACKEND, When: [SUBMIT_TRANSLATION], Then: SCORE_CONTENT }],
    },
    async () => {
      const result = await submitTranslationSuccessfully();

      expect(result.current.score).toEqual(scoreResp);
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: SCORE_FROM_BACKEND,
          When: [SUBMIT_TRANSLATION],
          Then: "呼び出し元に返る入力した翻訳は「テスト翻訳」になる",
        },
      ],
    },
    async () => {
      const result = await submitTranslationSuccessfully();

      expect(result.current.userTranslation).toBe("テスト翻訳");
    },
  );
});

const CORRECT_GUESS_FROM_BACKEND =
  "バックエンドが、正解、獲得したボールはハイパーボール、回答の言語は英語、残り挑戦回数 2 を返すとき";
const SUBMIT_PIKACHU = `${IN_TRANSLATING}名前当ての回答として、名前「Pikachu」を送信する`;

async function submitCorrectGuess() {
  server.use(http.post(apiUrl("/quest/guess-name"), () => HttpResponse.json(guessCorrect)));
  const { result } = await mountInTranslating();
  await act(async () => {
    await result.current.submitGuess("Pikachu");
  });
  return result;
}

describe("[本体:名前当て]名前当ての回答", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: CORRECT_GUESS_FROM_BACKEND,
          When: [SUBMIT_PIKACHU],
          Then: "呼び出し元に返る名前当ての結果は、正解、ハイパーボール、回答の言語は英語、残り挑戦回数 2 になる",
        },
      ],
    },
    async () => {
      const result = await submitCorrectGuess();

      expect(result.current.guessResult).toEqual(guessCorrect);
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [{ Given: CORRECT_GUESS_FROM_BACKEND, When: [SUBMIT_PIKACHU], Then: ULTRA_BALL }],
    },
    async () => {
      const result = await submitCorrectGuess();

      expect(result.current.ballType).toBe("ultra");
    },
  );
});

const SKIP_GUESS = `${IN_TRANSLATING}名前当てをスキップする`;

async function skipGuessSuccessfully() {
  server.use(
    http.post(apiUrl("/quest/skip-guess"), () => HttpResponse.json({ ball_type: "poke" })),
  );
  const { result } = await mountInTranslating();
  await act(async () => {
    await result.current.skipGuess();
  });
  return result;
}

describe("[本体:名前当て]名前当てのスキップ", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "バックエンドがモンスターボールを返すとき",
          When: [SKIP_GUESS],
          Then: "バックエンドへスキップの要求が 1 回届く",
        },
      ],
    },
    async () => {
      await skipGuessSuccessfully();

      expect(countRequests("/quest/skip-guess")).toBe(1);
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "バックエンドがモンスターボールを返すとき",
          When: [SKIP_GUESS],
          Then: "呼び出し元に返る獲得したボールはモンスターボールになる",
        },
      ],
    },
    async () => {
      const result = await skipGuessSuccessfully();

      expect(result.current.ballType).toBe("poke");
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        { Given: "バックエンドがモンスターボールを返すとき", When: [SKIP_GUESS], Then: CAPTURING_SCREEN },
      ],
    },
    async () => {
      const result = await skipGuessSuccessfully();

      expect(result.current.phase).toBe("capturing");
    },
  );
});

const AFTER_CORRECT_GUESS = "名前「Pikachu」の送信に正解し、ハイパーボールを獲得しているとき";
const PROCEED_TO_CAPTURE = "名前当て画面で、「次へ進む」を押して捕獲待機に移行する";

async function proceedToCaptureAfterCorrectGuess() {
  server.use(http.post(apiUrl("/quest/guess-name"), () => HttpResponse.json(guessCorrect)));
  const { result } = await mountInTranslating();
  await act(async () => {
    await result.current.submitGuess("Pikachu");
  });
  act(() => {
    result.current.proceedToCapture();
  });
  return result;
}

describe("[本体:名前当て]名前当てから捕獲待機への移行", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [{ Given: AFTER_CORRECT_GUESS, When: [PROCEED_TO_CAPTURE], Then: CAPTURING_SCREEN }],
    },
    async () => {
      const result = await proceedToCaptureAfterCorrectGuess();

      expect(result.current.phase).toBe("capturing");
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: AFTER_CORRECT_GUESS,
          When: [PROCEED_TO_CAPTURE],
          Then: "バックエンドへスキップの要求が届かない",
        },
      ],
    },
    async () => {
      await proceedToCaptureAfterCorrectGuess();

      expect(countRequests("/quest/skip-guess")).toBe(0);
    },
  );
});

const ELECTRIC_HINT_FROM_BACKEND = "バックエンドがタイプ「でんき」と残り挑戦回数 2 を返すとき";
const TWO_HINTS_FROM_BACKEND =
  "1 回目の要求でバックエンドがタイプ「でんき」と残り挑戦回数 2 を返し、2 回目の要求で技「たいあたり」「なきごえ」「でんきショック」と残り挑戦回数 1 を返すとき";
const REQUEST_HINT = `${IN_TRANSLATING}ヒントを要求する`;
const REQUEST_HINT_TWICE = `${IN_TRANSLATING}ヒントを 2 回続けて要求する`;

async function requestHintOnce() {
  server.use(
    http.post(apiUrl("/quest/hint"), () =>
      HttpResponse.json({
        types: ["electric"],
        attempts_remaining: 2,
      }),
    ),
  );
  const { result } = await mountInTranslating();
  await act(async () => {
    await result.current.requestHint();
  });
  return result;
}

async function requestHintTwice() {
  server.use(
    http.post(apiUrl("/quest/hint"), () =>
      HttpResponse.json({
        types: ["electric"],
        attempts_remaining: 2,
      }),
    ),
  );
  const { result } = await mountInTranslating();
  await act(async () => {
    await result.current.requestHint();
  });
  server.use(
    http.post(apiUrl("/quest/hint"), () =>
      HttpResponse.json({
        moves: ["たいあたり", "なきごえ", "でんきショック"],
        attempts_remaining: 1,
      }),
    ),
  );
  await act(async () => {
    await result.current.requestHint();
  });
  return result;
}

describe("[本体:名前当て]ヒントの要求", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [{ Given: ELECTRIC_HINT_FROM_BACKEND, When: [REQUEST_HINT], Then: HINT_CONTENT }],
    },
    async () => {
      const result = await requestHintOnce();

      expect(result.current.hintResult).toEqual({
        types: ["electric"],
        attempts_remaining: 2,
      });
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: ELECTRIC_HINT_FROM_BACKEND,
          When: [REQUEST_HINT],
          Then: "呼び出し元に返る残り挑戦回数は 2 になる",
        },
      ],
    },
    async () => {
      const result = await requestHintOnce();

      expect(result.current.attemptsRemaining).toBe(2);
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: TWO_HINTS_FROM_BACKEND,
          When: [REQUEST_HINT_TWICE],
          Then: "呼び出し元に返るヒントの内容は、タイプ「でんき」と、技「たいあたり」「なきごえ」「でんきショック」の両方を含み、残り挑戦回数 1 になる",
        },
      ],
    },
    async () => {
      const result = await requestHintTwice();

      expect(result.current.hintResult).toEqual({
        types: ["electric"],
        moves: ["たいあたり", "なきごえ", "でんきショック"],
        attempts_remaining: 1,
      });
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: TWO_HINTS_FROM_BACKEND,
          When: [REQUEST_HINT_TWICE],
          Then: "呼び出し元に返る残り挑戦回数は 1 になる",
        },
      ],
    },
    async () => {
      const result = await requestHintTwice();

      expect(result.current.attemptsRemaining).toBe(1);
    },
  );
});

const CAPTURE_SUCCESS_FROM_BACKEND =
  "バックエンドが、捕獲成功、捕獲確率 0.9、ピカチュウ (図鑑番号 25)、最終評価点 75、ハイパーボールの捕獲結果を返すとき";
const CAPTURE_FAILURE_FROM_BACKEND =
  "バックエンドが、捕獲失敗、捕獲確率 0.2、ピカチュウ (図鑑番号 25)、最終評価点 40、モンスターボールの捕獲結果を返すとき";
const EXECUTE_CAPTURE = `${IN_TRANSLATING}捕獲を実行する`;

async function captureSuccessfully() {
  server.use(http.post(apiUrl("/quest/capture"), () => HttpResponse.json(captureResp)));
  const { result } = await mountInTranslating();
  await act(async () => {
    await result.current.capture();
  });
  return result;
}

async function finishCaptureEffect() {
  server.use(http.post(apiUrl("/quest/capture"), () => HttpResponse.json(captureFailed)));
  const { result } = await mountInTranslating();
  await act(async () => {
    await result.current.capture();
  });
  expect(result.current.phase).toBe("revealing");
  act(() => {
    result.current.revealCaptureResult();
  });
  return result;
}

describe("[本体:捕獲]捕獲の実行", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: CAPTURE_SUCCESS_FROM_BACKEND,
          When: [EXECUTE_CAPTURE],
          Then: "呼び出し元に返る表示画面が捕獲演出画面になる",
        },
      ],
    },
    async () => {
      const result = await captureSuccessfully();

      expect(result.current.phase).toBe("revealing");
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: CAPTURE_SUCCESS_FROM_BACKEND,
          When: [EXECUTE_CAPTURE],
          Then: "呼び出し元に返る捕獲結果は、捕獲成功、捕獲確率 0.9、ピカチュウ (図鑑番号 25)、最終評価点 75、ハイパーボールになる",
        },
      ],
    },
    async () => {
      const result = await captureSuccessfully();

      expect(result.current.captureResult).toEqual(captureResp);
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: CAPTURE_FAILURE_FROM_BACKEND,
          When: [EXECUTE_CAPTURE, "捕獲演出画面で、捕獲演出を終えて捕獲結果画面に進む"],
          Then: "呼び出し元に返る表示画面が捕獲結果画面になる",
        },
      ],
    },
    async () => {
      const result = await finishCaptureEffect();

      expect(result.current.phase).toBe("result");
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: CAPTURE_FAILURE_FROM_BACKEND,
          When: [EXECUTE_CAPTURE, "捕獲演出画面で、捕獲演出を終えて捕獲結果画面に進む"],
          Then: "呼び出し元に返る捕獲結果は、演出が終わる前と同じ、捕獲失敗、捕獲確率 0.2、ピカチュウ (図鑑番号 25)、最終評価点 40、モンスターボールになる",
        },
      ],
    },
    async () => {
      const result = await finishCaptureEffect();

      expect(result.current.captureResult).toEqual(captureFailed);
    },
  );
});

const PROGRESSED_STATE =
  "現在のクエストの問い合わせが 404 (進行中のセッションが無い) を返す状態で、翻訳「テスト」の最終評価点 75 の採点結果と、名前「Pikachu」への正解で獲得したハイパーボールと、ヒントのタイプ「ノーマル」と残り挑戦回数 2 が得られている";
const START_NEW_QUEST = "クエスト画面で、新しいクエストを開始する";
const NEW_QUEST_FIRST_FROM_BACKEND =
  "バックエンドが図鑑番号 1、英語の説明文「A wild creature.」、伝説でも幻でもない、最大挑戦回数 3 の出題を返すとき";
const RETRY_AFTER_ERROR_SCREEN_GIVEN = `${NO_QUEST_IN_PROGRESS}、${GRASSLAND_FROM_BACKEND}とき`;
const RETRY_AFTER_ERROR_SCREEN = "エラー画面で、「もう一度探す」を押して新しいクエストを開始する";

async function reselectLocation() {
  const { result } = await startNewQuestAfterProgress();
  await waitFor(() => expect(result.current.locations.length).toBeGreaterThan(0));
  await act(async () => {
    await result.current.selectLocation(result.current.locations[0].id);
  });
  return result;
}

async function retryAfterFailureScreen() {
  const { result } = renderHook(() => useQuest(), {
    wrapper: Wrapper,
  });
  await waitFor(() => expect(result.current.phase).toBe("error"));

  mockNoQuestInProgress();
  mockGrasslandLocation();
  await act(async () => {
    await result.current.startNewQuest();
  });
  return result;
}

async function retryAfterLocationsFailure() {
  server.use(
    http.get(apiUrl("/quest/locations"), () => HttpResponse.json({}, { status: 500 })),
  );
  return retryAfterFailureScreen();
}

async function retryAfterCurrentQuestFailure() {
  server.use(
    http.get(apiUrl("/quest/current"), () => HttpResponse.json({}, { status: 502 })),
  );
  return retryAfterFailureScreen();
}

describe("[本体:クエスト]新しいクエストの開始", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: `${PROGRESSED_STATE}とき`,
          When: [START_NEW_QUEST],
          Then: "呼び出し元に返る表示画面が場所の選択画面に戻る",
        },
      ],
    },
    async () => {
      const { result } = await startNewQuestAfterProgress();

      expect(result.current.phase).toBe("selectLocation");
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: `${PROGRESSED_STATE}とき`,
          When: [START_NEW_QUEST],
          Then: "呼び出し元に返る採点結果が無い状態になる",
        },
      ],
    },
    async () => {
      const { result } = await startNewQuestAfterProgress();

      expect(result.current.score).toBeNull();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: `${PROGRESSED_STATE}とき`,
          When: [START_NEW_QUEST],
          Then: "呼び出し元に返る入力した翻訳が空文字になる",
        },
      ],
    },
    async () => {
      const { result } = await startNewQuestAfterProgress();

      expect(result.current.userTranslation).toBe("");
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: `${PROGRESSED_STATE}とき`,
          When: [START_NEW_QUEST],
          Then: "呼び出し元に返る獲得したボールが無い状態に戻る",
        },
      ],
    },
    async () => {
      const { result } = await startNewQuestAfterProgress();

      expect(result.current.ballType).toBeNull();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: `${PROGRESSED_STATE}とき`,
          When: [START_NEW_QUEST],
          Then: "呼び出し元に返る残り挑戦回数が無い状態に戻る",
        },
      ],
    },
    async () => {
      const { result } = await startNewQuestAfterProgress();

      expect(result.current.attemptsRemaining).toBeNull();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: `${PROGRESSED_STATE}とき`,
          When: [START_NEW_QUEST],
          Then: "呼び出し元に返るヒントの内容が無い状態になる",
        },
      ],
    },
    async () => {
      const { result } = await startNewQuestAfterProgress();

      expect(result.current.hintResult).toBeNull();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: `${PROGRESSED_STATE}状態で、${NEW_QUEST_FIRST_FROM_BACKEND}`,
          When: [START_NEW_QUEST, RESELECT_LOCATION],
          Then: TRANSLATING_SCREEN,
        },
      ],
    },
    async () => {
      const result = await reselectLocation();

      expect(result.current.phase).toBe("translating");
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: `${PROGRESSED_STATE}状態で、${NEW_QUEST_FIRST_FROM_BACKEND}`,
          When: [START_NEW_QUEST, RESELECT_LOCATION],
          Then: "呼び出し元に返る出題の内容は、図鑑番号 1、英語の説明文「A wild creature.」、伝説でも幻でもない、最大挑戦回数 3 になる",
        },
      ],
    },
    async () => {
      const result = await reselectLocation();

      expect(result.current.quest).toEqual({
        ...questResp,
        pokemon_id: 1,
      });
    },
  );

  const failures = [
    {
      failure: "場所の一覧の取得が 500 で失敗するとき",
      retry: retryAfterLocationsFailure,
    },
    {
      failure: "現在のクエストの問い合わせが 502 で失敗するとき",
      retry: retryAfterCurrentQuestFailure,
    },
  ];

  for (const { failure, retry } of failures) {
    defineCase(
      {
        種別: "部品間結合テスト",
        正常異常: "異常系",
        観点: ["外部依存の失敗", "回復確認"],
        steps: [
          { Given: failure, When: [OPEN_QUEST_SCREEN_TO_START], Then: ERROR_SCREEN },
          {
            Given: RETRY_AFTER_ERROR_SCREEN_GIVEN,
            When: [RETRY_AFTER_ERROR_SCREEN],
            Then: SELECT_LOCATION_SCREEN,
          },
        ],
      },
      async () => {
        const result = await retry();

        expect(result.current.phase).toBe("selectLocation");
      },
    );

    defineCase(
      {
        種別: "部品間結合テスト",
        正常異常: "異常系",
        観点: ["外部依存の失敗", "回復確認"],
        steps: [
          { Given: failure, When: [OPEN_QUEST_SCREEN_TO_START], Then: ERROR_SCREEN },
          {
            Given: RETRY_AFTER_ERROR_SCREEN_GIVEN,
            When: [RETRY_AFTER_ERROR_SCREEN],
            Then: GRASSLAND_LIST,
          },
        ],
      },
      async () => {
        const result = await retry();

        await waitFor(() => expect(result.current.locations).toEqual([grasslandLocation]));
      },
    );

    defineCase(
      {
        種別: "部品間結合テスト",
        正常異常: "異常系",
        観点: ["外部依存の失敗", "回復確認"],
        steps: [
          { Given: failure, When: [OPEN_QUEST_SCREEN_TO_START], Then: ERROR_SCREEN },
          {
            Given: RETRY_AFTER_ERROR_SCREEN_GIVEN,
            When: [RETRY_AFTER_ERROR_SCREEN],
            Then: ERROR_MESSAGE_CLEARED,
          },
        ],
      },
      async () => {
        const result = await retry();

        expect(result.current.error).toBeNull();
      },
    );
  }
});

const FAILURE_RESPONSES: { status: number; body: Record<string, string> }[] = [
  { status: 429, body: { error: "user", message: "x" } },
  { status: 502, body: {} },
];

function defineCommunicationErrorCases(operation: CommunicationOperation) {
  const { path, call, buildSuccess, when, successResponse, recoveredOutcome, expectRecovered } =
    operation;
  const retryWhen = [when, "同じ翻訳の入力画面で、直前と同じ操作をもう一度行う"] as const;

  async function mountAndCall(status: number, body: Record<string, string>) {
    server.use(http.post(apiUrl(path), () => HttpResponse.json(body, { status })));
    const hook = await mountInTranslating();
    await act(async () => {
      await call(hook.result.current);
    });
    return hook.result;
  }

  async function retryAfterBackendFailure(status: number, body: Record<string, string>) {
    const result = await mountAndCall(status, body);
    server.use(http.post(apiUrl(path), buildSuccess));
    await act(async () => {
      await call(result.current);
    });
    return result;
  }

  const recoveryGiven = (status: number) =>
    `1 回目はバックエンドが ${status} を返し、2 回目は成功の応答として${successResponse}を返すとき`;

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      観点: ["外部依存の失敗"],
      steps: [{ Given: "バックエンドが 429 を返すとき", When: [when], Then: "エラーメッセージは出ない" }],
    },
    async () => {
      const result = await mountAndCall(429, { error: "user", message: "x" });

      expect(result.current.error).toBeNull();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      観点: ["外部依存の失敗"],
      steps: [
        {
          Given: "バックエンドが 502 を返すとき",
          When: [when],
          Then: "エラーメッセージに「外部サービスが応答しません」が含まれる",
        },
      ],
    },
    async () => {
      const result = await mountAndCall(502, {});

      expect(result.current.error).toContain("外部サービスが応答しません");
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      観点: ["外部依存の失敗"],
      steps: [
        { Given: "バックエンドが 404 (セッション切れ) を返すとき", When: [when], Then: ERROR_SCREEN },
      ],
    },
    async () => {
      const result = await mountAndCall(404, {});

      expect(result.current.phase).toBe("error");
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      観点: ["外部依存の失敗"],
      steps: [
        {
          Given: "バックエンドが 404 (セッション切れ) を返すとき",
          When: [when],
          Then: "エラーメッセージに「セッションが切断されました」が含まれる",
        },
      ],
    },
    async () => {
      const result = await mountAndCall(404, {});

      expect(result.current.error).toContain("セッションが切断されました");
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      観点: ["外部依存の失敗", "回復確認"],
      steps: [{ Given: recoveryGiven(502), When: retryWhen, Then: ERROR_MESSAGE_CLEARED }],
    },
    async () => {
      const result = await retryAfterBackendFailure(502, {});

      expect(result.current.error).toBeNull();
    },
  );

  for (const { status, body } of FAILURE_RESPONSES) {
    defineCase(
      {
        種別: "部品間結合テスト",
        正常異常: "異常系",
        観点: ["外部依存の失敗", "回復確認"],
        steps: [{ Given: recoveryGiven(status), When: retryWhen, Then: recoveredOutcome }],
      },
      async () => {
        const result = await retryAfterBackendFailure(status, body);

        expectRecovered(result.current);
      },
    );
  }

  for (const { status, body } of FAILURE_RESPONSES) {
    defineCase(
      {
        種別: "部品間結合テスト",
        正常異常: "異常系",
        観点: ["外部依存の失敗"],
        steps: [
          {
            Given: `バックエンドが ${status} を返すとき`,
            When: [when],
            Then: "呼び出し元に返る表示画面が翻訳の入力画面のままになる",
          },
        ],
      },
      async () => {
        const result = await mountAndCall(status, body);

        expect(result.current.phase).toBe("translating");
      },
    );
  }
}

describe("[本体:クエスト]進行中の通信エラーの扱い", () => {
  defineCommunicationErrorCases(translationOperation);
  defineCommunicationErrorCases(guessOperation);
  defineCommunicationErrorCases(hintOperation);
  defineCommunicationErrorCases(skipGuessOperation);
  defineCommunicationErrorCases(captureOperation);
});

const CURRENT_QUEST_FAILS_502 = "現在のクエストの問い合わせが 502 で失敗するとき";
const LOCATIONS_FAIL_500 = "場所の一覧の取得が 500 で失敗するとき";

async function mountResumedTranslating() {
  server.use(
    http.get(apiUrl("/quest/current"), () =>
      HttpResponse.json({ phase: "translating", quest: questResp }),
    ),
  );
  const { result } = renderHook(() => useQuest(), {
    wrapper: Wrapper,
  });
  await waitFor(() => expect(result.current.phase).toBe("translating"));
  return result;
}

const electricHint = { types: ["electric"], attempts_remaining: 2 };

async function mountResumedGuessing() {
  server.use(
    http.get(apiUrl("/quest/current"), () =>
      HttpResponse.json({
        phase: "guessing",
        quest: questResp,
        score: scoreResp,
        user_translation: "テスト訳",
        attempts_remaining: 2,
        hint: electricHint,
      }),
    ),
  );
  const { result } = renderHook(() => useQuest(), {
    wrapper: Wrapper,
  });
  await waitFor(() => expect(result.current.phase).toBe("guessing"));
  return result;
}

async function mountResumedCapturing() {
  server.use(
    http.get(apiUrl("/quest/current"), () =>
      HttpResponse.json({
        phase: "capturing",
        quest: questResp,
        ball_type: "ultra",
      }),
    ),
  );
  const { result } = renderHook(() => useQuest(), {
    wrapper: Wrapper,
  });
  await waitFor(() => expect(result.current.phase).toBe("capturing"));
  return result;
}

async function mountWithResumeDisabled() {
  server.use(
    http.get(apiUrl("/quest/current"), () =>
      HttpResponse.json({ phase: "translating", quest: questResp }),
    ),
  );
  const { result } = renderHook(() => useQuest({ enableResume: false }), {
    wrapper: Wrapper,
  });
  await waitFor(() => expect(result.current.locations.length).toBeGreaterThan(0));
  return result;
}

async function mountWithLocationsFailure() {
  server.use(
    http.get(apiUrl("/quest/locations"), () => HttpResponse.json({}, { status: 500 })),
  );
  const { result } = renderHook(() => useQuest(), {
    wrapper: Wrapper,
  });
  await waitFor(() => expect(result.current.phase).toBe("error"));
  return result;
}

async function mountWithCurrentQuestFailure() {
  server.use(
    http.get(apiUrl("/quest/current"), () => HttpResponse.json({}, { status: 502 })),
  );
  const { result } = renderHook(() => useQuest(), {
    wrapper: Wrapper,
  });
  await waitFor(() => expect(result.current.phase).toBe("error"));
  return result;
}

describe("[本体:クエスト]クエストの再開", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: `${NO_QUEST_IN_PROGRESS}、${GRASSLAND_FROM_BACKEND}とき`,
          When: [OPEN_QUEST_SCREEN_TO_RESUME],
          Then: GRASSLAND_LIST,
        },
      ],
    },
    async () => {
      mockNoQuestInProgress();
      mockGrasslandLocation();

      const { result } = renderHook(() => useQuest(), {
        wrapper: Wrapper,
      });

      await waitFor(() => expect(result.current.locations).toEqual([grasslandLocation]));
    },
  );

  const TRANSLATING_SESSION = `現在のクエストの問い合わせが、翻訳の入力画面の段階で${QUEST_FROM_BACKEND}を返すとき`;

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [{ Given: TRANSLATING_SESSION, When: [OPEN_QUEST_SCREEN_TO_RESUME], Then: TRANSLATING_SCREEN }],
    },
    async () => {
      const result = await mountResumedTranslating();

      expect(result.current.phase).toBe("translating");
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [{ Given: TRANSLATING_SESSION, When: [OPEN_QUEST_SCREEN_TO_RESUME], Then: QUEST_CONTENT }],
    },
    async () => {
      const result = await mountResumedTranslating();

      expect(result.current.quest).toEqual(questResp);
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: TRANSLATING_SESSION,
          When: [OPEN_QUEST_SCREEN_TO_RESUME],
          Then: "バックエンドへ場所の一覧の取得要求が届かない",
        },
      ],
    },
    async () => {
      await mountResumedTranslating();

      expect(countRequests("/quest/locations")).toBe(0);
    },
  );

  const GUESSING_SESSION =
    "現在のクエストの問い合わせが、名前当て画面の段階で、図鑑番号 25 の出題、最終評価点 75、講評「review」、日本語版の説明「ja desc」の採点結果、翻訳「テスト訳」、残り挑戦回数 2、ヒント (タイプ「でんき」、残り挑戦回数 2) を返すとき";

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [{ Given: GUESSING_SESSION, When: [OPEN_QUEST_SCREEN_TO_RESUME], Then: GUESSING_SCREEN }],
    },
    async () => {
      const result = await mountResumedGuessing();

      expect(result.current.phase).toBe("guessing");
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [{ Given: GUESSING_SESSION, When: [OPEN_QUEST_SCREEN_TO_RESUME], Then: SCORE_CONTENT }],
    },
    async () => {
      const result = await mountResumedGuessing();

      expect(result.current.score).toEqual(scoreResp);
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: GUESSING_SESSION,
          When: [OPEN_QUEST_SCREEN_TO_RESUME],
          Then: "呼び出し元に返る入力した翻訳は「テスト訳」になる",
        },
      ],
    },
    async () => {
      const result = await mountResumedGuessing();

      expect(result.current.userTranslation).toBe("テスト訳");
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: GUESSING_SESSION,
          When: [OPEN_QUEST_SCREEN_TO_RESUME],
          Then: "呼び出し元に返る残り挑戦回数は 2 になる",
        },
      ],
    },
    async () => {
      const result = await mountResumedGuessing();

      expect(result.current.attemptsRemaining).toBe(2);
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [{ Given: GUESSING_SESSION, When: [OPEN_QUEST_SCREEN_TO_RESUME], Then: HINT_CONTENT }],
    },
    async () => {
      const result = await mountResumedGuessing();

      expect(result.current.hintResult).toEqual(electricHint);
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: GUESSING_SESSION,
          When: [OPEN_QUEST_SCREEN_TO_RESUME],
          Then: "呼び出し元に返る名前当ての結果が無い状態になる",
        },
      ],
    },
    async () => {
      const result = await mountResumedGuessing();

      expect(result.current.guessResult).toBeNull();
    },
  );

  const CAPTURING_SESSION =
    "現在のクエストの問い合わせが、捕獲待機画面の段階で、図鑑番号 25 の出題と、確定済みのボール (ハイパーボール) を返すとき";

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [{ Given: CAPTURING_SESSION, When: [OPEN_QUEST_SCREEN_TO_RESUME], Then: CAPTURING_SCREEN }],
    },
    async () => {
      const result = await mountResumedCapturing();

      expect(result.current.phase).toBe("capturing");
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [{ Given: CAPTURING_SESSION, When: [OPEN_QUEST_SCREEN_TO_RESUME], Then: ULTRA_BALL }],
    },
    async () => {
      const result = await mountResumedCapturing();

      expect(result.current.ballType).toBe("ultra");
    },
  );

  const RESUME_DISABLED =
    "現在のクエストの問い合わせが、翻訳の入力画面の段階のセッションを返す状態で、リロード再開が無効になっているとき";

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [{ Given: RESUME_DISABLED, When: [OPEN_QUEST_SCREEN_TO_RESUME], Then: SELECT_LOCATION_SCREEN }],
    },
    async () => {
      const result = await mountWithResumeDisabled();

      expect(result.current.phase).toBe("selectLocation");
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: RESUME_DISABLED,
          When: [OPEN_QUEST_SCREEN_TO_RESUME],
          Then: "バックエンドへ現在のクエストの問い合わせが届かない",
        },
      ],
    },
    async () => {
      await mountWithResumeDisabled();

      expect(countRequests("/quest/current")).toBe(0);
    },
  );

  for (const { failure, mount } of [
    { failure: LOCATIONS_FAIL_500, mount: mountWithLocationsFailure },
    { failure: CURRENT_QUEST_FAILS_502, mount: mountWithCurrentQuestFailure },
  ]) {
    defineCase(
      {
        種別: "部品間結合テスト",
        正常異常: "異常系",
        観点: ["外部依存の失敗"],
        steps: [{ Given: failure, When: [OPEN_QUEST_SCREEN_TO_RESUME], Then: ERROR_SCREEN }],
      },
      async () => {
        const result = await mount();

        expect(result.current.phase).toBe("error");
      },
    );
  }

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      観点: ["外部依存の失敗"],
      steps: [
        {
          Given: LOCATIONS_FAIL_500,
          When: [OPEN_QUEST_SCREEN_TO_RESUME],
          Then: "エラーメッセージに「場所の読み込みに失敗しました」が含まれる",
        },
      ],
    },
    async () => {
      const result = await mountWithLocationsFailure();

      expect(result.current.error).toContain("場所の読み込みに失敗しました");
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      観点: ["外部依存の失敗"],
      steps: [
        {
          Given: CURRENT_QUEST_FAILS_502,
          When: [OPEN_QUEST_SCREEN_TO_RESUME],
          Then: "エラーメッセージに「外部サービスが応答しません」が含まれる",
        },
      ],
    },
    async () => {
      const result = await mountWithCurrentQuestFailure();

      expect(result.current.error).toContain("外部サービスが応答しません");
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      観点: ["外部依存の失敗"],
      steps: [
        {
          Given: CURRENT_QUEST_FAILS_502,
          When: [OPEN_QUEST_SCREEN_TO_RESUME],
          Then: "バックエンドへ場所の一覧の取得要求が届かない",
        },
      ],
    },
    async () => {
      await mountWithCurrentQuestFailure();

      expect(countRequests("/quest/locations")).toBe(0);
    },
  );
});
