import { useNavigate } from "react-router-dom";
import type { CaptureResponse } from "../../types";

interface CaptureResultProps {
  result: CaptureResponse;
  onNewQuest: () => void;
}

export function CaptureResult({ result, onNewQuest }: CaptureResultProps) {
  const navigate = useNavigate();

  return (
    <div className="mt-4 text-center">
      <div
        className={`rounded-3xl shadow-xl p-8 border-2 ${
          result.captured
            ? "bg-gradient-to-b from-green-50 to-white border-green-300"
            : "bg-gradient-to-b from-gray-50 to-white border-gray-300"
        }`}
      >
        {result.captured ? (
          <>
            <div className="text-4xl mb-2">&#11088;</div>
            <h2 className="text-2xl font-bold text-green-700 mb-4">
              やったー！ {result.name_ja}を つかまえたぞ！
            </h2>
          </>
        ) : (
          <>
            <div className="text-4xl mb-2">&#128168;</div>
            <h2 className="text-2xl font-bold text-gray-600 mb-4">
              やせいの {result.name_ja}は にげだした！
            </h2>
          </>
        )}

        <img
          src={result.sprite_url}
          alt={result.name_en}
          className={`w-40 h-40 mx-auto mb-4 ${
            result.captured ? "" : "opacity-30 grayscale"
          }`}
        />

        <p className="text-xl font-bold text-gray-800">{result.name_en}</p>
        <p className="text-gray-500">{result.name_ja}</p>

        <div className="mt-4 text-sm text-gray-500">
          <span>スコア: {result.score}</span>
        </div>

        {result.description_en && (
          <div className="mt-4 bg-gray-50 rounded-xl p-4 text-left">
            <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">
              ずかんの せつめい
            </h3>
            <p className="text-gray-700 text-sm leading-relaxed italic">
              "{result.description_en}"
            </p>
            {result.description_ja && (
              <p className="text-gray-500 text-sm leading-relaxed mt-2">
                「{result.description_ja}」
              </p>
            )}
          </div>
        )}
      </div>

      <button
        onClick={onNewQuest}
        className="mt-6 w-full bg-red-500 text-white py-4 rounded-2xl font-bold text-lg
                   hover:bg-red-600 transition-colors shadow-lg"
      >
        つぎの クエストへ
      </button>

      <button
        onClick={() => navigate("/")}
        className="mt-3 w-full bg-white text-gray-600 py-3 rounded-2xl font-bold text-base
                   border-2 border-gray-200 hover:bg-gray-50 transition-colors"
      >
        メニューに もどる
      </button>
    </div>
  );
}
