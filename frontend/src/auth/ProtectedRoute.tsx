import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { isRequesterForbiddenPath, isRequestOnly } from '../constants/roles';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="loading">Загрузка...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (isRequestOnly(user.role) && isRequesterForbiddenPath(location.pathname)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
