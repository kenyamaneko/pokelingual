import { useState, useEffect } from "react";
import { collectionApi } from "../services/collectionApi";
import { PokemonGrid } from "../components/collection/PokemonGrid";
import { PokemonDetailCard } from "../components/collection/PokemonDetailCard";
import type { CollectionEntry, PokemonDetail } from "../types";

export function CollectionPage() {
  const [collection, setCollection] = useState<CollectionEntry[]>([]);
  const [totalAvailable, setTotalAvailable] = useState(649);
  const [capturedCount, setCapturedCount] = useState(0);
  const [selectedPokemon, setSelectedPokemon] = useState<PokemonDetail | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    collectionApi
      .getCollection()
      .then((res) => {
        setCollection(res.data.pokemon || []);
        setTotalAvailable(res.data.total_available);
        setCapturedCount(res.data.captured_count ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSelect = async (id: number) => {
    try {
      const res = await collectionApi.getPokemonDetail(id);
      setSelectedPokemon(res.data);
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-[calc(100vh-56px)] bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">
            マイ コレクション
          </h1>
          <span className="text-gray-400 text-sm">
            {capturedCount} / {totalAvailable}
          </span>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500" />
          </div>
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
