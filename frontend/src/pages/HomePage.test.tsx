import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Routes, Route } from "react-router";
import type { User } from "firebase/auth";
import { HomePage } from "./HomePage";
import { QuestPage } from "./QuestPage";
import { TutorialPage } from "./TutorialPage";
import { AuthContext } from "../contexts/AuthContext";
import { UsageProvider } from "../contexts/UsageContext";
import { TutorialProvider } from "../contexts/TutorialContext";
import { server, apiUrl } from "../test/mswServer";
import { defineCase } from "../test/defineCase";

const START_QUEST_BUTTON = "ポケモンを探しに行く";

const fakeUser = { uid: "trainer-test" } as unknown as User;

const authValue = {
  user: fakeUser,
  loading: false,
  login: async () => {},
  signup: async () => {},
  loginWithGoogle: async () => {},
  resetPassword: async () => {},
  logout: async () => {},
};

/**
 * GET /tutorial-status が指定の完了状態を返す状態をモックする。
 * @param completed チュートリアル完了状態。
 */
function mockTutorialStatus(completed: boolean) {
  server.use(
    http.get(apiUrl("/tutorial-status"), () => HttpResponse.json({ tutorial_completed: completed })),
  );
}

function renderHome() {
  return render(
    <AuthContext.Provider value={authValue}>
      <UsageProvider>
        <TutorialProvider>
          <MemoryRouter initialEntries={["/"]}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/quest" element={<QuestPage />} />
              <Route path="/tutorial" element={<TutorialPage />} />
            </Routes>
          </MemoryRouter>
        </TutorialProvider>
      </UsageProvider>
    </AuthContext.Provider>,
  );
}

const PRESS_START_QUEST = "ホーム画面のクエストの開始で、「ポケモンを探しに行く」ボタンを押す";
const TUTORIAL_COMPLETED = "チュートリアルが完了済みのとき";
const QUEST_SELECT_SHOWN = "場所選択画面に遷移し、見出し「どこに　ポケモンを　探しに行く？」が表示される";
const STATUS_CHECK_FAILED_MESSAGE = "「状態の確認に失敗しました。もう一度お試しください」と表示される";
const STATUS_CHECK_UNAVAILABLE = "チュートリアルの完了状態を確認できないとき";
const STATUS_CHECK_SLOW = "チュートリアルの完了状態の確認に時間がかかっているとき";

async function pressStartQuestButtonAgainAfterFailure() {
  let shouldSucceed = false;
  server.use(
    http.get(apiUrl("/tutorial-status"), () =>
      shouldSucceed ? HttpResponse.json({ tutorial_completed: true }) : HttpResponse.error(),
    ),
  );
  const user = userEvent.setup();
  renderHome();

  await user.click(screen.getByRole("button", { name: START_QUEST_BUTTON }));
  await screen.findByText("状態の確認に失敗しました。もう一度お試しください");

  shouldSucceed = true;
  await user.click(screen.getByRole("button", { name: START_QUEST_BUTTON }));
}

function mockPendingTutorialStatus() {
  let resolvePending: () => void = () => {};
  const pending = new Promise<void>((resolve) => {
    resolvePending = resolve;
  });
  server.use(
    http.get(apiUrl("/tutorial-status"), async () => {
      await pending;
      return HttpResponse.json({ tutorial_completed: true });
    }),
  );
  return resolvePending;
}

