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
  description_en: "When several of these Pokémon gather, their electricity could build and cause lightning storms.",
  is_legendary: false,
  is_mythical: false,
  max_guess_attempts: 3,
};

const scoreResp: ScoreResponse = {
  score: 75,
  review: "雷の嵐という訳がよくできている。集まるの意味も正しく伝わっている。",
  description_ja: "何匹か　あつまっていると そこでは　強い　電気が　たまり 雷が　落ちることが　あるという。",
};

const captureResp: CaptureResponse = {
  captured: true,
  probability: 0.9,
  pokemon_id: 25,
  name_en: "Pikachu",
  name_ja: "ピカチュウ",
  sprite_url: "https://example.com/pikachu.png",
  score: 75,
  description_en: "When several of these Pokémon gather, their electricity could build and cause lightning storms.",
  description_ja: "何匹か　あつまっていると そこでは　強い　電気が　たまり 雷が　落ちることが　あるという。",
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
  name: "木漏れ日の森",
  description: "やわらかい光と、虫の声",
  types: ["normal"],
};

/**
 * GET /quest/new が指定の出題を返す状態をモックする。
 * @param resp 返す出題レスポンス。
 */
function mockNewQuest(resp: QuestNewResponse = questResp) {
  server.use(http.get(apiUrl("/quest/new"), () => HttpResponse.json(resp)));
}

/** GET /quest/locations が「木漏れ日の森」の 1 件を返す状態をモックする。 */
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
 * 出題を得て翻訳画面の段階になるまで進めた useQuest をマウントする。
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
  description_en: "When several of these Pokémon gather, their electricity could build and cause lightning storms.",
  description_ja: "何匹か　あつまっていると そこでは　強い　電気が　たまり 雷が　落ちることが　あるという。",
  base_stat_total: 320,
  ball_type: "poke",
  types: ["electric"],
  height: 4,
  weight: 60,
  is_legendary: false,
  is_mythical: false,
};

const SCORE_STATE = "AI が翻訳「このポケモンが何匹か集まると、強い電気がたまって雷が落ちることがある」に最終評価点 75、講評「雷の嵐という訳がよくできている。集まるの意味も正しく伝わっている。」、日本語版の説明「何匹か　あつまっていると そこでは　強い　電気が　たまり 雷が　落ちることが　あるという。」を付ける";
const GUESS_WRONG_STATE = "名前「Pikachu」が不正解で、残り挑戦回数が 2 である";
const ELECTRIC_HINT_STATE =
  "出題されたポケモンのタイプが「でんき」で、最大挑戦回数が 3 回で、ヒントの要求でチャンスを 1 回使う";
const CAPTURE_SUCCESS_STATE =
  "捕獲の抽選に当たり、捕獲確率が 0.9、出題されたポケモンがピカチュウ、最終評価点が 75、使うボールがハイパーボールである";
const CAPTURE_FAILURE_DETAIL_STATE =
  "捕獲の抽選に外れ、捕獲確率が 0.2、出題されたポケモンがピカチュウ、最終評価点が 40、使うボールがモンスターボールである";
const SKIP_BALL_STATE = "スキップで獲得できるボールがモンスターボールである";

interface CommunicationOperation {
  path: string;
  when: string;
  successState: string;
  call: (r: QuestHook) => Promise<unknown>;
  buildSuccess: () => Response;
  recoveredOutcome: string;
  expectRecovered: (r: QuestHook) => void;
}

const translationOperation: CommunicationOperation = {
  path: "/quest/score",
  when: "翻訳「このポケモンが何匹か集まると、強い電気がたまって雷が落ちることがある」を送信する",
  successState: SCORE_STATE,
  call: (r) => r.submitTranslation("このポケモンが何匹か集まると、強い電気がたまって雷が落ちることがある"),
  buildSuccess: () => HttpResponse.json(scoreResp),
  recoveredOutcome:
    "名前当て画面が表示され、採点結果は、最終評価点 75、講評「雷の嵐という訳がよくできている。集まるの意味も正しく伝わっている。」、日本語版の説明「何匹か　あつまっていると そこでは　強い　電気が　たまり 雷が　落ちることが　あるという。」になる",
  expectRecovered: (r) => {
    expect(r.phase).toBe("guessing");
    expect(r.score).toEqual(scoreResp);
  },
};

