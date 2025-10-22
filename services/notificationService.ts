/**
 * Notification Service
 * 
 * This service handles push notifications using either Expo or Firebase Cloud Messaging (FCM).
 * It provides functions to register for notifications, store device tokens, and handle notification events.
 * 
 * WHY: Users need to receive notifications when they get new messages
 * WHAT: Push notification registration, token storage, and event handling
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { doc, setDoc, serverTimestamp, collection } from 'firebase/firestore';
import { db } from './firebase';
import { NOTIFICATION_PROVIDER } from '../constants/config';

/**
 * Configure notification behavior
 * 
 * WHY: We need to define how notifications appear when the app is in foreground
 * WHAT: Show alert, play sound, and show badge for foreground notifications
 * 
 * PROPERTIES EXPLAINED:
 * - shouldShowAlert: Show notification popup when app is in foreground (legacy, iOS)
 * - shouldPlaySound: Play notification sound
 * - shouldSetBadge: Update app badge count (iOS)
 * - shouldShowBanner: Show notification banner at top (iOS 14+)
 * - shouldShowList: Show in notification center list
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Register for push notifications
 * 
 * WHY: We need a device token to send notifications to this specific device
 * WHAT: Requests permission, gets token based on provider (Expo or FCM)
 * 
 * @returns Push token or null if registration failed
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  try {
    console.log('[NotificationService] Registering for push notifications...');
    console.log('[NotificationService] Provider:', NOTIFICATION_PROVIDER);

    // Check if running on physical device
    if (!Device.isDevice) {
      console.warn('[NotificationService] Must use physical device for push notifications');
      return null;
    }

    // Request permission
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.warn('[NotificationService] Permission not granted for notifications');
      return null;
    }

    // Get push token based on provider
    let token: string;
    
    if (NOTIFICATION_PROVIDER === 'fcm') {
      // Get FCM token (for production builds)
      console.log('[NotificationService] Getting FCM token...');
      const devicePushToken = await Notifications.getDevicePushTokenAsync();
      token = devicePushToken.data;
      console.log('[NotificationService] FCM token obtained');
    } else {
      // Get Expo token (for Expo Go)
      console.log('[NotificationService] Getting Expo push token...');
      
      // Try to get projectId from environment, otherwise call without it
      // WHY: Expo can infer the project ID in most cases, but specifying it is more reliable
      const projectId = process.env.EXPO_PUBLIC_PROJECT_ID;
      
      const expoPushToken = projectId
        ? await Notifications.getExpoPushTokenAsync({ projectId })
        : await Notifications.getExpoPushTokenAsync();
        
      token = expoPushToken.data;
      console.log('[NotificationService] Expo push token obtained:', token);
    }

    // Set notification channel for Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#25D366',
      });
    }

    return token;
  } catch (error) {
    console.error('[NotificationService] Failed to register for notifications:', error);
    return null;
  }
}

/**
 * Store device token in Firestore
 * 
 * WHY: We need to save the token so Cloud Functions can send notifications to this device
 * WHAT: Writes token to /users/{userId}/tokens/{tokenId}
 * 
 * @param userId - User ID
 * @param token - Push notification token
 */
export async function storeDeviceToken(userId: string, token: string): Promise<void> {
  try {
    console.log('[NotificationService] Storing device token for user:', userId);
    
    // Create a unique token ID (hash of the token)
    const tokenId = token.substring(0, 20); // Use first 20 chars as ID
    
    const tokenRef = doc(collection(db, 'users', userId, 'tokens'), tokenId);
    
    await setDoc(tokenRef, {
      token,
      platform: Platform.OS,
      provider: NOTIFICATION_PROVIDER,
      createdAt: serverTimestamp(),
      lastUsed: serverTimestamp(),
    });
    
    console.log('[NotificationService] Device token stored successfully');
  } catch (error) {
    console.error('[NotificationService] Failed to store device token:', error);
    throw error;
  }
}

/**
 * Handle notification received while app is in foreground
 * 
 * WHY: Show in-app notification when message arrives while user is in app
 * WHAT: Called when notification is received in foreground
 * 
 * @param notification - Notification object
 */
export function handleNotificationReceived(
  notification: Notifications.Notification
): void {
  console.log('[NotificationService] Foreground notification received:', notification);
  
  // You can show a custom in-app banner here
  // For now, the default handler (setNotificationHandler) shows it
}

/**
 * Handle notification tap
 * 
 * WHY: Navigate to the relevant chat when user taps notification
 * WHAT: Extracts chatId from notification data and returns it
 * 
 * @param response - Notification response object
 * @returns Chat ID to navigate to, or null
 */
export function handleNotificationResponse(
  response: Notifications.NotificationResponse
): string | null {
  console.log('[NotificationService] Notification tapped:', response);
  
  try {
    const chatId = response.notification.request.content.data?.chatId as string | undefined;
    
    if (chatId) {
      console.log('[NotificationService] Navigating to chat:', chatId);
      return chatId;
    }
    
    console.warn('[NotificationService] No chatId in notification data');
    return null;
  } catch (error) {
    console.error('[NotificationService] Failed to handle notification response:', error);
    return null;
  }
}

/**
 * Set up notification listeners
 * 
 * WHY: We need to listen for notification events throughout the app lifecycle
 * WHAT: Sets up listeners for received and response events
 * 
 * @param onReceived - Callback for when notification is received in foreground
 * @param onResponse - Callback for when notification is tapped
 * @returns Cleanup function to remove listeners
 */
export function setupNotificationListeners(
  onReceived: (notification: Notifications.Notification) => void,
  onResponse: (chatId: string) => void
): () => void {
  console.log('[NotificationService] Setting up notification listeners...');
  
  // Listen for notifications received while app is in foreground
  const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
    handleNotificationReceived(notification);
    onReceived(notification);
  });
  
  // Listen for notification taps
  const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const chatId = handleNotificationResponse(response);
    if (chatId) {
      onResponse(chatId);
    }
  });
  
  // Return cleanup function
  return () => {
    console.log('[NotificationService] Cleaning up notification listeners');
    receivedSubscription.remove();
    responseSubscription.remove();
  };
}

