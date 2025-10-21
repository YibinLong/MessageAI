/**
 * SQLite Database Service
 * 
 * This file manages the local SQLite database for offline message storage.
 * It creates tables and provides functions to read/write data locally.
 * 
 * WHY: SQLite allows the app to work offline and load messages instantly
 * without waiting for network requests. It's the local cache layer.
 */

import * as SQLite from 'expo-sqlite';
import { SQLiteMessage, SQLiteChat, SQLiteUser } from '../types';

/**
 * Database instance
 * 
 * WHAT: Opens (or creates) a database file named 'messageai.db'
 * WHY: This is our local storage that persists even when app is closed
 */
let db: SQLite.SQLiteDatabase | null = null;

/**
 * Operation queue to prevent concurrent SQLite operations
 * 
 * WHY: expo-sqlite has issues with concurrent operations on Android.
 * Running multiple operations at once can cause NullPointerException.
 * 
 * WHAT: Queue that ensures operations run one at a time
 */
let operationQueue: Promise<any> = Promise.resolve();

/**
 * Queue an operation to run sequentially
 * 
 * WHY: Prevents concurrent SQLite operations that cause crashes
 * WHAT: Adds operation to queue, waits for previous operations to finish
 * 
 * @param operation - Async function to execute
 * @returns Promise that resolves with operation result
 */
async function queueOperation<T>(operation: () => Promise<T>): Promise<T> {
  // Create a promise for this specific operation
  const thisOperation = operationQueue.then(
    () => operation(),
    () => operation() // Run even if previous operation failed
  );
  
  // Update the global queue to include this operation
  operationQueue = thisOperation;
  
  // Return the promise for this specific operation
  return thisOperation;
}

/**
 * Initialize the SQLite database
 * 
 * WHAT: 
 * - Opens/creates the database file
 * - Creates tables if they don't exist
 * - Sets up indexes for fast queries
 * 
 * WHY: Must be called when the app starts to ensure database is ready
 * 
 * @returns Promise that resolves when database is initialized
 */
export async function initDatabase(): Promise<void> {
  try {
    console.log('[SQLite] Initializing database...');
    
    // Open database connection
    db = await SQLite.openDatabaseAsync('messageai.db');
    console.log('[SQLite] Database opened');
    
    // Create messages table
    // WHY: Stores all messages locally so they load instantly
    // WHAT: Each row is one message with all its properties
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        chatId TEXT NOT NULL,
        senderId TEXT NOT NULL,
        text TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        status TEXT NOT NULL,
        readBy TEXT,
        type TEXT DEFAULT 'text',
        mediaURL TEXT,
        synced INTEGER DEFAULT 0
      );
    `);
    console.log('[SQLite] Messages table created');
    
    // Create index for fast message queries by chat
    // WHY: Makes loading a chat's messages very fast
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_messages_chatId 
      ON messages(chatId, timestamp DESC);
    `);
    
    // Create chats table
    // WHY: Stores chat metadata (who's in it, last message, etc.)
    // WHAT: Each row is one conversation
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS chats (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        participants TEXT NOT NULL,
        name TEXT,
        photoURL TEXT,
        lastMessage TEXT,
        updatedAt INTEGER NOT NULL,
        createdAt INTEGER NOT NULL,
        unreadCount INTEGER DEFAULT 0
      );
    `);
    console.log('[SQLite] Chats table created');
    
    // Add unreadCount column if it doesn't exist (migration for existing databases)
    // WHY: For users who already have the app, we need to add this column
    try {
      await db.execAsync(`ALTER TABLE chats ADD COLUMN unreadCount INTEGER DEFAULT 0;`);
      console.log('[SQLite] Added unreadCount column to chats table');
    } catch (error) {
      // Column already exists, ignore error
      console.log('[SQLite] unreadCount column already exists (expected for existing DBs)');
    }
    
    // Create index for sorting chats by most recent
    // WHY: Chat list shows most recent conversations first
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_chats_updatedAt 
      ON chats(updatedAt DESC);
    `);
    
    // Create users table (cache of user profiles)
    // WHY: So we can show names/photos even when offline
    // WHAT: Caches user profile data from Firestore
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        displayName TEXT NOT NULL,
        photoURL TEXT,
        lastSeen INTEGER,
        online INTEGER DEFAULT 0
      );
    `);
    console.log('[SQLite] Users table created');
    
    console.log('[SQLite] Database initialized successfully');
  } catch (error) {
    console.error('[SQLite] Initialization failed:', error);
    throw error;
  }
}

/**
 * Get the database instance
 * 
 * WHY: Other parts of the app need access to the database
 * WHAT: Returns the database connection, throws error if not initialized
 */
export function getDatabase(): SQLite.SQLiteDatabase {
  if (!db) {
    throw new Error('[SQLite] Database not initialized. Call initDatabase() first.');
  }
  return db;
}

/**
 * Get the database instance safely (returns null if not initialized)
 * 
 * WHY: Allows graceful degradation when SQLite is unavailable
 * WHAT: Returns database connection or null without throwing
 * 
 * USE THIS for operations that should continue even if SQLite fails
 */
export function getDatabaseSafe(): SQLite.SQLiteDatabase | null {
  if (!db) {
    console.warn('[SQLite] Database not initialized, operations will be skipped');
    return null;
  }
  return db;
}

/**
 * Insert a message into SQLite
 * 
 * WHY: Called when sending a message (optimistic UI) or receiving one
 * WHAT: Adds a new row to the messages table
 * 
 * @param message - The message to insert
 */
export async function insertMessage(message: SQLiteMessage): Promise<void> {
  return queueOperation(async () => {
    const database = getDatabaseSafe();
    if (!database) {
      console.warn('[SQLite] Database unavailable, skipping message insert');
      return;
    }
    
    try {
      await database.runAsync(
        `INSERT OR REPLACE INTO messages 
         (id, chatId, senderId, text, timestamp, status, readBy, type, mediaURL, synced)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          message.id,
          message.chatId,
          message.senderId,
          message.text,
          message.timestamp,
          message.status,
          message.readBy,
          message.type,
          message.mediaURL || null,
          message.synced,
        ]
      );
      console.log('[SQLite] Message inserted:', message.id);
    } catch (error) {
      console.warn('[SQLite] Insert message failed:', error);
      // Don't throw - graceful degradation
    }
  });
}