const guessOperation: CommunicationOperation = {
  path: "/quest/guess-name",
  when: "名前「Pikachu」を回答する",
  successState: GUESS_WRONG_STATE,
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
  when: "ヒントを要求する",
  successState: ELECTRIC_HINT_STATE,
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
  when: "捕獲を実行する",
  successState: CAPTURE_SUCCESS_STATE,
  call: (r) => r.capture(),
  buildSuccess: () => HttpResponse.json(captureResp),
  recoveredOutcome:
    "捕獲演出画面が表示され、捕獲結果は、捕獲成功、捕獲確率 0.9、ピカチュウ、最終評価点 75、ハイパーボールになる",
  expectRecovered: (r) => {
    expect(r.phase).toBe("revealing");
    expect(r.captureResult).toEqual(captureResp);
  },
};

const skipGuessOperation: CommunicationOperation = {
  path: "/quest/skip-guess",
  when: "名前当てをスキップする",
  successState: SKIP_BALL_STATE,
  call: (r) => r.skipGuess(),
  buildSuccess: () => HttpResponse.json({ ball_type: "poke" }),
  recoveredOutcome:
    "捕獲待機画面が表示され、獲得したボールはモンスターボールになる",
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
      HttpResponse.json({ types: ["electric"], attempts_remaining: 2 }),
    ),
  );
  const hook = await mountInTranslating();
  await act(async () => {
    await hook.result.current.submitTranslation("このポケモンが何匹か集まると、強い電気がたまって雷が落ちることがある");
  });
  await act(async () => {
    await hook.result.current.submitGuess("Pikachu");
  });
  await act(async () => {
    await hook.result.current.requestHint();
  });
  mockNewQuest({ ...questResp, pokemon_id: 1, description_en: "A strange seed was planted on its back at birth. The plant sprouts and grows with this Pokémon." });
  await act(async () => {
    await hook.result.current.startNewQuest();
  });
  return hook;
}

const QUEST_DETAIL = "図鑑番号 25、英語の説明文「When several of these Pokémon gather, their electricity could build and cause lightning storms.」、伝説でも幻でもない、最大挑戦回数 3 回";
const NO_QUEST_AND_QUEST_AVAILABLE = "進行中のクエストが無く、出題を取得できるとき";
const NO_QUEST_AND_LOCATIONS_AVAILABLE = "進行中のクエストが無く、場所の一覧を取得できるとき";
const NO_QUEST_AND_GRASSLAND_ONLY = "進行中のクエストが無く、選べる場所が「木漏れ日の森」の 1 件だけのとき";
const TRANSLATING_SCREEN_SHOWN = "翻訳画面を表示していて";

const SELECT_LOCATION = "場所を選択する";
const START_NEW_QUEST = "新しいクエストを開始する";
const OPEN_QUEST_SCREEN = "クエストを開始する";

const TRANSLATING_SCREEN = "翻訳画面が表示される";
const GUESSING_SCREEN = "名前当て画面が表示される";
const CAPTURING_SCREEN = "捕獲待機画面が表示される";
const ERROR_SCREEN = "エラー画面が表示される";
const SELECT_LOCATION_SCREEN = "場所選択画面が表示される";
const GRASSLAND_LIST = "場所の一覧は、「木漏れ日の森」の 1 件になる";
const ERROR_MESSAGE_CLEARED = "エラーメッセージが消える";
const QUEST_CONTENT = `出題の内容は、${QUEST_DETAIL}になる`;
const SCORE_CONTENT = "採点結果は、最終評価点 75、講評「雷の嵐という訳がよくできている。集まるの意味も正しく伝わっている。」、日本語版の説明「何匹か　あつまっていると そこでは　強い　電気が　たまり 雷が　落ちることが　あるという。」になる";
const HINT_CONTENT = "ヒントの内容は、タイプ「でんき」、残り挑戦回数 2 になる";
const ULTRA_BALL = "獲得したボールはハイパーボールになる";

