import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./AuthContext";
import { usageApi, type DailyUsage } from "../api/usageApi";
import {
  RATE_LIMIT_EVENT,
  rateLimitEvents,
  type RateLimitDetail,
} from "../utils/rateLimitEvents";
import { logger } from "../utils/logger";
import { RateLimitModal } from "../components/quest/RateLimitModal";

interface UsageContextValue {
  usage: DailyUsage | null;
  refresh: () => Promise<void>;
}

const UsageContext = createContext<UsageContextValue | undefined>(undefined);

/**
 * 当日のAPI利用状況を購読し、レート制限到達時にモーダルを表示するプロバイダ。
 * @param props children を含む React props。
 * @returns UsageContext.Provider でラップした子要素。
 */
export function UsageProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [usage, setUsage] = useState<DailyUsage | null>(null);
  const [rateLimit, setRateLimit] = useState<RateLimitDetail | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setUsage(null);
      return;
    }
    try {
      const res = await usageApi.get();
      setUsage(res.data);
    } catch (err) {
      // ヘッダーのレート残量表示は補助情報なので UI 上は無視するが、診断のためログは残す
      logger.warn("failed to fetch usage", { error: err });
    }
  }, [user]);

  useEffect(() => {
    refresh(); // eslint-disable-line react-hooks/set-state-in-effect -- initial data fetch on mount
  }, [refresh]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<RateLimitDetail>).detail;
      setRateLimit(detail);
      // 429 到達時は枠が満杯のはずなのでヘッダー表示も同期させる
      refresh();
    };
    rateLimitEvents.addEventListener(RATE_LIMIT_EVENT, handler);
    return () => rateLimitEvents.removeEventListener(RATE_LIMIT_EVENT, handler);
  }, [refresh]);

  return (
    <UsageContext.Provider value={{ usage, refresh }}>
      {children}
      {rateLimit && (
        <RateLimitModal detail={rateLimit} onDismiss={() => setRateLimit(null)} />
      )}
    </UsageContext.Provider>
  );
}

/**
 * 当日の利用状況と手動リフレッシュ関数を取得するフック。Provider 外で呼ぶと例外。
 * @returns 当日の利用状況と手動リフレッシュ関数。
 * @throws UsageProvider の外で呼ばれた場合。
 */
// eslint-disable-next-line react-refresh/only-export-components
export const useUsage = (): UsageContextValue => {
  const ctx = useContext(UsageContext);
  if (!ctx) throw new Error("useUsage must be used within UsageProvider");
  return ctx;
};
