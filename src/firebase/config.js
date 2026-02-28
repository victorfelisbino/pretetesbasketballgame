/**
 * Firebase Configuration
 *
 * To set up your Firebase project:
 * 1. Go to https://console.firebase.google.com/
 * 2. Create a new project called "quadra-legacy" (or any name)
 * 3. Enable Authentication (Email/Password and Google providers)
 * 4. Enable Firestore Database (start in production mode)
 * 5. Copy your config values to a .env file (see .env.example)
 *
 * Offline persistence is enabled by default via persistentLocalCache,
 * which uses IndexedDB and supports multiple browser tabs.
 */

import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  connectFirestoreEmulator
} from 'firebase/firestore';

// ---------------------------------------------------------------------------
// Config — values come from .env; fallback to demo project for local dev only
// ---------------------------------------------------------------------------
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            || 'demo-api-key',
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN        || 'quadra-legacy.firebaseapp.com',
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         || 'quadra-legacy',
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     || 'quadra-legacy.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '422765281985',
  appId:             import.meta.env.VITE_FIREBASE_APP_ID             || '1:422765281985:web:66c1a6b16a2a069ef44a40',
};

// ---------------------------------------------------------------------------
// Initialize Firebase app
// ---------------------------------------------------------------------------
const app = initializeApp(firebaseConfig);

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export const auth = getAuth(app);

// ---------------------------------------------------------------------------
// Firestore — use persistentLocalCache so the app works offline.
// persistentMultipleTabManager allows multiple browser tabs to share the cache.
// ---------------------------------------------------------------------------
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

// ---------------------------------------------------------------------------
// Emulator support — set VITE_USE_FIREBASE_EMULATOR=true in .env.local
// ---------------------------------------------------------------------------
if (import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, 'localhost', 8080);
  console.info('[Firebase] Running against local emulators');
}

export default app;
