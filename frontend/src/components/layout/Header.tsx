import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useUsage } from "../../contexts/UsageContext";

// prod 環境ではラベルを出さない仕様。VITE_ENVIRONMENT 未設定や想定外の値も同じく非表示扱い。
const envLabel = (() => {
  const env = import.meta.env.VITE_ENVIRONMENT;
  if (env === "local") return "LOCAL";
  if (env === "dev") return "DEV";
  return null;
})();

/**
 * ログイン後の全ページ共通ヘッダ。環境ラベルと当日のレート残量を表示する。
 * @returns ヘッダの要素 (未ログイン・ログイン画面では null)。
 */
export function Header() {
  const { user } = useAuth();
  const { usage } = useUsage();
  const location = useLocation();

  if (!user || location.pathname === "/login") {
    return null;
  }

  const remaining = usage ? Math.max(0, usage.limit - usage.count) : null;

  return (
    <header className="bg-red-500 text-white shadow-md">
      <div className="max-w-4xl mx-auto flex justify-between items-center px-4 py-3">
        <div className="flex items-center gap-2">
          <Link to="/" className="text-xl font-bold tracking-wide">
            PokeLingual
          </Link>
          {envLabel && (
            <span className="text-xs font-semibold bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded-full">
              {envLabel}
            </span>
          )}
          {usage && remaining !== null && (
            <span
              className="text-xs font-semibold bg-white/20 px-2 py-0.5 rounded-full"
              title="きょうの　のこり　AI呼び出しかいすう（JST 0:00 に リセット）"
            >
              のこり {remaining}/{usage.limit}
            </span>
          )}
        </div>
        <nav className="flex items-center gap-4">
          <Link
            to="/quest"
            className={`hover:text-red-100 transition-colors ${
              location.pathname === "/quest" ? "underline underline-offset-4" : ""
            }`}
          >
            ぼうけん
          </Link>
          <Link
            to="/collection"
            className={`hover:text-red-100 transition-colors ${
              location.pathname === "/collection"
                ? "underline underline-offset-4"
                : ""
            }`}
          >
            ずかん
          </Link>
          <Link
            to="/settings"
            className={`hover:text-red-100 transition-colors ${
              location.pathname === "/settings"
                ? "underline underline-offset-4"
                : ""
            }`}
          >
            せってい
          </Link>
        </nav>
      </div>
    </header>
  );
}
