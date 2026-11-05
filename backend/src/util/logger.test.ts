import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildLogEntry, logger } from "./logger.js";

describe("[運用:構造化ログ]ログの形式", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-03T04:56:07.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("単体テスト", () => {
    describe("正常系", () => {
      it("現在時刻が 2026-07-03T04:56:07.000Z で、severity に INFO、メッセージに starting server、追加フィールドに port が 8080 を指定したとき、ログの JSON は severity が INFO、message が starting server、time が 2026-07-03T04:56:07.000Z、port が 8080 になる", () => {
        const entry = buildLogEntry("INFO", "starting server", { port: "8080" });

        expect(JSON.parse(entry)).toEqual({
          severity: "INFO",
          message: "starting server",
          time: "2026-07-03T04:56:07.000Z",
          port: "8080",
        });
      });

      it("severity に INFO、メッセージに starting server、追加フィールドに port が 8080 を指定したとき、ログは 1 行に収まり改行を含まない", () => {
        const entry = buildLogEntry("INFO", "starting server", { port: "8080" });

        expect(entry).not.toContain("\n");
      });

      it("現在時刻が 2026-07-03T04:56:07.000Z で、severity に WARNING、メッセージに running in public mode を指定し、追加フィールドを指定しないとき、ログの JSON は severity が WARNING、message が running in public mode、time が 2026-07-03T04:56:07.000Z の 3 項目だけになる", () => {
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
        "追加フィールドに %s を含めたとき、%s を上書きしようとしたエラーになる",
        (reservedKey) => {
          expect(() =>
            buildLogEntry("ERROR", "boom", { [reservedKey]: "hijacked" }),
          ).toThrow(`log field "${reservedKey}"`);
        },
      );
    });
  });
});

describe("[運用:構造化ログ]ログレベルごとの出力先", () => {
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

  describe("メッセージが something happened で、追加フィールド path が /api/quest のとき", () => {
    describe("ログを出力すると", () => {
      describe("単体テスト", () => {
        describe("正常系", () => {
          it("ログレベルが Info のとき、標準出力に、severity が INFO、message が something happened、path が /api/quest の改行で終わる 1 行の JSON が 1 回だけ書き出される", () => {
            logger.info("something happened", { path: "/api/quest" });

            expect(written.stdout).toHaveLength(1);
            const line = written.stdout[0];
            expect(line.endsWith("\n")).toBe(true);
            expect(JSON.parse(line)).toMatchObject({
              severity: "INFO",
              message: "something happened",
              path: "/api/quest",
            });
          });

          it("ログレベルが Warn のとき、標準エラー出力に、severity が WARNING、message が something happened、path が /api/quest の改行で終わる 1 行の JSON が 1 回だけ書き出される", () => {
            logger.warn("something happened", { path: "/api/quest" });

            expect(written.stderr).toHaveLength(1);
            const line = written.stderr[0];
            expect(line.endsWith("\n")).toBe(true);
            expect(JSON.parse(line)).toMatchObject({
              severity: "WARNING",
              message: "something happened",
              path: "/api/quest",
            });
          });

          it("ログレベルが Error のとき、標準エラー出力に、severity が ERROR、message が something happened、path が /api/quest の改行で終わる 1 行の JSON が 1 回だけ書き出される", () => {
            logger.error("something happened", { path: "/api/quest" });

            expect(written.stderr).toHaveLength(1);
            const line = written.stderr[0];
            expect(line.endsWith("\n")).toBe(true);
            expect(JSON.parse(line)).toMatchObject({
              severity: "ERROR",
              message: "something happened",
              path: "/api/quest",
            });
          });
        });
      });
    });
  });
});
