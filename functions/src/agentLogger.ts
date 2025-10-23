/**
 * Agent Logger Service
 * 
 * WHY: Track all actions taken by the AI agent for transparency and debugging
 * WHAT: Logs agent actions to Firestore for user review
 */

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

/**
 * Log an agent action to Firestore
 * 
 * WHY: Users need to see what the agent did and why
 * WHAT: Creates a log entry in /users/{userId}/agentLogs
 * 
 * @param userId - User ID who owns the agent
 * @param action - Type of action taken
 * @param messageId - Message that triggered the action
 * @param chatId - Chat the message belongs to
 * @param result - Description of what happened
 * @returns Log ID
 */
export async function logAgentAction(
  userId: string,
  action: 'categorize' | 'respond' | 'archive' | 'flag',
  messageId: string,
  chatId: string,
  result: string
): Promise<string> {
  try {
    const logRef = admin.firestore()
      .collection('users')
      .doc(userId)
      .collection('agentLogs')
      .doc();

    await logRef.set({
      id: logRef.id,
      action,
      messageId,
      chatId,
      result,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    functions.logger.info('Agent action logged', {
      userId,
      action,
      messageId,
      logId: logRef.id,
    });

    return logRef.id;
  } catch (error: any) {
    functions.logger.error('Failed to log agent action', {
      error: error.message,
      userId,
      action,
    });
    // Don't throw - logging failure shouldn't break agent workflow
    return '';
  }
}