/**
 * Get messages for a specific chat
 * 
 * WHY: Load chat history from local cache (instant, works offline)
 * WHAT: Queries messages table filtered by chatId, sorted by timestamp
 * 
 * @param chatId - The chat ID to get messages for
 * @param limit - Maximum number of messages to return (for pagination)
 * @returns Array of messages
 */
export async function getMessagesByChat(
  chatId: string,
  limit: number = 50
): Promise<SQLiteMessage[]> {
  return queueOperation(async () => {
    const database = getDatabaseSafe();
    if (!database) {
      console.warn('[SQLite] Database unavailable, returning empty messages');
      return [];
    }
    
    try {
      const result = await database.getAllAsync<SQLiteMessage>(
        `SELECT * FROM messages 
         WHERE chatId = ? 
         ORDER BY timestamp DESC 
         LIMIT ?`,
        [chatId, limit]
      );
      
      console.log(`[SQLite] Retrieved ${result.length} messages for chat ${chatId}`);
      return result;
    } catch (error) {
      console.warn('[SQLite] Get messages failed:', error);
      return [];
    }
  });
}

/**
 * Get all chats, sorted by most recent
 * 
 * WHY: Powers the chat list screen
 * WHAT: Returns all chats ordered by updatedAt (most recent first)
 * 
 * @returns Array of chats
 */
export async function getAllChats(): Promise<SQLiteChat[]> {
  return queueOperation(async () => {
    const database = getDatabaseSafe();
    if (!database) {
      console.warn('[SQLite] Database unavailable, returning empty chats');
      return [];
    }
    
    try {
      const result = await database.getAllAsync<SQLiteChat>(
        `SELECT * FROM chats 
         ORDER BY updatedAt DESC`
      );
      
      console.log(`[SQLite] Retrieved ${result.length} chats`);
      return result;
    } catch (error) {
      console.warn('[SQLite] Get chats failed:', error);
      return [];
    }
  });
}

/**
 * Insert or update a chat
 * 
 * WHY: Keep local chat list in sync with Firestore
 * WHAT: Upserts a chat record
 * 
 * @param chat - The chat to save
 */
