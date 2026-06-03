import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { TranslationInput } from "./TranslationInput";

/**
 * TranslationInput の仕様:
 * - 空テキストでは送信不可
 * - 入力後は送信可
 * - 送信時に onSubmit へ入力値が渡る
 *
 * 文言検証は意図的に行わない (ボタンの存在は role で取得)。
 */
describe("TranslationInput の仕様", () => {
  it("空テキストのときは送信ボタンが disabled", () => {
    render(<TranslationInput onSubmit={vi.fn()} />);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("テキスト入力後は送信ボタンが enabled", async () => {
    const user = userEvent.setup();
    render(<TranslationInput onSubmit={vi.fn()} />);

    await user.type(screen.getByRole("textbox"), "テスト翻訳");

    expect(screen.getByRole("button")).toBeEnabled();
  });

  it("送信時に onSubmit へ入力値が渡る", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<TranslationInput onSubmit={onSubmit} />);

    await user.type(screen.getByRole("textbox"), "テスト翻訳");
    await user.click(screen.getByRole("button"));

    expect(onSubmit).toHaveBeenCalledWith("テスト翻訳");
  });
});
