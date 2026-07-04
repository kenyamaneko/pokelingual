/** バックエンドの実行環境。デプロイ先 (dev / prod) とローカル実行 (local) を区別する。 */
export type AppEnvironment = "local" | "dev" | "prod";

const APP_ENVIRONMENTS: readonly AppEnvironment[] = ["local", "dev", "prod"];

/**
 * 環境変数由来の値を AppEnvironment として検証する。
 * @param value APP_ENV の値。
 * @returns 検証済みの実行環境。
 * @throws 定義外の値の場合。
 */
export function parseAppEnvironment(value: string): AppEnvironment {
  if (!APP_ENVIRONMENTS.includes(value as AppEnvironment)) {
    // タイポ等の未知値を非 prod 扱いに倒すと、prod で開発者除外が誤って有効化するため起動時に失敗させる
    throw new Error(`invalid APP_ENV: ${value} (must be one of: ${APP_ENVIRONMENTS.join(", ")})`);
  }
  return value as AppEnvironment;
}
