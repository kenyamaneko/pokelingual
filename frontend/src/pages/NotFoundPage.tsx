import { Link } from "react-router-dom";

/**
 * NotFoundPage の表示文言。テストから import される SSOT。
 */
export const NOT_FOUND_LABELS = {
  title: "おや？　ページが　みつからない",
  description: "URL が　まちがっているか、ページが　いどうしたみたいだ。",
  backToHome: "ホームに　もどる",
} as const;

/** 未定義ルート用の 404 ページ。ホームへの導線を提供する。 */
export function NotFoundPage() {
  return (
    <div className="min-h-[calc(100vh-56px)] bg-gray-50 flex items-center justify-center">
      <div className="text-center max-w-md mx-4" data-testid="not-found">
        <img
          src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png"
          alt="Pokeball"
          className="w-24 h-24 mx-auto mb-6 opacity-60"
        />
        <p className="text-5xl font-bold text-gray-300 mb-4">404</p>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          {NOT_FOUND_LABELS.title}
        </h1>
        <p className="text-gray-500 mb-8">{NOT_FOUND_LABELS.description}</p>

        <Link
          to="/"
          className="block w-full bg-red-500 hover:bg-red-600 text-white py-4 px-6 rounded-2xl
                     font-bold text-lg transition-colors shadow-lg hover:shadow-xl"
        >
          {NOT_FOUND_LABELS.backToHome}
        </Link>
      </div>
    </div>
  );
}
