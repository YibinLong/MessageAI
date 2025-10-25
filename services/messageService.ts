/**
 * Message Service
 * 
 * This service handles all messaging logic: sending, receiving, and syncing messages.
 * It implements optimistic UI and offline queue for reliable messaging.
 * 
 * WHY: Centralized message handling ensures messages work reliably online and offline
 * WHAT: Functions to send messages, listen for new messages, and retry failed sends
 */

import { 
  collection, 
  doc, 
  addDoc,
  setDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  where,
  serverTimestamp,
  Timestamp,
  updateDoc,
  getDocs,
  getDoc,
  increment
} from 'firebase/firestore';
import uuid from 'react-native-uuid';
import { db } from './firebase';
import { 
  insertMessage, 
  getMessagesByChat, 
  getMessagesByStatus,
  updateMessageStatus as updateMessageStatusSQLite,
  upsertChat,
  getAllChats,
  updateMessageReadBy
} from './sqlite';
import { updateChatLastMessage } from './chatService';
import { Message, SQLiteMessage } from '../types';
import { uploadChatImage } from '../utils/imageUpload';

/**
 * Send a text message
 * 
 * WHY: This is the core function for sending messages. It implements optimistic UI
 * (message appears instantly) and handles offline queueing.
 * 
 * WHAT: 
 * 1. Generate message ID
 * 2. Save to SQLite with status 'sending' (optimistic UI)
 * 3. Upload to Firestore
 * 4. Update SQLite status to 'sent'
 * 5. Update chat's last message
 * 
 * FLOW:
 * - Online: message appears instantly, syncs in background
 * - Offline: message appears with 'sending' status, syncs when reconnected
 * 
 * @param chatId - Chat ID to send message to
 * @param text - Message text content
 * @param senderId - User ID of sender (current user)
 * @returns Message object (with status 'sending' initially)
 */
export async function sendMessage(
  chatId: string,
  text: string,
  senderId: string
): Promise<Message> {
  const messageId = uuid.v4() as string;
  const timestamp = Timestamp.now();
  
  // Create message object
  const message: Message = {
    id: messageId,
    chatId,
    senderId,
    text,
    timestamp,
    status: 'sending', // Start as 'sending' for optimistic UI
    readBy: [],
    type: 'text',
  };
  
  try {
    // 1. Save to SQLite immediately (optimistic UI)
    // WHY: User sees message instantly, even before upload completes
    const sqliteMessage: SQLiteMessage = {
      id: message.id,
      chatId: message.chatId,
      senderId: message.senderId,
      text: message.text,
      timestamp: timestamp.toMillis(),
      status: 'sending',
      readBy: JSON.stringify(message.readBy),
      type: message.type,
      synced: 0, // Not synced yet
    };
    
    try {
      await insertMessage(sqliteMessage);
    } catch (sqliteError) {
      console.warn('[MessageService] SQLite insert failed, continuing without cache:', sqliteError);
      // Don't throw - app can work without SQLite cache
    }
    
    // 2. Upload to Firestore in background
    // WHY: This syncs the message to the server so recipient can receive it
    try {
      // Use setDoc with our generated ID instead of addDoc
      // WHY: addDoc generates a new ID, which breaks our status update logic
      const messageRef = doc(db, 'chats', chatId, 'messages', messageId);
      await setDoc(messageRef, {
        id: messageId,
        chatId,
        senderId,
        text,
        timestamp: serverTimestamp(),
        status: 'sending', // Start as 'sending' - will update to 'sent' after confirmation
        readBy: [],
        type: 'text',
      });
      
      // Update to 'sent' after successful upload
      await updateDoc(messageRef, { status: 'sent' });
      
      // 3. Update status to 'sent' in SQLite
      try {
        await updateMessageStatusSQLite(messageId, 'sent');
      } catch (sqliteError) {
        console.warn('[MessageService] SQLite status update failed:', sqliteError);
      }
      
      // 4. Update chat's last message (include message ID for AI categorization)
      await updateChatLastMessage(chatId, text, senderId, messageId);
    } catch (uploadError) {
      console.error('[MessageService] Failed to upload to Firestore:', uploadError);
      // Don't throw - message is saved locally and will retry later
      // Status stays as 'sending' so offline queue can retry it
    }
    
    return message;
  } catch (error) {
    console.error('[MessageService] Failed to send message:', error);
    throw error;
  }
}

