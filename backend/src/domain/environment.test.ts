import { describe, it, expect } from "vitest";
import { parseAppEnvironment } from "./environment.js";

describe("[起動設定] 実行環境名の検証", () => {
  it.each(["local", "dev", "prod"])("定義済みの環境 %s を受理する", (value) => {
    expect(parseAppEnvironment(value)).toBe(value);
  });

  it.each([
    ["stg", "stg"],
    ["production", "production"],
    ["PROD", "PROD"],
    ["空文字", ""],
  ])("定義外の値 (%s) は起動エラーにする", (_label, value) => {
    expect(() => parseAppEnvironment(value)).toThrow(/invalid APP_ENV/);
  });
});
