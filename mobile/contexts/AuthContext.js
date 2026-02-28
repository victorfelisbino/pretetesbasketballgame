import { createContext, useContext, useState, useCallback } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);

  const signIn = useCallback(async (email, password) => {
    setLoading(true);
    try {
      // TODO: integrate firebase auth
      setUser({ email, displayName: email.split('@')[0] });
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setUser(null);
  }, []);

  const enterGuestMode = useCallback(() => {
    setUser({ email: 'guest', displayName: 'Guest Coach', isGuest: true });
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, enterGuestMode }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
