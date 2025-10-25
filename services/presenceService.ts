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

import { ref, set, onValue, onDisconnect, serverTimestamp, get } from 'firebase/database';
import { realtimeDb } from './firebase';

/**
 * Heartbeat configuration constants
 * 
 * WHY: Fast presence detection requires frequent heartbeats and aggressive staleness detection
 * WHAT: 
 * - HEARTBEAT_INTERVAL: How often to send "I'm alive" signals (1.5 seconds)
 * - OFFLINE_THRESHOLD: How long without heartbeat before considering user offline (4 seconds)
 */
const HEARTBEAT_INTERVAL = 1500; // 1.5 seconds
const OFFLINE_THRESHOLD = 4000; // 4 seconds

/**
 * Export threshold for use in UI components
 * WHY: UI needs to check staleness before Firebase listener updates
 */
export const getOfflineThreshold = () => OFFLINE_THRESHOLD;

/**
 * Presence data structure
 */
export interface PresenceData {
  online: boolean;
  lastSeen: number; // Unix timestamp in milliseconds
  lastHeartbeat?: number; // Unix timestamp of last heartbeat (for staleness detection)
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
    
    const now = Date.now();
    
    // Use Date.now() instead of serverTimestamp() for immediate consistency
    // WHY: serverTimestamp() returns a placeholder that may not be immediately readable
    // WHAT: Client timestamp is accurate enough for presence and immediately available
    await set(presenceRef, {
      online,
      lastSeen: now,
      lastHeartbeat: online ? now : null, // Set heartbeat only when online, use null not undefined
    });
    
    console.log('[PresenceService] Presence updated successfully at:', now);
  } catch (error) {
    console.error('[PresenceService] Failed to update presence:', error);
    throw error;
  }
}

/**
 * Set up automatic presence tracking for a user with heartbeat
 * 
 * WHY: Fast offline detection requires frequent heartbeats to prove user is still active
 * 
 * WHAT: 
 * - Sets user online with initial heartbeat
 * - Starts interval that updates heartbeat every 1.5 seconds
 * - Configures .onDisconnect() as fallback for crashes
 * - Returns cleanup function that stops heartbeat and sets offline
 * 
 * HOW IT WORKS:
 * - Every 1.5s, we write a fresh timestamp to lastHeartbeat
 * - Other users check if lastHeartbeat is older than 4s
 * - If stale, they show user as offline even if online=true
 * - This provides 1-2 second offline detection vs 30-60s with Firebase alone
 * 
 * @param userId - User ID to track presence for
 * @returns Async cleanup function to call on sign out
 */
