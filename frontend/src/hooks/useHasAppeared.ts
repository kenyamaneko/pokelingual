import { useEffect, useState, type RefObject } from "react";

/**
 * ref の要素が初めてビューポート内に現れたら true を返す。一度 true になったら
 * observer を解除し、以後は再計算しない (縦スクロールで遅れて現れる要素の検知用)。
 * @param ref 監視対象の要素の ref。
 * @returns 要素が初めて可視化されたら true。
 */
export function useHasAppeared(ref: RefObject<Element | null>): boolean {
  const [hasAppeared, setHasAppeared] = useState(false);

  useEffect(() => {
    if (hasAppeared) return;
    const target = ref.current;
    if (!target) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setHasAppeared(true);
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [ref, hasAppeared]);

  return hasAppeared;
}
