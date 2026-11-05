import { render, screen } from "@testing-library/react";
import { describe, expect, vi } from "vitest";
import { TermsModal } from "./TermsModal";
import { defineCase } from "../../test/defineCase";

describe("[本体:サイト情報]利用規約モーダル", () => {
  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ When: ["利用規約モーダルを表示する"], Then: "見出し「利用規約」が表示される" }],
    },
    () => {
      render(<TermsModal onDismiss={vi.fn()} />);
      expect(screen.getByRole("heading", { name: "利用規約" })).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        { When: ["利用規約モーダルを表示する"], Then: "「非営利のファンサイト」である旨の文が表示される" },
      ],
    },
    () => {
      render(<TermsModal onDismiss={vi.fn()} />);
      expect(screen.getByText(/非営利のファンサイト/)).toBeInTheDocument();
    },
  );
});
