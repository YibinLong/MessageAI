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
import { View, Text, ActivityIndicator, Platform, AppState, AppStateStatus } from 'react-native';
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
   * WHAT: Subscribes to onAuthStateChanged, fetches user data, updates store, sets up presence
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
            // Update user presence to online in Firestore (legacy field)
            await updateUserPresence(firebaseUser.uid, true);
            
            // Set up Firebase Realtime Database presence tracking
            // WHY: This automatically sets user offline if they disconnect
            const cleanupPresence: () => Promise<void> = await setupPresenceListener(firebaseUser.uid);
            presenceCleanupRef.current = cleanupPresence;
            
            // Register for push notifications
            // NOTE: Expo Go doesn't support push notifications in SDK 53+
            // This will work in development builds and production builds
            try {
              const pushToken = await registerForPushNotificationsAsync();
              if (pushToken) {
                await storeDeviceToken(firebaseUser.uid, pushToken);
                console.log('[App] Push notifications registered');
              }
            } catch (error: any) {
              // Expected in Expo Go - notifications require development build
              console.log('[App] Push notifications not available (Expo Go limitation)');
              console.log('[App] To test notifications, build with: eas build --profile development');
              // Continue without errors - presence and groups will still work!
            }
            
            // Update Zustand store with user data
            setUser(userData);
            console.log('[App] User data loaded and presence set up');
          } else {
            console.warn('[App] User document not found in Firestore');
            clearUser();
          }
        } else {
          console.log('[App] No user signed in');
          
          // Clean up presence if user signs out
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

    // Cleanup listener on unmount
    return () => {
      console.log('[App] Cleaning up auth listener');
      unsubscribe();
    };
  }, [isReady]);

  /**
   * Track app foreground/background state for presence
   * 
   * WHY: Update user's online status when app is backgrounded/foregrounded
   * WHAT: Listen to AppState changes and update presence accordingly
   */
  useEffect(() => {
    if (!user) return;

    console.log('[App] Setting up AppState listener for presence...');
    
    const subscription = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
      console.log('[App] AppState changed to:', nextAppState);
      
      if (nextAppState === 'active') {
        // App came to foreground - set user online
        console.log('[App] App foregrounded, setting user online');
        await updatePresence(user.id, true);
      } else if (nextAppState === 'background') {
        // App went to background - set user offline
        // WHY: Only set offline on 'background', not 'inactive'
        // 'inactive' is transient (pulling down notifications, app switcher)
        // 'background' means user actually left the app
        console.log('[App] App backgrounded, setting user offline');
        await updatePresence(user.id, false);
      }
      // Note: 'inactive' is ignored - user is still considered online during transitions
    });

    return () => {
      console.log('[App] Cleaning up AppState listener');
      subscription.remove();
    };
  }, [user]);

  /**
   * Set up notification listeners
   * 
   * WHY: Handle notification taps and foreground notifications
   * WHAT: Listens to notification events and navigates to chat when tapped
   */
  useEffect(() => {
    console.log('[App] Setting up notification listeners...');
    
    const cleanup = setupNotificationListeners(
      // On notification received (foreground)
      (notification) => {
        console.log('[App] Notification received:', notification.request.content);
        // You can show a custom in-app banner here if needed
      },
      // On notification tapped
      (chatId) => {
        console.log('[App] Navigating to chat from notification:', chatId);
        router.push(`/(app)/chat/${chatId}`);
      }
    );
    
    notificationCleanupRef.current = cleanup;

    return () => {
      console.log('[App] Cleaning up notification listeners');
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

