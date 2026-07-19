import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./AuthContext";
import { tutorialApi } from "../api/tutorialApi";
import { logger } from "../utils/logger";

interface TutorialContextValue {
  /** チュートリアル完了状態。true と確定するまで (未ログイン・応答待ち・取得失敗を含む) は null。 */
  completed: boolean | null;
  /**
   * 確定したチュートリアル完了状態を返す。未確定なら取得を待ち、取得中なら合流する。
   * @returns 確定したチュートリアル完了状態。
   * @throws 取得に失敗した場合。
   */
  ensureStatus: () => Promise<boolean>;
  markCompleted: () => Promise<void>;
}

const TutorialContext = createContext<TutorialContextValue | undefined>(undefined);

/**
 * チュートリアル完了状態を購読し、完了操作を提供するプロバイダ。
 * @param props children を含む React props。
 * @returns TutorialContext.Provider でラップした子要素。
 */
export function TutorialProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [completed, setCompleted] = useState<boolean | null>(null);
  const resolvedRef = useRef<boolean | null>(null);
  const pendingRef = useRef<Promise<boolean> | null>(null);

  const fetchStatus = useCallback(async (): Promise<boolean> => {
    const res = await tutorialApi.getStatus();
    const value = res.data.tutorial_completed;
    resolvedRef.current = value;
    setCompleted(value);
    return value;
  }, []);

  const ensureStatus = useCallback((): Promise<boolean> => {
    if (resolvedRef.current !== null) return Promise.resolve(resolvedRef.current);
    if (pendingRef.current) return pendingRef.current;
    const pending = fetchStatus().finally(() => {
      pendingRef.current = null;
    });
    pendingRef.current = pending;
    return pending;
  }, [fetchStatus]);

  const prefetch = useCallback(async () => {
    resolvedRef.current = null;
    pendingRef.current = null;
    setCompleted(null);
    if (!user) return;
    try {
      await ensureStatus();
    } catch (err) {
      // 起動時取得は最善努力のウォームアップなので失敗はログに留める。正しさはCTA押下時のensureStatusが担保する
      logger.warn("failed to prefetch tutorial status", { error: err });
    }
  }, [user, ensureStatus]);

  useEffect(() => {
    prefetch(); // eslint-disable-line react-hooks/set-state-in-effect -- initial data fetch on mount / user変更時の再取得
  }, [prefetch]);

  const markCompleted = useCallback(async () => {
    try {
      await tutorialApi.markCompleted();
      resolvedRef.current = true;
      setCompleted(true);
    } catch (err) {
      // 記録に失敗しても結果画面の表示は妨げない (次回訪問時に再度チュートリアルが始まるだけ)。診断のためログは残す
      logger.warn("failed to mark tutorial completed", { error: err });
    }
  }, []);

  return (
    <TutorialContext.Provider value={{ completed, ensureStatus, markCompleted }}>
      {children}
    </TutorialContext.Provider>
  );
}

/**
 * チュートリアル完了状態と操作を取得するフック。Provider 外で呼ぶと例外。
 * @returns チュートリアル完了状態と操作。
 * @throws TutorialProvider の外で呼ばれた場合。
 */
// eslint-disable-next-line react-refresh/only-export-components
export const useTutorial = (): TutorialContextValue => {
  const ctx = useContext(TutorialContext);
  if (!ctx) throw new Error("useTutorial must be used within TutorialProvider");
  return ctx;
};
