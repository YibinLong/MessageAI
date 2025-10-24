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
import { useEffect, useState, useRef } from 'react';
import { initDatabase } from '../services/sqlite';
import { View, Text, ActivityIndicator, Platform, AppState, AppStateStatus, LogBox } from 'react-native';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../services/firebase';
import { useAuthStore } from '../stores/authStore';
import { getUserById } from '../services/userService';
import { updateUserPresence } from '../services/userService';
import { setupPresenceListener, updatePresence } from '../services/presenceService';
import { 
  registerForPushNotificationsAsync, 
  storeDeviceToken,
  setupNotificationListeners 
} from '../services/notificationService';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

/**
 * Suppress non-critical warnings
 * 
 * WHY: expo-keep-awake (transitive dependency) throws non-critical errors that don't affect functionality
 * WHAT: Ignore the "Unable to activate keep awake" warning
 */
LogBox.ignoreLogs([
  'Unable to activate keep awake',
  'keep awake',
]);

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
  
  // Ref to store presence cleanup function
  const presenceCleanupRef = useRef<(() => Promise<void>) | null>(null);
  
  // Ref to store notification listener cleanup function
  const notificationCleanupRef = useRef<(() => void) | null>(null);

  /**
   * Initialize app
   * 
   * WHAT: Initialize SQLite database
   * WHY: Database must be ready before app can function
   */
  useEffect(() => {
    async function prepare() {
      try {
        if (Platform.OS !== 'web') {
          await initDatabase();
        }
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
   * WHAT: Subscribes to onAuthStateChanged, fetches user data, updates store, sets up presence
   */
  useEffect(() => {
    if (!isReady) return;
    
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          const userData = await getUserById(firebaseUser.uid);
          
          if (userData) {
            await updateUserPresence(firebaseUser.uid, true);
            const cleanupPresence: () => Promise<void> = await setupPresenceListener(firebaseUser.uid);
            presenceCleanupRef.current = cleanupPresence;
            
            try {
              const pushToken = await registerForPushNotificationsAsync();
              if (pushToken) {
                await storeDeviceToken(firebaseUser.uid, pushToken);
              }
            } catch (error: any) {
              // Expected in Expo Go - notifications require development build
            }
            
            setUser(userData);
          } else {
            console.warn('[App] User document not found in Firestore');
            clearUser();
          }
        } else {
          if (presenceCleanupRef.current) {
            await presenceCleanupRef.current();
            presenceCleanupRef.current = null;
          }
          clearUser();
        }
      } catch (error) {
        console.error('[App] Auth state change error:', error);
        clearUser();
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [isReady]);

  /**
   * Track app foreground/background state for presence
   * 
   * WHY: Update user's online status when app is backgrounded/foregrounded
   * WHAT: Listen to AppState changes and update presence accordingly
   */
  useEffect(() => {
    if (!user) return;
    
    const subscription = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        await updatePresence(user.id, true);
      } else if (nextAppState === 'background') {
        await updatePresence(user.id, false);
      }
    });

    return () => subscription.remove();
  }, [user]);

  /**
   * Set up notification listeners
   * 
   * WHY: Handle notification taps and foreground notifications
   * WHAT: Listens to notification events and navigates to chat when tapped
   */
  useEffect(() => {
    const cleanup = setupNotificationListeners(
      (notification) => {
        // Notification received in foreground
      },
      (chatId) => {
        router.push(`/(app)/chat/${chatId}`);
      }
    );
    
    notificationCleanupRef.current = cleanup;
    return () => {
      if (notificationCleanupRef.current) {
        notificationCleanupRef.current();
      }
    };
  }, [router]);

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
      router.replace('/(app)');
    } else if (!user && !inAuthGroup) {
      router.replace('/(auth)/signin');
    }
  }, [user, segments, isReady]);

  // Show loading screen while initializing
  if (!isReady || useAuthStore.getState().loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#128c7e" />
        <Text style={{ marginTop: 16, color: '#666' }}>Initializing MessageAI...</Text>
        {error && <Text style={{ marginTop: 8, color: 'red' }}>{error}</Text>}
      </View>
    );
  }

  // WHY: GestureHandlerRootView enables gesture support for ImageViewer
  // WHY: PaperProvider enables Material Design 3 components throughout the app
  // WHY: ErrorBoundary catches React errors and shows fallback UI
  // WHAT: Slot renders the current route
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <PaperProvider>
          <Slot />
        </PaperProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

