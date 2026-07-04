/** Cloud Logging が解釈する severity 名。principles.md のログレベル (Info/Warn/Error) と 1:1 に対応する。 */
type LogSeverity = "INFO" | "WARNING" | "ERROR";

/** ログの構造化フィールド。値は JSON 化できるものを渡す。 */
type LogFields = Record<string, unknown>;

// severity/message/time は Cloud Logging が特別扱いするキーのため、fields による上書きを禁止する
const RESERVED_FIELD_KEYS = ["severity", "message", "time"] as const;

/**
 * ログエントリを Cloud Logging が構造化取り込みできる 1 行 JSON に組み立てる。
 * @param severity Cloud Logging の severity 名。
 * @param message ログメッセージ。可変値は message に埋め込まず fields に分離する。
 * @param fields 検索可能な構造化フィールド。
 * @returns 1 行 JSON 文字列 (改行を含まない)。
 * @throws Error fields が予約キー (severity / message / time) を含む場合。
 */
export function buildLogEntry(
  severity: LogSeverity,
  message: string,
  fields: LogFields = {},
): string {
  for (const key of RESERVED_FIELD_KEYS) {
    if (key in fields) {
      throw new Error(`log field "${key}" would overwrite a reserved log entry key`);
    }
  }
  return JSON.stringify({ severity, message, time: new Date().toISOString(), ...fields });
}

/**
 * 構造化ログを stdout / stderr に出力するロガー。
 * Cloud Run は両ストリームを Cloud Logging へ転送し、1 行 JSON を構造化フィールドとして取り込む。
 */
export const logger = {
  /**
   * 起動・停止・正常系の事象を記録する。
   * @param message ログメッセージ。
   * @param fields 検索可能な構造化フィールド。
   */
  info(message: string, fields?: LogFields): void {
    process.stdout.write(buildLogEntry("INFO", message, fields) + "\n");
  },

  /**
   * 運用に影響を与えない、あるいは影響が軽微な事象を記録する。
   * @param message ログメッセージ。
   * @param fields 検索可能な構造化フィールド。
   */
  warn(message: string, fields?: LogFields): void {
    process.stderr.write(buildLogEntry("WARNING", message, fields) + "\n");
  },

  /**
   * 運用に支障をきたす事象を記録する。
   * @param message ログメッセージ。
   * @param fields 検索可能な構造化フィールド。
   */
  error(message: string, fields?: LogFields): void {
    process.stderr.write(buildLogEntry("ERROR", message, fields) + "\n");
  },
};