/**
 * Send an image message
 * 
 * WHY: Users need to send images in chats. This handles the full flow:
 * optimistic UI, upload to Storage, create message, handle offline.
 * 
 * WHAT:
 * 1. Generate message ID
 * 2. Upload image to Firebase Storage
 * 3. Save message to SQLite with mediaURL (optimistic UI)
 * 4. Upload message doc to Firestore
 * 5. Update chat's last message
 * 
 * FLOW:
 * - Online: image appears with loading state, uploads in background
 * - Offline: image saved locally, uploads when reconnected
 * 
 * @param chatId - Chat ID to send image message to
 * @param imageUri - Local file URI of the compressed image
 * @param senderId - User ID of sender (current user)
 * @returns Message object (with type 'image')
 */
export async function sendImageMessage(
  chatId: string,
  imageUri: string,
  senderId: string
): Promise<Message> {
  const messageId = uuid.v4() as string;
  const timestamp = Timestamp.now();
  
  try {
    // 1. Upload image to Firebase Storage first
    // WHY: We need the download URL before creating the message
    const mediaURL = await uploadChatImage(senderId, messageId, imageUri);
    const mediaPath = `media/${senderId}/${messageId}.jpg`;
    
    // 2. Create message object
    const message: Message = {
      id: messageId,
      chatId,
      senderId,
      text: '', // Image messages have empty text
      timestamp,
      status: 'sending',
      readBy: [],
      type: 'image',
      mediaURL,
      mediaPath,
    };
    
    // 3. Save to SQLite immediately (optimistic UI)
    const sqliteMessage: SQLiteMessage = {
      id: message.id,
      chatId: message.chatId,
      senderId: message.senderId,
      text: message.text,
      timestamp: timestamp.toMillis(),
      status: 'sending',
      readBy: JSON.stringify(message.readBy),
      type: 'image',
      mediaURL: message.mediaURL,
      synced: 0,
    };
    
    try {
      await insertMessage(sqliteMessage);
    } catch (sqliteError) {
      console.warn('[MessageService] SQLite insert failed, continuing without cache:', sqliteError);
    }
    
    // 4. Upload message document to Firestore
    try {
      const messageRef = doc(db, 'chats', chatId, 'messages', messageId);
      await setDoc(messageRef, {
        id: messageId,
        chatId,
        senderId,
        text: '',
        timestamp: serverTimestamp(),
        status: 'sending',
        readBy: [],
        type: 'image',
        mediaURL,
        mediaPath,
      });
      
      // Update to 'sent' after successful upload
      await updateDoc(messageRef, { status: 'sent' });
      
      // 5. Update SQLite status
      try {
        await updateMessageStatusSQLite(messageId, 'sent');
      } catch (sqliteError) {
        console.warn('[MessageService] SQLite status update failed:', sqliteError);
      }
      
      // 6. Update chat's last message (show "📷 Image" as preview, include message ID)
      await updateChatLastMessage(chatId, '📷 Image', senderId, messageId);
    } catch (uploadError) {
      console.error('[MessageService] Failed to upload message to Firestore:', uploadError);
      // Message is saved locally and will retry later
    }
    
    return message;
  } catch (error) {
    console.error('[MessageService] Failed to send image message:', error);
    throw error;
  }
}

