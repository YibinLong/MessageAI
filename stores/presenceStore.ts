/**
 * Presence Store
 * 
 * Global state management for user online/offline status.
 * This ensures presence data is consistent across all screens.
 * 
 * WHY: Instead of each screen managing its own presence listeners,
 *      we have ONE central store that all screens read from.
 *      When presence updates, ALL screens see the change instantly.
 * 
 * WHAT: Zustand store that:
 *       - Manages presence listeners for all users
 *       - Stores presence data in a Map
 *       - Provides methods to subscribe/unsubscribe to user presence
 *       - Automatically handles cleanup
 * 
 * BENEFITS:
 * - Single source of truth for presence data
 * - Automatic consistency across screens
 * - Better performance (shared listeners instead of duplicate listeners)
 * - Easier to debug (all presence state in one place)
 */

import { create } from 'zustand';
import { listenToPresence, PresenceData } from '../services/presenceService';

/**
 * Presence Store State
 */
interface PresenceStoreState {
  /**
   * Map of userId to their current presence data
   * WHY: Fast lookups by userId
   */
  presenceMap: Map<string, PresenceData>;
  
  /**
   * Map of userId to their listener cleanup function
   * WHY: Need to track active listeners to avoid duplicates and clean up properly
   */
  listeners: Map<string, () => void>;
  
  /**
   * Start listening to a user's presence
   * 
   * WHY: When a screen needs to show a user's online status
   * WHAT: Sets up Realtime Database listener, stores cleanup function
   * 
   * NOTE: Safe to call multiple times for same user - will only create one listener
   * 
   * @param userId - User ID to track presence for
   */
  startListening: (userId: string) => void;
  
  /**
   * Stop listening to a user's presence
   * 
   * WHY: When a screen no longer needs to show a user's status (cleanup)
   * WHAT: Calls cleanup function, removes from maps
   * 
   * @param userId - User ID to stop tracking
   */
  stopListening: (userId: string) => void;
  
  /**
   * Get presence data for a user
   * 
   * WHY: Screens need to read presence to show online/offline status
   * WHAT: Returns presence from map, or null if not available
   * 
   * @param userId - User ID to get presence for
   * @returns Presence data or null
   */
  getPresence: (userId: string) => PresenceData | null;
  
  /**
   * Clean up all listeners
   * 
   * WHY: When app closes or user signs out, clean up all listeners
   * WHAT: Calls all cleanup functions, clears maps
   */
  cleanup: () => void;
}

/**
 * Presence Store
 * 
 * HOW TO USE:
 * 
 * ```typescript
 * // In any component that needs presence data:
 * const { startListening, getPresence, stopListening } = usePresenceStore();
 * 
 * // Start listening when component mounts
 * useEffect(() => {
 *   startListening(userId);
 *   return () => stopListening(userId); // Cleanup
 * }, [userId]);
 * 
 * // Get presence data (re-renders when presence changes)
 * const presenceMap = usePresenceStore(state => state.presenceMap);
 * const presence = presenceMap.get(userId);
 * const isOnline = presence?.online || false;
 * ```
 */
export const usePresenceStore = create<PresenceStoreState>((set, get) => ({
  presenceMap: new Map(),
  listeners: new Map(),
  
  startListening: (userId: string) => {
    const { listeners, presenceMap } = get();
    
    // If already listening, do nothing
    // WHY: Avoid duplicate listeners for same user
    if (listeners.has(userId)) {
      console.log('[PresenceStore] Already listening to:', userId);
      return;
    }
    
    console.log('[PresenceStore] Starting listener for:', userId);
    
    // Set up presence listener with staleness detection
    // WHY: listenToPresence already handles staleness detection,
    //      so we get instant offline detection automatically
    const unsubscribe = listenToPresence(userId, (presence) => {
      // Update presence in store
      // WHY: This triggers re-renders in all components using this presence data
      set((state) => {
        const newMap = new Map(state.presenceMap);
        
        if (presence) {
          console.log('[PresenceStore] Presence update for', userId, ':', 
            presence.online ? 'ONLINE' : 'OFFLINE');
          newMap.set(userId, presence);
        } else {
          console.log('[PresenceStore] Presence removed for:', userId);
          newMap.delete(userId);
        }
        
        return { presenceMap: newMap };
      });
    });
    
    // Store cleanup function
    set((state) => {
      const newListeners = new Map(state.listeners);
      newListeners.set(userId, unsubscribe);
      return { listeners: newListeners };
    });
  },
  
  stopListening: (userId: string) => {
    const { listeners } = get();
    
    const unsubscribe = listeners.get(userId);
    if (unsubscribe) {
      console.log('[PresenceStore] Stopping listener for:', userId);
      unsubscribe(); // Call cleanup function
      
      // Remove from maps
      set((state) => {
        const newListeners = new Map(state.listeners);
        newListeners.delete(userId);
        
        const newPresenceMap = new Map(state.presenceMap);
        newPresenceMap.delete(userId);
        
        return { 
          listeners: newListeners,
          presenceMap: newPresenceMap
        };
      });
    }
  },
  
  getPresence: (userId: string) => {
    const { presenceMap } = get();
    return presenceMap.get(userId) || null;
  },
  
  cleanup: () => {
    console.log('[PresenceStore] Cleaning up all listeners');
    const { listeners } = get();
    
    // Call all cleanup functions
    listeners.forEach((unsubscribe) => {
      unsubscribe();
    });
    
    // Clear maps
    set({ 
      listeners: new Map(),
      presenceMap: new Map()
    });
  },
}));


