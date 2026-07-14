import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useUsage } from "../../contexts/UsageContext";

/**
 * 環境ラベルの表示文字列を返す。prod 環境ではラベルを出さない仕様のため、
 * VITE_ENVIRONMENT 未設定や想定外の値も含めて null (非表示) を返す。
 * @param env VITE_ENVIRONMENT の値。
 * @returns 表示するラベル。非表示なら null。
 */
function getEnvLabel(env: string | undefined): string | null {
  if (env === "local") return "LOCAL";
  if (env === "dev") return "DEV";
  return null;
}

/**
 * ログイン後の全ページ共通ヘッダ。環境ラベルと当日のレート残量を表示する。
 * @returns ヘッダの要素 (未ログイン・ログイン画面では null)。
 */
export function Header() {
  const { user } = useAuth();
  const { usage } = useUsage();
  const location = useLocation();
  const envLabel = getEnvLabel(import.meta.env.VITE_ENVIRONMENT);

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
              title="今日の残り回数"
            >
              残り {remaining}/{usage.limit}
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
            to="/pokedex"
            className={`hover:text-red-100 transition-colors ${
              location.pathname === "/pokedex"
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
