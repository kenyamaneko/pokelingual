import { readFile } from "node:fs/promises";
import { Storage } from "@google-cloud/storage";
import type { SnapshotReader } from "./snapshot.js";

/**
 * スナップショットの読み込み元 URI から reader を作る。
 * @param uri `gs://bucket/object` なら Cloud Storage、それ以外はローカルファイルパス。
 * @returns スナップショット JSON テキストを返す reader。
 * @throws gs:// でオブジェクトパスが欠けている場合。
 */
export function createSnapshotReader(uri: string): SnapshotReader {
  if (uri.startsWith("gs://")) {
    const path = uri.slice("gs://".length);
    const slash = path.indexOf("/");
    if (slash === -1) throw new Error(`invalid snapshot URI (missing object path): ${uri}`);
    const bucketName = path.slice(0, slash);
    const objectName = path.slice(slash + 1);
    const storage = new Storage();
    return async () => {
      const [contents] = await storage.bucket(bucketName).file(objectName).download();
      return contents.toString("utf-8");
    };
  }
  return async () => readFile(uri, "utf-8");
}
