import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { TermsModal } from "./TermsModal";

describe("[サイト情報] 利用規約モーダル", () => {
  it("非営利のファンサイトである旨を含む利用規約を表示する", () => {
    render(<TermsModal onDismiss={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "利用規約" })).toBeInTheDocument();
    expect(screen.getByText(/非営利のファンサイト/)).toBeInTheDocument();
  });
});
