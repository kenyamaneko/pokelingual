type IntersectionListener = (isIntersecting: boolean) => void;

interface ObservedTarget {
  target: Element;
  notify: IntersectionListener;
}

let observedTargets: ObservedTarget[] = [];
let autoTrigger = true;

class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin = "";
  readonly thresholds: ReadonlyArray<number> = [];
  private readonly callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }

  observe(target: Element): void {
    const notify: IntersectionListener = (isIntersecting) => {
      this.callback(
        [{ isIntersecting, target } as IntersectionObserverEntry],
        this,
      );
    };
    observedTargets.push({ target, notify });
    if (autoTrigger) notify(true);
  }

  unobserve(target: Element): void {
    observedTargets = observedTargets.filter((entry) => entry.target !== target);
  }

  disconnect(): void {
    observedTargets = [];
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

/**
 * jsdom に無い IntersectionObserver をテスト用に補う。既定では observe した要素へ
 * 即座に isIntersecting=true を通知し、可視化ゲートが常に開いた状態を再現する。
 */
export function installIntersectionObserverMock(): void {
  globalThis.IntersectionObserver =
    MockIntersectionObserver as unknown as typeof IntersectionObserver;
}

/**
 * observe した要素一覧と自動発火設定をリセットする。テストの afterEach から呼ぶ。
 */
export function resetIntersectionObserverMock(): void {
  observedTargets = [];
  autoTrigger = true;
}

/**
 * observe 時の isIntersecting 自動発火を止める。可視化ゲートが「保留」状態を保つ
 * テストで、triggerIntersection による明示的な発火まで開示が始まらないことを確かめる。
 * @param enabled 自動発火するか。
 */
export function setIntersectionAutoTrigger(enabled: boolean): void {
  autoTrigger = enabled;
}

/**
 * 指定要素を observe しているコールバックへ isIntersecting を明示的に通知する。
 * @param target 発火対象の要素。
 * @param isIntersecting 可視状態。
 */
export function triggerIntersection(target: Element, isIntersecting: boolean): void {
  observedTargets
    .filter((entry) => entry.target === target)
    .forEach((entry) => entry.notify(isIntersecting));
}
