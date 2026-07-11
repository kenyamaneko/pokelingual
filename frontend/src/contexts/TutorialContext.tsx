import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./AuthContext";
import { tutorialApi } from "../api/tutorialApi";
import { logger } from "../utils/logger";

interface TutorialContextValue {
  /** チュートリアル完了状態。true と確定するまで (未ログイン・応答待ち・取得失敗を含む) は null。 */
  completed: boolean | null;
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

  const refresh = useCallback(async () => {
    if (!user) {
      setCompleted(null);
      return;
    }
    try {
      const res = await tutorialApi.getStatus();
      setCompleted(res.data.tutorial_completed);
    } catch (err) {
      // チュートリアル導線の出し分けは補助的なUXなので取得失敗はUI上無視するが、診断のためログは残す
      logger.warn("failed to fetch tutorial status", { error: err });
    }
  }, [user]);

  useEffect(() => {
    refresh(); // eslint-disable-line react-hooks/set-state-in-effect -- initial data fetch on mount
  }, [refresh]);

  const markCompleted = useCallback(async () => {
    try {
      await tutorialApi.markCompleted();
      setCompleted(true);
    } catch (err) {
      // 記録に失敗しても結果画面の表示は妨げない (次回訪問時に再度チュートリアルが始まるだけ)。診断のためログは残す
      logger.warn("failed to mark tutorial completed", { error: err });
    }
  }, []);

  return (
    <TutorialContext.Provider value={{ completed, markCompleted }}>
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