/**
 * Subscribe to new messages in a chat
 * 
 * WHY: Real-time messaging requires listening for new messages from Firestore.
 * When someone sends you a message, this listener fires and adds it to SQLite.
 * 
 * WHAT: Sets up Firestore real-time listener, saves new messages to SQLite,
 * calls callback to update UI.
 * 
 * @param chatId - Chat ID to listen to
 * @param callback - Function to call when new messages arrive
 * @returns Unsubscribe function to stop listening
 */
export function subscribeToMessages(
  chatId: string,
  callback: (messages: Message[]) => void
): () => void {
  // Query last 50 messages, ordered by timestamp
  const messagesRef = collection(db, 'chats', chatId, 'messages');
  const q = query(
    messagesRef,
    orderBy('timestamp', 'desc'),
    limit(50)
  );
  
  // Set up real-time listener
  const unsubscribe = onSnapshot(
    q,
    async (snapshot) => {
      const messages: Message[] = [];
      
      // Process each message
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        
        const message: Message = {
          id: docSnap.id,
          chatId,
          senderId: data.senderId,
          text: data.text,
          timestamp: data.timestamp || Timestamp.now(),
          status: data.status || 'sent',
          readBy: data.readBy || [],
          type: data.type || 'text',
          mediaURL: data.mediaURL,
          mediaPath: data.mediaPath,
        };
        
        messages.push(message);
        
        // Save to SQLite for offline access
        try {
          const sqliteMessage: SQLiteMessage = {
            id: message.id,
            chatId: message.chatId,
            senderId: message.senderId,
            text: message.text,
            timestamp: message.timestamp instanceof Timestamp ? message.timestamp.toMillis() : Date.now(),
            status: message.status,
            readBy: JSON.stringify(message.readBy),
            type: message.type,
            mediaURL: message.mediaURL,
            synced: 1, // Message came from Firestore, so it's synced
          };
          
          await insertMessage(sqliteMessage);
        } catch (sqliteError) {
          console.warn('[MessageService] SQLite insert failed for message:', message.id, sqliteError);
          // Don't throw - message is still in Firestore and will display
        }
      }
      
      // Call callback with messages (sorted newest first)
      callback(messages);
    },
    (error) => {
      console.error('[MessageService] Snapshot listener error:', error);
    }
  );
  
  return unsubscribe;
}

/**
 * Retry sending unsent messages (offline queue)
 * 
 * WHY: When user is offline, messages stay in 'sending' status. When they
 * reconnect, we need to upload those messages to Firestore.
 * 
 * WHAT: 
 * 1. Query SQLite for messages with status 'sending'
 * 2. For each message, upload to Firestore
 * 3. Update status to 'sent'
 * 
 * WHEN: Called automatically when network reconnects
 * 
 * @param chatId - Optional: only retry messages in this chat
 * @returns Number of messages successfully retried
 */
export async function retryUnsentMessages(chatId?: string): Promise<number> {
  try {
    // Query messages with status 'sending' using the queued operation
    const unsentMessages = await getMessagesByStatus('sending', chatId);
    
    let successCount = 0;
    
    // Retry each message
    for (const sqliteMsg of unsentMessages) {
      try {
        // Upload to Firestore using setDoc with our ID
        const messageRef = doc(db, 'chats', sqliteMsg.chatId, 'messages', sqliteMsg.id);
        await setDoc(messageRef, {
          id: sqliteMsg.id,
          chatId: sqliteMsg.chatId,
          senderId: sqliteMsg.senderId,
          text: sqliteMsg.text,
          timestamp: serverTimestamp(),
          status: 'sending', // Start as 'sending' - will update to 'sent' after confirmation
          readBy: JSON.parse(sqliteMsg.readBy || '[]'),
          type: sqliteMsg.type,
        });
        
        // Update to 'sent' after successful upload
        await updateDoc(messageRef, { status: 'sent' });
        
        // Update status to 'sent' in SQLite
        try {
          await updateMessageStatusSQLite(sqliteMsg.id, 'sent');
        } catch (sqliteError) {
          console.warn('[MessageService] SQLite status update failed during retry:', sqliteError);
        }
        
        // Update chat's last message (include message ID)
        await updateChatLastMessage(sqliteMsg.chatId, sqliteMsg.text, sqliteMsg.senderId, sqliteMsg.id);
        
        successCount++;
      } catch (error) {
        console.error('[MessageService] Failed to retry message:', sqliteMsg.id, error);
        // Continue with next message even if this one fails
      }
    }
    
    return successCount;
  } catch (error) {
    console.error('[MessageService] Failed to retry unsent messages:', error);
    return 0;
  }
}

