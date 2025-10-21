/**
 * Root Layout
 * 
 * This is the entry point for the app's navigation structure.
 * It handles authentication routing and initializes the app.
 * 
 * WHY: We need to check if a user is logged in and route them to the correct screen.
 * WHAT: 
 * - Initializes SQLite database
 * - Listens to Firebase Auth state changes
 * - Routes to (auth) stack if not logged in, (app) stack if logged in
 */

import { Slot, useRouter, useSegments } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { useEffect, useState } from 'react';
import { initDatabase } from '../services/sqlite';
import { View, Text, ActivityIndicator, Platform } from 'react-native';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../services/firebase';
import { useAuthStore } from '../stores/authStore';
import { getUserById } from '../services/userService';
import { updateUserPresence } from '../services/userService';

/**
 * Root Layout Component
 * 
 * WHY: Manages app initialization and authentication routing
 * WHAT: 
 * - Initializes SQLite database
 * - Listens to Firebase Auth state
 * - Redirects based on authentication status
 */
export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user, setUser, clearUser, setLoading } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  /**
   * Initialize app
   * 
   * WHAT: Initialize SQLite database
   * WHY: Database must be ready before app can function
   */
  useEffect(() => {
    async function prepare() {
      try {
        console.log('[App] Initializing...');
        
        // Initialize SQLite database (skip on web)
        if (Platform.OS !== 'web') {
          await initDatabase();
        } else {
          console.log('[App] Skipping SQLite on web (not supported)');
        }
        
        console.log('[App] Database ready');
        setIsReady(true);
      } catch (err) {
        console.error('[App] Initialization failed:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    }

    prepare();
  }, []);

  /**
   * Listen to Firebase Auth state changes
   * 
   * WHY: We need to know when users sign in/out to route them appropriately
   * WHAT: Subscribes to onAuthStateChanged, fetches user data, updates store
   */
  useEffect(() => {
    if (!isReady) return;

    console.log('[App] Setting up auth listener...');
    
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          console.log('[App] User is signed in:', firebaseUser.uid);
          
          // Fetch full user profile from Firestore
          const userData = await getUserById(firebaseUser.uid);
          
          if (userData) {
            // Update user presence to online
            await updateUserPresence(firebaseUser.uid, true);
            
            // Update Zustand store with user data
            setUser(userData);
            console.log('[App] User data loaded');
          } else {
            console.warn('[App] User document not found in Firestore');
            clearUser();
          }
        } else {
          console.log('[App] No user signed in');
          clearUser();
        }
      } catch (error) {
        console.error('[App] Auth state change error:', error);
        clearUser();
      } finally {
        setLoading(false);
      }
    });

    // Cleanup listener on unmount
    return () => {
      console.log('[App] Cleaning up auth listener');
      unsubscribe();
    };
  }, [isReady]);

  /**
   * Handle auth routing
   * 
   * WHY: Redirect users to appropriate screens based on auth status
   * WHAT: If logged in → go to (app), if not → go to (auth)
   */
  useEffect(() => {
    if (!isReady) return;
    
    const inAuthGroup = segments[0] === '(auth)';
    const inAppGroup = segments[0] === '(app)';

    if (user && !inAppGroup) {
      // User is signed in but not in app group → redirect to app
      console.log('[App] Redirecting to app...');
      router.replace('/(app)');
    } else if (!user && !inAuthGroup) {
      // User is not signed in but not in auth group → redirect to auth
      console.log('[App] Redirecting to auth...');
      router.replace('/(auth)/signin');
    }
  }, [user, segments, isReady]);

  // Show loading screen while initializing
  if (!isReady || useAuthStore.getState().loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#25D366" />
        <Text style={{ marginTop: 16, color: '#666' }}>Initializing MessageAI...</Text>
        {error && <Text style={{ marginTop: 8, color: 'red' }}>{error}</Text>}
      </View>
    );
  }

  // WHY: PaperProvider enables Material Design 3 components throughout the app
  // WHAT: Slot renders the current route
  return (
    <PaperProvider>
      <Slot />
    </PaperProvider>
  );
}

