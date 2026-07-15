import { Link } from "react-router-dom";
import { useTutorial } from "../contexts/TutorialContext";
import { POKE_BALL_SPRITE_URL } from "../utils/pokemonSprites";

/**
 * HomePage の仕様文言。テストから import される SSOT。
 */
export const HOME_PAGE_LABELS = {
  tutorialLink: "チュートリアルを見る",
} as const;

/**
 * ホームページ。クエスト開始・図鑑・設定への導線を表示する。
 * チュートリアル完了が確定していなければ、「ポケモンを探しに行く」の遷移先をチュートリアルに差し替える。
 * @returns ホームページの要素。
 */
export function HomePage() {
  const { completed } = useTutorial();
  const questLinkTo = completed === true ? "/quest" : "/tutorial";

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
            <Link
              to={questLinkTo}
              className="block w-full bg-red-500 hover:bg-red-600 text-white py-4 px-6 rounded-2xl
                         font-bold text-lg transition-colors shadow-lg hover:shadow-xl"
            >
              ポケモンを探しに行く
            </Link>
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
            className="block w-full bg-white hover:bg-gray-100 text-gray-500 py-3 px-6 rounded-2xl
                       font-bold text-base transition-colors border border-gray-200"
          >
            設定
          </Link>
        </div>
      </div>
    </div>
  );
}
