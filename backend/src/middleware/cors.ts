import cors from "cors";

/**
 * フロントエンドオリジンのみ許可する CORS ミドルウェアを生成する。
 * @param frontendURL 許可するフロントエンドのオリジン。
 * @returns 設定済みの CORS ミドルウェア。
 */
export function corsConfig(frontendURL: string) {
  return cors({
    origin: frontendURL,
    methods: ["GET", "POST", "PUT", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"],
    credentials: true,
  });
}
