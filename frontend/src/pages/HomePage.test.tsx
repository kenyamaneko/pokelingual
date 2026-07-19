import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { User } from "firebase/auth";
import { HomePage, HOME_PAGE_LABELS } from "./HomePage";
import { QuestPage } from "./QuestPage";
import { TutorialPage } from "./TutorialPage";
import { AuthContext } from "../contexts/AuthContext";
import { UsageProvider } from "../contexts/UsageContext";
import { TutorialProvider } from "../contexts/TutorialContext";
import { server, apiUrl } from "../test/mswServer";

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

describe("[チュートリアル] ホーム画面 (「ポケモンを探しに行く」の遷移先出し分け)", () => {
  it("チュートリアル完了済みのとき、押すと本番クエスト画面に遷移する", async () => {
    mockTutorialStatus(true);
    const user = userEvent.setup();
    renderHome();

    await user.click(screen.getByRole("button", { name: HOME_PAGE_LABELS.startQuest }));

    expect(
      await screen.findByRole("heading", { name: "どこに　ポケモンを　探しに行く？" }),
    ).toBeInTheDocument();
  });

  it("チュートリアル未完了のとき、押すとチュートリアル画面に遷移する", async () => {
    mockTutorialStatus(false);
    const user = userEvent.setup();
    renderHome();

    await user.click(screen.getByRole("button", { name: HOME_PAGE_LABELS.startQuest }));

    expect(await screen.findByRole("heading", { name: "遊び方の説明をします" })).toBeInTheDocument();
  });

  it("チュートリアル完了状態の確定が遅れている間に押しても、確定後は本番クエスト画面に遷移する", async () => {
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
    const user = userEvent.setup();
    renderHome();

    await user.click(screen.getByRole("button", { name: HOME_PAGE_LABELS.startQuest }));

    expect(await screen.findByRole("button", { name: "確認中..." })).toBeDisabled();
    resolvePending();

    expect(
      await screen.findByRole("heading", { name: "どこに　ポケモンを　探しに行く？" }),
    ).toBeInTheDocument();
  });
});

describe("[チュートリアル] ホーム画面 (チュートリアル完了状態の取得に失敗したときの回復)", () => {
  it("「ポケモンを探しに行く」を押すと、エラーが表示される", async () => {
    server.use(http.get(apiUrl("/tutorial-status"), () => HttpResponse.error()));
    const user = userEvent.setup();
    renderHome();

    await user.click(screen.getByRole("button", { name: HOME_PAGE_LABELS.startQuest }));

    expect(await screen.findByText(HOME_PAGE_LABELS.startQuestError)).toBeInTheDocument();
  });

  it("再度「ポケモンを探しに行く」を押して取得に成功すると、本番クエスト画面に遷移しエラー表示が残らない", async () => {
    let shouldSucceed = false;
    server.use(
      http.get(apiUrl("/tutorial-status"), () =>
        shouldSucceed ? HttpResponse.json({ tutorial_completed: true }) : HttpResponse.error(),
      ),
    );
    const user = userEvent.setup();
    renderHome();

    await user.click(screen.getByRole("button", { name: HOME_PAGE_LABELS.startQuest }));
    await screen.findByText(HOME_PAGE_LABELS.startQuestError);

    shouldSucceed = true;
    await user.click(screen.getByRole("button", { name: HOME_PAGE_LABELS.startQuest }));

    expect(
      await screen.findByRole("heading", { name: "どこに　ポケモンを　探しに行く？" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(HOME_PAGE_LABELS.startQuestError)).not.toBeInTheDocument();
  });
});

describe("[チュートリアル] ホーム画面 (チュートリアルへのリンク)", () => {
  it("チュートリアルへのリンクが表示される", async () => {
    renderHome();

    expect(
      await screen.findByRole("link", { name: HOME_PAGE_LABELS.tutorialLink }),
    ).toHaveAttribute("href", "/tutorial");
  });
});
