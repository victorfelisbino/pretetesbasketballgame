/**
 * Authentication Context
 * Provides auth state and functions throughout the app
 */

import { createContext, useContext, useState, useEffect } from 'react';
import { 
  onAuthChange, 
  signUp, 
  signIn, 
  signInWithGoogle, 
  logOut,
  getUserData 
} from '../firebase/index.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        try {
          const data = await getUserData(firebaseUser.uid);
          setUserData(data);
        } catch (err) {
          console.error('Error fetching user data:', err);
        }
      } else {
        setUserData(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const handleSignUp = async (email, password, displayName) => {
    setError(null);
    try {
      await signUp(email, password, displayName);
    } catch (err) {
      setError(getErrorMessage(err.code));
      throw err;
    }
  };

  const handleSignIn = async (email, password) => {
    setError(null);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(getErrorMessage(err.code));
      throw err;
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(getErrorMessage(err.code));
      throw err;
    }
  };

  const handleLogOut = async () => {
    setError(null);
    try {
      await logOut();
    } catch (err) {
      setError(getErrorMessage(err.code));
      throw err;
    }
  };

  const clearError = () => setError(null);

  const value = {
    user,
    userData,
    loading,
    error,
    signUp: handleSignUp,
    signIn: handleSignIn,
    signInWithGoogle: handleGoogleSignIn,
    logOut: handleLogOut,
    clearError,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/**
 * Convert Firebase error codes to user-friendly messages
 */
function getErrorMessage(code) {
  const messages = {
    'auth/email-already-in-use': 'Este email já está em uso. / This email is already in use.',
    'auth/invalid-email': 'Email inválido. / Invalid email.',
    'auth/operation-not-allowed': 'Operação não permitida. / Operation not allowed.',
    'auth/weak-password': 'Senha muito fraca. / Password is too weak.',
    'auth/user-disabled': 'Conta desativada. / Account disabled.',
    'auth/user-not-found': 'Usuário não encontrado. / User not found.',
    'auth/wrong-password': 'Senha incorreta. / Wrong password.',
    'auth/popup-closed-by-user': 'Login cancelado. / Login cancelled.',
    'auth/network-request-failed': 'Erro de conexão. / Network error.',
    'auth/too-many-requests': 'Muitas tentativas. Tente novamente mais tarde. / Too many attempts. Try again later.',
    'auth/invalid-credential': 'Credenciais inválidas. / Invalid credentials.'
  };
  
  return messages[code] || 'Erro desconhecido. / Unknown error.';
}

export default AuthContext;
