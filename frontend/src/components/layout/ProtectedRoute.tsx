import { Navigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

/**
 * 認証済みユーザのみ children を描画し、未認証なら /login にリダイレクトするガード。
 * @param props children を含む props。
 * @returns 認証状態に応じた要素 (children / リダイレクト / ローディング)。
 */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div
          role="status"
          aria-label="認証を確認中..."
          className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"
        />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
