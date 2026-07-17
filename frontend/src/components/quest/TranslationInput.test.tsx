import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { TranslationInput } from "./TranslationInput";

/**
 * TranslationInput の仕様:
 * - 空テキストでは送信不可
 * - 入力後は送信可
 *
 * 送信で入力訳が渡り採点へ進む結合は、名前当て画面に入力訳が表示される結果を
 * 観測するため QuestPage.test.tsx (公開入口からのフロー) で確かめる。
 * 文言検証は意図的に行わない (ボタンの存在は role で取得)。
 */
describe("[クエスト] 訳文入力欄", () => {
  it("空テキストのときは送信ボタンが押せない", () => {
    render(<TranslationInput onSubmit={vi.fn()} />);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("テキスト入力後は送信ボタンが押せる", async () => {
    const user = userEvent.setup();
    render(<TranslationInput onSubmit={vi.fn()} />);

    await user.type(screen.getByRole("textbox"), "テスト翻訳");

    expect(screen.getByRole("button")).toBeEnabled();
  });
});