/**
 * Load messages from SQLite (for instant display)
 * 
 * WHY: When user opens a chat, we load from SQLite first (instant) before
 * Firestore listener fires (slower).
 * 
 * WHAT: Queries SQLite for messages, converts to Message objects
 * 
 * @param chatId - Chat ID to load messages for
 * @param limitCount - Max number of messages to load (default 50)
 * @returns Array of messages
 */
export async function loadMessagesFromCache(
  chatId: string,
  limitCount: number = 50
): Promise<Message[]> {
  try {
    const sqliteMessages = await getMessagesByChat(chatId, limitCount);
    
    // Convert SQLite messages to Message objects
    const messages: Message[] = sqliteMessages.map((sqliteMsg) => ({
      id: sqliteMsg.id,
      chatId: sqliteMsg.chatId,
      senderId: sqliteMsg.senderId,
      text: sqliteMsg.text,
      timestamp: Timestamp.fromMillis(sqliteMsg.timestamp),
      status: sqliteMsg.status as 'sending' | 'sent' | 'delivered' | 'read',
      readBy: JSON.parse(sqliteMsg.readBy || '[]'),
      type: sqliteMsg.type as 'text' | 'image',
      mediaURL: sqliteMsg.mediaURL,
    }));
    
    return messages;
  } catch (error) {
    console.error('[MessageService] Failed to load messages from cache:', error);
    return [];
  }
}

/**
 * Mark a chat as read for a specific user
 * 
 * WHY: When a user opens a chat, we need to reset their unread count to 0.
 * This is tracked per-user using a map in Firestore.
 * 
 * WHAT: 
 * 1. Updates Firestore chat document to set unreadCounts[userId] = 0
 * 2. Updates SQLite cache to set unreadCount = 0 for this user
 * 
 * @param chatId - Chat ID to mark as read
 * @param userId - User ID who is marking the chat as read
 */
export async function markChatAsRead(chatId: string, userId: string): Promise<void> {
  try {
    // Update Firestore: Set this user's unread count to 0
    // We use a map structure: { unreadCounts: { userId1: 0, userId2: 5 } }
    const chatRef = doc(db, 'chats', chatId);
    await updateDoc(chatRef, {
      [`unreadCounts.${userId}`]: 0,
    });
    
    // Update SQLite cache
    // Note: SQLite stores only the current user's unread count
    const sqliteChats = await getAllChats();
    const chat = sqliteChats.find(c => c.id === chatId);
    
    if (chat) {
      chat.unreadCount = 0;
      await upsertChat(chat);
    }
  } catch (error) {
    console.error('[MessageService] Failed to mark chat as read:', error);
    // Don't throw - this is not critical, chat will still work
  }
}

/**
 * Mark messages as delivered
 * 
 * WHY: When recipient receives messages, we need to update their status to 'delivered'
 * so the sender sees double gray checkmarks instead of single checkmark.
 * 
 * WHAT:
 * 1. Filters messages to only those not sent by current user
 * 2. Updates status from 'sent' to 'delivered' in Firestore
 * 3. Updates SQLite cache to match
 * 
 * @param chatId - Chat ID containing the messages
 * @param messageIds - Array of message IDs to mark as delivered
 * @param userId - Current user ID (to avoid marking own messages)
 */
