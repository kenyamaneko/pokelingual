import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ProfessorChat, PROFESSOR_CHAT_LABELS } from "./ProfessorChat";
import { renderWithProviders } from "../../test/render";
import type { ChatContext } from "../../../../shared/api-types/quest";

vi.mock("../../api/questApi", () => ({
  questApi: {
    replyToChat: vi.fn().mockResolvedValue({
      data: { reply: "テスト用の 博士の 返答だよ。" },
    }),
  },
}));

vi.mock("../../api/usageApi", () => ({
  usageApi: { get: vi.fn().mockResolvedValue({ data: { count: 0, limit: 30 } }) },
}));

const chatContext: ChatContext = {
  description_en: "desc en",
  description_ja: "desc ja",
  translation: "yaku",
  score: 80,
  review: "review",
  name_en: "Pikachu",
  name_ja: "ピカチュウ",
};

/**
 * ProfessorChat の仕様:
 * - 質問を送信するとユーザメッセージと教授の返答が会話履歴に表示される
 * - 閉じる (×) ボタンで onClose が呼ばれる
 *
 * テスト対象外: ヘッダ文言・プレースホルダの存在確認は role / aria 経由で得られるため
 * 個別の文言テストは書かない (LABELS で SSOT 化済み)。
 */
describe("ProfessorChat の仕様", () => {
  it("質問を送信するとユーザメッセージと教授の返答が表示される", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProfessorChat context={chatContext} onClose={vi.fn()} />);

    const input = screen.getByRole("textbox");
    await user.type(input, "emit ってどういう意味？");
    await user.click(
      screen.getByRole("button", { name: PROFESSOR_CHAT_LABELS.sendButton }),
    );

    // ユーザの質問が履歴に出る
    expect(screen.getByText("emit ってどういう意味？")).toBeInTheDocument();
    // 教授 (モック) からの返答が履歴に出る
    expect(
      await screen.findByText("テスト用の 博士の 返答だよ。"),
    ).toBeInTheDocument();
  });

  it("閉じるボタンで onClose が呼ばれる", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(<ProfessorChat context={chatContext} onClose={onClose} />);

    await user.click(
      screen.getByRole("button", { name: PROFESSOR_CHAT_LABELS.closeButtonAria }),
    );

    expect(onClose).toHaveBeenCalledOnce();
  });
});
