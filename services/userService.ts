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
  }
): Promise<void> {
  try {
    console.log('[UserService] Creating user document:', userId);
    
    // Create user document in Firestore
    // WHY: We use setDoc (not addDoc) because we want to use the Auth UID as the document ID
    await setDoc(doc(db, 'users', userId), {
      id: userId,
      email: data.email || null,
      displayName: data.displayName,
      photoURL: data.photoURL || null,
      bio: data.bio || null,
      createdAt: serverTimestamp(), // Server timestamp ensures consistency
      lastSeen: serverTimestamp(),
      online: true, // User just signed up, they're online
    });
    
    console.log('[UserService] User document created successfully');
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
    console.log('[UserService] Fetching user document:', userId);
    
    const userDoc = await getDoc(doc(db, 'users', userId));
    
    if (!userDoc.exists()) {
      console.log('[UserService] User document not found');
      return null;
    }
    
    const data = userDoc.data();
    console.log('[UserService] User document fetched successfully');
    
    // Convert Firestore data to User type
    return {
      id: data.id,
      email: data.email,
      phone: data.phone,
      displayName: data.displayName,
      photoURL: data.photoURL,
      bio: data.bio,
      createdAt: data.createdAt as Timestamp,
      lastSeen: data.lastSeen as Timestamp,
      online: data.online,
    };
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
    online?: boolean;
    lastSeen?: Timestamp;
  }
): Promise<void> {
  try {
    console.log('[UserService] Updating user profile:', userId);
    
    // Only update fields that are provided
    const updateData: any = {};
    if (updates.displayName !== undefined) updateData.displayName = updates.displayName;
    if (updates.photoURL !== undefined) updateData.photoURL = updates.photoURL;
    if (updates.bio !== undefined) updateData.bio = updates.bio;
    if (updates.online !== undefined) updateData.online = updates.online;
    if (updates.lastSeen !== undefined) updateData.lastSeen = updates.lastSeen;
    
    await updateDoc(doc(db, 'users', userId), updateData);
    
    console.log('[UserService] User profile updated successfully');
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
export async function updateUserPresence(userId: string, online: boolean): Promise<void> {
  try {
    console.log('[UserService] Updating user presence:', userId, online);
    
    await updateDoc(doc(db, 'users', userId), {
      online,
      lastSeen: serverTimestamp(),
    });
    
    console.log('[UserService] User presence updated successfully');
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
    console.log('[UserService] Fetching all users');
    
    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);
    
    const users: User[] = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        email: data.email,
        phone: data.phone,
        displayName: data.displayName,
        photoURL: data.photoURL,
        bio: data.bio,
        createdAt: data.createdAt as Timestamp,
        lastSeen: data.lastSeen as Timestamp,
        online: data.online,
      } as User;
    });
    
    console.log(`[UserService] Fetched ${users.length} users`);
    
    // Cache all users in SQLite for offline access
    for (const user of users) {
      const sqliteUser: SQLiteUser = {
        id: user.id,
        displayName: user.displayName,
        photoURL: user.photoURL,
        lastSeen: user.lastSeen instanceof Timestamp ? user.lastSeen.toMillis() : Date.now(),
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

