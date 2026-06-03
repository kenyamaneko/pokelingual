import type { RandomSource } from "../../domain/ports.js";

/**
 * mock モード用の決定的な乱数ソース。常に 0 を返す。
 *
 * Why: 0 は捕獲抽選 `next() < probability` を必ず成立させる (確率は常に正)。これにより
 * mock の E2E では捕獲結果が確定し、図鑑表示などの後続検証が flaky にならない。
 * 出題の flavor text 選択も先頭固定になり、再現性が得られる。
 */
export class MockRandomSource implements RandomSource {
  next(): number {
    return 0;
  }
}
