import { createContext, useContext, useMemo, useState } from 'react';

const STORAGE_KEY = 'routflex_ops_mock_session';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const value = useMemo(() => ({
    user,
    isAuthenticated: Boolean(user),
    login(credentials) {
      const nextUser = {
        name: 'Administrador OPS',
        email: credentials?.email || 'admin@routflex.com',
        profile: 'Administrador OPS',
        region: 'DDD 65',
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser));
      setUser(nextUser);
    },
    logout() {
      localStorage.removeItem(STORAGE_KEY);
      setUser(null);
    },
  }), [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
