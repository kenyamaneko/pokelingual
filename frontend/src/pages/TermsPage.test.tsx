import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { TermsPage } from "./TermsPage";

/**
 * TermsPage の仕様:
 * - 非営利のファンサイトである旨を含む利用規約を表示する
 * - 「戻る」で直前の画面へ戻る
 */
describe("TermsPage", () => {
  it("非営利のファンサイトである旨を含む利用規約を表示する", () => {
    render(
      <MemoryRouter initialEntries={["/terms"]}>
        <Routes>
          <Route path="/terms" element={<TermsPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "利用規約", level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/非営利のファンサイト/)).toBeInTheDocument();
  });

  it("「戻る」で直前の画面へ戻る", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/settings", "/terms"]}>
        <Routes>
          <Route path="/settings" element={<div data-testid="settings-page" />} />
          <Route path="/terms" element={<TermsPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("button", { name: "戻る" }));
    expect(screen.getByTestId("settings-page")).toBeInTheDocument();
  });
});
