/**
 * Authentication Service
 * 
 * This file provides helper functions for Firebase Authentication operations.
 * It wraps Firebase Auth API calls to keep auth logic separate from UI components.
 * 
 * WHY: Centralizing auth logic makes it easier to maintain and test.
 * WHAT: Provides functions for sign up, sign in, sign out, and password reset.
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  updateProfile as firebaseUpdateProfile,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth } from './firebase';

/**
 * Sign up a new user with email and password
 * 
 * WHY: Creates a new Firebase Auth account
 * WHAT: 
 * - Creates auth account with email/password
 * - Returns the created user object
 * 
 * @param email - User's email address
 * @param password - User's password (min 6 characters)
 * @param displayName - User's display name
 * @returns Promise with the created user
 */
export async function signUp(
  email: string,
  password: string,
  displayName: string
): Promise<FirebaseUser> {
  try {
    console.log('[Auth] Creating new user account...');
    
    // Create the auth account
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    // Update the profile with display name
    await firebaseUpdateProfile(userCredential.user, { displayName });
    
    console.log('[Auth] User account created successfully:', userCredential.user.uid);
    return userCredential.user;
  } catch (error: any) {
    console.error('[Auth] Sign up failed:', error.code, error.message);
    throw error;
  }
}

/**
 * Sign in an existing user with email and password
 * 
 * WHY: Authenticates a user and grants access to the app
 * WHAT: Signs in with Firebase Auth and returns the user object
 * 
 * @param email - User's email address
 * @param password - User's password
 * @returns Promise with the signed-in user
 */
export async function signIn(email: string, password: string): Promise<FirebaseUser> {
  try {
    console.log('[Auth] Signing in user...');
    
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    
    console.log('[Auth] User signed in successfully:', userCredential.user.uid);
    return userCredential.user;
  } catch (error: any) {
    console.error('[Auth] Sign in failed:', error.code, error.message);
    throw error;
  }
}

/**
 * Sign out the current user
 * 
 * WHY: Logs out the user and clears their session
 * WHAT: Signs out from Firebase Auth
 * 
 * @returns Promise that resolves when sign out is complete
 */
export async function signOut(): Promise<void> {
  try {
    console.log('[Auth] Signing out user...');
    
    await firebaseSignOut(auth);
    
    console.log('[Auth] User signed out successfully');
  } catch (error: any) {
    console.error('[Auth] Sign out failed:', error.code, error.message);
    throw error;
  }
}

/**
 * Send a password reset email to the user
 * 
 * WHY: Allows users to reset their password if they forget it
 * WHAT: Sends Firebase Auth password reset email
 * 
 * @param email - User's email address
 * @returns Promise that resolves when email is sent
 */
export async function resetPassword(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error: any) {
    console.error('[Auth] Password reset failed:', error.code, error.message);
    throw error;
  }
}

/**
 * Update the current user's profile
 * 
 * WHY: Allows updating display name and photo URL in Firebase Auth
 * WHAT: Updates the Firebase Auth user profile
 * 
 * @param updates - Object with displayName and/or photoURL
 * @returns Promise that resolves when update is complete
 */
export async function updateProfile(updates: {
  displayName?: string;
  photoURL?: string;
}): Promise<void> {
  try {
    if (!auth.currentUser) {
      throw new Error('No user is currently signed in');
    }
    
    console.log('[Auth] Updating user profile...');
    
    await firebaseUpdateProfile(auth.currentUser, updates);
    
    console.log('[Auth] Profile updated successfully');
  } catch (error: any) {
    console.error('[Auth] Profile update failed:', error.code, error.message);
    throw error;
  }
}

/**
 * Get user-friendly error message from Firebase Auth error code
 * 
 * WHY: Firebase error codes are not user-friendly (e.g., 'auth/wrong-password')
 * WHAT: Maps error codes to readable messages
 * 
 * @param errorCode - Firebase Auth error code
 * @returns User-friendly error message
 */
export function getAuthErrorMessage(errorCode: string): string {
  const errorMessages: { [key: string]: string } = {
    'auth/email-already-in-use': 'This email is already registered',
    'auth/invalid-email': 'Invalid email address',
    'auth/weak-password': 'Password must be at least 6 characters',
    'auth/user-not-found': 'No account found with this email',
    'auth/wrong-password': 'Incorrect password',
    'auth/network-request-failed': 'Network error. Check your connection.',
    'auth/too-many-requests': 'Too many attempts. Please try again later.',
    'auth/user-disabled': 'This account has been disabled',
    'auth/operation-not-allowed': 'Operation not allowed. Please contact support.',
  };

  return errorMessages[errorCode] || 'An error occurred. Please try again.';
}

