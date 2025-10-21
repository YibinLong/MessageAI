// TypeScript type definitions for MessageAI

import { Timestamp } from 'firebase/firestore';

/**
 * User represents a registered user in the app
 * Stored in Firestore at /users/{userId}
 */
export interface User {
  id: string;                    // Firebase Auth UID
  email?: string;                // User's email address
  phone?: string;                // User's phone number
  displayName: string;           // Display name shown in chats
  photoURL?: string;             // Profile picture URL from Firebase Storage
  bio?: string;                  // User bio/status message
  createdAt: Timestamp;          // Account creation timestamp
  lastSeen: Timestamp;           // Last activity timestamp
  online: boolean;               // Current online status
}

/**
 * Chat represents a conversation (1:1 or group)
 * Stored in Firestore at /chats/{chatId}
 */
export interface Chat {
  id: string;                    // Unique chat ID
  type: '1:1' | 'group';         // Chat type
  participants: string[];        // Array of user IDs
  name?: string;                 // Group name (only for groups)
  photoURL?: string;             // Group photo (only for groups)
  admins?: string[];             // Admin user IDs (only for groups)
  lastMessage?: {
    text: string;
    senderId: string;
    timestamp: Timestamp;
  };
  updatedAt: Timestamp;          // Last message timestamp (for sorting)
  createdBy: string;             // User who created the chat
  createdAt: Timestamp;
  unreadCount?: number;          // Number of unread messages for current user (client-side only)
  unreadCounts?: {[userId: string]: number}; // Unread counts per user (Firestore only)
}

/**
 * Message represents a single message in a chat
 * Stored in Firestore at /chats/{chatId}/messages/{messageId}
 * Also stored in SQLite for offline access
 */
export interface Message {
  id: string;                    // Unique message ID
  chatId: string;                // Parent chat ID
  senderId: string;              // User who sent the message
  text: string;                  // Message content
  timestamp: Timestamp;          // When message was sent
  status: 'sending' | 'sent' | 'delivered' | 'read';  // Message delivery status
  readBy: string[];              // User IDs who have read this message
  type: 'text' | 'image';        // Message type
  mediaURL?: string;             // Firebase Storage URL (for images)
  mediaPath?: string;            // Storage path (for deletion)
}

/**
 * SQLite message type (timestamp as number instead of Firestore Timestamp)
 */
export interface SQLiteMessage {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  timestamp: number;             // Unix timestamp in milliseconds
  status: string;
  readBy: string;                // JSON stringified array
  type: string;
  mediaURL?: string;
  synced: number;                // 0 = not synced, 1 = synced
}

/**
 * SQLite chat type
 */
export interface SQLiteChat {
  id: string;
  type: string;
  participants: string;          // JSON stringified array
  name?: string;
  photoURL?: string;
  lastMessage?: string;          // JSON stringified object
  updatedAt: number;             // Unix timestamp
  createdAt: number;
  unreadCount?: number;          // Number of unread messages for current user
}

/**
 * SQLite user cache type
 */
export interface SQLiteUser {
  id: string;
  displayName: string;
  photoURL?: string;
  lastSeen: number;              // Unix timestamp
  online: number;                // 0 = offline, 1 = online
}

/**
 * Typing indicator
 * Stored in Firestore at /chats/{chatId}/typing/{userId}
 */
export interface TypingIndicator {
  userId: string;
  isTyping: boolean;
  timestamp: Timestamp;
}

/**
 * Device token for push notifications
 * Stored in Firestore at /users/{userId}/tokens/{tokenId}
 */
export interface DeviceToken {
  token: string;
  platform: 'android' | 'ios';
  createdAt: Timestamp;
  lastUsed: Timestamp;
}

