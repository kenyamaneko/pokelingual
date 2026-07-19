import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useTutorial } from "../contexts/TutorialContext";
import { POKE_BALL_SPRITE_URL } from "../utils/pokemonSprites";
import { logger } from "../utils/logger";

/**
 * HomePage の仕様文言。テストから import される SSOT。
 */
export const HOME_PAGE_LABELS = {
  startQuest: "ポケモンを探しに行く",
  startQuestPending: "確認中...",
  startQuestError: "状態の確認に失敗しました。もう一度お試しください",
  tutorialLink: "チュートリアルを見る",
} as const;

/**
 * ホームページ。クエスト開始・図鑑・設定への導線を表示する。
 * 「ポケモンを探しに行く」は、チュートリアル完了状態が確定するのを待ってから、
 * 完了済みなら本番クエストへ、未完了ならチュートリアルへ遷移する。
 * @returns ホームページの要素。
 */
export function HomePage() {
  const { getTutorialCompleted } = useTutorial();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"idle" | "pending" | "error">("idle");

  const handleStart = async () => {
    setPhase("pending");
    try {
      const done = await getTutorialCompleted();
      navigate(done ? "/quest" : "/tutorial");
    } catch (err) {
      logger.warn("failed to resolve tutorial status on quest start", { error: err });
      setPhase("error");
    }
  };

  return (
    <div className="min-h-[calc(100vh-var(--header-h))] bg-gray-50 flex items-center justify-center">
      <div className="text-center max-w-md mx-4">
        <img
          src={POKE_BALL_SPRITE_URL}
          alt="Pokeball"
          className="w-24 h-24 mx-auto mb-6"
        />
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          かがくのちからって　すげー！
          <span className="block text-lg font-normal text-gray-500 mt-1">
            Technology is incredible!
          </span>
        </h1>
        <p className="text-gray-500 mb-8">
          いまは　AIで　えいごを　ほんやくして
          <br />
          ポケモンを　つかまえられるんだと
        </p>

        <div className="space-y-4">
          <div>
            <button
              type="button"
              onClick={handleStart}
              disabled={phase === "pending"}
              className="block w-full bg-red-500 hover:bg-red-600 text-white py-4 px-6 rounded-2xl
                         font-bold text-lg transition-colors shadow-lg hover:shadow-xl
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {phase === "pending" ? HOME_PAGE_LABELS.startQuestPending : HOME_PAGE_LABELS.startQuest}
            </button>
            {phase === "error" && (
              <p className="text-red-500 text-sm mt-2">{HOME_PAGE_LABELS.startQuestError}</p>
            )}
            <Link
              to="/tutorial"
              className="block mt-2 text-sm text-gray-400 hover:text-gray-600 underline text-center"
            >
              {HOME_PAGE_LABELS.tutorialLink}
            </Link>
          </div>
          <Link
            to="/pokedex"
            className="block w-full bg-white hover:bg-gray-100 text-gray-700 py-4 px-6 rounded-2xl
                       font-bold text-lg transition-colors shadow border border-gray-200"
          >
            図鑑を見る
          </Link>
          <Link
            to="/settings"
            className="block w-full bg-white hover:bg-gray-100 text-gray-700 py-4 px-6 rounded-2xl
                       font-bold text-lg transition-colors shadow border border-gray-200"
          >
            設定
          </Link>
        </div>
      </div>
    </div>
  );
}