const LOCATIONS_FAIL_GIVEN = "バックエンドでエラーが起きていて、場所の一覧を取得できないとき";
const CURRENT_QUEST_FAIL_GIVEN = "外部サービスが応答せず、進行中のクエストを確認できないとき";
const SERVER_ERROR_GIVEN = "バックエンドでエラーが起きていて、出題を取得できないとき";
const NEW_QUEST_FAILURE_MESSAGES = [
  { status: 401, given: "認証に失敗して、出題を取得できないとき", message: "認証に失敗しました" },
  { status: 403, given: "アクセス権が無く、出題を取得できないとき", message: "アクセス権がありません" },
  { status: 404, given: "セッションが切れていて、出題を取得できないとき", message: "セッションが切断されました" },
  { status: 502, given: "外部サービスが応答せず、出題を取得できないとき", message: "外部サービスが応答しません" },
];
const NETWORK_DOWN_GIVEN = "ネットワークが切れていて、出題を取得できないとき";

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
    cause: SERVER_ERROR_GIVEN,
    fail: () =>
      server.use(
        http.get(apiUrl("/quest/new"), () => HttpResponse.json({}, { status: 500 })),
      ),
  },
  {
    cause: NEW_QUEST_FAILURE_MESSAGES[0].given,
    fail: () =>
      server.use(
        http.get(apiUrl("/quest/new"), () => HttpResponse.json({}, { status: 401 })),
      ),
  },
  {
    cause: NEW_QUEST_FAILURE_MESSAGES[1].given,
    fail: () =>
      server.use(
        http.get(apiUrl("/quest/new"), () => HttpResponse.json({}, { status: 403 })),
      ),
  },
  {
    cause: NEW_QUEST_FAILURE_MESSAGES[2].given,
    fail: () =>
      server.use(
        http.get(apiUrl("/quest/new"), () => HttpResponse.json({}, { status: 404 })),
      ),
  },
  {
    cause: NETWORK_DOWN_GIVEN,
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
        { When: [SELECT_LOCATION], Then: TRANSLATING_SCREEN },
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
          Given: `出題の抽選で、${QUEST_DETAIL}のクエストが選ばれるとき`,
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
          Given: SERVER_ERROR_GIVEN,
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
          Given: SERVER_ERROR_GIVEN,
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

  for (const { status, given, message } of NEW_QUEST_FAILURE_MESSAGES) {
    defineCase(
      {
        種別: "部品間結合テスト",
        正常異常: "異常系",
        観点: ["外部依存の失敗"],
        steps: [
          {
            Given: given,
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
          Given: NETWORK_DOWN_GIVEN,
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
            Given: NO_QUEST_AND_QUEST_AVAILABLE,
            When: [START_NEW_QUEST, SELECT_LOCATION],
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
            Given: NO_QUEST_AND_QUEST_AVAILABLE,
            When: [START_NEW_QUEST, SELECT_LOCATION],
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

const SCORE_GIVEN =
  "AI が翻訳「このポケモンが何匹か集まると、強い電気がたまって雷が落ちることがある」に最終評価点 75、講評「雷の嵐という訳がよくできている。集まるの意味も正しく伝わっている。」、日本語版の説明「何匹か　あつまっていると そこでは　強い　電気が　たまり 雷が　落ちることが　あるという。」を付けるとき";
const SUBMIT_TRANSLATION = "翻訳「このポケモンが何匹か集まると、強い電気がたまって雷が落ちることがある」を送信する";

async function submitTranslationSuccessfully() {
  server.use(http.post(apiUrl("/quest/score"), () => HttpResponse.json(scoreResp)));
  const { result } = await mountInTranslating();
  await act(async () => {
    await result.current.submitTranslation("このポケモンが何匹か集まると、強い電気がたまって雷が落ちることがある");
  });
  return result;
}

describe("[本体:採点]翻訳の採点", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [{ When: [SUBMIT_TRANSLATION], Then: GUESSING_SCREEN }],
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
      steps: [{ Given: SCORE_GIVEN, When: [SUBMIT_TRANSLATION], Then: SCORE_CONTENT }],
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
          When: [SUBMIT_TRANSLATION],
          Then: "入力した翻訳は「このポケモンが何匹か集まると、強い電気がたまって雷が落ちることがある」になる",
        },
      ],
    },
    async () => {
      const result = await submitTranslationSuccessfully();

      expect(result.current.userTranslation).toBe("このポケモンが何匹か集まると、強い電気がたまって雷が落ちることがある");
    },
  );
});

const CORRECT_GUESS_GIVEN = "出題されたポケモンの英語名が「Pikachu」で、残り挑戦回数が 2 のとき";
const CORRECT_GUESS_ULTRA_BALL_GIVEN = "出題されたポケモンの英語名が「Pikachu」のとき";
const SUBMIT_PIKACHU = "名前「Pikachu」を回答する";

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
          Given: CORRECT_GUESS_GIVEN,
          When: [SUBMIT_PIKACHU],
          Then: "名前当ての結果は、正解、ハイパーボール、回答の言語は英語、残り挑戦回数 2 になる",
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
      steps: [{ Given: CORRECT_GUESS_ULTRA_BALL_GIVEN, When: [SUBMIT_PIKACHU], Then: ULTRA_BALL }],
    },
    async () => {
      const result = await submitCorrectGuess();

      expect(result.current.ballType).toBe("ultra");
    },
  );
});

