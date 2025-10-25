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
  isContentCreator?: boolean;    // Whether user is a content creator (has access to AI features)
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
    readBy?: string[];           // User IDs who have read this message (for group chat read receipts)
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
  // AI-powered fields
  aiCategory?: 'fan' | 'business' | 'spam' | 'urgent';  // AI categorization
  aiSentiment?: 'positive' | 'neutral' | 'negative';    // AI sentiment analysis
  aiUrgency?: number;            // AI urgency score (1-5)
  aiCollaborationScore?: number; // AI collaboration potential (1-10)
  matchedFAQId?: string;         // Matched FAQ ID (if applicable)
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

/**
 * FAQ (Frequently Asked Question)
 * Stored in Firestore at /users/{userId}/faqs/{faqId}
 */
export interface FAQ {
  id: string;                    // Unique FAQ ID
  question: string;              // The question to match
  answer: string;                // The answer to send
  usageCount: number;            // How many times this FAQ was used
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Agent Settings
 * Stored in Firestore at /users/{userId}/agentSettings/config
 */
export interface AgentSettings {
  agentEnabled: boolean;         // Whether agent is enabled
  autoRespondFans: boolean;      // Auto-respond to fan messages
  autoRespondFAQs: boolean;      // Auto-respond to FAQ matches
  autoArchiveSpam: boolean;      // Auto-archive spam messages
  updatedAt: Timestamp;
}

/**
 * Agent Log
 * Stored in Firestore at /users/{userId}/agentLogs/{logId}
 */
export interface AgentLog {
  id: string;                    // Unique log ID
  action: 'categorize' | 'respond' | 'archive' | 'flag';  // Action taken
  messageId: string;             // Message that triggered action
  chatId: string;                // Chat the message belongs to
  result: string;                // Result description
  timestamp: Timestamp;
}

/**
 * Message Embedding for RAG
 * Stored in Firestore at /users/{userId}/messageEmbeddings/{messageId}
 */
export interface MessageEmbedding {
  messageId: string;             // Original message ID
  embedding: number[];           // Vector embedding from OpenAI
  textSnippet: string;           // First 100 chars of message for reference
  timestamp: Timestamp;
  chatId: string;                // Chat the message belongs to
}

/**
 * Suggested Action (from AI Agent)
 * Stored in Firestore at /users/{userId}/suggestedActions/{actionId}
 */
export interface SuggestedAction {
  id: string;                    // Unique action ID
  type: 'respond' | 'archive' | 'flag';  // Type of suggested action
  messageId: string;             // Message that triggered suggestion
  chatId: string;                // Chat the message belongs to
  senderId: string;              // User who sent the message
  senderName?: string;           // Sender's display name
  senderPhotoURL?: string;       // Sender's profile photo
  messageText?: string;          // Original message text (for context)
  messageTimestamp?: Timestamp;  // When the original message was sent
  suggestedText?: string;        // Suggested response text (for 'respond' type)
  reasoning: string;             // AI's reasoning for this suggestion
  status: 'pending' | 'approved' | 'rejected';  // Action status
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * AI Chat Message
 * Stored in Firestore at /users/{userId}/aiChatHistory/{messageId}
 */
export interface AIChatMessage {
  id: string;                    // Unique message ID
  role: 'user' | 'assistant';    // Who sent the message
  content: string;               // Message text
  timestamp: Timestamp;
}

