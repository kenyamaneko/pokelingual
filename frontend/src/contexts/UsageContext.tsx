import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./AuthContext";
import { usageApi, type DailyUsage } from "../services/usageApi";
import {
  RATE_LIMIT_EVENT,
  rateLimitEvents,
  type RateLimitDetail,
} from "../services/rateLimitEvents";
import { RateLimitModal } from "../components/quest/RateLimitModal";

interface UsageContextValue {
  usage: DailyUsage | null;
  refresh: () => Promise<void>;
}

const UsageContext = createContext<UsageContextValue>({
  usage: null,
  refresh: async () => {},
});

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
    } catch {
      // 取得失敗時はヘッダー非表示で良い（致命的でない）
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

// eslint-disable-next-line react-refresh/only-export-components
export const useUsage = () => useContext(UsageContext);
