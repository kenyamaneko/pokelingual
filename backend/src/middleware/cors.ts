import cors from "cors";

/** フロントエンドオリジンのみ許可する CORS ミドルウェアを生成する。 */
export function corsConfig(frontendURL: string) {
  return cors({
    origin: frontendURL,
    methods: ["GET", "POST", "PUT", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"],
    credentials: true,
  });
}
