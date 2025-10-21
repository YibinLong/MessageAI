/**
 * Firebase Service
 * 
 * This file initializes the Firebase SDK with configuration from environment variables.
 * It provides initialized Firebase services (auth, firestore, storage) for the app to use.
 * 
 * WHY: We centralize Firebase initialization so all parts of the app use the same
 * Firebase instance, preventing initialization errors.
 */

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
// Auth import delayed - will initialize when needed in Phase 2
// import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getDatabase, Database } from 'firebase/database';
import Constants from 'expo-constants';

/**
 * Firebase configuration object
 * These values come from the .env file (EXPO_PUBLIC_* variables)
 * 
 * WHAT: This is the configuration that connects our app to our specific Firebase project
 */
const firebaseConfig = {
  apiKey: Constants.expoConfig?.extra?.EXPO_PUBLIC_FIREBASE_API_KEY || process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: Constants.expoConfig?.extra?.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: Constants.expoConfig?.extra?.EXPO_PUBLIC_FIREBASE_PROJECT_ID || process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: Constants.expoConfig?.extra?.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: Constants.expoConfig?.extra?.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: Constants.expoConfig?.extra?.EXPO_PUBLIC_FIREBASE_APP_ID || process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  databaseURL: Constants.expoConfig?.extra?.EXPO_PUBLIC_FIREBASE_DATABASE_URL || process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
};

/**
 * Initialize Firebase app
 * 
 * WHY: We check if an app is already initialized to prevent duplicate initialization errors
 * WHAT: If no Firebase app exists, create one. Otherwise, use the existing one.
 */
let app: FirebaseApp;

if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
  console.log('[Firebase] Initialized successfully');
} else {
  app = getApps()[0];
  console.log('[Firebase] Using existing instance');
}

/**
 * Firebase service instances
 * 
 * WHY: We create these once and export them so the entire app uses the same instances
 * WHAT:
 * - auth: For user authentication (sign up, sign in, sign out) - DISABLED for Phase 1
 * - db: Firestore database for storing messages, chats, user profiles
 * - storage: For uploading/downloading images and media files
 * - realtimeDb: For real-time presence (online/offline status)
 */
// Auth disabled for Phase 1 testing - will enable in Phase 2 (Authentication epic)
// export const auth: Auth = getAuth(app);
export const auth: any = null;  // Placeholder - will initialize in Phase 2
export const db: Firestore = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);
export const realtimeDb: Database = getDatabase(app);

/**
 * Helper function to test Firebase connection
 * 
 * WHY: Used during setup to verify Firebase is configured correctly
 * WHAT: Attempts to write and read a test document from Firestore
 * 
 * @returns Promise that resolves to true if connection works, false otherwise
 */
export async function testFirebaseConnection(): Promise<boolean> {
  try {
    const { collection, addDoc, getDocs } = await import('firebase/firestore');
    
    // Write a test document
    const testRef = collection(db, 'test');
    const docRef = await addDoc(testRef, {
      message: 'Firebase connection test',
      timestamp: new Date(),
    });
    
    console.log('[Firebase] Test document written with ID:', docRef.id);
    
    // Read back test documents
    const snapshot = await getDocs(testRef);
    console.log('[Firebase] Test documents count:', snapshot.size);
    
    return true;
  } catch (error) {
    console.error('[Firebase] Connection test failed:', error);
    return false;
  }
}

export default app;

