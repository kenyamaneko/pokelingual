import cors from "cors";

export function corsConfig(frontendURL: string) {
  return cors({
    origin: frontendURL,
    methods: ["GET", "POST", "PUT", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"],
    credentials: true,
  });
}