const SKIP_GUESS = "名前当てをスキップする";

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
          Given: `${SKIP_BALL_STATE}とき`,
          When: [SKIP_GUESS],
          Then: "獲得したボールはモンスターボールになる",
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
      steps: [{ When: [SKIP_GUESS], Then: CAPTURING_SCREEN }],
    },
    async () => {
      const result = await skipGuessSuccessfully();

      expect(result.current.phase).toBe("capturing");
    },
  );
});

const AFTER_CORRECT_GUESS = "名前「Pikachu」に正解し、ハイパーボールを獲得しているとき";
const PROCEED_TO_CAPTURE = "捕獲に進む";

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

const ELECTRIC_HINT_GIVEN = `${ELECTRIC_HINT_STATE}とき`;
const HINT_ATTEMPTS_REMAINING_2_GIVEN = "最大挑戦回数が 3 回で、ヒントの要求でチャンスを 1 回使うとき";
const TWO_HINTS_GIVEN =
  "出題されたポケモンのタイプが「でんき」、レベルアップで覚える技が「たいあたり」「なきごえ」「でんきショック」で、最大挑戦回数が 3 回で、ヒントの要求でチャンスを 1 回使うとき";
const SECOND_HINT_ATTEMPTS_REMAINING_1_GIVEN = HINT_ATTEMPTS_REMAINING_2_GIVEN;
const REQUEST_HINT = "ヒントを要求する";

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
      steps: [{ Given: ELECTRIC_HINT_GIVEN, When: [REQUEST_HINT], Then: HINT_CONTENT }],
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
          Given: HINT_ATTEMPTS_REMAINING_2_GIVEN,
          When: [REQUEST_HINT],
          Then: "残り挑戦回数は 2 になる",
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
          Given: TWO_HINTS_GIVEN,
          When: [REQUEST_HINT, REQUEST_HINT],
          Then: "ヒントの内容は、タイプ「でんき」と、技「たいあたり」「なきごえ」「でんきショック」の両方を含み、残り挑戦回数 1 になる",
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
          Given: SECOND_HINT_ATTEMPTS_REMAINING_1_GIVEN,
          When: [REQUEST_HINT, REQUEST_HINT],
          Then: "残り挑戦回数は 1 になる",
        },
      ],
    },
    async () => {
      const result = await requestHintTwice();

      expect(result.current.attemptsRemaining).toBe(1);
    },
  );
});

