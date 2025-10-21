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
        createdAt INTEGER NOT NULL
      );
    `);
    console.log('[SQLite] Chats table created');
    
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
 * Insert a message into SQLite
 * 
 * WHY: Called when sending a message (optimistic UI) or receiving one
 * WHAT: Adds a new row to the messages table
 * 
 * @param message - The message to insert
 */
export async function insertMessage(message: SQLiteMessage): Promise<void> {
  const database = getDatabase();
  
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
    console.error('[SQLite] Insert message failed:', error);
    throw error;
  }
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
  const database = getDatabase();
  
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
    console.error('[SQLite] Get messages failed:', error);
    return [];
  }
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
  const database = getDatabase();
  
  try {
    const result = await database.getAllAsync<SQLiteChat>(
      `SELECT * FROM chats 
       ORDER BY updatedAt DESC`
    );
    
    console.log(`[SQLite] Retrieved ${result.length} chats`);
    return result;
  } catch (error) {
    console.error('[SQLite] Get chats failed:', error);
    return [];
  }
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
  const database = getDatabase();
  
  try {
    await database.runAsync(
      `INSERT OR REPLACE INTO chats 
       (id, type, participants, name, photoURL, lastMessage, updatedAt, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        chat.id,
        chat.type,
        chat.participants,
        chat.name || null,
        chat.photoURL || null,
        chat.lastMessage || null,
        chat.updatedAt,
        chat.createdAt,
      ]
    );
    console.log('[SQLite] Chat upserted:', chat.id);
  } catch (error) {
    console.error('[SQLite] Upsert chat failed:', error);
    throw error;
  }
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
  const database = getDatabase();
  
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
    console.error('[SQLite] Cache user failed:', error);
    throw error;
  }
}

/**
 * Get a cached user by ID
 * 
 * @param userId - The user ID to look up
 * @returns The cached user data, or null if not found
 */
export async function getCachedUser(userId: string): Promise<SQLiteUser | null> {
  const database = getDatabase();
  
  try {
    const result = await database.getFirstAsync<SQLiteUser>(
      `SELECT * FROM users WHERE id = ?`,
      [userId]
    );
    return result || null;
  } catch (error) {
    console.error('[SQLite] Get cached user failed:', error);
    return null;
  }
}

/**
 * Clear all data from the database
 * 
 * WHY: Useful for logout or testing
 * WHAT: Deletes all rows from all tables
 */
export async function clearDatabase(): Promise<void> {
  const database = getDatabase();
  
  try {
    await database.execAsync(`
      DELETE FROM messages;
      DELETE FROM chats;
      DELETE FROM users;
    `);
    console.log('[SQLite] Database cleared');
  } catch (error) {
    console.error('[SQLite] Clear database failed:', error);
    throw error;
  }
}

