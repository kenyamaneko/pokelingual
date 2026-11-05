import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, vi } from "vitest";
import { TranslationInput } from "./TranslationInput";
import { defineCase } from "../../test/defineCase";

describe("[本体:採点]翻訳の入力欄", () => {
  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          When: ["翻訳「テスト翻訳」を入力する"],
          Then: "「この翻訳に決めた！」ボタンが押せる状態になる",
        },
      ],
    },
    async () => {
      const user = userEvent.setup();
      render(<TranslationInput onSubmit={vi.fn()} />);

      await user.type(screen.getByRole("textbox"), "テスト翻訳");

      expect(screen.getByRole("button")).toBeEnabled();
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      steps: [
        {
          Given: "入力欄が空のとき",
          When: ["翻訳の入力欄を表示する"],
          Then: "「この翻訳に決めた！」ボタンは押せない状態になる",
        },
      ],
    },
    () => {
      render(<TranslationInput onSubmit={vi.fn()} />);
      expect(screen.getByRole("button")).toBeDisabled();
    },
  );
});
