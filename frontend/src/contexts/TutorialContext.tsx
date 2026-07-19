import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { useAuth } from "./AuthContext";
import { tutorialApi } from "../api/tutorialApi";
import { logger } from "../utils/logger";

interface TutorialContextValue {
  /**
   * チュートリアル完了状態を返す。取得済みならその値を返し、取得中ならその取得の完了を待ち、未取得なら取得する。
   * @returns チュートリアル完了状態。
   * @throws 取得に失敗した場合。
   */
  getTutorialCompleted: () => Promise<boolean>;
  markTutorialCompleted: () => Promise<void>;
}

const TutorialContext = createContext<TutorialContextValue | undefined>(undefined);

/**
 * チュートリアル完了状態の取得と完了操作を提供するプロバイダ。
 * @param props children を含む React props。
 * @returns TutorialContext.Provider でラップした子要素。
 */
export function TutorialProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const resolvedRef = useRef<boolean | null>(null);
  const pendingRef = useRef<Promise<boolean> | null>(null);

  const fetchTutorialCompleted = useCallback(async (): Promise<boolean> => {
    const res = await tutorialApi.getStatus();
    const value = res.data.tutorial_completed;
    resolvedRef.current = value;
    return value;
  }, []);

  const getTutorialCompleted = useCallback((): Promise<boolean> => {
    if (resolvedRef.current !== null) return Promise.resolve(resolvedRef.current);
    if (pendingRef.current) return pendingRef.current;
    const pending = fetchTutorialCompleted().finally(() => {
      pendingRef.current = null;
    });
    pendingRef.current = pending;
    return pending;
  }, [fetchTutorialCompleted]);

  const prefetch = useCallback(async () => {
    resolvedRef.current = null;
    pendingRef.current = null;
    if (!user) return;
    try {
      await getTutorialCompleted();
    } catch (err) {
      // 起動時の先読みは失敗しても構わないためログに留める。正しさは押下時のgetTutorialCompletedが担保する
      logger.warn("failed to prefetch tutorial status", { error: err });
    }
  }, [user, getTutorialCompleted]);

  useEffect(() => {
    prefetch();
  }, [prefetch]);

  const markTutorialCompleted = useCallback(async () => {
    try {
      await tutorialApi.markCompleted();
      resolvedRef.current = true;
    } catch (err) {
      // 記録に失敗しても結果画面の表示は妨げない (次回訪問時に再度チュートリアルが始まるだけ)。診断のためログは残す
      logger.warn("failed to mark tutorial completed", { error: err });
    }
  }, []);

  return (
    <TutorialContext.Provider value={{ getTutorialCompleted, markTutorialCompleted }}>
      {children}
    </TutorialContext.Provider>
  );
}

/**
 * チュートリアル完了状態の取得と完了操作を持つオブジェクトを返すフック。Provider 外で呼ぶと例外。
 * @returns チュートリアル完了状態の取得と完了操作。
 * @throws TutorialProvider の外で呼ばれた場合。
 */
// eslint-disable-next-line react-refresh/only-export-components
export const useTutorial = (): TutorialContextValue => {
  const ctx = useContext(TutorialContext);
  if (!ctx) throw new Error("useTutorial must be used within TutorialProvider");
  return ctx;
};
