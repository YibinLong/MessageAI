/**
 * Firebase Cloud Functions
 * 
 * This file exports all Cloud Functions for MessageAI.
 * Functions run server-side and handle:
 * - Push notifications
 * - AI processing (categorization, response drafting, etc.)
 * - Background tasks (multi-step agent)
 * 
 * WHY: Cloud Functions keep sensitive logic (AI API keys) secure on the server
 * WHAT: Export functions that Firebase will deploy
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { onMessageCreated } from './notifications';
import { categorizeMessage, recategorizeMessage } from './categorization';

/**
 * Initialize Firebase Admin SDK
 * 
 * WHY: Admin SDK allows Cloud Functions to access Firestore, Auth, etc.
 * WHAT: Initializes with default credentials (automatic on Firebase)
 */
admin.initializeApp();

/**
 * Export notification functions
 */
export { onMessageCreated };

/**
 * Export AI categorization functions (includes sentiment & collaboration scoring)
 */
export { categorizeMessage, recategorizeMessage };

/**
 * Test function to verify Cloud Functions are working
 * 
 * WHY: Simple test endpoint to confirm deployment succeeded
 * WHAT: Returns a success message when called
 * 
 * HOW TO CALL:
 * - From frontend: use Firebase Functions SDK
 * - From HTTP: GET/POST to the function URL
 */
export const helloWorld = functions.https.onRequest((request, response) => {
  functions.logger.info('Hello logs!', { structuredData: true });
  response.json({ 
    message: 'Hello from MessageAI Cloud Functions!',
    timestamp: new Date().toISOString(),
    status: 'success'
  });
});

/**
 * Note: onMessageCreated is now exported from notifications.ts
 * This function sends push notifications when new messages arrive
 */

/**
 * Placeholder for AI categorization function
 * 
 * WHY: Will be implemented in Phase 3 for AI features
 * WHAT: Will use OpenAI to categorize messages as fan/business/spam/urgent
 */
// export const categorizeMessage = functions.https.onCall(async (data, context) => {
//   // TODO: Implement in Phase 3
//   return { category: 'fan', confidence: 0.95 };
// });

/**
 * Placeholder for push notification function
 * 
 * WHY: Will send FCM notifications when messages arrive
 * WHAT: Sends notification to recipient's device tokens
 */
// export const sendNotification = functions.firestore
//   .document('chats/{chatId}/messages/{messageId}')
//   .onCreate(async (snapshot, context) => {
//     // TODO: Implement in Phase 2
//   });

functions.logger.info('MessageAI Cloud Functions initialized');

