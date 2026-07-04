import { Firestore } from "@google-cloud/firestore";

/** テスト用に固定したプロジェクトID。本番プロジェクトと混同しないために専用名にする。 */
const TEST_PROJECT_ID = "pokelingual-test";

/**
 * Firestore Emulator への接続を必須化して Firestore クライアントを返す。
 * 環境変数 FIRESTORE_EMULATOR_HOST が未設定なら明示的に停止し、
 * 本番 Firestore への誤接続や Emulator 未起動での silent-pass を防ぐ。
 * @returns Emulator に接続した Firestore クライアント。
 * @throws FIRESTORE_EMULATOR_HOST が未設定の場合。
 */
export function requireFirestoreEmulator(): Firestore {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error(
      "FIRESTORE_EMULATOR_HOST is required for repository tests. " +
        "Run `make test-backend` (or `make emulator-up` then `npm test`) to start the emulator.",
    );
  }
  return new Firestore({ projectId: TEST_PROJECT_ID });
}

/**
 * Emulator 上の全ドキュメントをクリアする。
 * テスト間の独立性 (ケース順序に依存しない) を確保する目的。
 */
export async function clearFirestoreEmulator(): Promise<void> {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  if (!host) {
    throw new Error("FIRESTORE_EMULATOR_HOST not set; cannot clear emulator");
  }
  const url = `http://${host}/emulator/v1/projects/${TEST_PROJECT_ID}/databases/(default)/documents`;
  const res = await fetch(url, { method: "DELETE" });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to clear Firestore emulator: ${res.status} ${body}`);
  }
}
