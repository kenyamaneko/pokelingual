import type { PokemonDetail } from "../../types";
import { typeColors } from "../../utils/pokemonTypes";
import { formatPokemonId, formatHeightMeters, formatWeightKilograms } from "../../utils/pokemonFormat";

interface PokemonDetailCardProps {
  pokemon: PokemonDetail;
  onClose: () => void;
}

/** ポケモン詳細モーダル。図鑑番号・タイプ・複数バージョンの説明文・実績を表示する。 */
export function PokemonDetailCard({ pokemon, onClose }: PokemonDetailCardProps) {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-b from-slate-500 to-slate-600 rounded-t-3xl p-6 text-center relative">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-white/80 hover:text-white text-2xl font-bold"
          >
            &times;
          </button>
          <img
            src={pokemon.sprite_url}
            alt={pokemon.name_en}
            className={`w-40 h-40 mx-auto drop-shadow-lg ${
              pokemon.status !== "captured" ? "grayscale opacity-60" : ""
            }`}
          />
        </div>

        <div className="p-6">
          <div className="text-center mb-4">
            <span className="text-sm text-gray-400">
              #{formatPokemonId(pokemon.pokemon_id)}
            </span>
            <h2 className="text-2xl font-bold text-gray-800">
              {pokemon.name_en}
            </h2>
            <p className="text-gray-500">{pokemon.name_ja}</p>
            {pokemon.types && pokemon.types.length > 0 && (
              <div className="flex justify-center gap-2 mt-2">
                {pokemon.types.map((t) => (
                  <span
                    key={t}
                    className={`${typeColors[t] ?? "bg-gray-400"} text-white text-xs font-bold px-3 py-1 rounded-full`}
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
            {pokemon.height != null && pokemon.weight != null && (
              <p className="text-sm text-gray-400 mt-2">
                たかさ: {formatHeightMeters(pokemon.height)}m | おもさ: {formatWeightKilograms(pokemon.weight)}kg
              </p>
            )}
          </div>

          {pokemon.flavor_texts && pokemon.flavor_texts.length > 0 ? (
            <div className="mb-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">
                ずかんの　せつめい
              </h3>
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {pokemon.flavor_texts.map((pair, i) => (
                  <div key={i} className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs font-semibold text-indigo-500 mb-1">
                      {pair.version_names.join(" / ")}
                    </p>
                    <p className="text-gray-700 text-sm leading-relaxed italic">
                      &ldquo;{pair.description_en}&rdquo;
                    </p>
                    <p className="text-gray-500 text-sm leading-relaxed mt-1">
                      「{pair.description_ja}」
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-xl p-4 mb-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">
                ずかんの　せつめい
              </h3>
              <p className="text-gray-700 text-sm leading-relaxed italic">
                &ldquo;{pokemon.description_en}&rdquo;
              </p>
              {pokemon.description_ja && (
                <p className="text-gray-500 text-sm leading-relaxed mt-2">
                  「{pokemon.description_ja}」
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-blue-50 rounded-xl p-3 text-center">
              <p className="text-xs text-blue-400">さいこう　スコア</p>
              <p className="text-xl font-bold text-blue-600">
                {pokemon.best_score}
              </p>
            </div>
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <p className="text-xs text-green-400">ほかく　回数</p>
              <p className="text-xl font-bold text-green-600">
                {pokemon.total_captures}
              </p>
            </div>
            <div className="bg-purple-50 rounded-xl p-3 text-center">
              <p className="text-xs text-purple-400">そうぐう　回数</p>
              <p className="text-xl font-bold text-purple-600">
                {pokemon.total_encounters}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="mt-4 w-full bg-gray-100 text-gray-600 py-3 rounded-xl font-bold
                       hover:bg-gray-200 transition-colors"
          >
            とじる
          </button>
        </div>
      </div>
    </div>
  );
}
