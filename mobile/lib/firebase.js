import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'demo-api-key',
  authDomain: 'quadra-legacy.firebaseapp.com',
  projectId: 'quadra-legacy',
  storageBucket: 'quadra-legacy.firebasestorage.app',
  messagingSenderId: '422765281985',
  appId: '1:422765281985:web:66c1a6b16a2a069ef44a40',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({}),
});

export default app;
