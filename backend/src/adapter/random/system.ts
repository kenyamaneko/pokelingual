import type { RandomSource } from "../../domain/ports.js";

/** 本番用の乱数ソース。Math.random をそのまま委譲する。 */
export class SystemRandomSource implements RandomSource {
  /**
   * @returns Math.random() による [0,1) の乱数。
   */
  next(): number {
    return Math.random();
  }
}
