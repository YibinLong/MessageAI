/**
 * App Configuration
 * 
 * This file contains app-wide configuration settings.
 * 
 * WHY: Centralized configuration makes it easy to switch between different modes
 * WHAT: Feature flags and environment settings
 */

/**
 * Notification Provider Setting
 * 
 * WHY: We support two notification providers:
 * - 'expo': Works in Expo Go, uses Expo's push notification service (easier for development)
 * - 'fcm': Uses Firebase Cloud Messaging (requires production build, better for production)
 * 
 * HOW TO TEST:
 * 
 * FOR EXPO (Default - works in Expo Go):
 * 1. Set NOTIFICATION_PROVIDER = 'expo'
 * 2. Run app in Expo Go
 * 3. No additional setup needed
 * 4. Test notifications using https://expo.dev/notifications
 * 
 * FOR FCM (Requires build):
 * 1. Set NOTIFICATION_PROVIDER = 'fcm'
 * 2. Build APK: `eas build --profile preview --platform android`
 * 3. Install APK on device
 * 4. Test notifications via Firebase Console or Cloud Functions
 * 
 * SWITCHING:
 * - Change the value below
 * - Restart the app
 * - Cloud Functions will automatically use the correct provider
 */
export const NOTIFICATION_PROVIDER: 'expo' | 'fcm' = 'expo';

/**
 * Other app configuration settings can go here
 */
export const APP_CONFIG = {
  // Message pagination
  MESSAGES_PER_PAGE: 50,
  
  // Typing indicator timeout
  TYPING_TIMEOUT_MS: 3000,
  
  // Max image upload size
  MAX_IMAGE_SIZE_MB: 5,
  
  // App version
  VERSION: '1.0.0',
};

