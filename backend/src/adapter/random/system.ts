import type { RandomSource } from "../../domain/ports.js";

/** 本番用の乱数ソース。Math.random をそのまま委譲する。 */
export class SystemRandomSource implements RandomSource {
  next(): number {
    return Math.random();
  }
}