export async function upsertChat(chat: SQLiteChat): Promise<void> {
  return queueOperation(async () => {
    const database = getDatabaseSafe();
    if (!database) {
      console.warn('[SQLite] Database unavailable, skipping chat upsert');
      return;
    }
    
    try {
      await database.runAsync(
        `INSERT OR REPLACE INTO chats 
         (id, type, participants, name, photoURL, lastMessage, updatedAt, createdAt, unreadCount)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          chat.id,
          chat.type,
          chat.participants,
          chat.name || null,
          chat.photoURL || null,
          chat.lastMessage || null,
          chat.updatedAt,
          chat.createdAt,
          chat.unreadCount || 0,
        ]
      );
      console.log('[SQLite] Chat upserted:', chat.id);
    } catch (error) {
      console.warn('[SQLite] Upsert chat failed:', error);
      // Don't throw - graceful degradation
    }
  });
}

/**
 * Cache a user profile
 * 
 * WHY: So we can display user names/photos even when offline
 * WHAT: Saves user data to local users table
 * 
 * @param user - The user to cache
 */
export async function cacheUser(user: SQLiteUser): Promise<void> {
  return queueOperation(async () => {
    const database = getDatabaseSafe();
    if (!database) {
      console.warn('[SQLite] Database unavailable, skipping user cache');
      return;
    }
    
    try {
      await database.runAsync(
        `INSERT OR REPLACE INTO users 
         (id, displayName, photoURL, lastSeen, online)
         VALUES (?, ?, ?, ?, ?)`,
        [
          user.id,
          user.displayName,
          user.photoURL || null,
          user.lastSeen,
          user.online,
        ]
      );
      console.log('[SQLite] User cached:', user.id);
    } catch (error) {
      console.warn('[SQLite] Cache user failed:', error);
      // Don't throw - graceful degradation
    }
  });
}

/**
 * Get a cached user by ID
 * 
 * @param userId - The user ID to look up
 * @returns The cached user data, or null if not found
 */
export async function getCachedUser(userId: string): Promise<SQLiteUser | null> {
  return queueOperation(async () => {
    const database = getDatabaseSafe();
    if (!database) {
      console.warn('[SQLite] Database unavailable, returning null for cached user');
      return null;
    }
    
    try {
      const result = await database.getFirstAsync<SQLiteUser>(
        `SELECT * FROM users WHERE id = ?`,
        [userId]
      );
      return result || null;
    } catch (error) {
      console.warn('[SQLite] Get cached user failed:', error);
      return null;
    }
  });
}

/**
 * Update message status
 * 
 * WHY: As messages progress (sending → sent → delivered → read), we update status
 * WHAT: Updates status and synced fields for a specific message
 * 
 * @param messageId - Message ID to update
 * @param status - New status value
 */
export async function updateMessageStatus(
  messageId: string,
  status: 'sending' | 'sent' | 'delivered' | 'read'
): Promise<void> {
  return queueOperation(async () => {
    const database = getDatabaseSafe();
    if (!database) {
      console.warn('[SQLite] Database unavailable, skipping status update');
      return;
    }
    
    try {
      await database.runAsync(
        'UPDATE messages SET status = ?, synced = 1 WHERE id = ?',
        [status, messageId]
      );
      console.log('[SQLite] Message status updated:', messageId, '→', status);
    } catch (error) {
      console.warn('[SQLite] Failed to update message status:', error);
      // Don't throw - graceful degradation
    }
  });
}

/**
 * Get messages with specific status (for offline queue)
 * 
 * WHY: When network reconnects, we need to find messages that failed to send
 * WHAT: Queries messages by status, optionally filtered by chatId
 * 
 * @param status - Status to filter by (e.g., 'sending')
 * @param chatId - Optional: only get messages from this chat
 * @returns Array of messages with the specified status
 */
export async function getMessagesByStatus(
  status: 'sending' | 'sent' | 'delivered' | 'read',
  chatId?: string
): Promise<SQLiteMessage[]> {
  return queueOperation(async () => {
    const database = getDatabaseSafe();
    if (!database) {
      console.warn('[SQLite] Database unavailable, returning empty messages');
      return [];
    }
    
    try {
      const result = chatId
        ? await database.getAllAsync<SQLiteMessage>(
            'SELECT * FROM messages WHERE status = ? AND chatId = ?',
            [status, chatId]
          )
        : await database.getAllAsync<SQLiteMessage>(
            'SELECT * FROM messages WHERE status = ?',
            [status]
          );
      
      console.log(`[SQLite] Retrieved ${result.length} messages with status ${status}`);
      return result;
    } catch (error) {
      console.warn('[SQLite] Get messages by status failed:', error);
      return [];
    }
  });
}

/**
 * Update message readBy array
 * 
 * WHY: When messages are read, we need to update who has read them
 * WHAT: Updates the readBy field with new array of user IDs
 * 
 * @param messageId - Message ID to update
 * @param readBy - Array of user IDs who have read the message
 */
export async function updateMessageReadBy(
  messageId: string,
  readBy: string[]
): Promise<void> {
  return queueOperation(async () => {
    const database = getDatabaseSafe();
    if (!database) {
      console.warn('[SQLite] Database unavailable, skipping readBy update');
      return;
    }
    
    try {
      await database.runAsync(
        'UPDATE messages SET readBy = ?, status = ?, synced = 1 WHERE id = ?',
        [JSON.stringify(readBy), 'read', messageId]
      );
      console.log('[SQLite] Message readBy updated:', messageId);
    } catch (error) {
      console.warn('[SQLite] Failed to update message readBy:', error);
      // Don't throw - graceful degradation
    }
  });
}

/**
 * Clear all data from the database
 * 
 * WHY: Useful for logout or testing
 * WHAT: Deletes all rows from all tables
 */
export async function clearDatabase(): Promise<void> {
  return queueOperation(async () => {
    const database = getDatabaseSafe();
    if (!database) {
      console.warn('[SQLite] Database unavailable, cannot clear');
      return;
    }
    
    try {
      await database.execAsync(`
        DELETE FROM messages;
        DELETE FROM chats;
        DELETE FROM users;
      `);
      console.log('[SQLite] Database cleared');
    } catch (error) {
      console.warn('[SQLite] Clear database failed:', error);
      // Don't throw - graceful degradation
    }
  });
}

