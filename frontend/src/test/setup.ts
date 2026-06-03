import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// jsdom は scrollIntoView を実装しないため、テストでチャット UI などを描画すると例外になる。
// テスト全体で安全側に倒してスタブ化する。
Element.prototype.scrollIntoView = vi.fn();
