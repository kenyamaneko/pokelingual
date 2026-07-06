import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { settingsApi } from "../api/settingsApi";
import { formatPokemonId } from "../utils/pokemonFormat";
import { CONTACT_FORM_URL } from "../constants/links";

/**
 * 設定ページ。除外ポケモンの追加・削除とログアウトを提供する。
 * @returns 設定ページの要素。
 */
export function SettingsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [excludedIDs, setExcludedIDs] = useState<number[]>([]);
  const [newID, setNewID] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    settingsApi
      .getSettings()
      .then((res) => {
        setExcludedIDs(res.data.excluded_pokemon_ids);
      })
      .catch(() => {
        setError("設定の読み込みに失敗しました");
      })
      .finally(() => setLoading(false));
  }, []);

  // バリデーション (範囲・重複・上限) はサーバが行う。フロントは送信し、失敗時にエラー表示する。成功したら反映。
  const saveExcluded = async (ids: number[]) => {
    setSaving(true);
    setError(null);
    try {
      await settingsApi.updateExcludedPokemon(ids);
      setExcludedIDs(ids);
    } catch {
      setError("設定の保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = () => {
    const id = parseInt(newID, 10);
    if (isNaN(id)) return;
    setNewID("");
    saveExcluded([...excludedIDs, id].sort((a, b) => a - b));
  };

  const handleRemove = (id: number) => {
    saveExcluded(excludedIDs.filter((x) => x !== id));
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-56px)] bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-56px)] bg-gray-50 py-8">
      <div className="max-w-md mx-auto px-4">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">設定</h1>

        <div className="bg-white rounded-2xl shadow p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">
            アカウント
          </h2>
          <p className="text-gray-700 mb-4">
            {user?.displayName || user?.email}
          </p>
          <button
            onClick={handleLogout}
            className="w-full bg-gray-100 text-gray-600 py-3 rounded-xl font-bold
                       hover:bg-gray-200 transition-colors"
          >
            ログアウト
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">
            バージョン
          </h2>
          <p className="text-gray-500 text-xs font-mono">
            {import.meta.env.VITE_BUILD_VERSION || "dev"}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-400 uppercase">
              苦手ポケモン設定
            </h2>
            <span className="text-xs text-gray-400 font-mono">
              {excludedIDs.length}
            </span>
          </div>
          <p className="text-gray-500 text-sm mb-4">
            出てきてほしくないポケモンを設定できます
          </p>

          {error && (
            <p className="text-red-500 text-sm mb-3">{error}</p>
          )}

          <div className="flex gap-2 mb-4">
            <input
              type="number"
              min="1"
              value={newID}
              onChange={(e) => setNewID(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="ポケモン ID"
              className="flex-1 border border-gray-300 rounded-xl px-4 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-red-300"
            />
            <button
              onClick={handleAdd}
              disabled={saving}
              className="bg-red-500 text-white px-4 py-2 rounded-xl font-bold text-sm
                         hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              追加
            </button>
          </div>

          {excludedIDs.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">
              除外ポケモンはいません
            </p>
          ) : (
            <ul className="space-y-2">
              {excludedIDs.map((id) => (
                <li
                  key={id}
                  className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-2"
                >
                  <span className="text-gray-700 text-sm font-mono">
                    #{formatPokemonId(id)}
                  </span>
                  <button
                    onClick={() => handleRemove(id)}
                    disabled={saving}
                    className="text-red-400 hover:text-red-600 text-sm font-bold
                               disabled:opacity-50"
                  >
                    削除
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow p-6 mt-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">
            このサイトについて
          </h2>
          <div className="flex flex-col gap-2 text-sm">
            <a
              href={CONTACT_FORM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              問い合わせ
            </a>
            <Link to="/terms" className="text-blue-500 hover:underline">
              利用規約
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
