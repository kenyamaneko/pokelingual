import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useEffect, useState, type FormEvent } from "react";

/** ログインページ。Email/Password と Google サインインを提供する。 */
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
      setError("メールアドレス　または　パスワードが　正しくありません");
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
      setError("Google ログインに　しっぱいしました");
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
          ポケモンで　えいごを　学ぼう！
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
          {googleLoading ? "ログイン中..." : "Google で　はじめる"}
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
            {loading ? "ログイン中..." : "メールで　ログイン"}
          </button>
        </form>
      </div>
    </div>
  );
}

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
    </svg>
  );
}
