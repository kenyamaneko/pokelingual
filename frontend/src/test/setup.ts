import "@testing-library/jest-dom/vitest";
import { vi, beforeAll, afterEach, afterAll } from "vitest";
import { server, requestLog, resetTutorialQuestState } from "./mswServer";

// jsdom は scrollIntoView を実装しないため、テストでチャット UI などを描画すると例外になる。
// テスト全体で安全側に倒してスタブ化する。
Element.prototype.scrollIntoView = vi.fn();

// API モックは HTTP 境界 (MSW) で行う。未処理リクエストはハンドラ漏れとして即エラーにする。
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  requestLog.length = 0;
  resetTutorialQuestState();
});
afterAll(() => server.close());
