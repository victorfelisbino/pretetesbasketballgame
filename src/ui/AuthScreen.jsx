/**
 * Auth Screen Component
 * Login and Register forms
 */

import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function AuthScreen({ language = 'pt' }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { signIn, signUp, signInWithGoogle, error, clearError } = useAuth();

  const t = translations[language];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    clearError();

    try {
      if (isLogin) {
        await signIn(email, password);
      } else {
        await signUp(email, password, displayName);
      }
    } catch (err) {
      // Error is handled by AuthContext
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsSubmitting(true);
    clearError();
    
    try {
      await signInWithGoogle();
    } catch (err) {
      // Error is handled by AuthContext
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    clearError();
  };

  return (
    <div className="auth-screen">
      <div className="auth-container">
        <div className="auth-header">
          <h1>🏀 Pretetê's Basketball</h1>
          <p className="auth-subtitle">{t.subtitle}</p>
        </div>

        <div className="auth-tabs">
          <button 
            className={`auth-tab ${isLogin ? 'active' : ''}`}
            onClick={() => { setIsLogin(true); clearError(); }}
          >
            {t.login}
          </button>
          <button 
            className={`auth-tab ${!isLogin ? 'active' : ''}`}
            onClick={() => { setIsLogin(false); clearError(); }}
          >
            {t.register}
          </button>
        </div>

        {error && (
          <div className="auth-error">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {!isLogin && (
            <div className="form-group">
              <label htmlFor="displayName">{t.coachName}</label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t.coachNamePlaceholder}
                required={!isLogin}
                disabled={isSubmitting}
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">{t.email}</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.emailPlaceholder}
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">{t.password}</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t.passwordPlaceholder}
              required
              minLength={6}
              disabled={isSubmitting}
            />
          </div>

          <button 
            type="submit" 
            className="auth-submit-btn"
            disabled={isSubmitting}
          >
            {isSubmitting ? t.loading : (isLogin ? t.loginBtn : t.registerBtn)}
          </button>
        </form>

        <div className="auth-divider">
          <span>{t.or}</span>
        </div>

        <button 
          className="google-signin-btn"
          onClick={handleGoogleSignIn}
          disabled={isSubmitting}
        >
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {t.googleSignIn}
        </button>

        <p className="auth-footer">
          {isLogin ? t.noAccount : t.hasAccount}{' '}
          <button className="auth-link" onClick={toggleMode}>
            {isLogin ? t.register : t.login}
          </button>
        </p>
      </div>
    </div>
  );
}

const translations = {
  pt: {
    subtitle: 'Gerencie seu time de basquete!',
    login: 'Entrar',
    register: 'Cadastrar',
    coachName: 'Nome do Técnico',
    coachNamePlaceholder: 'Como quer ser chamado?',
    email: 'Email',
    emailPlaceholder: 'seu@email.com',
    password: 'Senha',
    passwordPlaceholder: 'Mínimo 6 caracteres',
    loginBtn: 'Entrar',
    registerBtn: 'Criar Conta',
    loading: 'Aguarde...',
    or: 'ou',
    googleSignIn: 'Entrar com Google',
    noAccount: 'Não tem uma conta?',
    hasAccount: 'Já tem uma conta?'
  },
  en: {
    subtitle: 'Manage your basketball team!',
    login: 'Login',
    register: 'Sign Up',
    coachName: 'Coach Name',
    coachNamePlaceholder: 'What should we call you?',
    email: 'Email',
    emailPlaceholder: 'your@email.com',
    password: 'Password',
    passwordPlaceholder: 'Minimum 6 characters',
    loginBtn: 'Sign In',
    registerBtn: 'Create Account',
    loading: 'Please wait...',
    or: 'or',
    googleSignIn: 'Sign in with Google',
    noAccount: "Don't have an account?",
    hasAccount: 'Already have an account?'
  }
};