const CAPTURE_SUCCESS_GIVEN = `${CAPTURE_SUCCESS_STATE}とき`;
const CAPTURE_FAILURE_GIVEN = "捕獲の抽選に外れるとき";
const CAPTURE_FAILURE_DETAIL_GIVEN = `${CAPTURE_FAILURE_DETAIL_STATE}とき`;
const EXECUTE_CAPTURE = "捕獲を実行する";
const FINISH_CAPTURE_EFFECT = "捕獲演出が終わるまで待つ";

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
          When: [EXECUTE_CAPTURE],
          Then: "捕獲演出画面が表示される",
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
          Given: CAPTURE_SUCCESS_GIVEN,
          When: [EXECUTE_CAPTURE],
          Then: "捕獲結果は、捕獲成功、捕獲確率 0.9、ピカチュウ、最終評価点 75、ハイパーボールになる",
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
          Given: CAPTURE_FAILURE_GIVEN,
          When: [EXECUTE_CAPTURE, FINISH_CAPTURE_EFFECT],
          Then: "捕獲結果画面が表示される",
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
          Given: CAPTURE_FAILURE_DETAIL_GIVEN,
          When: [EXECUTE_CAPTURE, FINISH_CAPTURE_EFFECT],
          Then: "捕獲結果は、捕獲失敗、捕獲確率 0.2、ピカチュウ、最終評価点 40、モンスターボールになる",
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
  "翻訳「このポケモンが何匹か集まると、強い電気がたまって雷が落ちることがある」の採点結果が最終評価点 75、名前「Pikachu」への正解でハイパーボールを獲得し、ヒントのタイプ「でんき」と残り挑戦回数 2 が出ていて";
