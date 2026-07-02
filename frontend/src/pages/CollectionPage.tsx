import { useState, useEffect } from "react";
import { collectionApi } from "../api/collectionApi";
import { PokemonGrid } from "../components/collection/PokemonGrid";
import { PokemonDetailCard } from "../components/collection/PokemonDetailCard";
import type { CollectionEntry, PokemonDetailResponse } from "../../../shared/api-types/collection";

/**
 * 図鑑コレクション一覧ページ。捕獲済み数と全ポケモンのカードグリッドを表示する。
 * @returns 図鑑ページの要素。
 */
export function CollectionPage() {
  const [collection, setCollection] = useState<CollectionEntry[]>([]);
  // API 応答で上書きされるまでの初期値。ロード中はスピナー表示のため画面には出ない。
  const [totalAvailable, setTotalAvailable] = useState(0);
  const [capturedCount, setCapturedCount] = useState(0);
  const [unavailableCount, setUnavailableCount] = useState(0);
  const [selectedPokemon, setSelectedPokemon] = useState<PokemonDetailResponse | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    collectionApi
      .getCollection()
      .then((res) => {
        setCollection(res.data.pokemon);
        setTotalAvailable(res.data.total_available);
        setCapturedCount(res.data.captured_count);
        setUnavailableCount(res.data.unavailable_count);
      })
      .catch((err) => {
        console.error("failed to load collection", err);
        setListError("ずかんの　よみこみに　しっぱいしました");
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSelect = async (id: number) => {
    setDetailError(null);
    try {
      const res = await collectionApi.getPokemonDetail(id);
      setSelectedPokemon(res.data);
    } catch (err) {
      console.error("failed to load pokemon detail", err);
      setDetailError("ポケモンの　しょうさいを　よみこめなかったよ");
    }
  };

  return (
    <div className="min-h-[calc(100vh-56px)] bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">
            ずかん
          </h1>
          <span className="text-gray-400 text-sm">
            {capturedCount} / {totalAvailable}
          </span>
        </div>

        {unavailableCount > 0 && (
          <p className="bg-yellow-50 border border-yellow-200 text-yellow-700 text-sm rounded-xl px-4 py-2 mb-4">
            {unavailableCount}びき　よみこめなかったよ。あとで　もう一度　ためしてね
          </p>
        )}

        {detailError && (
          <p className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-2 mb-4">
            {detailError}
          </p>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500" />
          </div>
        ) : listError ? (
          <p className="text-center text-red-500 py-20">{listError}</p>
        ) : (
          <PokemonGrid pokemon={collection} onSelect={handleSelect} />
        )}

        {selectedPokemon && (
          <PokemonDetailCard
            pokemon={selectedPokemon}
            onClose={() => setSelectedPokemon(null)}
          />
        )}
      </div>
    </div>
  );
}
