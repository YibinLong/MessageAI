/**
 * Presence Service
 * 
 * This service manages user online/offline status using Firebase Realtime Database.
 * It tracks when users are active and updates their presence automatically.
 * 
 * WHY: Firebase Realtime Database is better for presence than Firestore because:
 * - It has built-in .onDisconnect() to auto-set offline when connection drops
 * - Lower latency for real-time status updates
 * - More reliable for connection state management
 * 
 * WHAT: Manages /status/{userId} nodes with online status and lastSeen timestamp
 */

import { ref, set, onValue, onDisconnect, serverTimestamp } from 'firebase/database';
import { realtimeDb } from './firebase';

/**
 * Presence data structure
 */
export interface PresenceData {
  online: boolean;
  lastSeen: number; // Unix timestamp in milliseconds
}

/**
 * Update user's presence status
 * 
 * WHY: Called when user goes online/offline to update their status
 * WHAT: Writes to /status/{userId} in Realtime Database
 * 
 * @param userId - User ID to update presence for
 * @param online - Whether user is online or offline
 */
export async function updatePresence(userId: string, online: boolean): Promise<void> {
  try {
    console.log('[PresenceService] Updating presence:', userId, online ? 'online' : 'offline');
    
    const presenceRef = ref(realtimeDb, `status/${userId}`);
    
    await set(presenceRef, {
      online,
      lastSeen: Date.now(),
    });
    
    console.log('[PresenceService] Presence updated successfully');
  } catch (error) {
    console.error('[PresenceService] Failed to update presence:', error);
    throw error;
  }
}

/**
 * Set up automatic presence tracking for a user
 * 
 * WHY: We want to automatically set user offline when they disconnect,
 * even if the app crashes or they lose internet connection.
 * 
 * WHAT: 
 * - Sets user online
 * - Configures .onDisconnect() to auto-set offline
 * - Returns cleanup function
 * 
 * This is the core presence feature - Firebase automatically sets the user
 * offline if their connection drops, without requiring any code to run.
 * 
 * @param userId - User ID to track presence for
 * @returns Async cleanup function to call on sign out
 */
export async function setupPresenceListener(userId: string): Promise<() => Promise<void>> {
  try {
    console.log('[PresenceService] Setting up presence listener for:', userId);
    
    const presenceRef = ref(realtimeDb, `status/${userId}`);
    
    // Set up onDisconnect handler FIRST (before setting online)
    // WHY: This ensures if we lose connection immediately, we still go offline
    const disconnectRef = onDisconnect(presenceRef);
    await disconnectRef.set({
      online: false,
      lastSeen: serverTimestamp(),
    });
    
    console.log('[PresenceService] onDisconnect handler configured');
    
    // Now set user as online
    await set(presenceRef, {
      online: true,
      lastSeen: Date.now(),
    });
    
    console.log('[PresenceService] User set to online');
    
    // Return cleanup function
    const cleanup = async (): Promise<void> => {
      console.log('[PresenceService] Cleaning up presence for:', userId);
      
      // Cancel onDisconnect (so it doesn't fire after manual sign out)
      await disconnectRef.cancel();
      
      // Set user offline
      await set(presenceRef, {
        online: false,
        lastSeen: Date.now(),
      });
      
      console.log('[PresenceService] Presence cleanup complete');
    };
    
    return cleanup;
  } catch (error) {
    console.error('[PresenceService] Failed to setup presence listener:', error);
    throw error;
  }
}

/**
 * Listen to real-time presence updates for a user
 * 
 * WHY: We need to show online/offline status in the UI and update it in real-time
 * WHAT: Sets up Realtime Database listener for /status/{userId}
 * 
 * @param userId - User ID to listen to
 * @param callback - Called when presence changes
 * @returns Unsubscribe function
 */
export function listenToPresence(
  userId: string,
  callback: (presence: PresenceData | null) => void
): () => void {
  console.log('[PresenceService] Listening to presence for:', userId);
  
  const presenceRef = ref(realtimeDb, `status/${userId}`);
  
  // Set up listener
  const unsubscribe = onValue(
    presenceRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        console.log('[PresenceService] No presence data for user:', userId);
        callback(null);
        return;
      }
      
      const data = snapshot.val();
      const presence: PresenceData = {
        online: data.online || false,
        lastSeen: data.lastSeen || Date.now(),
      };
      
      console.log('[PresenceService] Presence update:', userId, presence.online ? 'online' : 'offline');
      callback(presence);
    },
    (error) => {
      console.error('[PresenceService] Presence listener error:', error);
    }
  );
  
  return unsubscribe;
}

/**
 * Get current presence status for a user (one-time read)
 * 
 * WHY: Sometimes we need to check presence without setting up a listener
 * WHAT: Reads current value from /status/{userId}
 * 
 * @param userId - User ID to get presence for
 * @returns Current presence data or null if not available
 */
export async function getPresence(userId: string): Promise<PresenceData | null> {
  try {
    console.log('[PresenceService] Getting presence for:', userId);
    
    const presenceRef = ref(realtimeDb, `status/${userId}`);
    
    return new Promise((resolve) => {
      onValue(
        presenceRef,
        (snapshot) => {
          if (!snapshot.exists()) {
            resolve(null);
            return;
          }
          
          const data = snapshot.val();
          resolve({
            online: data.online || false,
            lastSeen: data.lastSeen || Date.now(),
          });
        },
        { onlyOnce: true }
      );
    });
  } catch (error) {
    console.error('[PresenceService] Failed to get presence:', error);
    return null;
  }
}

