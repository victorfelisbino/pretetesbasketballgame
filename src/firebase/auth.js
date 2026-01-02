/**
 * Authentication Service
 * Handles user sign up, sign in, sign out, and auth state
 */

import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './config.js';

const googleProvider = new GoogleAuthProvider();

/**
 * Sign up with email and password
 * @param {string} email 
 * @param {string} password 
 * @param {string} displayName 
 * @returns {Promise<User>}
 */
export async function signUp(email, password, displayName) {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;
  
  // Update display name
  await updateProfile(user, { displayName });
  
  // Create user document in Firestore
  await createUserDocument(user, { displayName });
  
  return user;
}

/**
 * Sign in with email and password
 * @param {string} email 
 * @param {string} password 
 * @returns {Promise<User>}
 */
export async function signIn(email, password) {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user;
}

/**
 * Sign in with Google
 * @returns {Promise<User>}
 */
export async function signInWithGoogle() {
  const userCredential = await signInWithPopup(auth, googleProvider);
  const user = userCredential.user;
  
  // Create user document if it doesn't exist
  await createUserDocument(user);
  
  return user;
}

/**
 * Sign out current user
 */
export async function logOut() {
  await signOut(auth);
}

/**
 * Subscribe to auth state changes
 * @param {Function} callback - Called with user or null
 * @returns {Function} Unsubscribe function
 */
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

/**
 * Get current user
 * @returns {User|null}
 */
export function getCurrentUser() {
  return auth.currentUser;
}

/**
 * Create or update user document in Firestore
 * @param {User} user 
 * @param {object} additionalData 
 */
async function createUserDocument(user, additionalData = {}) {
  if (!user) return;
  
  const userRef = doc(db, 'users', user.uid);
  const snapshot = await getDoc(userRef);
  
  if (!snapshot.exists()) {
    const { email, displayName, photoURL } = user;
    
    await setDoc(userRef, {
      email,
      displayName: displayName || additionalData.displayName || 'Coach',
      photoURL,
      createdAt: serverTimestamp(),
      stats: {
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        ties: 0,
        totalPointsScored: 0,
        totalPointsAllowed: 0
      },
      teams: [],
      currentLeagueId: null,
      ...additionalData
    });
  }
  
  return userRef;
}

/**
 * Get user data from Firestore
 * @param {string} userId 
 * @returns {Promise<object|null>}
 */
export async function getUserData(userId) {
  const userRef = doc(db, 'users', userId);
  const snapshot = await getDoc(userRef);
  
  if (snapshot.exists()) {
    return { id: snapshot.id, ...snapshot.data() };
  }
  
  return null;
}
