/**
 * Auth Store (Zustand)
 * 
 * This is a global state store for authentication using Zustand.
 * It tracks the currently logged-in user and provides actions to update auth state.
 * 
 * WHY: We need a way to share user auth state across all components in the app.
 * Zustand is lightweight and simpler than Redux for this use case.
 * 
 * WHAT: Stores current user data and provides actions to set/clear/update user.
 */

import { create } from 'zustand';
import { User } from '../types';

/**
 * Auth State Interface
 * 
 * WHAT: Defines the shape of our auth state
 * - user: Currently logged-in user (null if not logged in)
 * - loading: Whether we're checking auth status (app startup)
 * - isAuthenticated: Computed value - true if user exists
 */
interface AuthState {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  
  // Actions
  setUser: (user: User | null) => void;
  updateUser: (updates: Partial<User>) => void;
  clearUser: () => void;
  setLoading: (loading: boolean) => void;
}

/**
 * Create the auth store
 * 
 * WHY: This hook can be used in any component to access/update auth state
 * WHAT: Creates a Zustand store with user state and actions
 * 
 * Usage in components:
 * const { user, isAuthenticated } = useAuthStore();
 * const setUser = useAuthStore((state) => state.setUser);
 */
export const useAuthStore = create<AuthState>((set) => ({
  // Initial state
  user: null,
  loading: true, // Start as loading while we check if user is logged in
  isAuthenticated: false,
  
  /**
   * Set the current user
   * 
   * WHY: Called when user signs in or when we load user data on app start
   * WHAT: Updates user state and sets isAuthenticated to true
   * 
   * @param user - User object or null to clear
   */
  setUser: (user) =>
    set({
      user,
      isAuthenticated: user !== null,
      loading: false,
    }),
  
  /**
   * Update specific fields of the current user
   * 
   * WHY: When user updates their profile, we want to update the store
   * without re-fetching from Firestore
   * 
   * WHAT: Merges updates into existing user object
   * 
   * @param updates - Partial user object with fields to update
   */
  updateUser: (updates) =>
    set((state) => ({
      user: state.user ? { ...state.user, ...updates } : null,
    })),
  
  /**
   * Clear the current user (sign out)
   * 
   * WHY: Called when user signs out
   * WHAT: Sets user to null and isAuthenticated to false
   */
  clearUser: () =>
    set({
      user: null,
      isAuthenticated: false,
      loading: false,
    }),
  
  /**
   * Set loading state
   * 
   * WHY: Used during app initialization to show loading screen
   * WHAT: Updates loading flag
   * 
   * @param loading - Whether auth is being checked
   */
  setLoading: (loading) =>
    set({ loading }),
}));

