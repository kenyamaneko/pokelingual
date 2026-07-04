import type { PokedexEntry } from "../../../../shared/api-types/pokedex";
import { formatPokemonId } from "../../utils/pokemonFormat";

interface PokemonGridProps {
  pokemon: PokedexEntry[];
  onSelect: (id: number) => void;
}

/**
 * 図鑑のグリッド表示。未捕獲はグレースケールで描画し、クリックで詳細を開く。
 * @param props pokemon / onSelect を含む props。
 * @returns 図鑑グリッドの要素。
 */
export function PokemonGrid({ pokemon, onSelect }: PokemonGridProps) {
  if (pokemon.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400 text-lg mb-2">まだ　ポケモンに　出会っていません</p>
        <p className="text-gray-400 text-sm">ぼうけんに　出かけて　ポケモンを　見つけよう！</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
      {pokemon.map((p) => (
        <button
          key={p.pokemon_id}
          data-testid="pokemon-card"
          onClick={() => onSelect(p.pokemon_id)}
          className="bg-white rounded-xl shadow hover:shadow-lg transition-shadow
                     p-3 flex flex-col items-center border border-gray-100
                     hover:border-red-300 cursor-pointer"
        >
          <img
            src={p.sprite_url}
            alt={p.name_en}
            className={`w-16 h-16 sm:w-20 sm:h-20 ${
              p.status !== "captured" ? "grayscale opacity-60" : ""
            }`}
          />
          <span className="text-xs text-gray-400 mt-1">
            #{formatPokemonId(p.pokemon_id)}
          </span>
          <span className="text-xs font-semibold text-gray-700 truncate w-full text-center">
            {p.name_ja}
          </span>
        </button>
      ))}
    </div>
  );
}
