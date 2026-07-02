import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getMe, logout as apiLogout, type User } from '../api/auth';
import { clearToken, getToken } from '../api/client';
import { applyUiTheme } from '../theme/applyTheme';
import { normalizeUiTheme } from '../constants/themes';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  refresh: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: async () => {},
  refresh: async () => false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async (): Promise<boolean> => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return false;
    }
    try {
      const me = await getMe();
      setUser(me);
      applyUiTheme(normalizeUiTheme(me.ui_theme));
      return true;
    } catch {
      clearToken();
      setUser(null);
      return false;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const logout = async () => {
    try {
      await apiLogout();
    } catch {
      /* ignore */
    }
    clearToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
