import type { DocumentReference, Firestore, Transaction } from "@google-cloud/firestore";
import { FieldValue } from "@google-cloud/firestore";
import { RateLimitError } from "../../domain/errors.js";
import type { DailyUsage, RateLimitRepository } from "../../domain/ports.js";

interface DailyCounter {
  ref: DocumentReference;
  count: number;
}

/** Firestore で日次レートリミットを管理する RateLimitRepository 実装。 */
export class RateLimitRepo implements RateLimitRepository {
  /**
   * @param db Firestore クライアント。
   * @param perUserLimit 1 ユーザ 1 日あたりの上限。
   * @param globalLimit サービス全体 1 日あたりの上限。
   */
  constructor(
    private db: Firestore,
    private perUserLimit: number,
    private globalLimit: number,
  ) {}

  /**
   * AI 呼び出し回数を記録する。日次上限に達していれば記録せずエラーにする。
   * @param userId ユーザ ID。
   * @returns 記録後の AI 呼び出し回数と日次上限。
   * @throws RateLimitError 全体またはユーザごとの日次上限に到達した場合。
   */
  async recordDailyUsage(userId: string): Promise<DailyUsage> {
    const today = getJstToday();
    const userRef = this.db.doc(`users/${userId}/daily_usage/${today}`);
    // users/{userId}/daily_usage/{date} と階層を揃え、Firestore の doc は偶数階層必須という制約を満たす
    const globalRef = this.db.doc(`system/global/daily_usage/${today}`);

    return await this.db.runTransaction(async (tx) => {
      const [userSnap, globalSnap] = await Promise.all([tx.get(userRef), tx.get(globalRef)]);
      const perUserCallCount = (userSnap.data()?.count as number) ?? 0;
      const globalCallCount = (globalSnap.data()?.count as number) ?? 0;

      this.assertBelowDailyLimit(perUserCallCount, globalCallCount);
      this.incrementDailyUsage(tx, { ref: userRef, count: perUserCallCount }, { ref: globalRef, count: globalCallCount });

      return { count: perUserCallCount + 1, limit: this.perUserLimit };
    });
  }

  /**
   * ユーザごとと全体の AI 呼び出し回数を、トランザクション内で 1 ずつ加算する。
   * @param tx 読み取り済みのトランザクション。
   * @param user ユーザごとの AI 呼び出し回数の文書と、加算前の回数。
   * @param global 全体の AI 呼び出し回数の文書と、加算前の回数。
   */
  private incrementDailyUsage(tx: Transaction, user: DailyCounter, global: DailyCounter): void {
    tx.set(user.ref, { count: user.count + 1, updated_at: FieldValue.serverTimestamp() }, { merge: true });
    tx.set(global.ref, { count: global.count + 1, updated_at: FieldValue.serverTimestamp() }, { merge: true });
  }

  /**
   * AI 呼び出し回数が、ユーザごとの日次上限と全体の日次上限のどちらにも達していないことを確かめる。
   * @param perUserCallCount ユーザごとの AI 呼び出し回数。
   * @param globalCallCount 全体の AI 呼び出し回数。
   * @throws RateLimitError 全体またはユーザごとの日次上限に到達した場合。
   */
  private assertBelowDailyLimit(perUserCallCount: number, globalCallCount: number): void {
    // 特定ユーザーだけが原因でないことを区別できるようにするため、全体の日次上限を先に判定する
    if (globalCallCount >= this.globalLimit) throw new RateLimitError("global");
    if (perUserCallCount >= this.perUserLimit) throw new RateLimitError("user");
  }

  /**
   * ユーザごとの AI 呼び出し回数と日次上限を返す。読み取り専用。
   * @param userId ユーザ ID。
   * @returns ユーザごとの AI 呼び出し回数と日次上限。
   */
  async getUserUsage(userId: string): Promise<DailyUsage> {
    const snap = await this.db.doc(`users/${userId}/daily_usage/${getJstToday()}`).get();
    return {
      count: (snap.data()?.count as number) ?? 0,
      limit: this.perUserLimit,
    };
  }
}

/**
 * 当日 (JST) の日付文字列を返す。
 * @returns "YYYY-MM-DD" 形式の JST 日付。
 */
function getJstToday(): string {
  // JST 固定。ユーザー現地時刻にすると 23:59 + 0:00 で枠を2倍使える抜け道ができるため
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}
