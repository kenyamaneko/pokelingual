import type { Firestore } from "@google-cloud/firestore";
import type { UserRepository } from "../../domain/ports.js";
import type { User } from "../../domain/user.js";

/** ユーザ本体 (users/{uid} ルートドキュメント) を Firestore に永続化する UserRepository 実装。 */
export class UserRepo implements UserRepository {
  private db: Firestore;

  /**
   * @param db Firestore クライアント。
   */
  constructor(db: Firestore) {
    this.db = db;
  }

  /**
   * ユーザ本体ドキュメントへの参照を返す。
   * @param userId ユーザ ID。
   * @returns users/{userId} への DocumentReference。
   */
  private getUserRef(userId: string) {
    return this.db.collection("users").doc(userId);
  }

  /**
   * ユーザ本体を取得する。未保存なら tutorial_completed が false の値を返す。
   * @param userId ユーザ ID。
   * @returns ユーザ本体。
   */
  async getUser(userId: string): Promise<User> {
    const doc = await this.getUserRef(userId).get();
    if (!doc.exists) {
      return { tutorial_completed: false };
    }
    const data = doc.data() as Partial<User>;
    return { tutorial_completed: data.tutorial_completed ?? false };
  }

  /**
   * チュートリアル完了フラグを立てる。
   * @param userId ユーザ ID。
   */
  async markTutorialCompleted(userId: string): Promise<void> {
    await this.getUserRef(userId).set({ tutorial_completed: true }, { merge: true });
  }
}