export async function markMessagesAsDelivered(
  chatId: string,
  messageIds: string[],
  userId: string
): Promise<void> {
  try {
    // Update each message in Firestore
    for (const messageId of messageIds) {
      try {
        const messageRef = doc(db, 'chats', chatId, 'messages', messageId);
        
        // Get message to check if it's from current user
        const messageSnap = await getDoc(messageRef);
        if (!messageSnap.exists()) continue;
        
        const messageData = messageSnap.data();
        
        // Don't mark own messages as delivered
        if (messageData.senderId === userId) continue;
        
        // Only update if status is currently 'sent'
        if (messageData.status === 'sent') {
          await updateDoc(messageRef, {
            status: 'delivered',
          });
          
          // Update SQLite cache
          await updateMessageStatusSQLite(messageId, 'delivered');
        }
      } catch (error) {
        console.warn('[MessageService] Failed to mark message as delivered:', messageId, error);
        // Continue with other messages
      }
    }
  } catch (error) {
    console.error('[MessageService] Failed to mark messages as delivered:', error);
    // Don't throw - this is not critical
  }
}

/**
 * Mark messages as read
 * 
 * WHY: When user opens a chat, all unread messages should be marked as 'read'
 * so the sender sees blue double checkmarks.
 * 
 * WHAT:
 * 1. Queries all messages in chat where userId is NOT in readBy array
 * 2. Updates status to 'read'
 * 3. Adds userId to readBy array
 * 4. Updates both Firestore and SQLite
 * 
 * @param chatId - Chat ID containing the messages
 * @param userId - User ID who is reading the messages
 */
export async function markMessagesAsRead(
  chatId: string,
  userId: string
): Promise<void> {
  try {
    // Query messages in this chat
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(50));
    const snapshot = await getDocs(q);
    
    let updatedCount = 0;
    let lastMessageId: string | null = null;
    let lastMessageReadBy: string[] | null = null;
    
    // Update each unread message
    for (const docSnap of snapshot.docs) {
      try {
        const data = docSnap.data();
        const messageId = docSnap.id;
        
        // Skip if current user sent this message
        if (data.senderId === userId) continue;
        
        // Skip if user already read this message
        const readBy = data.readBy || [];
        if (readBy.includes(userId)) continue;
        
        // Add user to readBy array
        const newReadBy = [...readBy, userId];
        
        // Update Firestore
        await updateDoc(doc(db, 'chats', chatId, 'messages', messageId), {
          status: 'read',
          readBy: newReadBy,
        });
        
        // Update SQLite cache
        await updateMessageReadBy(messageId, newReadBy);
        
        // Track the most recent message's readBy (first in desc order)
        if (updatedCount === 0) {
          lastMessageId = messageId;
          lastMessageReadBy = newReadBy;
        }
        
        updatedCount++;
      } catch (error) {
        console.warn('[MessageService] Failed to mark message as read:', docSnap.id, error);
        // Continue with other messages
      }
    }
    
    // Update chat's lastMessage.readBy if we marked the most recent message as read
    // WHY: This keeps the denormalized lastMessage in sync for group chat read receipts
    // WHAT: Updates the readBy array in the chat document's lastMessage field
    if (lastMessageId && lastMessageReadBy) {
      try {
        const chatRef = doc(db, 'chats', chatId);
        const chatSnap = await getDoc(chatRef);
        
        if (chatSnap.exists()) {
          const chatData = chatSnap.data();
          // Only update if this is actually the last message in the chat
          if (chatData.lastMessage?.id === lastMessageId) {
            await updateDoc(chatRef, {
              'lastMessage.readBy': lastMessageReadBy,
            });
          }
        }
      } catch (error) {
        console.warn('[MessageService] Failed to update chat lastMessage.readBy:', error);
        // Don't throw - this is not critical
      }
    }
  } catch (error) {
    console.error('[MessageService] Failed to mark messages as read:', error);
    // Don't throw - this is not critical
  }
}


