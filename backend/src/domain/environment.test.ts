import { describe, it, expect } from "vitest";
import { parseAppEnvironment } from "./environment.js";

describe("parseAppEnvironment", () => {
  it.each(["local", "dev", "prod"])("定義済みの環境 %s を受理する", (value) => {
    expect(parseAppEnvironment(value)).toBe(value);
  });

  it.each(["stg", "production", "PROD", ""])("定義外の値 %s は起動エラーにする", (value) => {
    expect(() => parseAppEnvironment(value)).toThrow(/invalid APP_ENV/);
  });
});
