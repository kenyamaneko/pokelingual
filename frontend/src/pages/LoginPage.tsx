import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useEffect, useState, type FormEvent } from "react";
import { GoogleLogo } from "../components/auth/GoogleLogo";
import { CONTACT_FORM_URL } from "../constants/links";

/**
 * ログインページ。Email/Password と Google サインインを提供する。
 * @returns ログインページの要素。
 */
export function LoginPage() {
  const { user, login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
    } catch {
      setError("メールアドレスまたはパスワードが間違っています");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
    } catch {
      setError("Googleでのログインに失敗しました");
    } finally {
      setGoogleLoading(false);
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
        <p className="text-gray-400 text-sm mb-8">
          ポケモンで英語を学ぼう！
        </p>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={googleLoading || loading}
          className="w-full border-2 border-gray-300 bg-white text-gray-700 py-3 px-6 rounded-xl
                     font-semibold hover:bg-gray-50 transition-colors flex items-center justify-center gap-3
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <GoogleLogo />
          {googleLoading ? "ログイン中..." : "Googleでログイン"}
        </button>

        <div className="flex items-center gap-3 my-6 text-gray-400 text-xs">
          <hr className="flex-1 border-gray-200" />
          <span>または</span>
          <hr className="flex-1 border-gray-200" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="メールアドレス"
            required
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-700
                       focus:outline-none focus:border-sky-400 transition-colors"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="パスワード"
            required
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-700
                       focus:outline-none focus:border-sky-400 transition-colors"
          />
          {error && (
            <p className="text-red-500 text-sm">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading || googleLoading}
            className="w-full bg-blue-500 text-white py-2 px-6 rounded-xl text-sm
                       font-semibold hover:bg-blue-600 transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "ログイン中..." : "メールでログイン"}
          </button>
        </form>

        <p className="text-gray-400 text-sm mt-6">
          初めての人は{" "}
          <Link to="/signup" className="text-blue-500 hover:underline" data-testid="goto-signup">
            アカウントを作る
          </Link>
        </p>
        <p className="text-gray-400 text-sm mt-2">
          パスワードを忘れた人は{" "}
          <Link
            to="/reset-password"
            className="text-blue-500 hover:underline"
            data-testid="goto-reset-password"
          >
            再設定する
          </Link>
        </p>

        <div className="mt-6 flex justify-center gap-4 text-gray-400 text-xs">
          <a
            href={CONTACT_FORM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            問い合わせ
          </a>
          <Link to="/terms" className="hover:underline">
            利用規約
          </Link>
        </div>
      </div>
    </div>
  );
}
