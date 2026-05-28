import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { settingsApi } from "../services/settingsApi";

/** 設定ページ。除外ポケモンの追加・削除とログアウトを提供する。 */
export function SettingsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [excludedIDs, setExcludedIDs] = useState<number[]>([]);
  const [maxPokemonID, setMaxPokemonID] = useState(898);
  const [newID, setNewID] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    settingsApi
      .getSettings()
      .then((res) => {
        setExcludedIDs(res.data.excluded_pokemon_ids || []);
        if (res.data.max_pokemon_id) setMaxPokemonID(res.data.max_pokemon_id);
      })
      .catch(() => {
        setError("せっていの　読みこみに　しっぱいしました");
      })
      .finally(() => setLoading(false));
  }, []);

  const handleAdd = () => {
    const id = parseInt(newID, 10);
    if (isNaN(id) || id < 1 || id > maxPokemonID) {
      setError(`1から${maxPokemonID}の　かずを　いれてね`);
      return;
    }
    if (excludedIDs.includes(id)) {
      setError("もう　ついかされているよ");
      return;
    }
    setError(null);
    const updated = [...excludedIDs, id].sort((a, b) => a - b);
    setExcludedIDs(updated);
    setNewID("");
    saveExcluded(updated);
  };

  const handleRemove = (id: number) => {
    const updated = excludedIDs.filter((x) => x !== id);
    setExcludedIDs(updated);
    saveExcluded(updated);
  };

  const saveExcluded = async (ids: number[]) => {
    setSaving(true);
    try {
      await settingsApi.updateExcludedPokemon(ids);
    } catch {
      setError("ほぞんに　しっぱいしました");
    } finally {
      setSaving(false);
    }
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
        <h1 className="text-2xl font-bold text-gray-800 mb-6">せってい</h1>

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
          <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">
            にがて　ポケモン　せってい
          </h2>
          <p className="text-gray-500 text-sm mb-4">
            ぼうけんに　出てきてほしくない　ポケモンの　IDを　せっていできます
          </p>

          {error && (
            <p className="text-red-500 text-sm mb-3">{error}</p>
          )}

          <div className="flex gap-2 mb-4">
            <input
              type="number"
              min="1"
              max={maxPokemonID}
              value={newID}
              onChange={(e) => setNewID(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder={`ポケモン ID (1-${maxPokemonID})`}
              className="flex-1 border border-gray-300 rounded-xl px-4 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-red-300"
            />
            <button
              onClick={handleAdd}
              disabled={saving}
              className="bg-red-500 text-white px-4 py-2 rounded-xl font-bold text-sm
                         hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              ついか
            </button>
          </div>

          {excludedIDs.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">
              じょがい　ポケモンは　いません
            </p>
          ) : (
            <ul className="space-y-2">
              {excludedIDs.map((id) => (
                <li
                  key={id}
                  className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-2"
                >
                  <span className="text-gray-700 text-sm font-mono">
                    #{String(id).padStart(3, "0")}
                  </span>
                  <button
                    onClick={() => handleRemove(id)}
                    disabled={saving}
                    className="text-red-400 hover:text-red-600 text-sm font-bold
                               disabled:opacity-50"
                  >
                    さくじょ
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
