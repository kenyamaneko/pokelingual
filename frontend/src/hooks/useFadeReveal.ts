import { useEffect, useState } from "react";

/** フェードインの再生時間 (ミリ秒)。CSS の transition-duration と揃える。 */
export const FADE_DURATION_MS = 400;

/**
 * shouldReveal が true になった時点でフェードインを開始し、再生時間の経過後に
 * onComplete を呼ぶ。
 * @param shouldReveal この段の開示条件 (前段階の完了 && 可視化) が揃ったか。
 * @param onComplete フェード完了時に呼ぶ。
 * @returns フェードインを開始してよいか (true なら不透明度を上げる)。
 */
export function useFadeReveal(shouldReveal: boolean, onComplete?: () => void): boolean {
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (!shouldReveal || completed) return;
    const timer = setTimeout(() => {
      setCompleted(true);
      onComplete?.();
    }, FADE_DURATION_MS);
    return () => clearTimeout(timer);
  }, [shouldReveal, completed, onComplete]);

  return shouldReveal;
}
