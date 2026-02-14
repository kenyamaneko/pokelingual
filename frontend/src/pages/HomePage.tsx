import { Link } from "react-router-dom";

export function HomePage() {
  return (
    <div className="min-h-[calc(100vh-56px)] bg-gray-50 flex items-center justify-center">
      <div className="text-center max-w-md mx-4">
        <img
          src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png"
          alt="Pokeball"
          className="w-24 h-24 mx-auto mb-6"
        />
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          おーす！　みらいの　チャンピオン
        </h1>
        <p className="text-gray-500 mb-8">
          えいごを　ほんやくして　ポケモンを　つかまえよう！
        </p>

        <div className="space-y-4">
          <Link
            to="/quest"
            className="block w-full bg-red-500 hover:bg-red-600 text-white py-4 px-6 rounded-2xl
                       font-bold text-lg transition-colors shadow-lg hover:shadow-xl"
          >
            ぼうけんに　出かける
          </Link>
          <Link
            to="/collection"
            className="block w-full bg-white hover:bg-gray-100 text-gray-700 py-4 px-6 rounded-2xl
                       font-bold text-lg transition-colors shadow border border-gray-200"
          >
            ずかんを　見る
          </Link>
          <Link
            to="/settings"
            className="block w-full bg-white hover:bg-gray-100 text-gray-500 py-3 px-6 rounded-2xl
                       font-bold text-base transition-colors border border-gray-200"
          >
            せってい
          </Link>
        </div>
      </div>
    </div>
  );
}
