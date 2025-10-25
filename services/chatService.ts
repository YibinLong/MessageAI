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
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  increment
} from 'firebase/firestore';
import { db } from './firebase';
import { upsertChat, getAllChats as getSQLiteChats } from './sqlite';
import { Chat, SQLiteChat } from '../types';
import { firestoreChatDataToChat } from '../utils/firestoreConverters';
import { timestampToMillis } from '../utils/dateUtils';
import uuid from 'react-native-uuid';

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
    const chatId = generateChatId(userId1, userId2);
    const chatRef = doc(db, 'chats', chatId);
    const chatSnap = await getDoc(chatRef);
    
    if (chatSnap.exists()) {
      const chatData = chatSnap.data() as Chat;
      await cacheChatInSQLite(chatData);
      return chatData;
    }
    
    const newChat: Chat = {
      id: chatId,
      type: '1:1',
      participants: [userId1, userId2],
      updatedAt: Timestamp.now(),
      createdAt: Timestamp.now(),
      createdBy: userId1,
    };
    
    await setDoc(chatRef, {
      ...newChat,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    });
    
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
    const chatRef = doc(db, 'chats', chatId);
    const chatSnap = await getDoc(chatRef);
    
    if (!chatSnap.exists()) {
      return null;
    }
    
    const chatData = chatSnap.data() as Chat;
    await cacheChatInSQLite(chatData);
    return chatData;
  } catch (error) {
    console.error('[ChatService] Failed to get chat:', error);
    throw error;
  }
}

/**
 * Update chat's last message and increment unread counts
 * 
 * WHY: Chat list shows preview of last message. We update this every time
 * a new message is sent so the chat list stays current.
 * 
 * WHAT: 
 * - Updates lastMessage and updatedAt fields in Firestore
 * - Increments unread count for all participants except the sender
 * 
 * @param chatId - Chat ID to update
 * @param lastMessageText - Text of the last message
 * @param senderId - ID of user who sent the message
 */
export async function updateChatLastMessage(
  chatId: string,
  lastMessageText: string,
  senderId: string,
  messageId?: string
): Promise<void> {
  try {
    const chatRef = doc(db, 'chats', chatId);
    const chatSnap = await getDoc(chatRef);
    
    if (!chatSnap.exists()) {
      console.error('[ChatService] Chat not found:', chatId);
      return;
    }
    
    const participants = chatSnap.data().participants || [];
    
    const updateData: any = {
      lastMessage: {
        id: messageId || null,
        text: lastMessageText,
        senderId,
        timestamp: serverTimestamp(),
        readBy: [], // Initialize as empty array - will be populated as users read the message
      },
      updatedAt: serverTimestamp(),
    };
    
    participants.forEach((participantId: string) => {
      if (participantId !== senderId) {
        updateData[`unreadCounts.${participantId}`] = increment(1);
      }
    });
    
    await updateDoc(chatRef, updateData);
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
    const sqliteChat: SQLiteChat = {
      id: chat.id,
      type: chat.type,
      participants: JSON.stringify(chat.participants),
      name: chat.name,
      photoURL: chat.photoURL,
      lastMessage: chat.lastMessage ? JSON.stringify(chat.lastMessage) : undefined,
      updatedAt: timestampToMillis(chat.updatedAt),
      createdAt: timestampToMillis(chat.createdAt),
      unreadCount: chat.unreadCount || 0,
    };
    
    await upsertChat(sqliteChat);
  } catch (error) {
    console.warn('[ChatService] Failed to cache chat in SQLite:', error);
  }
}

/**
 * Create a group chat
 * 
 * WHY: Users need to create group chats with multiple participants
 * WHAT: Creates a new chat document with type='group' and specified participants
 * 
 * @param name - Group name
 * @param participants - Array of user IDs (must include creator)
 * @param createdBy - User ID of creator
 * @param photoURL - Optional group photo URL
 * @returns Created chat object
 */
export async function createGroupChat(
  name: string,
  participants: string[],
  createdBy: string,
  photoURL?: string
): Promise<Chat> {
  try {
    const groupId = uuid.v4() as string;
    
    const newChat: Chat = {
      id: groupId,
      type: 'group',
      name,
      ...(photoURL && { photoURL }),
      participants,
      admins: [createdBy],
      updatedAt: Timestamp.now(),
      createdAt: Timestamp.now(),
      createdBy,
    };
    
    const chatRef = doc(db, 'chats', groupId);
    await setDoc(chatRef, {
      ...newChat,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    });
    
    await cacheChatInSQLite(newChat);
    return newChat;
  } catch (error) {
    console.error('[ChatService] Failed to create group chat:', error);
    throw error;
  }
}

/**
 * Update a group chat's photo URL
 * 
 * WHY: After creating a group and uploading its photo with the real group ID,
 * we need to update the chat document with the photo URL.
 * 
 * WHAT: Updates the photoURL field in the group chat document
 * 
 * @param groupId - Group chat ID
 * @param photoURL - Firebase Storage URL of the uploaded photo
 */
export async function updateGroupPhoto(
  groupId: string,
  photoURL: string
): Promise<void> {
  try {
    const chatRef = doc(db, 'chats', groupId);
    await updateDoc(chatRef, {
      photoURL,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('[ChatService] Failed to update group photo:', error);
    throw error;
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
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', email.toLowerCase().trim()));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return null;
    }
    
    return snapshot.docs[0].id;
  } catch (error) {
    console.error('[ChatService] Failed to find user by email:', error);
    throw error;
  }
}

/**
 * Get all chats for a user from Firestore
 * 
 * WHY: Chat list screen needs to display all conversations for the current user
 * WHAT: Queries Firestore for chats where user is a participant, ordered by most recent
 * 
 * @param userId - Current user's ID
 * @returns Array of chats, sorted by updatedAt (most recent first)
 */
export async function getUserChats(userId: string): Promise<Chat[]> {
  try {
    const chatsRef = collection(db, 'chats');
    const q = query(
      chatsRef,
      where('participants', 'array-contains', userId),
      orderBy('updatedAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    const chats: Chat[] = snapshot.docs.map((doc) => 
      firestoreChatDataToChat(doc.data(), doc.id, userId)
    );
    
    for (const chat of chats) {
      await cacheChatInSQLite(chat);
    }
    
    return chats;
  } catch (error) {
    console.error('[ChatService] Failed to get user chats:', error);
    throw error;
  }
}

/**
 * Listen to real-time updates for user's chats
 * 
 * WHY: Chat list should update instantly when new messages arrive or chats are created
 * WHAT: Sets up Firestore onSnapshot listener for chats where user is a participant
 * 
 * @param userId - Current user's ID
 * @param callback - Function called with updated chats array
 * @returns Unsubscribe function to stop listening
 */
export function listenToUserChats(
  userId: string,
  callback: (chats: Chat[]) => void
): () => void {
  const chatsRef = collection(db, 'chats');
  const q = query(
    chatsRef,
    where('participants', 'array-contains', userId),
    orderBy('updatedAt', 'desc')
  );
  
  const unsubscribe = onSnapshot(
    q,
    async (snapshot) => {
      const chats: Chat[] = snapshot.docs.map((doc) => 
        firestoreChatDataToChat(doc.data(), doc.id, userId)
      );
      
      for (const chat of chats) {
        await cacheChatInSQLite(chat);
      }
      
      callback(chats);
    },
    (error) => {
      console.error('[ChatService] Chat listener error:', error);
    }
  );
  
  return unsubscribe;
}


