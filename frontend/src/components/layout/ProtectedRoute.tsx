import { Navigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

/** 認証済みユーザのみ children を描画し、未認証なら /login にリダイレクトするガード。 */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div
          role="status"
          aria-label="にんしょうを かくにんちゅう"
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
