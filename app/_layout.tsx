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
            // Set up presence tracking (also sets user online in Realtime Database)
            // WHY: setupPresenceListener handles both setting online and configuring auto-offline
            // WHAT: Returns cleanup function to set offline on signout
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
   * Track app foreground/background state for INSTANT presence updates
   * 
   * WHY: Provide instant offline detection when user backgrounds app or locks phone
   * WHAT: 
   * - When app goes inactive/background: Immediately mark offline (0-200ms response)
   * - When app returns to active: Mark online and heartbeat resumes
   * 
   * HOW THIS PROVIDES INSTANT DETECTION:
   * - User backgrounds app → updatePresence(false) called synchronously
   * - Other users' listeners fire within 200-500ms showing offline status
   * - Much faster than waiting for heartbeat timeout (4s) or Firebase disconnect (30-60s)
   */
  useEffect(() => {
    if (!user) return;
    
    const subscription = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
      console.log('[App] AppState changed to:', nextAppState);
      
      if (nextAppState === 'active') {
        // User returned to app - mark online
        // WHY: Heartbeat will resume from setupPresenceListener
        console.log('[App] App became active, setting user online');
        await updatePresence(user.id, true);
      } else if (nextAppState === 'background' || nextAppState === 'inactive') {
        // User backgrounded app or locked phone - IMMEDIATELY mark offline
        // WHY: Don't wait for heartbeat timeout or Firebase disconnect
        // WHAT: Instant offline marking provides WhatsApp-like responsiveness
        console.log('[App] App went to background/inactive, setting user offline IMMEDIATELY');
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
   * WHY: Redirect users to appropriate screens based on auth status and profile completion
   * WHAT: 
   * - If user exists and profile is complete (has isContentCreator set) → go to (app)
   * - If user exists but profile is incomplete → go to profile-setup
   * - If no user → go to signin
   */
  useEffect(() => {
    if (!isReady) return;
    
    const inAuthGroup = segments[0] === '(auth)';
    const inAppGroup = segments[0] === '(app)';
    const onProfileSetup = segments[1] === 'profile-setup';

    if (user) {
      // Check if user has completed profile setup (isContentCreator must be set)
      const hasCompletedProfile = user.isContentCreator !== null && user.isContentCreator !== undefined;
      
      if (!hasCompletedProfile && !onProfileSetup) {
        // User hasn't completed profile setup, redirect to profile-setup
        console.log('[App] User profile incomplete, redirecting to profile-setup');
        router.replace('/(auth)/profile-setup');
      } else if (hasCompletedProfile && !inAppGroup) {
        // User has completed profile, redirect to main app
        console.log('[App] User profile complete, redirecting to app');
        router.replace('/(app)');
      }
    } else if (!user && !inAuthGroup) {
      // No user logged in, redirect to signin
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