const PROGRESSED_GIVEN = `${PROGRESSED_STATE}、進行中のクエストが無いとき`;

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
          Given: PROGRESSED_GIVEN,
          When: [START_NEW_QUEST],
          Then: SELECT_LOCATION_SCREEN,
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
          Given: PROGRESSED_GIVEN,
          When: [START_NEW_QUEST],
          Then: "採点結果が無い状態になる",
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
          Given: PROGRESSED_GIVEN,
          When: [START_NEW_QUEST],
          Then: "入力した翻訳が空文字になる",
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
          Given: PROGRESSED_GIVEN,
          When: [START_NEW_QUEST],
          Then: "獲得したボールが無い状態になる",
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
          Given: PROGRESSED_GIVEN,
          When: [START_NEW_QUEST],
          Then: "残り挑戦回数が無い状態になる",
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
          Given: PROGRESSED_GIVEN,
          When: [START_NEW_QUEST],
          Then: "ヒントの内容が無い状態になる",
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
          Given: `${PROGRESSED_STATE}、進行中のクエストが無く、出題を取得できるとき`,
          When: [START_NEW_QUEST, SELECT_LOCATION],
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
          Given: `${PROGRESSED_STATE}、進行中のクエストが無く、出題の抽選で、図鑑番号 1、英語の説明文「A strange seed was planted on its back at birth. The plant sprouts and grows with this Pokémon.」、伝説でも幻でもない、最大挑戦回数 3 回のクエストが選ばれるとき`,
          When: [START_NEW_QUEST, SELECT_LOCATION],
          Then: "出題の内容は、図鑑番号 1、英語の説明文「A strange seed was planted on its back at birth. The plant sprouts and grows with this Pokémon.」、伝説でも幻でもない、最大挑戦回数 3 回になる",
        },
      ],
    },
    async () => {
      const result = await reselectLocation();

      expect(result.current.quest).toEqual({
        ...questResp,
        pokemon_id: 1,
        description_en: "A strange seed was planted on its back at birth. The plant sprouts and grows with this Pokémon.",
      });
    },
  );

  const failures = [
    {
      failure: LOCATIONS_FAIL_GIVEN,
      retry: retryAfterLocationsFailure,
    },
    {
      failure: CURRENT_QUEST_FAIL_GIVEN,
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
          { Given: failure, When: [OPEN_QUEST_SCREEN], Then: ERROR_SCREEN },
          {
            Given: NO_QUEST_AND_LOCATIONS_AVAILABLE,
            When: [START_NEW_QUEST],
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
          { Given: failure, When: [OPEN_QUEST_SCREEN], Then: ERROR_SCREEN },
          {
            Given: NO_QUEST_AND_GRASSLAND_ONLY,
            When: [START_NEW_QUEST],
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
          { Given: failure, When: [OPEN_QUEST_SCREEN], Then: ERROR_SCREEN },
          {
            Given: NO_QUEST_AND_LOCATIONS_AVAILABLE,
            When: [START_NEW_QUEST],
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

const SESSION_EXPIRED_GIVEN = "セッションが切れているとき";
const FAILURE_RESPONSES: {
  status: number;
  body: Record<string, string>;
  given: string;
  recoveryCause: string;
}[] = [
  {
    status: 429,
    body: { error: "user", message: "x" },
    given: "ユーザーの日次上限に達しているとき",
    recoveryCause: "ユーザーの日次上限に達していて",
  },
  {
    status: 502,
    body: {},
    given: "外部サービスが応答しないとき",
    recoveryCause: "外部サービスが応答せず",
  },
];
const EXTERNAL_SERVICE_NO_RESPONSE_GIVEN = FAILURE_RESPONSES[1].given;
const EXTERNAL_SERVICE_NO_RESPONSE_CAUSE = FAILURE_RESPONSES[1].recoveryCause;

function defineCommunicationErrorCases(operation: CommunicationOperation) {
  const { path, call, buildSuccess, when, successState, recoveredOutcome, expectRecovered } =
    operation;
  const retryWhen = [when, when] as const;

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

  const recoveryGiven = (cause: string) => `1 回目は${cause}、2 回目は${successState}とき`;

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      観点: ["外部依存の失敗"],
      steps: [{ Given: FAILURE_RESPONSES[0].given, When: [when], Then: "エラーメッセージは出ない" }],
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
          Given: EXTERNAL_SERVICE_NO_RESPONSE_GIVEN,
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
        { Given: SESSION_EXPIRED_GIVEN, When: [when], Then: ERROR_SCREEN },
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
          Given: SESSION_EXPIRED_GIVEN,
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
      steps: [
        {
          Given: recoveryGiven(EXTERNAL_SERVICE_NO_RESPONSE_CAUSE),
          When: retryWhen,
          Then: ERROR_MESSAGE_CLEARED,
        },
      ],
    },
    async () => {
      const result = await retryAfterBackendFailure(502, {});

      expect(result.current.error).toBeNull();
    },
  );

  for (const { status, body, recoveryCause } of FAILURE_RESPONSES) {
    defineCase(
      {
        種別: "部品間結合テスト",
        正常異常: "異常系",
        観点: ["外部依存の失敗", "回復確認"],
        steps: [{ Given: recoveryGiven(recoveryCause), When: retryWhen, Then: recoveredOutcome }],
      },
      async () => {
        const result = await retryAfterBackendFailure(status, body);

        expectRecovered(result.current);
      },
    );
  }

  for (const { status, body, given } of FAILURE_RESPONSES) {
    defineCase(
      {
        種別: "部品間結合テスト",
        正常異常: "異常系",
        観点: ["外部依存の失敗"],
        steps: [
          {
            Given: `${TRANSLATING_SCREEN_SHOWN}、${given}`,
            When: [when],
            Then: "翻訳画面が表示されたままになる",
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
        user_translation: "このポケモンが何匹か集まると、強い電気がたまって雷が落ちることがある",
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
          Given: NO_QUEST_AND_GRASSLAND_ONLY,
          When: [OPEN_QUEST_SCREEN],
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

  const TRANSLATING_SESSION = "進行中のクエストが翻訳画面の段階のとき";
  const TRANSLATING_SESSION_QUEST = `進行中のクエストが翻訳画面の段階で、出題が、${QUEST_DETAIL}であるとき`;

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [{ Given: TRANSLATING_SESSION, When: [OPEN_QUEST_SCREEN], Then: TRANSLATING_SCREEN }],
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
      steps: [{ Given: TRANSLATING_SESSION_QUEST, When: [OPEN_QUEST_SCREEN], Then: QUEST_CONTENT }],
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
          When: [OPEN_QUEST_SCREEN],
          Then: "バックエンドへ場所の一覧の取得要求が届かない",
        },
      ],
    },
    async () => {
      await mountResumedTranslating();

      expect(countRequests("/quest/locations")).toBe(0);
    },
  );

  const GUESSING_SESSION = "進行中のクエストが名前当て画面の段階のとき";
  const GUESSING_SESSION_SCORE =
    "進行中のクエストが名前当て画面の段階で、採点結果が、最終評価点 75、講評「雷の嵐という訳がよくできている。集まるの意味も正しく伝わっている。」、日本語版の説明「何匹か　あつまっていると そこでは　強い　電気が　たまり 雷が　落ちることが　あるという。」であるとき";
  const GUESSING_SESSION_TRANSLATION =
    "進行中のクエストが名前当て画面の段階で、入力した翻訳が「このポケモンが何匹か集まると、強い電気がたまって雷が落ちることがある」であるとき";
  const GUESSING_SESSION_ATTEMPTS =
    "進行中のクエストが名前当て画面の段階で、残り挑戦回数が 2 であるとき";
  const GUESSING_SESSION_HINT =
    "進行中のクエストが名前当て画面の段階で、ヒントが、タイプ「でんき」、残り挑戦回数 2 であるとき";

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [{ Given: GUESSING_SESSION, When: [OPEN_QUEST_SCREEN], Then: GUESSING_SCREEN }],
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
      steps: [{ Given: GUESSING_SESSION_SCORE, When: [OPEN_QUEST_SCREEN], Then: SCORE_CONTENT }],
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
          Given: GUESSING_SESSION_TRANSLATION,
          When: [OPEN_QUEST_SCREEN],
          Then: "入力した翻訳は「このポケモンが何匹か集まると、強い電気がたまって雷が落ちることがある」になる",
        },
      ],
    },
    async () => {
      const result = await mountResumedGuessing();

      expect(result.current.userTranslation).toBe("このポケモンが何匹か集まると、強い電気がたまって雷が落ちることがある");
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: GUESSING_SESSION_ATTEMPTS,
          When: [OPEN_QUEST_SCREEN],
          Then: "残り挑戦回数は 2 になる",
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
      steps: [{ Given: GUESSING_SESSION_HINT, When: [OPEN_QUEST_SCREEN], Then: HINT_CONTENT }],
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
          When: [OPEN_QUEST_SCREEN],
          Then: "名前当ての結果が無い状態になる",
        },
      ],
    },
    async () => {
      const result = await mountResumedGuessing();

      expect(result.current.guessResult).toBeNull();
    },
  );

  const CAPTURING_SESSION = "進行中のクエストが捕獲待機画面の段階のとき";
  const CAPTURING_SESSION_BALL =
    "進行中のクエストが捕獲待機画面の段階で、確定済みのボールがハイパーボールであるとき";

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [{ Given: CAPTURING_SESSION, When: [OPEN_QUEST_SCREEN], Then: CAPTURING_SCREEN }],
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
      steps: [{ Given: CAPTURING_SESSION_BALL, When: [OPEN_QUEST_SCREEN], Then: ULTRA_BALL }],
    },
    async () => {
      const result = await mountResumedCapturing();

      expect(result.current.ballType).toBe("ultra");
    },
  );

  const RESUME_DISABLED =
    "進行中のクエストが翻訳画面の段階で、リロード再開が無効になっているとき";

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [{ Given: RESUME_DISABLED, When: [OPEN_QUEST_SCREEN], Then: SELECT_LOCATION_SCREEN }],
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
          When: [OPEN_QUEST_SCREEN],
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
    { failure: LOCATIONS_FAIL_GIVEN, mount: mountWithLocationsFailure },
    { failure: CURRENT_QUEST_FAIL_GIVEN, mount: mountWithCurrentQuestFailure },
  ]) {
    defineCase(
      {
        種別: "部品間結合テスト",
        正常異常: "異常系",
        観点: ["外部依存の失敗"],
        steps: [{ Given: failure, When: [OPEN_QUEST_SCREEN], Then: ERROR_SCREEN }],
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
          Given: LOCATIONS_FAIL_GIVEN,
          When: [OPEN_QUEST_SCREEN],
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
          Given: CURRENT_QUEST_FAIL_GIVEN,
          When: [OPEN_QUEST_SCREEN],
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
          Given: CURRENT_QUEST_FAIL_GIVEN,
          When: [OPEN_QUEST_SCREEN],
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
