import type { QuestLocation } from "../../../../shared/api-types/quest";
import { getTypeLabel } from "../../utils/pokemonTypes";

interface LocationSelectProps {
  locations: QuestLocation[];
  onSelect: (locationId: string) => void;
}

/**
 * 探索場所の選択画面。候補の場所カードを提示し、選ぶとその場所で出題を始める。
 * @param props locations (候補) / onSelect (場所 ID を受け取る選択ハンドラ)。
 * @returns 場所選択の要素。
 */
export function LocationSelect({ locations, onSelect }: LocationSelectProps) {
  if (locations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20" data-testid="locations-loading">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-red-500 mb-4" />
        <p className="text-gray-500">行き先を　探しています</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-center text-gray-800 font-bold text-xl mb-6">
        どこに　ポケモンを　探しに行く？
      </h2>
      <div className="grid gap-3">
        {locations.map((location) => (
          <button
            key={location.id}
            onClick={() => onSelect(location.id)}
            className="bg-white rounded-2xl shadow p-5 text-left border-2 border-transparent
                       hover:border-red-300 hover:shadow-md transition-all"
          >
            <p className="font-bold text-gray-800 text-lg mb-1">{location.name}</p>
            <p className="text-gray-500 text-sm mb-3">{location.description}</p>
            <div className="flex flex-wrap gap-1.5">
              {location.types.map((t) => (
                <span
                  key={t}
                  className="text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5"
                >
                  {getTypeLabel(t)}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
