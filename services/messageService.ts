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
  updateMessageStatus as updateMessageStatusSQLite
} from './sqlite';
import { updateChatLastMessage } from './chatService';
import { Message, SQLiteMessage } from '../types';

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
  
  console.log('[MessageService] Sending message:', { chatId, messageId, text: text.substring(0, 50) });
  
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
      console.log('[MessageService] Message saved to SQLite (optimistic)');
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
      
      console.log('[MessageService] Message uploaded to Firestore');
      
      // Update to 'sent' after successful upload
      await updateDoc(messageRef, { status: 'sent' });
      console.log('[MessageService] Message status updated to sent');
      
      // 3. Update status to 'sent' in SQLite
      try {
        await updateMessageStatusSQLite(messageId, 'sent');
      } catch (sqliteError) {
        console.warn('[MessageService] SQLite status update failed:', sqliteError);
      }
      
      // 4. Update chat's last message
      await updateChatLastMessage(chatId, text, senderId);
      
      console.log('[MessageService] Message sent successfully');
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
  console.log('[MessageService] Subscribing to messages for chat:', chatId);
  
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
      console.log('[MessageService] Received snapshot with', snapshot.docs.length, 'messages');
      
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
 * Update message status
 * 
 * WHY: As messages progress through sending → sent → delivered → read,
 * we need to update their status in the local database.
 * 
 * WHAT: Wrapper for SQLite updateMessageStatus - exported for external use
 * 
 * @param messageId - Message ID to update
 * @param status - New status value
 */
export async function updateMessageStatus(
  messageId: string,
  status: 'sending' | 'sent' | 'delivered' | 'read'
): Promise<void> {
  // Delegate to SQLite function which uses the operation queue
  await updateMessageStatusSQLite(messageId, status);
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
    console.log('[MessageService] Retrying unsent messages', chatId ? `for chat ${chatId}` : '');
    
    // Query messages with status 'sending' using the queued operation
    const unsentMessages = await getMessagesByStatus('sending', chatId);
    
    console.log('[MessageService] Found', unsentMessages.length, 'unsent messages');
    
    let successCount = 0;
    
    // Retry each message
    for (const sqliteMsg of unsentMessages) {
      try {
        console.log('[MessageService] Retrying message:', sqliteMsg.id);
        
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
        console.log('[MessageService] Retry message status updated to sent');
        
        // Update status to 'sent' in SQLite
        try {
          await updateMessageStatusSQLite(sqliteMsg.id, 'sent');
        } catch (sqliteError) {
          console.warn('[MessageService] SQLite status update failed during retry:', sqliteError);
        }
        
        // Update chat's last message
        await updateChatLastMessage(sqliteMsg.chatId, sqliteMsg.text, sqliteMsg.senderId);
        
        successCount++;
        console.log('[MessageService] Message retry successful:', sqliteMsg.id);
      } catch (error) {
        console.error('[MessageService] Failed to retry message:', sqliteMsg.id, error);
        // Continue with next message even if this one fails
      }
    }
    
    console.log('[MessageService] Retry complete:', successCount, 'of', unsentMessages.length, 'succeeded');
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
    console.log('[MessageService] Loading messages from cache for chat:', chatId);
    
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
    
    console.log('[MessageService] Loaded', messages.length, 'messages from cache');
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
    console.log('[MessageService] Marking chat as read:', { chatId, userId });
    
    // Update Firestore: Set this user's unread count to 0
    // We use a map structure: { unreadCounts: { userId1: 0, userId2: 5 } }
    const chatRef = doc(db, 'chats', chatId);
    await updateDoc(chatRef, {
      [`unreadCounts.${userId}`]: 0,
    });
    
    console.log('[MessageService] Chat marked as read in Firestore');
    
    // Update SQLite cache
    // Note: SQLite stores only the current user's unread count
    const { upsertChat, getAllChats } = await import('./sqlite');
    const sqliteChats = await getAllChats();
    const chat = sqliteChats.find(c => c.id === chatId);
    
    if (chat) {
      chat.unreadCount = 0;
      await upsertChat(chat);
      console.log('[MessageService] Chat marked as read in SQLite');
    }
  } catch (error) {
    console.error('[MessageService] Failed to mark chat as read:', error);
    // Don't throw - this is not critical, chat will still work
  }
}


