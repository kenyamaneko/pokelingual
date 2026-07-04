import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildLogEntry, logger } from "./logger.js";

/**
 * 構造化ロガーの仕様:
 * - buildLogEntry は severity / message / time / 追加フィールドを 1 行 JSON にする
 * - 予約キー (severity / message / time) を fields で上書きしようとするとエラーにする
 * - logger.info は stdout、warn / error は stderr に severity 付きで書き出す
 */
describe("buildLogEntry の仕様", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-03T04:56:07.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("severity・message・time・追加フィールドを含む 1 行 JSON を返す", () => {
    const entry = buildLogEntry("INFO", "starting server", { port: "8080" });

    expect(JSON.parse(entry)).toEqual({
      severity: "INFO",
      message: "starting server",
      time: "2026-07-03T04:56:07.000Z",
      port: "8080",
    });
    expect(entry).not.toContain("\n");
  });

  it("fields を省略すると severity・message・time のみになる", () => {
    const entry = buildLogEntry("WARNING", "running in public mode");

    expect(JSON.parse(entry)).toEqual({
      severity: "WARNING",
      message: "running in public mode",
      time: "2026-07-03T04:56:07.000Z",
    });
  });

  it.each([["severity"], ["message"], ["time"]])(
    "予約キー %s を fields に含むとエラーにする",
    (reservedKey) => {
      expect(() =>
        buildLogEntry("ERROR", "boom", { [reservedKey]: "hijacked" }),
      ).toThrow(`log field "${reservedKey}"`);
    },
  );
});

describe("logger の仕様", () => {
  let written: Record<"stdout" | "stderr", string[]>;

  beforeEach(() => {
    written = { stdout: [], stderr: [] };
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      written.stdout.push(String(chunk));
      return true;
    });
    vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      written.stderr.push(String(chunk));
      return true;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ["info", "INFO", "stdout"],
    ["warn", "WARNING", "stderr"],
    ["error", "ERROR", "stderr"],
  ] as const)(
    "logger.%s は severity=%s の JSON を %s に 1 行で書き出す",
    (method, severity, stream) => {
      logger[method]("something happened", { path: "/api/quest" });

      expect(written[stream]).toHaveLength(1);
      const line = written[stream][0];
      expect(line.endsWith("\n")).toBe(true);
      expect(JSON.parse(line)).toMatchObject({
        severity,
        message: "something happened",
        path: "/api/quest",
      });
    },
  );
});
