/** ログの構造化フィールド。backend の logger と呼び出しの形 (message + fields) を揃える。 */
type LogFields = Record<string, unknown>;

/**
 * フロントエンド用の 3 レベルロガー。
 * 収集基盤が無くブラウザ devtools でしか見ないため、JSON 文字列化はせず
 * fields をオブジェクトのまま console に渡す (ツリー展開・スタックトレース表示を保つ)。
 */
export const logger = {
  /**
   * 正常系の事象を記録する。
   * @param message ログメッセージ。
   * @param fields 補足情報のフィールド。
   */
  info(message: string, fields?: LogFields): void {
    console.info(message, ...(fields === undefined ? [] : [fields]));
  },

  /**
   * 動作に影響を与えない、あるいは影響が軽微な事象を記録する。
   * @param message ログメッセージ。
   * @param fields 補足情報のフィールド。
   */
  warn(message: string, fields?: LogFields): void {
    console.warn(message, ...(fields === undefined ? [] : [fields]));
  },

  /**
   * 機能の失敗を記録する。
   * @param message ログメッセージ。
   * @param fields 補足情報のフィールド。
   */
  error(message: string, fields?: LogFields): void {
    console.error(message, ...(fields === undefined ? [] : [fields]));
  },
};
