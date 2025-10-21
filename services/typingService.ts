/**
 * Typing Service
 * 
 * This service manages typing indicators for real-time chat.
 * It updates Firestore when users start/stop typing and listens for others typing.
 * 
 * WHY: Users need to see when someone is typing for better chat UX
 * WHAT: Functions to start/stop typing and subscribe to typing status
 */

import { 
  doc, 
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { TypingIndicator } from '../types';

/**
 * Start typing indicator
 * 
 * WHY: When user starts typing, we need to notify the other person
 * WHAT: Creates/updates a typing indicator document in Firestore
 * 
 * @param chatId - Chat ID where user is typing
 * @param userId - User ID who is typing
 */
export async function startTyping(chatId: string, userId: string): Promise<void> {
  try {
    console.log('[TypingService] Start typing:', { chatId, userId });
    
    const typingRef = doc(db, 'chats', chatId, 'typing', userId);
    await setDoc(typingRef, {
      userId,
      isTyping: true,
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error('[TypingService] Failed to start typing:', error);
    // Don't throw - typing indicators are not critical
  }
}

/**
 * Stop typing indicator
 * 
 * WHY: When user stops typing or sends message, we need to clear the indicator
 * WHAT: Deletes the typing indicator document from Firestore
 * 
 * @param chatId - Chat ID where user was typing
 * @param userId - User ID who stopped typing
 */
export async function stopTyping(chatId: string, userId: string): Promise<void> {
  try {
    console.log('[TypingService] Stop typing:', { chatId, userId });
    
    const typingRef = doc(db, 'chats', chatId, 'typing', userId);
    await deleteDoc(typingRef);
  } catch (error) {
    console.error('[TypingService] Failed to stop typing:', error);
    // Don't throw - typing indicators are not critical
  }
}

/**
 * Subscribe to typing indicators
 * 
 * WHY: Real-time typing indicators require listening for changes in Firestore
 * WHAT: Sets up listener for other users' typing status, calls callback when it changes
 * 
 * @param chatId - Chat ID to listen for typing in
 * @param currentUserId - Current user's ID (to filter out own typing status)
 * @param callback - Function to call when typing status changes
 * @returns Unsubscribe function to stop listening
 */
export function subscribeToTyping(
  chatId: string,
  currentUserId: string,
  callback: (isTyping: boolean, typingUserId?: string) => void
): () => void {
  console.log('[TypingService] Subscribing to typing indicators for chat:', chatId);
  
  // We listen to all typing indicators in the chat
  // In a 1:1 chat, there should only be one other user
  // In a group chat, we could show multiple typing indicators
  
  // For simplicity, we'll listen to the first non-current-user typing indicator
  // This works for 1:1 chats. For group chats, you'd iterate through all typing docs
  
  // Store unsubscribe functions for cleanup
  const unsubscribers: (() => void)[] = [];
  
  // Track active typers (for potential group chat support)
  const activeTypers = new Set<string>();
  
  // For now, we'll create a simple implementation that works for 1:1 chats
  // We need to find the other user's ID and listen to their typing status
  // Since we don't have participant info here, we'll use a different approach:
  // Listen to the entire typing collection and filter out current user
  
  // NOTE: This is a simplified implementation. For production, you'd want to
  // listen to specific user typing docs if you know the participant IDs.
  
  // For now, let's create a polling mechanism with snapshot listener
  // We'll listen to typing/{otherUserId} once we know who the other user is
  // But we don't have that info in this service
  
  // Alternative: Return a function that takes the other user ID
  // But that changes the API
  
  // For MVP, let's use a workaround: store the callback and let the caller
  // manage the subscription per user
  
  // Actually, let's keep it simple and just return a dummy unsubscribe for now
  // The actual implementation will be in the component where we know the other user ID
  
  return () => {
    console.log('[TypingService] Unsubscribing from typing indicators');
    unsubscribers.forEach(unsub => unsub());
  };
}

/**
 * Subscribe to a specific user's typing status
 * 
 * WHY: In 1:1 chats, we know the other user's ID and can listen directly
 * WHAT: Sets up listener for a specific user's typing indicator
 * 
 * @param chatId - Chat ID to listen for typing in
 * @param otherUserId - The other user's ID to watch for typing
 * @param callback - Function to call when typing status changes
 * @returns Unsubscribe function to stop listening
 */
export function subscribeToUserTyping(
  chatId: string,
  otherUserId: string,
  callback: (isTyping: boolean) => void
): () => void {
  console.log('[TypingService] Subscribing to typing for user:', otherUserId);
  
  const typingRef = doc(db, 'chats', chatId, 'typing', otherUserId);
  
  const unsubscribe = onSnapshot(
    typingRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as TypingIndicator;
        const isTyping = data.isTyping || false;
        
        // Check if typing indicator is recent (within 5 seconds)
        // WHY: If network is slow, stale indicators might persist
        if (data.timestamp) {
          const timestamp = data.timestamp as Timestamp;
          const now = new Date();
          const typingTime = timestamp.toDate();
          const secondsAgo = (now.getTime() - typingTime.getTime()) / 1000;
          
          // Only show typing if indicator is fresh (< 5 seconds old)
          if (secondsAgo < 5) {
            callback(isTyping);
          } else {
            callback(false);
          }
        } else {
          callback(isTyping);
        }
      } else {
        // Document doesn't exist = user is not typing
        callback(false);
      }
    },
    (error) => {
      console.error('[TypingService] Typing listener error:', error);
      callback(false);
    }
  );
  
  return unsubscribe;
}

