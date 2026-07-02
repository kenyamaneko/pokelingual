import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useEffect, useState, type FormEvent } from "react";
import { GoogleLogo } from "../components/auth/GoogleLogo";

/** サインアップページ。Email/Password と Google サインインで新規登録する。 */
export function SignupPage() {
  const { user, signup, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
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
    // パスワード確認の不一致はバックエンドに送る前にクライアントで弾く
    if (password !== passwordConfirm) {
      setError("パスワードが　いっちしません");
      return;
    }
    setLoading(true);
    try {
      await signup(email, password);
    } catch {
      setError("とうろくに　しっぱいしました。メールアドレスか　パスワードを　かくにんしてね");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setError("");
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
    } catch {
      setError("Google とうろくに　しっぱいしました");
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
        <p className="text-gray-400 text-sm mb-8">あたらしく　はじめよう！</p>

        <button
          type="button"
          onClick={handleGoogleSignup}
          disabled={googleLoading || loading}
          className="w-full border-2 border-gray-300 bg-white text-gray-700 py-3 px-6 rounded-xl
                     font-semibold hover:bg-gray-50 transition-colors flex items-center justify-center gap-3
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <GoogleLogo />
          {googleLoading ? "とうろく中..." : "Google で　はじめる"}
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
            data-testid="signup-email"
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-700
                       focus:outline-none focus:border-sky-400 transition-colors"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="パスワード"
            required
            data-testid="signup-password"
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-700
                       focus:outline-none focus:border-sky-400 transition-colors"
          />
          <input
            type="password"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            placeholder="パスワード（かくにん）"
            required
            data-testid="signup-password-confirm"
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-700
                       focus:outline-none focus:border-sky-400 transition-colors"
          />
          {error && (
            <p className="text-red-500 text-sm" data-testid="signup-error">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading || googleLoading}
            data-testid="signup-submit"
            className="w-full bg-blue-500 text-white py-2 px-6 rounded-xl text-sm
                       font-semibold hover:bg-blue-600 transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "とうろく中..." : "アカウントを　つくる"}
          </button>
        </form>

        <p className="text-gray-400 text-sm mt-6">
          すでに　アカウントを　もっている人は{" "}
          <Link to="/login" className="text-blue-500 hover:underline" data-testid="goto-login">
            ログイン
          </Link>
        </p>
      </div>
    </div>
  );
}
