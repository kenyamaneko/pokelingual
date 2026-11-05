import { describe, expect, vi, beforeEach, afterEach } from "vitest";
import { buildLogEntry, logger } from "./logger.js";
import { defineCase } from "../test/defineCase.js";

const BUILD_LOG_ENTRY = "ログ出力に、ログ 1 件の組み立てを依頼する";
const CURRENT_TIME = "現在時刻が 2026-07-03T04:56:07.000Z で";

describe("[運用:ログ出力]ログの形式", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-03T04:56:07.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: `${CURRENT_TIME}、severity が INFO、メッセージが starting server、追加フィールドの port が 8080 のとき`,
          When: [BUILD_LOG_ENTRY],
          Then: "ログの JSON は severity が INFO、message が starting server、time が 2026-07-03T04:56:07.000Z、port が 8080 になる",
        },
      ],
    },
    () => {
      const entry = buildLogEntry("INFO", "starting server", { port: "8080" });

      expect(JSON.parse(entry)).toEqual({
        severity: "INFO",
        message: "starting server",
        time: "2026-07-03T04:56:07.000Z",
        port: "8080",
      });
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "severity が INFO、メッセージが starting server、追加フィールドの port が 8080 のとき",
          When: [BUILD_LOG_ENTRY],
          Then: "ログは 1 行に収まり改行を含まない",
        },
      ],
    },
    () => {
      const entry = buildLogEntry("INFO", "starting server", { port: "8080" });

      expect(entry).not.toContain("\n");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: `${CURRENT_TIME}、severity が WARNING、メッセージが running in public mode で、追加フィールドが無いとき`,
          When: [BUILD_LOG_ENTRY],
          Then: "ログの JSON は severity が WARNING、message が running in public mode、time が 2026-07-03T04:56:07.000Z の 3 項目だけになる",
        },
      ],
    },
    () => {
      const entry = buildLogEntry("WARNING", "running in public mode");

      expect(JSON.parse(entry)).toEqual({
        severity: "WARNING",
        message: "running in public mode",
        time: "2026-07-03T04:56:07.000Z",
      });
    },
  );

  for (const reservedKey of ["severity", "message", "time"]) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "異常系",
        steps: [
          {
            Given: `追加フィールドに ${reservedKey} が含まれているとき`,
            When: [BUILD_LOG_ENTRY],
            Then: `${reservedKey} を上書きしようとしたエラーになる`,
          },
        ],
      },
      () => {
        expect(() =>
          buildLogEntry("ERROR", "boom", { [reservedKey]: "hijacked" }),
        ).toThrow(`log field "${reservedKey}"`);
      },
    );
  }
});

describe("[運用:ログ出力]ログレベルごとの出力先", () => {
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

  const MESSAGE_AND_FIELD = "メッセージが something happened で、追加フィールド path が /api/quest で";
  const WRITE_LOG = "ログ出力に、ログの書き出しを依頼する";

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: `${MESSAGE_AND_FIELD}、ログレベルが Info のとき`,
          When: [WRITE_LOG],
          Then: "標準出力に、severity が INFO、message が something happened、path が /api/quest の改行で終わる 1 行の JSON が 1 回だけ書き出される",
        },
      ],
    },
    () => {
      logger.info("something happened", { path: "/api/quest" });

      expect(written.stdout).toHaveLength(1);
      const line = written.stdout[0];
      expect(line.endsWith("\n")).toBe(true);
      expect(JSON.parse(line)).toMatchObject({
        severity: "INFO",
        message: "something happened",
        path: "/api/quest",
      });
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: `${MESSAGE_AND_FIELD}、ログレベルが Warn のとき`,
          When: [WRITE_LOG],
          Then: "標準エラー出力に、severity が WARNING、message が something happened、path が /api/quest の改行で終わる 1 行の JSON が 1 回だけ書き出される",
        },
      ],
    },
    () => {
      logger.warn("something happened", { path: "/api/quest" });

      expect(written.stderr).toHaveLength(1);
      const line = written.stderr[0];
      expect(line.endsWith("\n")).toBe(true);
      expect(JSON.parse(line)).toMatchObject({
        severity: "WARNING",
        message: "something happened",
        path: "/api/quest",
      });
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: `${MESSAGE_AND_FIELD}、ログレベルが Error のとき`,
          When: [WRITE_LOG],
          Then: "標準エラー出力に、severity が ERROR、message が something happened、path が /api/quest の改行で終わる 1 行の JSON が 1 回だけ書き出される",
        },
      ],
    },
    () => {
      logger.error("something happened", { path: "/api/quest" });

      expect(written.stderr).toHaveLength(1);
      const line = written.stderr[0];
      expect(line.endsWith("\n")).toBe(true);
      expect(JSON.parse(line)).toMatchObject({
        severity: "ERROR",
        message: "something happened",
        path: "/api/quest",
      });
    },
  );
});
