import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useUsage } from "../../contexts/UsageContext";

/**
 * Header の仕様文言。テストから import される SSOT。
 */
export const HEADER_LABELS = {
  menuButton: "メニュー",
} as const;

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
 * 画面幅が狭いときはナビゲーションをハンバーガーメニューに折りたたむ。
 * @returns ヘッダの要素 (未ログイン・ログイン画面では null)。
 */
export function Header() {
  const { user } = useAuth();
  const { usage } = useUsage();
  const location = useLocation();
  const envLabel = getEnvLabel(import.meta.env.VITE_ENVIRONMENT);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  if (!user || location.pathname === "/login") {
    return null;
  }

  const remaining = usage ? Math.max(0, usage.limit - usage.count) : null;

  const navLinkClass = (path: string) =>
    `hover:text-red-100 transition-colors ${
      location.pathname === path ? "underline underline-offset-4" : ""
    }`;
  const closeMenu = () => setIsMenuOpen(false);

  return (
    <header className="bg-red-500 text-white shadow-md relative">
      <div className="max-w-4xl mx-auto flex justify-between items-center px-4 py-3">
        <div className="flex items-center gap-2">
          <Link to="/" className="text-xl font-bold tracking-wide" onClick={closeMenu}>
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

        <nav
          id="header-nav"
          className={`${isMenuOpen ? "flex" : "hidden"} sm:flex flex-col sm:flex-row
                      items-start sm:items-center gap-2 sm:gap-4
                      absolute sm:static left-0 right-0 top-full sm:top-auto
                      bg-red-500 sm:bg-transparent px-4 sm:px-0 pb-3 sm:pb-0`}
        >
          <Link to="/quest" className={navLinkClass("/quest")} onClick={closeMenu}>
            ぼうけん
          </Link>
          <Link to="/pokedex" className={navLinkClass("/pokedex")} onClick={closeMenu}>
            ずかん
          </Link>
          <Link to="/settings" className={navLinkClass("/settings")} onClick={closeMenu}>
            せってい
          </Link>
        </nav>

        <button
          type="button"
          className="sm:hidden p-2 -mr-2"
          aria-expanded={isMenuOpen}
          aria-controls="header-nav"
          aria-label={HEADER_LABELS.menuButton}
          onClick={() => setIsMenuOpen((open) => !open)}
        >
          <span aria-hidden="true" className="block text-xl leading-none">
            {isMenuOpen ? "✕" : "☰"}
          </span>
        </button>
      </div>
    </header>
  );
}
