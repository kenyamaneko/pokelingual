import { screen, waitFor } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import type { User } from "firebase/auth";
import { HomePage, HOME_PAGE_LABELS } from "./HomePage";
import { renderWithProviders } from "../test/render";
import { server, apiUrl } from "../test/mswServer";

/**
 * GET /tutorial-status が指定の完了状態を返す状態をモックする。
 * @param completed チュートリアル完了状態。
 */
function mockTutorialStatus(completed: boolean) {
  server.use(
    http.get(apiUrl("/tutorial-status"), () => HttpResponse.json({ tutorial_completed: completed })),
  );
}

const fakeUser = { uid: "trainer-test" } as unknown as User;

describe("HomePage (「ポケモンを探しに行く」の遷移先出し分け)", () => {
  it("チュートリアル未完了のとき、遷移先はチュートリアルになる", async () => {
    mockTutorialStatus(false);
    renderWithProviders(<HomePage />, { user: fakeUser, withRouter: true });

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "ポケモンを探しに行く" })).toHaveAttribute("href", "/tutorial");
    });
  });

  it("チュートリアル完了済みのとき、遷移先は本番のクエストになる", async () => {
    mockTutorialStatus(true);
    renderWithProviders(<HomePage />, { user: fakeUser, withRouter: true });

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "ポケモンを探しに行く" })).toHaveAttribute("href", "/quest");
    });
  });

  it("チュートリアル完了が確定していないとき、遷移先はチュートリアルになる", () => {
    renderWithProviders(<HomePage />, { user: null, withRouter: true });

    expect(screen.getByRole("link", { name: "ポケモンを探しに行く" })).toHaveAttribute("href", "/tutorial");
  });

  it("チュートリアルへの再視聴導線が完了状態によらず表示される", async () => {
    mockTutorialStatus(true);
    renderWithProviders(<HomePage />, { user: fakeUser, withRouter: true });

    expect(
      await screen.findByRole("link", { name: HOME_PAGE_LABELS.tutorialLink }),
    ).toHaveAttribute("href", "/tutorial");
  });
});
