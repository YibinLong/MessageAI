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
import { draftResponse } from './draftResponse';
import { detectFAQ } from './faqDetection';
import { runAgent } from './agent';
import { sendAIChatMessage } from './aiChat';
import { approveSuggestedAction, rejectSuggestedAction } from './suggestedActions';

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
 * Export FAQ detection functions
 */
export { detectFAQ };

/**
 * Export AI response drafting functions
 */
export { draftResponse };

/**
 * Export AI Agent functions (Epic 3.7)
 */
export { runAgent };

/**
 * Export AI Chat functions (Epic 3.8)
 */
export { sendAIChatMessage };

/**
 * Export suggested action management functions
 */
export const approveSuggestion = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be logged in');
  }
  const { userId, actionId } = data;
  if (context.auth.uid !== userId) {
    throw new functions.https.HttpsError('permission-denied', 'Can only approve your own actions');
  }
  await approveSuggestedAction(userId, actionId);
  return { success: true };
});

export const rejectSuggestion = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be logged in');
  }
  const { userId, actionId } = data;
  if (context.auth.uid !== userId) {
    throw new functions.https.HttpsError('permission-denied', 'Can only reject your own actions');
  }
  await rejectSuggestedAction(userId, actionId);
  return { success: true };
});

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

