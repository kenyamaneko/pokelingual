import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { settingsApi } from "../api/settingsApi";
import { formatPokemonId } from "../utils/pokemonFormat";

/** 選択可能な世代 (第1〜8世代)。図鑑上限 898 に対応し、backend の GENERATION_RANGES と対応する。 */
const SELECTABLE_GENERATIONS = [1, 2, 3, 4, 5, 6, 7, 8];

/**
 * 設定ページ。出題世代の選択・除外ポケモンの追加削除・ログアウトを提供する。
 * @returns 設定ページの要素。
 */
export function SettingsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [excludedIDs, setExcludedIDs] = useState<number[]>([]);
  const [enabledGenerations, setEnabledGenerations] = useState<number[]>([]);
  const [newID, setNewID] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    settingsApi
      .getSettings()
      .then((res) => {
        setExcludedIDs(res.data.excluded_pokemon_ids);
        setEnabledGenerations(res.data.enabled_generations);
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

  const saveGenerations = async (generations: number[]) => {
    setSaving(true);
    setError(null);
    try {
      await settingsApi.updateEnabledGenerations(generations);
      setEnabledGenerations(generations);
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

  // 最低1世代は必須のため、選択が1つだけのときはその世代を外せない。
  const toggleGeneration = (generation: number) => {
    const isEnabled = enabledGenerations.includes(generation);
    if (isEnabled && enabledGenerations.length === 1) return;
    const next = isEnabled
      ? enabledGenerations.filter((g) => g !== generation)
      : [...enabledGenerations, generation].sort((a, b) => a - b);
    saveGenerations(next);
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

        {error && (
          <p className="text-red-500 text-sm mb-4">{error}</p>
        )}

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

        <div className="bg-white rounded-2xl shadow p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">
            出題する世代
          </h2>
          <p className="text-gray-500 text-sm mb-4">
            選んだ世代のポケモンだけが登場します（図鑑の数は変わりません）
          </p>
          <div className="grid grid-cols-2 gap-2">
            {SELECTABLE_GENERATIONS.map((generation) => {
              const checked = enabledGenerations.includes(generation);
              const isOnlyChecked = checked && enabledGenerations.length === 1;
              return (
                <label
                  key={generation}
                  className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={saving || isOnlyChecked}
                    onChange={() => toggleGeneration(generation)}
                    className="accent-red-500"
                  />
                  <span className="text-gray-700 text-sm">第{generation}世代</span>
                </label>
              );
            })}
          </div>
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
      </div>
    </div>
  );
}
