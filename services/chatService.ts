/**
 * Chat Service
 * 
 * This service manages chat creation and retrieval for both Firestore and SQLite.
 * It handles 1:1 chats (group chats will be added in Epic 2.7).
 * 
 * WHY: Centralized chat management ensures consistency between local and remote data
 * WHAT: Functions to create, retrieve, and update chats in both databases
 */

import { 
  collection, 
  doc, 
  getDoc, 
  getDocs,
  setDoc, 
  updateDoc,
  query,
  where,
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { db } from './firebase';
import { upsertChat, getDatabase } from './sqlite';
import { Chat, SQLiteChat } from '../types';

/**
 * Generate a deterministic chat ID for 1:1 chats
 * 
 * WHY: For 1:1 chats, we want the same chat ID regardless of who initiates.
 * This prevents duplicate chats between the same two users.
 * 
 * WHAT: Sorts user IDs alphabetically and joins them with underscore.
 * Example: createOrGetChat('user1', 'user2') and createOrGetChat('user2', 'user1')
 * both return chat ID 'user1_user2'
 * 
 * @param userId1 - First user ID
 * @param userId2 - Second user ID
 * @returns Deterministic chat ID
 */
function generateChatId(userId1: string, userId2: string): string {
  // Sort alphabetically to ensure consistent ID regardless of order
  const sortedIds = [userId1, userId2].sort();
  return `${sortedIds[0]}_${sortedIds[1]}`;
}

/**
 * Create or get existing 1:1 chat between two users
 * 
 * WHY: Before sending messages, we need a chat to exist. This function ensures
 * we don't create duplicate chats between the same two users.
 * 
 * WHAT: 
 * - Generates deterministic chat ID
 * - Checks if chat exists in Firestore
 * - If not, creates new chat document
 * - Caches chat in SQLite
 * - Returns chat object
 * 
 * @param userId1 - First user ID (typically current user)
 * @param userId2 - Second user ID (the other participant)
 * @returns Chat object
 */
export async function createOrGetChat(userId1: string, userId2: string): Promise<Chat> {
  try {
    console.log('[ChatService] Creating or getting chat between:', userId1, userId2);
    
    // Generate deterministic chat ID
    const chatId = generateChatId(userId1, userId2);
    console.log('[ChatService] Chat ID:', chatId);
    
    // Check if chat already exists in Firestore
    const chatRef = doc(db, 'chats', chatId);
    const chatSnap = await getDoc(chatRef);
    
    if (chatSnap.exists()) {
      // Chat exists, return it
      console.log('[ChatService] Chat already exists');
      const chatData = chatSnap.data() as Chat;
      
      // Cache in SQLite
      await cacheChatInSQLite(chatData);
      
      return chatData;
    }
    
    // Chat doesn't exist, create new one
    console.log('[ChatService] Creating new chat');
    const newChat: Chat = {
      id: chatId,
      type: '1:1',
      participants: [userId1, userId2],
      updatedAt: Timestamp.now(),
      createdAt: Timestamp.now(),
      createdBy: userId1,
    };
    
    // Write to Firestore
    await setDoc(chatRef, {
      ...newChat,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    });
    
    console.log('[ChatService] Chat created successfully');
    
    // Cache in SQLite
    await cacheChatInSQLite(newChat);
    
    return newChat;
  } catch (error) {
    console.error('[ChatService] Failed to create/get chat:', error);
    throw error;
  }
}

/**
 * Get chat by ID from Firestore
 * 
 * WHY: When navigating to a chat screen, we need to load the chat metadata
 * WHAT: Fetches chat document from Firestore and caches in SQLite
 * 
 * @param chatId - Chat ID to retrieve
 * @returns Chat object or null if not found
 */
export async function getChatById(chatId: string): Promise<Chat | null> {
  try {
    console.log('[ChatService] Getting chat by ID:', chatId);
    
    const chatRef = doc(db, 'chats', chatId);
    const chatSnap = await getDoc(chatRef);
    
    if (!chatSnap.exists()) {
      console.log('[ChatService] Chat not found');
      return null;
    }
    
    const chatData = chatSnap.data() as Chat;
    
    // Cache in SQLite
    await cacheChatInSQLite(chatData);
    
    return chatData;
  } catch (error) {
    console.error('[ChatService] Failed to get chat:', error);
    throw error;
  }
}

/**
 * Update chat's last message
 * 
 * WHY: Chat list shows preview of last message. We update this every time
 * a new message is sent so the chat list stays current.
 * 
 * WHAT: Updates lastMessage and updatedAt fields in Firestore and SQLite
 * 
 * @param chatId - Chat ID to update
 * @param lastMessageText - Text of the last message
 * @param senderId - ID of user who sent the message
 */
export async function updateChatLastMessage(
  chatId: string,
  lastMessageText: string,
  senderId: string
): Promise<void> {
  try {
    console.log('[ChatService] Updating last message for chat:', chatId);
    
    const chatRef = doc(db, 'chats', chatId);
    
    // Update in Firestore
    await updateDoc(chatRef, {
      lastMessage: {
        text: lastMessageText,
        senderId,
        timestamp: serverTimestamp(),
      },
      updatedAt: serverTimestamp(),
    });
    
    console.log('[ChatService] Last message updated successfully');
    
    // Update in SQLite (will be implemented when we add chat list in Epic 2.3)
    // For now, we just update Firestore
  } catch (error) {
    console.error('[ChatService] Failed to update last message:', error);
    throw error;
  }
}

/**
 * Cache chat in SQLite for offline access
 * 
 * WHY: We want chats to be viewable even when offline
 * WHAT: Converts Firestore Chat to SQLite format and saves locally
 * 
 * @param chat - Chat object from Firestore
 */
async function cacheChatInSQLite(chat: Chat): Promise<void> {
  try {
    // Convert Firestore Timestamp to Unix milliseconds for SQLite
    const sqliteChat: SQLiteChat = {
      id: chat.id,
      type: chat.type,
      participants: JSON.stringify(chat.participants), // SQLite doesn't support arrays, so we stringify
      name: chat.name,
      photoURL: chat.photoURL,
      lastMessage: chat.lastMessage ? JSON.stringify(chat.lastMessage) : undefined,
      updatedAt: chat.updatedAt instanceof Timestamp ? chat.updatedAt.toMillis() : Date.now(),
      createdAt: chat.createdAt instanceof Timestamp ? chat.createdAt.toMillis() : Date.now(),
    };
    
    await upsertChat(sqliteChat);
    console.log('[ChatService] Chat cached in SQLite');
  } catch (error) {
    console.warn('[ChatService] Failed to cache chat in SQLite:', error);
    // Don't throw - caching failure shouldn't break the chat creation
    // App will work with Firestore-only mode
  }
}

/**
 * Find user by email
 * 
 * WHY: For the temporary "Create Test Chat" feature, we need to look up
 * users by email before creating a chat with them.
 * 
 * WHAT: Queries Firestore /users collection for a user with matching email
 * 
 * NOTE: This is a temporary helper for testing. In Epic 2.10, we'll implement
 * proper contact discovery.
 * 
 * @param email - Email address to search for
 * @returns User ID if found, null otherwise
 */
export async function findUserByEmail(email: string): Promise<string | null> {
  try {
    console.log('[ChatService] Finding user by email:', email);
    
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', email.toLowerCase().trim()));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      console.log('[ChatService] No user found with email:', email);
      return null;
    }
    
    // Return the first matching user's ID
    const userId = snapshot.docs[0].id;
    console.log('[ChatService] Found user:', userId);
    return userId;
  } catch (error) {
    console.error('[ChatService] Failed to find user by email:', error);
    throw error;
  }
}