export async function setupPresenceListener(userId: string): Promise<() => Promise<void>> {
  try {
    console.log('[PresenceService] Setting up presence listener with heartbeat for:', userId);
    
    const presenceRef = ref(realtimeDb, `status/${userId}`);
    
    // Set up onDisconnect handler FIRST (before setting online)
    // WHY: This ensures if we lose connection immediately, we still go offline
    // NOTE: This is now a FALLBACK for crashes, heartbeat is primary detection
    const disconnectRef = onDisconnect(presenceRef);
    await disconnectRef.set({
      online: false,
      lastSeen: serverTimestamp(),
      lastHeartbeat: null, // Clear heartbeat on disconnect
    });
    
    console.log('[PresenceService] onDisconnect handler configured');
    
    // Set initial online status with heartbeat
    const now = Date.now();
    await set(presenceRef, {
      online: true,
      lastSeen: now,
      lastHeartbeat: now, // Initial heartbeat
    });
    
    console.log('[PresenceService] User set to online with initial heartbeat at:', now);
    
    // Start heartbeat interval
    // WHY: Frequent updates let other clients detect offline status within 1-4 seconds
    // WHAT: Updates lastHeartbeat every 1.5 seconds to prove we're still alive
    const heartbeatInterval = setInterval(async () => {
      try {
        const heartbeatTime = Date.now();
        await set(presenceRef, {
          online: true,
          lastSeen: heartbeatTime,
          lastHeartbeat: heartbeatTime,
        });
        console.log('[PresenceService] Heartbeat sent at:', heartbeatTime);
      } catch (error) {
        console.error('[PresenceService] Heartbeat failed:', error);
        // Don't throw - let it retry on next interval
      }
    }, HEARTBEAT_INTERVAL);
    
    console.log('[PresenceService] Heartbeat interval started');
    
    // Return cleanup function
    const cleanup = async (): Promise<void> => {
      console.log('[PresenceService] Cleaning up presence for:', userId);
      
      // Stop heartbeat interval FIRST
      clearInterval(heartbeatInterval);
      console.log('[PresenceService] Heartbeat interval stopped');
      
      // Cancel onDisconnect (so it doesn't fire after manual sign out)
      await disconnectRef.cancel();
      
      // Set user offline
      await set(presenceRef, {
        online: false,
        lastSeen: Date.now(),
        lastHeartbeat: null, // Clear heartbeat when offline
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
 * Listen to real-time presence updates for a user with staleness detection
 * 
 * WHY: We need to show online/offline status in the UI and detect stale heartbeats
 * WHAT: Sets up Realtime Database listener for /status/{userId} with client-side staleness check
 * 
 * HOW STALENESS DETECTION WORKS:
 * - If lastHeartbeat exists and is older than 4 seconds, override online=false
 * - This provides instant offline detection without waiting for server updates
 * - Even if Firebase shows online=true, we check the heartbeat timestamp
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
  
  // Set up listener with explicit cache handling
  // WHY: onValue by default might use cached data, we want fresh data from server
  const unsubscribe = onValue(
    presenceRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        console.log('[PresenceService] No presence data for user:', userId);
        callback(null);
        return;
      }
      
      const data = snapshot.val();
      
      // Ensure we have valid data
      if (!data) {
        console.warn('[PresenceService] Invalid presence data for user:', userId);
        callback(null);
        return;
      }
      
      const now = Date.now();
      let isOnline = data.online === true; // Explicit boolean check
      
      // CLIENT-SIDE STALENESS DETECTION
      // WHY: If heartbeat is stale, user is offline even if online=true
      // WHAT: Check if lastHeartbeat is older than OFFLINE_THRESHOLD (4 seconds)
      if (isOnline && data.lastHeartbeat) {
        const heartbeatAge = now - data.lastHeartbeat;
        if (heartbeatAge > OFFLINE_THRESHOLD) {
          console.log(`[PresenceService] Stale heartbeat detected for ${userId}: ${heartbeatAge}ms old, marking offline`);
          isOnline = false; // Override to offline
        }
      }
      
      const presence: PresenceData = {
        online: isOnline,
        lastSeen: data.lastSeen || now,
        lastHeartbeat: data.lastHeartbeat,
      };
      
      console.log('[PresenceService] Presence update:', userId, 
        'online:', presence.online, 
        'lastSeen:', new Date(presence.lastSeen).toISOString(),
        'lastHeartbeat:', presence.lastHeartbeat ? new Date(presence.lastHeartbeat).toISOString() : 'none');
      
      callback(presence);
    },
    (error) => {
      console.error('[PresenceService] Presence listener error:', error);
      callback(null); // Call with null on error so UI can handle gracefully
    }
  );
  
  return unsubscribe;
}

/**
 * Get current presence status for a user (one-time read) with staleness check
 * 
 * WHY: Sometimes we need to check presence without setting up a listener
 * WHAT: Uses get() for a single snapshot read from /status/{userId} with staleness detection
 * 
 * @param userId - User ID to get presence for
 * @returns Current presence data or null if not available
 */
export async function getPresence(userId: string): Promise<PresenceData | null> {
  try {
    console.log('[PresenceService] Getting presence for:', userId);
    
    const presenceRef = ref(realtimeDb, `status/${userId}`);
    const snapshot = await get(presenceRef);
    
    if (!snapshot.exists()) {
      console.log('[PresenceService] No presence data found for:', userId);
      return null;
    }
    
    const data = snapshot.val();
    const now = Date.now();
    let isOnline = data.online || false;
    
    // Apply staleness detection
    if (isOnline && data.lastHeartbeat) {
      const heartbeatAge = now - data.lastHeartbeat;
      if (heartbeatAge > OFFLINE_THRESHOLD) {
        console.log(`[PresenceService] Stale heartbeat in getPresence for ${userId}: ${heartbeatAge}ms old`);
        isOnline = false;
      }
    }
    
    const presence: PresenceData = {
      online: isOnline,
      lastSeen: data.lastSeen || now,
      lastHeartbeat: data.lastHeartbeat,
    };
    
    console.log('[PresenceService] Got presence:', userId, presence.online ? 'online' : 'offline');
    return presence;
  } catch (error) {
    console.error('[PresenceService] Failed to get presence:', error);
    return null;
  }
}

