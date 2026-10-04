import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildLogEntry, logger } from "./logger.js";

describe("[構造化ログ] ログエントリの組み立て", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-03T04:56:07.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("正常系", () => {
    it("追加フィールドを指定したとき、ログの JSON は、指定した severity と message、組み立てた時刻の time、指定した追加フィールドを持つ", () => {
      const entry = buildLogEntry("INFO", "starting server", { port: "8080" });

      expect(JSON.parse(entry)).toEqual({
        severity: "INFO",
        message: "starting server",
        time: "2026-07-03T04:56:07.000Z",
        port: "8080",
      });
    });

    it("追加フィールドを指定したとき、ログは 1 行に収まり改行を含まない", () => {
      const entry = buildLogEntry("INFO", "starting server", { port: "8080" });

      expect(entry).not.toContain("\n");
    });

    it("追加フィールドを指定しないとき、ログの JSON は severity・message・time だけを持つ", () => {
      const entry = buildLogEntry("WARNING", "running in public mode");

      expect(JSON.parse(entry)).toEqual({
        severity: "WARNING",
        message: "running in public mode",
        time: "2026-07-03T04:56:07.000Z",
      });
    });
  });

  describe("異常系", () => {
    it.each([
      ["severity", "severity"],
      ["message", "message"],
      ["time", "time"],
    ])(
      "追加フィールドに予約キー %s を含めたとき、組み立てると %s を上書きしようとしたエラーになる",
      (reservedKey) => {
        expect(() =>
          buildLogEntry("ERROR", "boom", { [reservedKey]: "hijacked" }),
        ).toThrow(`log field "${reservedKey}"`);
      },
    );
  });
});

describe("[構造化ログ] ログレベルごとの出力先", () => {
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

  describe("正常系", () => {
    it.each([
      ["Info", "stdout", "INFO", "info"],
      ["Warn", "stderr", "WARNING", "warn"],
      ["Error", "stderr", "ERROR", "error"],
    ] as const)(
      "%s レベルでメッセージと追加フィールドを出力したとき、%s に、severity が %s で指定したメッセージと追加フィールドを持つ 1 行の JSON が書き出される",
      (_level, stream, severity, method) => {
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
});
