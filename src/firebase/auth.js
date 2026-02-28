/**
 * Firebase Authentication Service — Quadra Legacy
 *
 * All exported functions return a consistent envelope:
 *   { success: true,  user: FirebaseUser, ... }  on success
 *   { success: false, error: string }             on failure
 *
 * Error messages are in Brazilian Portuguese for user-facing display.
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from './config.js';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const googleProvider = new GoogleAuthProvider();

/**
 * Map Firebase error codes to Portuguese user-facing messages.
 * @param {string} code  Firebase error code, e.g. 'auth/user-not-found'
 * @returns {string}
 */
function mapAuthError(code) {
  const messages = {
    'auth/email-already-in-use':   'Este e-mail já está em uso. Por favor, use outro ou faça login.',
    'auth/invalid-email':          'E-mail inválido. Verifique o endereço digitado.',
    'auth/operation-not-allowed':  'Operação não permitida. Entre em contato com o suporte.',
    'auth/weak-password':          'Senha muito fraca. Use pelo menos 6 caracteres.',
    'auth/user-disabled':          'Esta conta foi desativada. Entre em contato com o suporte.',
    'auth/user-not-found':         'Usuário não encontrado. Verifique seu e-mail ou crie uma conta.',
    'auth/wrong-password':         'Senha incorreta. Tente novamente.',
    'auth/invalid-credential':     'Credenciais inválidas. Verifique seu e-mail e senha.',
    'auth/popup-closed-by-user':   'Login cancelado. Feche a janela do Google e tente novamente.',
    'auth/popup-blocked':          'Pop-up bloqueado pelo navegador. Permita pop-ups para este site.',
    'auth/network-request-failed': 'Erro de conexão. Verifique sua internet e tente novamente.',
    'auth/too-many-requests':      'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.',
    'auth/requires-recent-login':  'Por segurança, faça login novamente para continuar.',
    'auth/account-exists-with-different-credential':
      'Já existe uma conta com este e-mail usando outro método de login.',
  };
  return messages[code] || 'Erro desconhecido. Tente novamente.';
}

/**
 * Create the Firestore user document on first sign-up / first Google login.
 * Idempotent — safe to call multiple times; will not overwrite existing data.
 *
 * @param {import('firebase/auth').User} user
 * @param {{ displayName?: string }} [extra]
 */
async function provisionUserDocument(user, extra = {}) {
  if (!user) return;
  const userRef = doc(db, 'users', user.uid);
  const snapshot = await getDoc(userRef);

  if (!snapshot.exists()) {
    await setDoc(userRef, {
      displayName: extra.displayName || user.displayName || 'Técnico',
      email:       user.email,
      photoURL:    user.photoURL || null,
      createdAt:   serverTimestamp(),
      stats: {
        totalWins:         0,
        totalLosses:       0,
        fantasyPtsAllTime: 0,
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Exported auth helpers
// ---------------------------------------------------------------------------

/**
 * Register a new account with email + password.
 * Also creates the Firestore user document.
 *
 * @param {string} email
 * @param {string} password
 * @param {string} displayName
 * @returns {Promise<{ success: boolean, user?: import('firebase/auth').User, error?: string }>}
 */
export async function signUpWithEmail(email, password, displayName) {
  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    const user = credential.user;

    // Write the display name to the Firebase Auth profile
    await updateProfile(user, { displayName });

    // Provision the Firestore document (includes the canonical stats shape)
    await provisionUserDocument(user, { displayName });

    return { success: true, user };
  } catch (err) {
    console.error('[auth] signUpWithEmail error:', err.code, err.message);
    return { success: false, error: mapAuthError(err.code) };
  }
}

/**
 * Sign in an existing user with email + password.
 *
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ success: boolean, user?: import('firebase/auth').User, error?: string }>}
 */
export async function signInWithEmail(email, password) {
  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    return { success: true, user: credential.user };
  } catch (err) {
    console.error('[auth] signInWithEmail error:', err.code, err.message);
    return { success: false, error: mapAuthError(err.code) };
  }
}

/**
 * Sign in (or register) via Google OAuth popup.
 * Creates a Firestore user document for new Google users.
 *
 * @returns {Promise<{ success: boolean, user?: import('firebase/auth').User, isNewUser?: boolean, error?: string }>}
 */
export async function signInWithGoogle() {
  try {
    const credential = await signInWithPopup(auth, googleProvider);
    const user = credential.user;

    // Provision document for first-time Google logins (idempotent)
    await provisionUserDocument(user);

    // AdditionalUserInfo.isNewUser tells us if this was a registration
    const isNewUser = credential._tokenResponse?.isNewUser ?? false;
    return { success: true, user, isNewUser };
  } catch (err) {
    console.error('[auth] signInWithGoogle error:', err.code, err.message);
    return { success: false, error: mapAuthError(err.code) };
  }
}

/**
 * Sign out the currently authenticated user.
 *
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function signOut() {
  try {
    await firebaseSignOut(auth);
    return { success: true };
  } catch (err) {
    console.error('[auth] signOut error:', err.code, err.message);
    return { success: false, error: mapAuthError(err.code) };
  }
}

/**
 * Return the synchronously available current user (may be null before
 * onAuthStateChange fires for the first time).
 *
 * @returns {import('firebase/auth').User | null}
 */
export function getCurrentUser() {
  return auth.currentUser;
}

/**
 * Subscribe to auth state changes.
 * The callback receives the Firebase User object, or null when signed out.
 *
 * @param {(user: import('firebase/auth').User | null) => void} callback
 * @returns {() => void}  Unsubscribe function
 */
export function onAuthStateChange(callback) {
  return onAuthStateChanged(auth, callback);
}

/**
 * Update the authenticated user's display name and/or photo URL.
 *
 * @param {string | null} displayName
 * @param {string | null} [photoURL]
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function updateUserProfile(displayName, photoURL = null) {
  try {
    const user = auth.currentUser;
    if (!user) {
      return { success: false, error: 'Nenhum usuário autenticado.' };
    }

    const updates = {};
    if (displayName !== null) updates.displayName = displayName;
    if (photoURL !== null)    updates.photoURL    = photoURL;

    await updateProfile(user, updates);
    return { success: true };
  } catch (err) {
    console.error('[auth] updateUserProfile error:', err.code, err.message);
    return { success: false, error: mapAuthError(err.code) };
  }
}

// ---------------------------------------------------------------------------
// Legacy aliases — kept so existing imports in AuthContext / index.js
// don't break during the transition.
// ---------------------------------------------------------------------------

/** @deprecated Use signUpWithEmail */
export async function signUp(email, password, displayName) {
  return signUpWithEmail(email, password, displayName);
}

/** @deprecated Use signInWithEmail */
export async function signIn(email, password) {
  return signInWithEmail(email, password);
}

/** @deprecated Use signOut */
export async function logOut() {
  return signOut();
}

/** @deprecated Use onAuthStateChange */
export function onAuthChange(callback) {
  return onAuthStateChange(callback);
}

/**
 * Fetch the Firestore user document for a given uid.
 * Returns null if the document does not exist.
 *
 * @param {string} userId
 * @returns {Promise<object | null>}
 */
export async function getUserData(userId) {
  try {
    const snapshot = await getDoc(doc(db, 'users', userId));
    if (snapshot.exists()) {
      return { id: snapshot.id, ...snapshot.data() };
    }
    return null;
  } catch (err) {
    console.error('[auth] getUserData error:', err);
    return null;
  }
}
