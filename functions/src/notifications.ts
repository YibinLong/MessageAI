/**
 * Cloud Functions for Push Notifications
 * 
 * This file contains Cloud Functions that send push notifications to users
 * when they receive new messages.
 * 
 * WHY: Users need to be notified of new messages even when app is closed
 * WHAT: Firestore trigger that sends notifications via Expo or FCM
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/**
 * Send push notification when a new message is created
 * 
 * WHY: Users should be notified immediately when they receive a message
 * WHAT: 
 * - Triggers when a message is created in /chats/{chatId}/messages/{messageId}
 * - Fetches recipient's device tokens
 * - Sends notification via Expo or FCM based on token provider
 * 
 * FLOW:
 * 1. Message created in Firestore
 * 2. Get chat participants
 * 3. Find recipient (not the sender)
 * 4. Get recipient's device tokens
 * 5. Get sender's name
 * 6. Send notification to each token
 */
export const onMessageCreated = functions.firestore
  .document('chats/{chatId}/messages/{messageId}')
  .onCreate(async (snapshot, context) => {
    try {
      const { chatId, messageId } = context.params;
      const message = snapshot.data();
      
      console.log('[Notifications] New message created:', messageId, 'in chat:', chatId);
      
      // Get chat to find participants
      const chatDoc = await admin.firestore().doc(`chats/${chatId}`).get();
      if (!chatDoc.exists) {
        console.error('[Notifications] Chat not found:', chatId);
        return;
      }
      
      const chat = chatDoc.data();
      if (!chat) return;
      
      // Validate participants array exists
      // WHY: Prevents runtime error if participants field is missing or malformed
      // WHAT: Check if participants exists and is an array before calling .filter()
      if (!chat.participants || !Array.isArray(chat.participants)) {
        console.error('[Notifications] Chat participants missing or malformed for chat:', chatId);
        return;
      }
      
      // Find recipients (all participants except sender)
      const recipients = chat.participants.filter((id: string) => id !== message.senderId);
      
      if (recipients.length === 0) {
        console.log('[Notifications] No recipients to notify');
        return;
      }
      
      console.log('[Notifications] Recipients:', recipients);
      
      // Get sender's name
      const senderDoc = await admin.firestore().doc(`users/${message.senderId}`).get();
      const senderName = senderDoc.exists ? senderDoc.data()?.displayName || 'Someone' : 'Someone';
      
      // Prepare notification payload
      // WHY: Provide fallbacks for undefined/null values to prevent displaying 'undefined' or 'null'
      // WHAT: Use default values for chat name and message text
      const groupName = chat.name || 'Group Chat';
      const messageText = message.text || '📷 Image'; // Default for image-only messages
      
      const notificationTitle = chat.type === 'group' ? groupName : senderName;
      const notificationBody = chat.type === 'group' 
        ? `${senderName}: ${messageText}`
        : messageText;
      
      // Send notification to each recipient
      for (const recipientId of recipients) {
        await sendNotificationToUser(recipientId, {
          title: notificationTitle,
          body: notificationBody,
          data: {
            chatId,
            messageId,
            senderId: message.senderId,
          },
        });
      }
      
      console.log('[Notifications] Notifications sent successfully');
    } catch (error) {
      console.error('[Notifications] Error sending notification:', error);
    }
  });

/**
 * Send notification to a specific user
 * 
 * WHY: Send to all of user's devices
 * WHAT: Fetches user's device tokens and sends notification to each
 * 
 * @param userId - User ID to send notification to
 * @param payload - Notification content
 */
async function sendNotificationToUser(
  userId: string,
  payload: {
    title: string;
    body: string;
    data: Record<string, any>;
  }
): Promise<void> {
  try {
    console.log('[Notifications] Sending notification to user:', userId);
    
    // Get user's device tokens
    const tokensSnapshot = await admin.firestore()
      .collection(`users/${userId}/tokens`)
      .get();
    
    if (tokensSnapshot.empty) {
      console.log('[Notifications] No device tokens for user:', userId);
      return;
    }
    
    // Send to each token based on provider
    const sendPromises = tokensSnapshot.docs.map(async (tokenDoc) => {
      const tokenData = tokenDoc.data();
      const token = tokenData.token;
      const provider = tokenData.provider || 'expo'; // Default to Expo
      
      console.log('[Notifications] Sending to token (provider:', provider, ')');
      
      if (provider === 'fcm') {
        // Send via FCM
        return sendFCMNotification(token, payload);
      } else {
        // Send via Expo
        return sendExpoNotification(token, payload);
      }
    });
    
    await Promise.all(sendPromises);
    console.log('[Notifications] Sent to', sendPromises.length, 'devices');
  } catch (error) {
    console.error('[Notifications] Error sending to user:', error);
  }
}

/**
 * Send notification via Firebase Cloud Messaging
 * 
 * WHY: For production builds using FCM
 * WHAT: Uses Firebase Admin SDK to send FCM notification
 * 
 * NOTE: FCM requires all data values to be strings, so we convert them
 * 
 * @param token - FCM device token
 * @param payload - Notification content
 */
async function sendFCMNotification(
  token: string,
  payload: {
    title: string;
    body: string;
    data: Record<string, any>;
  }
): Promise<void> {
  try {
    // Convert all data values to strings (FCM requirement)
    // WHY: FCM data payload must have string values only
    const stringData: Record<string, string> = {};
    for (const [key, value] of Object.entries(payload.data)) {
      stringData[key] = String(value);
    }
    
    await admin.messaging().send({
      token,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: stringData,
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          color: '#25D366',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    });
    
    console.log('[Notifications] FCM notification sent successfully');
  } catch (error) {
    console.error('[Notifications] FCM send error:', error);
  }
}

/**
 * Send notification via Expo Push Service
 * 
 * WHY: For Expo Go development builds
 * WHAT: Makes HTTP request to Expo's push notification service
 * 
 * @param token - Expo push token
 * @param payload - Notification content
 */
async function sendExpoNotification(
  token: string,
  payload: {
    title: string;
    body: string;
    data: Record<string, any>;
  }
): Promise<void> {
  try {
    const message = {
      to: token,
      sound: 'default',
      title: payload.title,
      body: payload.body,
      data: payload.data,
      priority: 'high',
      channelId: 'default',
    };
    
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });
    
    const result = await response.json();
    
    if (result.data && result.data[0] && result.data[0].status === 'error') {
      console.error('[Notifications] Expo send error:', result.data[0].message);
    } else {
      console.log('[Notifications] Expo notification sent successfully');
    }
  } catch (error) {
    console.error('[Notifications] Expo send error:', error);
  }
}

