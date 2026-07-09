import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { settingsApi } from "../api/settingsApi";
import { pokedexApi } from "../api/pokedexApi";
import { formatPokemonId } from "../utils/pokemonFormat";
import { logger } from "../utils/logger";
import type { PokedexEntry } from "../../../shared/api-types/pokedex";
import { CONTACT_FORM_URL } from "../constants/links";

/** 選択可能な世代 (第1〜8世代) と代表作。数字だけだと分かりにくいのでバージョン名を併記する。backend の GENERATION_RANGES と対応。 */
const GENERATION_OPTIONS = [
  { generation: 1, versions: "赤・緑" },
  { generation: 2, versions: "金・銀" },
  { generation: 3, versions: "ルビー・サファイア" },
  { generation: 4, versions: "ダイヤモンド・パール" },
  { generation: 5, versions: "ブラック・ホワイト" },
  { generation: 6, versions: "X・Y" },
  { generation: 7, versions: "サン・ムーン" },
  { generation: 8, versions: "ソード・シールド" },
];

/** 名前検索で一度に表示する候補の最大数。多すぎる候補で画面が埋まるのを防ぐ。 */
const MAX_SEARCH_CANDIDATES = 20;

/**
 * 設定ページ。出題世代の選択・苦手ポケモンの名前検索と追加削除・ログアウトを提供する。
 * @returns 設定ページの要素。
 */
export function SettingsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [excludedIDs, setExcludedIDs] = useState<number[]>([]);
  const [enabledGenerations, setEnabledGenerations] = useState<number[]>([]);
  const [pokedex, setPokedex] = useState<PokedexEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [pokedexUnavailable, setPokedexUnavailable] = useState(false);
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

    // 名前検索と一覧の名前併記のために図鑑一覧 (ID↔名前) を取得する。除外の保持は ID のまま。
    pokedexApi
      .getPokedex()
      .then((res) => setPokedex(res.data.pokemon))
      .catch((err) => {
        logger.error("failed to load pokedex for name search", { error: err });
        setPokedexUnavailable(true);
      });
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

  const handleSelectCandidate = (id: number) => {
    setSearchQuery("");
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

  const nameById = new Map(pokedex.map((p) => [p.pokemon_id, p.name_ja]));
  const query = searchQuery.trim();
  const candidates =
    query === ""
      ? []
      : pokedex
          .filter((p) => !excludedIDs.includes(p.pokemon_id) && p.name_ja.includes(query))
          .slice(0, MAX_SEARCH_CANDIDATES);

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-var(--header-h))] bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-var(--header-h))] bg-gray-50 py-8">
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
            {GENERATION_OPTIONS.map(({ generation, versions }) => {
              const checked = enabledGenerations.includes(generation);
              const isOnlyChecked = checked && enabledGenerations.length === 1;
              return (
                <label
                  key={generation}
                  className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={saving || isOnlyChecked}
                    onChange={() => toggleGeneration(generation)}
                    className="accent-red-500"
                  />
                  <span className="text-gray-700 text-sm">第{generation}世代（{versions}）</span>
                </label>
              );
            })}
          </div>
          <p className="text-gray-400 text-xs mt-3">1つ以上えらんでね（ぜんぶは外せないよ）</p>
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
            出てきてほしくないポケモンを名前で探して設定できます
          </p>

          {pokedexUnavailable ? (
            <p className="text-gray-400 text-sm mb-4">
              ポケモン一覧を読み込めませんでした。ページを再読み込みしてください
            </p>
          ) : (
            <div className="mb-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ポケモンの名前で探す"
                className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm
                           focus:outline-none focus:ring-2 focus:ring-red-300"
              />
              {candidates.length > 0 && (
                <ul className="mt-2 border border-gray-100 rounded-xl divide-y divide-gray-100 max-h-52 overflow-y-auto">
                  {candidates.map((p) => (
                    <li key={p.pokemon_id}>
                      <button
                        onClick={() => handleSelectCandidate(p.pokemon_id)}
                        disabled={saving}
                        className="w-full flex items-center gap-2 px-4 py-2 text-left text-sm
                                   hover:bg-gray-50 disabled:opacity-50"
                      >
                        <span className="text-gray-400 font-mono">
                          #{formatPokemonId(p.pokemon_id)}
                        </span>
                        <span className="text-gray-700">{p.name_ja}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

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
                  <span className="flex items-center gap-2">
                    <span className="text-gray-700 text-sm font-mono">
                      #{formatPokemonId(id)}
                    </span>
                    {nameById.has(id) && (
                      <span className="text-gray-700 text-sm">{nameById.get(id)}</span>
                    )}
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