describe("[本体:チュートリアル]「ポケモンを探しに行く」の遷移先", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [{ Given: TUTORIAL_COMPLETED, When: [PRESS_START_QUEST], Then: QUEST_SELECT_SHOWN }],
    },
    async () => {
      mockTutorialStatus(true);
      const user = userEvent.setup();
      renderHome();

      await user.click(screen.getByRole("button", { name: START_QUEST_BUTTON }));

      expect(
        await screen.findByRole("heading", { name: "どこに　ポケモンを　探しに行く？" }),
      ).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "チュートリアルが未完了のとき",
          When: [PRESS_START_QUEST],
          Then: "チュートリアル画面に遷移し、見出し「遊び方の説明をします」が表示される",
        },
      ],
    },
    async () => {
      mockTutorialStatus(false);
      const user = userEvent.setup();
      renderHome();

      await user.click(screen.getByRole("button", { name: START_QUEST_BUTTON }));

      expect(await screen.findByRole("heading", { name: "遊び方の説明をします" })).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      steps: [
        {
          Given: STATUS_CHECK_UNAVAILABLE,
          When: [PRESS_START_QUEST],
          Then: STATUS_CHECK_FAILED_MESSAGE,
        },
      ],
    },
    async () => {
      server.use(http.get(apiUrl("/tutorial-status"), () => HttpResponse.error()));
      const user = userEvent.setup();
      renderHome();

      await user.click(screen.getByRole("button", { name: START_QUEST_BUTTON }));

      expect(
        await screen.findByText("状態の確認に失敗しました。もう一度お試しください"),
      ).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      steps: [
        {
          Given: STATUS_CHECK_UNAVAILABLE,
          When: [PRESS_START_QUEST],
          Then: STATUS_CHECK_FAILED_MESSAGE,
        },
        {
          Given: TUTORIAL_COMPLETED,
          When: [PRESS_START_QUEST],
          Then: QUEST_SELECT_SHOWN,
        },
      ],
    },
    async () => {
      await pressStartQuestButtonAgainAfterFailure();

      expect(
        await screen.findByRole("heading", { name: "どこに　ポケモンを　探しに行く？" }),
      ).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      steps: [
        {
          Given: STATUS_CHECK_UNAVAILABLE,
          When: [PRESS_START_QUEST],
          Then: STATUS_CHECK_FAILED_MESSAGE,
        },
        {
          Given: TUTORIAL_COMPLETED,
          When: [PRESS_START_QUEST],
          Then: "「状態の確認に失敗しました。もう一度お試しください」と表示されなくなる",
        },
      ],
    },
    async () => {
      await pressStartQuestButtonAgainAfterFailure();

      await screen.findByRole("heading", { name: "どこに　ポケモンを　探しに行く？" });
      expect(
        screen.queryByText("状態の確認に失敗しました。もう一度お試しください"),
      ).not.toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        { Given: STATUS_CHECK_SLOW, When: [PRESS_START_QUEST], Then: "ボタンの表示が「確認中...」になる" },
      ],
    },
    async () => {
      const resolvePending = mockPendingTutorialStatus();
      const user = userEvent.setup();
      renderHome();

      await user.click(screen.getByRole("button", { name: START_QUEST_BUTTON }));

      expect(await screen.findByRole("button", { name: "確認中..." })).toBeInTheDocument();
      resolvePending();
      await screen.findByRole("heading", { name: "どこに　ポケモンを　探しに行く？" });
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: STATUS_CHECK_SLOW,
          When: [PRESS_START_QUEST],
          Then: "「確認中...」ボタンが押せない状態になる",
        },
      ],
    },
    async () => {
      const resolvePending = mockPendingTutorialStatus();
      const user = userEvent.setup();
      renderHome();

      await user.click(screen.getByRole("button", { name: START_QUEST_BUTTON }));

      expect(await screen.findByRole("button", { name: "確認中..." })).toBeDisabled();
      resolvePending();
      await screen.findByRole("heading", { name: "どこに　ポケモンを　探しに行く？" });
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "チュートリアルの完了状態の確認に時間がかかっていて、チュートリアルが完了済みのとき",
          When: [PRESS_START_QUEST, "ホーム画面のクエストの開始で、ボタンの表示が「確認中...」でなくなるまで待つ"],
          Then: QUEST_SELECT_SHOWN,
        },
      ],
    },
    async () => {
      const resolvePending = mockPendingTutorialStatus();
      const user = userEvent.setup();
      renderHome();

      await user.click(screen.getByRole("button", { name: START_QUEST_BUTTON }));
      await screen.findByRole("button", { name: "確認中..." });
      resolvePending();

      expect(
        await screen.findByRole("heading", { name: "どこに　ポケモンを　探しに行く？" }),
      ).toBeInTheDocument();
    },
  );
});

describe("[本体:チュートリアル]ホーム画面のチュートリアルへのリンク", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [{ When: ["ホーム画面を開く"], Then: "ホーム画面の「チュートリアルを見る」のリンク先が「/tutorial」になる" }],
    },
    async () => {
      renderHome();

      expect(
        await screen.findByRole("link", { name: "チュートリアルを見る" }),
      ).toHaveAttribute("href", "/tutorial");
    },
  );
});
