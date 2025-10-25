/**
 * User Service
 * 
 * This file handles all Firestore operations related to user documents.
 * It provides functions to create, read, and update user profiles.
 * 
 * WHY: Separating Firestore logic from UI keeps code organized and reusable.
 * WHAT: CRUD operations for /users/{userId} documents in Firestore.
 */

import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { User, SQLiteUser } from '../types';
import { cacheUser } from './sqlite';
import { firestoreUserDataToUser } from '../utils/firestoreConverters';
import { timestampToMillis } from '../utils/dateUtils';

/**
 * Create a new user document in Firestore
 * 
 * WHY: Firebase Auth only stores email/password, we need to store additional
 * user data (display name, photo, bio) in Firestore.
 * 
 * WHAT: Creates a document at /users/{userId} with user profile data.
 * 
 * @param userId - Firebase Auth user ID
 * @param data - User profile data (email, displayName, etc.)
 * @returns Promise that resolves when document is created
 */
export async function createUserDocument(
  userId: string,
  data: {
    email?: string;
    displayName: string;
    photoURL?: string;
    bio?: string;
    isContentCreator?: boolean;
  }
): Promise<void> {
  try {
    await setDoc(doc(db, 'users', userId), {
      id: userId,
      email: data.email || null,
      displayName: data.displayName,
      photoURL: data.photoURL || null,
      bio: data.bio || null,
      isContentCreator: data.isContentCreator ?? true, // Default to true if not specified
      createdAt: serverTimestamp(),
      lastSeen: serverTimestamp(),
      online: true,
    });
  } catch (error) {
    console.error('[UserService] Failed to create user document:', error);
    throw error;
  }
}

/**
 * Get a user document from Firestore by user ID
 * 
 * WHY: We need to fetch user profile data to display in the app.
 * WHAT: Reads the /users/{userId} document from Firestore.
 * 
 * @param userId - Firebase Auth user ID
 * @returns Promise with user data or null if not found
 */
export async function getUserById(userId: string): Promise<User | null> {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    
    if (!userDoc.exists()) {
      return null;
    }
    
    return firestoreUserDataToUser(userDoc.data(), userId);
  } catch (error) {
    console.error('[UserService] Failed to fetch user document:', error);
    throw error;
  }
}

/**
 * Update a user's profile in Firestore
 * 
 * WHY: Users need to be able to update their profile (name, photo, bio).
 * WHAT: Updates specific fields in the /users/{userId} document.
 * 
 * @param userId - Firebase Auth user ID
 * @param updates - Fields to update (displayName, photoURL, bio, etc.)
 * @returns Promise that resolves when update is complete
 */
export async function updateUserProfile(
  userId: string,
  updates: {
    displayName?: string;
    photoURL?: string;
    bio?: string;
    isContentCreator?: boolean;
    online?: boolean;
    lastSeen?: Timestamp;
  }
): Promise<void> {
  try {
    const updateData: any = {};
    if (updates.displayName !== undefined) updateData.displayName = updates.displayName;
    if (updates.photoURL !== undefined) updateData.photoURL = updates.photoURL;
    if (updates.bio !== undefined) updateData.bio = updates.bio;
    if (updates.isContentCreator !== undefined) updateData.isContentCreator = updates.isContentCreator;
    if (updates.online !== undefined) updateData.online = updates.online;
    if (updates.lastSeen !== undefined) updateData.lastSeen = updates.lastSeen;
    
    await updateDoc(doc(db, 'users', userId), updateData);
  } catch (error) {
    console.error('[UserService] Failed to update user profile:', error);
    throw error;
  }
}

/**
 * Update user's online status and last seen timestamp
 * 
 * WHY: We track when users are online for presence indicators.
 * WHAT: Updates the online and lastSeen fields in Firestore.
 * 
 * @param userId - Firebase Auth user ID
 * @param online - Whether the user is currently online
 * @returns Promise that resolves when update is complete
 */
/**
 * @deprecated Use updatePresence from presenceService instead
 * This function is maintained for backward compatibility but will be removed in future versions
 */
export async function updateUserPresence(userId: string, online: boolean): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', userId), {
      online,
      lastSeen: serverTimestamp(),
    });
  } catch (error) {
    console.error('[UserService] Failed to update user presence:', error);
    throw error;
  }
}

/**
 * Get all users from Firestore
 * 
 * WHY: Contact picker needs to show all available users for starting new chats
 * WHAT: Fetches all user documents from Firestore and caches them in SQLite
 * 
 * @returns Promise with array of all users
 */
export async function getAllUsers(): Promise<User[]> {
  try {
    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);
    
    const users: User[] = snapshot.docs.map((doc) => 
      firestoreUserDataToUser(doc.data(), doc.id)
    );
    
    for (const user of users) {
      const sqliteUser: SQLiteUser = {
        id: user.id,
        displayName: user.displayName,
        photoURL: user.photoURL,
        lastSeen: timestampToMillis(user.lastSeen),
        online: user.online ? 1 : 0,
      };
      await cacheUser(sqliteUser);
    }
    
    return users;
  } catch (error) {
    console.error('[UserService] Failed to fetch all users:', error);
    throw error;
  }
}

