import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useState, type FormEvent } from "react";

/** パスワードリセットページ。入力メールアドレス宛に再設定メールを送る。 */
export function ResetPasswordPage() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await resetPassword(email);
      setSent(true);
    } catch {
      setError("メールの　そうしんに　しっぱいしました。メールアドレスを　かくにんしてね");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-400 to-blue-500 flex items-center justify-center">
      <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-md w-full mx-4 text-center">
        <div className="text-6xl mb-4">
          <img
            src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png"
            alt="Pokeball"
            className="w-20 h-20 mx-auto"
          />
        </div>
        <h1 className="text-3xl font-bold text-gray-800 mb-2">PokeLingual</h1>
        <p className="text-gray-500 text-lg mb-1">ポケリンガル</p>
        <p className="text-gray-400 text-sm mb-8">パスワードを　さいせっていしよう</p>

        {sent ? (
          <div data-testid="reset-sent">
            <p className="text-green-600 text-sm">
              メールを　おくりました。とどいた　リンクから　パスワードを　さいせっていしてね
            </p>
            {/* 列挙保護が有効なため送信は常に成功扱いになる。メールが届かない原因
                (アドレス誤り / Google 登録) をユーザ自身が切り分けられるよう案内する */}
            <p className="text-gray-400 text-xs mt-3">
              メールが　とどかない　ときは、メールアドレスが　まちがっているか、Google
              アカウントで　とうろくして　いるかもしれません
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="メールアドレス"
              required
              data-testid="reset-email"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-700
                         focus:outline-none focus:border-sky-400 transition-colors"
            />
            {error && (
              <p className="text-red-500 text-sm" data-testid="reset-error">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              data-testid="reset-submit"
              className="w-full bg-blue-500 text-white py-2 px-6 rounded-xl text-sm
                         font-semibold hover:bg-blue-600 transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "そうしん中..." : "さいせってい　メールを　おくる"}
            </button>
          </form>
        )}

        <p className="text-gray-400 text-sm mt-6">
          <Link to="/login" className="text-blue-500 hover:underline" data-testid="goto-login">
            ログインに　もどる
          </Link>
        </p>
      </div>
    </div>
  );
}
