import { useEffect, useState } from "react";

/** 1文字を表示する間隔 (ミリ秒)。 */
export const CHAR_INTERVAL_MS = 20;

interface TypewriterTextProps {
  text: string;
  isActive: boolean;
  onComplete?: () => void;
}

/**
 * isActive が true になってから、text を1文字ずつ送り出して表示する。
 * 全文を表示し終えると onComplete を呼ぶ。
 * @param props text / isActive / onComplete を含む props。
 * @returns 表示中の文字列を含む要素。
 */
export function TypewriterText({ text, isActive, onComplete }: TypewriterTextProps) {
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      setVisibleCount((count) => {
        const next = count + 1;
        if (next >= text.length) clearInterval(interval);
        return next;
      });
    }, CHAR_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isActive, text]);

  useEffect(() => {
    if (isActive && visibleCount >= text.length) onComplete?.();
  }, [isActive, visibleCount, text, onComplete]);

  return <>{text.slice(0, visibleCount)}</>;
}
