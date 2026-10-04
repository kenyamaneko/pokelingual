import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
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

describe("[チュートリアル] 「ポケモンを探しに行く」の遷移先", () => {
  describe("「ポケモンを探しに行く」を押したとき", () => {
    describe("正常系", () => {
      it("チュートリアルが完了済みのとき、本番のクエスト画面に遷移する", async () => {
        mockTutorialStatus(true);
        const user = userEvent.setup();
        renderHome();

        await user.click(screen.getByRole("button", { name: START_QUEST_BUTTON }));

        expect(
          await screen.findByRole("heading", { name: "どこに　ポケモンを　探しに行く？" }),
        ).toBeInTheDocument();
      });

      it("チュートリアルが未完了のとき、チュートリアル画面に遷移する", async () => {
        mockTutorialStatus(false);
        const user = userEvent.setup();
        renderHome();

        await user.click(screen.getByRole("button", { name: START_QUEST_BUTTON }));

        expect(await screen.findByRole("heading", { name: "遊び方の説明をします" })).toBeInTheDocument();
      });

      describe("チュートリアルの完了状態の確認が終わっていないとき", () => {
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

        it("「確認中...」と表示される", async () => {
          const resolvePending = mockPendingTutorialStatus();
          const user = userEvent.setup();
          renderHome();

          await user.click(screen.getByRole("button", { name: START_QUEST_BUTTON }));

          expect(await screen.findByRole("button", { name: "確認中..." })).toBeInTheDocument();
          resolvePending();
          await screen.findByRole("heading", { name: "どこに　ポケモンを　探しに行く？" });
        });

        it("「確認中...」のボタンが押せない状態になる", async () => {
          const resolvePending = mockPendingTutorialStatus();
          const user = userEvent.setup();
          renderHome();

          await user.click(screen.getByRole("button", { name: START_QUEST_BUTTON }));

          expect(await screen.findByRole("button", { name: "確認中..." })).toBeDisabled();
          resolvePending();
          await screen.findByRole("heading", { name: "どこに　ポケモンを　探しに行く？" });
        });

        it("確認が終わると本番のクエスト画面に遷移する", async () => {
          const resolvePending = mockPendingTutorialStatus();
          const user = userEvent.setup();
          renderHome();

          await user.click(screen.getByRole("button", { name: START_QUEST_BUTTON }));
          await screen.findByRole("button", { name: "確認中..." });
          resolvePending();

          expect(
            await screen.findByRole("heading", { name: "どこに　ポケモンを　探しに行く？" }),
          ).toBeInTheDocument();
        });
      });
    });

    describe("異常系", () => {
      it("チュートリアルの完了状態の確認に失敗したとき、「状態の確認に失敗しました。もう一度お試しください」と表示される", async () => {
        server.use(http.get(apiUrl("/tutorial-status"), () => HttpResponse.error()));
        const user = userEvent.setup();
        renderHome();

        await user.click(screen.getByRole("button", { name: START_QUEST_BUTTON }));

        expect(
          await screen.findByText("状態の確認に失敗しました。もう一度お試しください"),
        ).toBeInTheDocument();
      });

      it("チュートリアルの完了状態の確認に失敗したあと、もう一度押して確認に成功すると、本番のクエスト画面に遷移し、エラーメッセージが消える", async () => {
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

        expect(
          await screen.findByRole("heading", { name: "どこに　ポケモンを　探しに行く？" }),
        ).toBeInTheDocument();
        expect(
          screen.queryByText("状態の確認に失敗しました。もう一度お試しください"),
        ).not.toBeInTheDocument();
      });
    });
  });
});

describe("[チュートリアル] ホーム画面のチュートリアルへのリンク", () => {
  describe("正常系", () => {
    it("ホーム画面を開くと、「チュートリアルを見る」のリンクがチュートリアル画面を指して表示される", async () => {
      renderHome();

      expect(
        await screen.findByRole("link", { name: "チュートリアルを見る" }),
      ).toHaveAttribute("href", "/tutorial");
    });
  });
});
