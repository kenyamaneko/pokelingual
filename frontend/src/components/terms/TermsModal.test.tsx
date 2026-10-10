import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { TermsModal } from "./TermsModal";

describe("[サイト情報] 利用規約モーダル", () => {
  describe("正常系", () => {
    describe("利用規約モーダルを表示したとき", () => {
      it("見出し「利用規約」が表示される", () => {
        render(<TermsModal onDismiss={vi.fn()} />);
        expect(screen.getByRole("heading", { name: "利用規約" })).toBeInTheDocument();
      });

      it("非営利のファンサイトである旨が表示される", () => {
        render(<TermsModal onDismiss={vi.fn()} />);
        expect(screen.getByText(/非営利のファンサイト/)).toBeInTheDocument();
      });
    });
  });
});
