/** メール未確認のユーザーがログインを試みたことを表すエラー。 */
export class EmailNotVerifiedError extends Error {
  constructor() {
    super("email not verified");
    this.name = "EmailNotVerifiedError";
  }
}

/** Firebase Auth のエラーコードからユーザー向けメッセージへの対応。 */
const FIREBASE_AUTH_MESSAGES: Record<string, string> = {
  "auth/email-already-in-use": "このメールアドレスは既に登録されています。ログインしてください",
  "auth/invalid-email": "メールアドレスの形式が正しくありません",
  "auth/weak-password": "パスワードは6文字以上で設定してください",
  "auth/network-request-failed": "ネットワークに接続できません。接続を確認してください",
};

/** 未確認メールの案内文。再送済みである旨と、リンクを開いてからログインし直す導線を伝える。 */
export const EMAIL_NOT_VERIFIED_MESSAGE =
  "メールが未確認です。確認メールを再送したので、メール内のリンクを開いてからログインし直してください";

/**
 * 認証エラーを原因ごとのユーザー向けメッセージに変換する。
 * @param err 捕捉したエラー。
 * @param fallback 原因を判定できない場合に使う既定メッセージ。
 * @returns ユーザー向けエラーメッセージ。
 */
export function mapAuthErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof EmailNotVerifiedError) {
    return EMAIL_NOT_VERIFIED_MESSAGE;
  }
  if (typeof err === "object" && err !== null && "code" in err) {
    const code = (err as { code: unknown }).code;
    if (typeof code === "string" && code in FIREBASE_AUTH_MESSAGES) {
      return FIREBASE_AUTH_MESSAGES[code];
    }
  }
  return fallback;
}
