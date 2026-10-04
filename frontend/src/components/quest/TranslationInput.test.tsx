import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { TranslationInput } from "./TranslationInput";

describe("[クエスト] 翻訳の入力欄", () => {
  describe("正常系", () => {
    it("翻訳を入力すると、送信ボタンが押せる状態になる", async () => {
      const user = userEvent.setup();
      render(<TranslationInput onSubmit={vi.fn()} />);

      await user.type(screen.getByRole("textbox"), "テスト翻訳");

      expect(screen.getByRole("button")).toBeEnabled();
    });
  });

  describe("異常系", () => {
    it("入力欄が空のとき、送信ボタンは押せない状態になる", () => {
      render(<TranslationInput onSubmit={vi.fn()} />);
      expect(screen.getByRole("button")).toBeDisabled();
    });
  });
});
