import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AxiosError, type AxiosResponse } from "axios";
import { ProfessorChat, PROFESSOR_CHAT_LABELS } from "./ProfessorChat";
import { questApi } from "../../api/questApi";
import { renderWithProviders } from "../../test/render";
import { spec } from "../../test/labels";
import type { ChatContext, ChatResponse } from "../../../../shared/api-types/quest";

vi.mock("../../api/questApi", () => ({
  questApi: { replyToChat: vi.fn() },
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
 * replyToChat が成功して教授の返答を返す状態をモックする。
 * @param reply 教授の返答文。
 */
function mockReply(reply: string) {
  vi.mocked(questApi.replyToChat).mockResolvedValue({
    data: { reply },
  } as AxiosResponse<ChatResponse>);
}

/**
 * 指定ステータスの response を持つ AxiosError を作る。
 * @param status HTTP ステータスコード。
 * @returns response 付きの AxiosError。
 */
function makeAxiosError(status: number): AxiosError {
  return new AxiosError(
    "test error",
    AxiosError.ERR_BAD_RESPONSE,
    undefined,
    undefined,
    {
      data: {},
      status,
      statusText: "",
      headers: {},
      // テスト用のダミー config。実装で参照されないため最小構成。
      config: { headers: {} } as AxiosResponse["config"],
    },
  );
}

/**
 * 質問を入力して送信ボタンを押す。
 * @param user userEvent のセッション。
 * @param text 送信する質問文。
 */
async function sendQuestion(
  user: ReturnType<typeof userEvent.setup>,
  text: string,
) {
  await user.type(screen.getByRole("textbox"), text);
  await user.click(
    screen.getByRole("button", { name: PROFESSOR_CHAT_LABELS.sendButton }),
  );
}

/**
 * ProfessorChat の仕様:
 * - 質問を送信するとユーザメッセージと教授の返答が会話履歴に表示される
 * - 送信が 429 で拒否されたら直前に足したユーザメッセージを巻き戻す (モーダル表示は UsageProvider に委譲)
 * - 送信が 429 以外で失敗したらエラーの返答をチャットに表示する
 * - 閉じる (×) ボタンで onClose が呼ばれる
 *
 * テスト対象外: ヘッダ文言・プレースホルダの存在確認は role / aria 経由で得られるため
 * 個別の文言テストは書かない (LABELS で SSOT 化済み)。
 */
describe("ProfessorChat の仕様", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("質問を送信するとユーザメッセージと教授の返答が表示される", async () => {
    mockReply("テスト用の 博士の 返答だよ。");
    const user = userEvent.setup();
    renderWithProviders(<ProfessorChat context={chatContext} onClose={vi.fn()} />);

    await sendQuestion(user, "emit ってどういう意味？");

    // ユーザの質問が履歴に出る
    expect(screen.getByText("emit ってどういう意味？")).toBeInTheDocument();
    // 教授 (モック) からの返答が履歴に出る
    expect(
      await screen.findByText("テスト用の 博士の 返答だよ。"),
    ).toBeInTheDocument();
  });

  it("送信が 429 で拒否されると直前に足したユーザメッセージが巻き戻る", async () => {
    vi.mocked(questApi.replyToChat).mockRejectedValue(makeAxiosError(429));
    const user = userEvent.setup();
    renderWithProviders(<ProfessorChat context={chatContext} onClose={vi.fn()} />);

    await sendQuestion(user, "しつもんです");

    // 楽観的に追加されたユーザメッセージが履歴から消える
    await waitFor(() => {
      expect(screen.queryByText("しつもんです")).not.toBeInTheDocument();
    });
    // 429 の通知は UsageProvider のモーダルに委譲され、チャット枠にはエラー返答が出ない
    expect(
      screen.queryByText(spec(PROFESSOR_CHAT_LABELS.errorReply)),
    ).not.toBeInTheDocument();
  });

  it("送信が 429 以外で失敗するとエラーの返答がチャットに表示される", async () => {
    vi.mocked(questApi.replyToChat).mockRejectedValue(makeAxiosError(500));
    const user = userEvent.setup();
    renderWithProviders(<ProfessorChat context={chatContext} onClose={vi.fn()} />);

    await sendQuestion(user, "しつもんです");

    expect(
      await screen.findByText(spec(PROFESSOR_CHAT_LABELS.errorReply)),
    ).toBeInTheDocument();
    // ユーザの質問は巻き戻さず履歴に残る
    expect(screen.getByText("しつもんです")).toBeInTheDocument();
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
