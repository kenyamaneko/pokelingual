import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { CaptureResponse, ChatContext } from "../../types";
import { getTypeColor } from "../../utils/pokemonTypes";
import { ProfessorChat } from "./ProfessorChat";

interface CaptureResultProps {
  result: CaptureResponse;
  chatContext: ChatContext;
  onNewQuest: () => void;
}

/** 捕獲結果の表示。成否・伝説/幻演出・チャット起動・次のクエスト遷移を提供する。 */
export function CaptureResult({ result, chatContext, onNewQuest }: CaptureResultProps) {
  const navigate = useNavigate();
  const [showChat, setShowChat] = useState(false);

  return (
    <div className="mt-4 text-center">
      <div
        className={`rounded-3xl shadow-xl p-8 border-2 ${
          result.captured && result.is_mythical
            ? "bg-gradient-to-b from-purple-100 to-indigo-50 border-purple-400"
            : result.captured && result.is_legendary
              ? "bg-gradient-to-b from-amber-100 to-yellow-50 border-amber-400"
              : result.captured
                ? "bg-gradient-to-b from-green-50 to-white border-green-300"
                : "bg-gradient-to-b from-gray-50 to-white border-gray-300"
        }`}
      >
        {result.captured ? (
          <>
            <div className="text-4xl mb-2">&#11088;</div>
            <h2 className={`text-2xl font-bold mb-4 ${
              result.is_mythical
                ? "text-purple-700"
                : result.is_legendary
                  ? "text-amber-700"
                  : "text-green-700"
            }`}>
              {result.is_mythical
                ? `しんじられない！　まぼろしの　${result.name_ja}を　つかまえたぞ！`
                : result.is_legendary
                  ? `やったー！　でんせつの　${result.name_ja}を　つかまえたぞ！`
                  : `やったー！　${result.name_ja}を　つかまえたぞ！`}
            </h2>
          </>
        ) : (
          <>
            <div className="text-4xl mb-2">&#128168;</div>
            <h2 className="text-2xl font-bold text-gray-600 mb-4">
              やせいの　{result.name_ja}は　にげだした！
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
        {result.types && result.types.length > 0 && (
          <div className="flex justify-center gap-2 mt-2">
            {result.types.map((t) => (
              <span
                key={t}
                className={`${getTypeColor(t)} text-white text-xs font-bold px-3 py-1 rounded-full`}
              >
                {t}
              </span>
            ))}
          </div>
        )}

        <div className="mt-4 text-sm text-gray-500">
          <span>スコア: {result.score}</span>
          <span className="mx-2">|</span>
          <span>しゅぞくち: {result.base_stat_total}</span>
        </div>

        {result.description_en && (
          <div className="mt-4 bg-gray-50 rounded-xl p-4 text-left">
            <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">
              かくちの　ずかんの　せつめい
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
        onClick={() => setShowChat(true)}
        className="mt-6 w-full bg-blue-500 text-white py-4 rounded-2xl font-bold text-lg
                   hover:bg-blue-600 transition-colors shadow-lg"
      >
        はかせに　しつもん
      </button>

      <button
        onClick={onNewQuest}
        className="mt-3 w-full bg-red-500 text-white py-4 rounded-2xl font-bold text-lg
                   hover:bg-red-600 transition-colors shadow-lg"
      >
        つぎの　ぼうけんへ
      </button>

      <button
        onClick={() => navigate("/")}
        className="mt-3 w-full bg-white text-gray-600 py-3 rounded-2xl font-bold text-base
                   border-2 border-gray-200 hover:bg-gray-50 transition-colors"
      >
        メニューに　もどる
      </button>

      {showChat && (
        <ProfessorChat
          context={chatContext}
          onClose={() => setShowChat(false)}
        />
      )}
    </div>
  );
}
