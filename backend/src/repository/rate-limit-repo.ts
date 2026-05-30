import type { Firestore } from "@google-cloud/firestore";
import { FieldValue } from "@google-cloud/firestore";
import { RateLimitError } from "../apperror/apperror.js";
import type { DailyUsage, RateLimitRepository } from "../domain/interfaces.js";

/** Firestore で日次レートリミットを管理する RateLimitRepository 実装。 */
export class RateLimitRepo implements RateLimitRepository {
  constructor(
    private db: Firestore,
    private perUserLimit: number,
    private globalLimit: number,
  ) {}

  /** 当日カウントを検証して上限到達なら RateLimitError、未到達ならインクリメントして返す。 */
  async checkAndIncrement(uid: string): Promise<DailyUsage> {
    const today = jstDate();
    const userRef = this.db.doc(`users/${uid}/daily_usage/${today}`);
    // users/{uid}/daily_usage/{date} と階層を揃え、Firestore の doc は偶数階層必須という制約を満たす
    const globalRef = this.db.doc(`system/global/daily_usage/${today}`);

    return await this.db.runTransaction(async (tx) => {
      const [userSnap, globalSnap] = await Promise.all([tx.get(userRef), tx.get(globalRef)]);
      const userCount = (userSnap.data()?.count as number) ?? 0;
      const globalCount = (globalSnap.data()?.count as number) ?? 0;

      // グローバル上限を先に判定して、特定ユーザーだけが原因でないことを区別可能にする
      if (globalCount >= this.globalLimit) throw new RateLimitError("global");
      if (userCount >= this.perUserLimit) throw new RateLimitError("user");

      tx.set(userRef, { count: userCount + 1, updated_at: FieldValue.serverTimestamp() }, { merge: true });
      tx.set(globalRef, { count: globalCount + 1, updated_at: FieldValue.serverTimestamp() }, { merge: true });

      return { count: userCount + 1, limit: this.perUserLimit };
    });
  }

  /** 当日のユーザ利用カウントと上限を返す。読み取り専用。 */
  async getUserUsage(uid: string): Promise<DailyUsage> {
    const snap = await this.db.doc(`users/${uid}/daily_usage/${jstDate()}`).get();
    return {
      count: (snap.data()?.count as number) ?? 0,
      limit: this.perUserLimit,
    };
  }
}

// JST 固定。ユーザー現地時刻にすると 23:59 + 0:00 で枠を2倍使える抜け道ができるため
function jstDate(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}
