/**
 * Date and Timestamp Utilities
 * 
 * Centralized functions for working with Firestore Timestamps and dates.
 * 
 * WHY: Timestamp conversions were scattered throughout the codebase
 * WHAT: Reusable helper functions for timestamp operations
 */

import { Timestamp } from 'firebase/firestore';

/**
 * Convert Firestore Timestamp to milliseconds
 * 
 * WHY: SQLite stores timestamps as numbers (milliseconds since epoch)
 * WHAT: Safely extracts milliseconds from Timestamp, handling undefined
 * 
 * @param ts - Firestore Timestamp (can be undefined)
 * @returns Milliseconds since epoch, or current time if undefined
 */
export function timestampToMillis(ts: Timestamp | undefined): number {
  if (!ts) {
    return Date.now();
  }
  
  if (ts instanceof Timestamp) {
    return ts.toMillis();
  }
  
  // Fallback for non-Timestamp objects
  return Date.now();
}

/**
 * Convert milliseconds to Firestore Timestamp
 * 
 * WHY: Need to convert SQLite timestamps back to Firestore format
 * WHAT: Creates Timestamp from milliseconds since epoch
 * 
 * @param ms - Milliseconds since epoch
 * @returns Firestore Timestamp object
 */
export function millisToTimestamp(ms: number): Timestamp {
  return Timestamp.fromMillis(ms);
}

/**
 * Get current timestamp
 * 
 * WHY: Convenience function for creating "now" timestamps
 * WHAT: Returns current time as Firestore Timestamp
 * 
 * @returns Current timestamp
 */
export function now(): Timestamp {
  return Timestamp.now();
}

/**
 * Check if timestamp is valid
 * 
 * WHY: Prevent errors from invalid timestamp objects
 * WHAT: Type guard for Timestamp objects
 * 
 * @param ts - Value to check
 * @returns True if valid Timestamp
 */
export function isValidTimestamp(ts: any): ts is Timestamp {
  return ts instanceof Timestamp && typeof ts.toMillis === 'function';
}

