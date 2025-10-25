/**
 * Firestore Data Converters
 * 
 * Centralized functions for converting Firestore documents to typed objects.
 * 
 * WHY: Firestore data mapping was duplicated across multiple files
 * WHAT: Reusable converter functions for Chat and User types
 */

import { DocumentSnapshot, Timestamp } from 'firebase/firestore';
import { Chat, User } from '../types';

/**
 * Convert Firestore chat document to Chat object
 * 
 * WHY: Chat data structure conversion is needed in multiple places
 * WHAT: Maps Firestore document data to Chat type with proper typing
 * 
 * @param doc - Firestore document snapshot
 * @param currentUserId - Current user's ID for calculating unread count
 * @returns Chat object with proper types
 */
export function firestoreToChat(doc: DocumentSnapshot, currentUserId: string): Chat {
  const data = doc.data();
  if (!data) {
    throw new Error('Document data is undefined');
  }

  const unreadCounts = data.unreadCounts || {};
  const unreadCount = unreadCounts[currentUserId] || 0;

  return {
    id: doc.id,
    type: data.type,
    participants: data.participants,
    name: data.name,
    photoURL: data.photoURL,
    admins: data.admins,
    lastMessage: data.lastMessage,
    updatedAt: data.updatedAt as Timestamp,
    createdBy: data.createdBy,
    createdAt: data.createdAt as Timestamp,
    unreadCount,
    unreadCounts: data.unreadCounts,
  } as Chat;
}

/**
 * Convert Firestore chat data (not document) to Chat object
 * 
 * WHY: Sometimes we have the data object directly without the document wrapper
 * WHAT: Maps raw Firestore data to Chat type
 * 
 * @param data - Raw Firestore data
 * @param docId - Document ID
 * @param currentUserId - Current user's ID for calculating unread count
 * @returns Chat object with proper types
 */
export function firestoreChatDataToChat(data: any, docId: string, currentUserId: string): Chat {
  const unreadCounts = data.unreadCounts || {};
  const unreadCount = unreadCounts[currentUserId] || 0;

  return {
    id: docId,
    type: data.type,
    participants: data.participants,
    name: data.name,
    photoURL: data.photoURL,
    admins: data.admins,
    lastMessage: data.lastMessage,
    updatedAt: data.updatedAt as Timestamp,
    createdBy: data.createdBy,
    createdAt: data.createdAt as Timestamp,
    unreadCount,
    unreadCounts: data.unreadCounts,
  } as Chat;
}

/**
 * Convert Firestore user document to User object
 * 
 * WHY: User data mapping was duplicated in multiple services
 * WHAT: Maps Firestore document data to User type with proper typing
 * 
 * @param doc - Firestore document snapshot
 * @returns User object with proper types
 */
export function firestoreToUser(doc: DocumentSnapshot): User {
  const data = doc.data();
  if (!data) {
    throw new Error('User document data is undefined');
  }

  return {
    id: data.id || doc.id,
    email: data.email,
    phone: data.phone,
    displayName: data.displayName,
    photoURL: data.photoURL,
    bio: data.bio,
    isContentCreator: data.isContentCreator ?? true, // Default to true for existing users
    createdAt: data.createdAt as Timestamp,
    lastSeen: data.lastSeen as Timestamp,
    online: data.online,
  };
}

/**
 * Convert Firestore user data (not document) to User object
 * 
 * WHY: Sometimes we have the data object directly without the document wrapper
 * WHAT: Maps raw Firestore data to User type
 * 
 * @param data - Raw Firestore data
 * @param docId - Document ID (optional, uses data.id if not provided)
 * @returns User object with proper types
 */
export function firestoreUserDataToUser(data: any, docId?: string): User {
  return {
    id: data.id || docId || '',
    email: data.email,
    phone: data.phone,
    displayName: data.displayName,
    photoURL: data.photoURL,
    bio: data.bio,
    isContentCreator: data.isContentCreator ?? true, // Default to true for existing users
    createdAt: data.createdAt as Timestamp,
    lastSeen: data.lastSeen as Timestamp,
    online: data.online,
  };
}

