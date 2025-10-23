/**
 * Suggested Actions Service
 * 
 * WHY: Agent suggests actions for user approval instead of auto-responding
 * WHAT: Manages suggested actions (respond, archive, flag)
 */

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

/**
 * Create a suggested action for the user to review
 * 
 * WHY: Agent suggests responses instead of sending automatically
 * WHAT: Creates a pending suggestion in Firestore
 * 
 * @param userId - User ID who will review the suggestion
 * @param type - Type of action (respond, archive, flag)
 * @param messageId - Message that triggered the suggestion
 * @param chatId - Chat the message belongs to
 * @param senderId - User who sent the message
 * @param senderName - Sender's display name
 * @param senderPhotoURL - Sender's profile photo
 * @param messageText - Original message text
 * @param suggestedText - Suggested response text (for 'respond' type)
 * @param reasoning - AI's reasoning for this suggestion
 * @returns Suggested action ID
 */
export async function createSuggestedAction(
  userId: string,
  type: 'respond' | 'archive' | 'flag',
  messageId: string,
  chatId: string,
  senderId: string,
  senderName: string | undefined,
  senderPhotoURL: string | undefined,
  messageText: string | undefined,
  messageTimestamp: any,
  suggestedText: string | undefined,
  reasoning: string
): Promise<string> {
  try {
    const actionRef = admin.firestore()
      .collection('users')
      .doc(userId)
      .collection('suggestedActions')
      .doc();

    await actionRef.set({
      id: actionRef.id,
      type,
      messageId,
      chatId,
      senderId,
      senderName: senderName || null,
      senderPhotoURL: senderPhotoURL || null,
      messageText: messageText || null,
      messageTimestamp: messageTimestamp || null,
      suggestedText: suggestedText || null,
      reasoning,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    functions.logger.info('Suggested action created', {
      userId,
      type,
      actionId: actionRef.id,
    });

    return actionRef.id;
  } catch (error: any) {
    functions.logger.error('Failed to create suggested action', {
      error: error.message,
      userId,
      type,
    });
    throw error;
  }
}

/**
 * Approve a suggested action (user accepted it)
 * 
 * WHY: User reviewed the suggestion and wants to execute it
 * WHAT: Updates status to 'approved' - frontend will send the message
 * 
 * @param userId - User ID
 * @param actionId - Suggested action ID
 */
export async function approveSuggestedAction(
  userId: string,
  actionId: string
): Promise<void> {
  try {
    await admin.firestore()
      .collection('users')
      .doc(userId)
      .collection('suggestedActions')
      .doc(actionId)
      .update({
        status: 'approved',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    functions.logger.info('Suggested action approved', {
      userId,
      actionId,
    });
  } catch (error: any) {
    functions.logger.error('Failed to approve suggested action', {
      error: error.message,
      userId,
      actionId,
    });
    throw error;
  }
}

/**
 * Reject a suggested action (user declined it)
 * 
 * WHY: User reviewed the suggestion and doesn't want to execute it
 * WHAT: Updates status to 'rejected'
 * 
 * @param userId - User ID
 * @param actionId - Suggested action ID
 */
export async function rejectSuggestedAction(
  userId: string,
  actionId: string
): Promise<void> {
  try {
    await admin.firestore()
      .collection('users')
      .doc(userId)
      .collection('suggestedActions')
      .doc(actionId)
      .update({
        status: 'rejected',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    functions.logger.info('Suggested action rejected', {
      userId,
      actionId,
    });
  } catch (error: any) {
    functions.logger.error('Failed to reject suggested action', {
      error: error.message,
      userId,
      actionId,
    });
    throw error;
  }
}

