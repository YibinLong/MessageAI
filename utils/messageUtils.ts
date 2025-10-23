/**
 * Message Utilities
 * 
 * Helper functions for message formatting and status icons.
 * 
 * WHY: Message display logic was duplicated in components
 * WHAT: Reusable functions for message formatting
 */

import { Timestamp } from 'firebase/firestore';
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';

/**
 * Status icon configuration
 */
export interface StatusIconConfig {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
}

/**
 * Get status icon based on message status
 * 
 * WHY: Visual feedback for message delivery status
 * WHAT:
 * - Clock: sending (message not yet uploaded)
 * - Single checkmark: sent (uploaded to Firestore)
 * - Double checkmark: delivered (recipient received)
 * - Blue double checkmark: read (recipient opened chat)
 * 
 * @param status - Message status
 * @returns Icon configuration with name and color
 */
export function getMessageStatusIcon(status: string): StatusIconConfig {
  switch (status) {
    case 'sending':
      return { name: 'time-outline', color: '#999' };
    case 'sent':
      return { name: 'checkmark', color: '#999' };
    case 'delivered':
      return { name: 'checkmark-done', color: '#999' };
    case 'read':
      return { name: 'checkmark-done', color: '#4FC3F7' };
    default:
      return { name: 'checkmark', color: '#999' };
  }
}

/**
 * Format timestamp for display
 * 
 * WHY: Different time formats make more sense for recent vs old messages
 * WHAT: 
 * - Just now, 2m ago, 1h ago (for messages < 24h)
 * - "Yesterday at 10:45 AM" (for yesterday)
 * - "10:45 AM" (for today)
 * - "Jan 15 at 10:45 AM" (for older)
 * 
 * @param timestamp - Firestore Timestamp object
 * @returns Formatted time string
 */
export function formatMessageTime(timestamp: Timestamp): string {
  const date = timestamp.toDate();
  const now = new Date();
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

  // For messages less than 24 hours old, show relative time
  if (diffInHours < 24) {
    if (diffInHours < 0.016) {
      // Less than 1 minute
      return 'Just now';
    }
    return formatDistanceToNow(date, { addSuffix: true });
  }

  // For yesterday's messages
  if (isYesterday(date)) {
    return `Yesterday at ${format(date, 'h:mm a')}`;
  }

  // For today (shouldn't happen since we check diffInHours < 24, but just in case)
  if (isToday(date)) {
    return format(date, 'h:mm a');
  }

  // For older messages
  return format(date, 'MMM d at h:mm a');
}

/**
 * Get sentiment icon emoji
 * 
 * WHY: Visual indication of message sentiment from AI analysis
 * WHAT: Returns emoji based on sentiment
 * 
 * @param sentiment - Sentiment string from AI
 * @returns Emoji string or null
 */
export function getSentimentIcon(sentiment?: string): string | null {
  switch (sentiment) {
    case 'positive':
      return '😊';
    case 'negative':
      return '😞';
    case 'neutral':
      return '😐';
    default:
      return null;
  }
}

/**
 * Get user initials for avatar
 * 
 * WHY: Show initials when no profile photo available
 * WHAT: Takes first letter of each word in name
 * 
 * @param displayName - User's display name
 * @returns Two-letter initials
 */
export function getUserInitials(displayName: string | undefined): string {
  if (!displayName) return '??';
  
  return displayName
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

