import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

export function Header() {
  const { user } = useAuth();
  const location = useLocation();

  if (!user || location.pathname === "/login") {
    return null;
  }

  return (
    <header className="bg-red-500 text-white shadow-md">
      <div className="max-w-4xl mx-auto flex justify-between items-center px-4 py-3">
        <Link to="/" className="text-xl font-bold tracking-wide">
          PokeLingual
        </Link>
        <nav className="flex items-center gap-4">
          <Link
            to="/quest"
            className={`hover:text-red-100 transition-colors ${
              location.pathname === "/quest" ? "underline underline-offset-4" : ""
            }`}
          >
            クエスト
          </Link>
          <Link
            to="/collection"
            className={`hover:text-red-100 transition-colors ${
              location.pathname === "/collection"
                ? "underline underline-offset-4"
                : ""
            }`}
          >
            コレクション
          </Link>
          <Link
            to="/settings"
            className={`hover:text-red-100 transition-colors ${
              location.pathname === "/settings"
                ? "underline underline-offset-4"
                : ""
            }`}
          >
            設定
          </Link>
        </nav>
      </div>
    </header>
  );
}
