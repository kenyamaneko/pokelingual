import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { mapAuthErrorMessage } from "../utils/authErrors";

/**
 * サインアップページ。Email/Password で新規登録する。
 * @returns サインアップページの要素。
 */
export function SignupPage() {
  const { user, signup } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  const signingUpRef = useRef(false);

  useEffect(() => {
    // 登録直後は確認メール送信→サインアウトで user が一時的に確定するが、確認前はホームへ遷移させない。
    if (user && !signingUpRef.current) {
      navigate("/");
    }
  }, [user, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    // パスワード確認の不一致はバックエンドに送る前にクライアントで弾く
    if (password !== passwordConfirm) {
      setError("パスワードが一致しません");
      return;
    }
    setLoading(true);
    signingUpRef.current = true;
    try {
      await signup(email, password);
      setRegistered(true);
    } catch (err) {
      setError(mapAuthErrorMessage(err, "登録に失敗しました。しばらくしてからお試しください"));
    } finally {
      setLoading(false);
      signingUpRef.current = false;
    }
  };

  if (registered) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-400 to-blue-500 flex items-center justify-center">
        <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-md w-full mx-4 text-center">
          <div className="text-6xl mb-4">📧</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-3">確認メールを送りました</h1>
          <p
            className="text-gray-600 text-sm mb-6 leading-relaxed"
            data-testid="signup-verify-message"
          >
            メールに届いたリンクを開いて、メールアドレスの確認を完了してください。確認したあとにログインできます。
          </p>
          <Link
            to="/login"
            className="inline-block w-full bg-blue-500 text-white py-2 px-6 rounded-xl text-sm
                       font-semibold hover:bg-blue-600 transition-colors"
            data-testid="goto-login-after-signup"
          >
            ログインへ
          </Link>
        </div>
      </div>
    );
  }

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
        <p className="text-gray-400 text-sm mb-8">登録する</p>

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
            placeholder="パスワード（確認）"
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
            disabled={loading}
            data-testid="signup-submit"
            className="w-full bg-blue-500 text-white py-2 px-6 rounded-xl text-sm
                       font-semibold hover:bg-blue-600 transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "登録中..." : "アカウントを作成する"}
          </button>
        </form>

        <p className="text-gray-400 text-sm mt-6">
          すでにアカウントを持っている人は{" "}
          <Link to="/login" className="text-blue-500 hover:underline" data-testid="goto-login">
            ログイン
          </Link>
        </p>
      </div>
    </div>
  );
}
