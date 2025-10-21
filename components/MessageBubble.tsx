/**
 * Message Bubble Component
 * 
 * Displays an individual message in WhatsApp style with:
 * - Different colors for sent (green) vs received (white) messages
 * - Timestamp (relative for recent, absolute for old)
 * - Status indicators (clock, checkmarks)
 * 
 * WHY: Messages need clear visual distinction between sent/received, and users
 * need to see message status at a glance.
 * 
 * WHAT: Styled message bubble with text, timestamp, and status icon
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';
import { Message } from '../types';
import { Timestamp } from 'firebase/firestore';

/**
 * Props for MessageBubble component
 */
interface MessageBubbleProps {
  message: Message;
  isSent: boolean; // True if message was sent by current user
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
function formatMessageTime(timestamp: Timestamp): string {
  const date = timestamp.toDate();
  const now = new Date();
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

  // For messages less than 24 hours old, show relative time
  if (diffInHours < 24) {
    if (diffInHours < 0.016) {
      // Less than 1 minute
      return 'Just now';
    }
    return formatDistanceToNow(date, { addSuffix: true }); // "2 minutes ago", "1 hour ago"
  }

  // For yesterday's messages
  if (isYesterday(date)) {
    return `Yesterday at ${format(date, 'h:mm a')}`; // "Yesterday at 10:45 AM"
  }

  // For today (shouldn't happen since we check diffInHours < 24, but just in case)
  if (isToday(date)) {
    return format(date, 'h:mm a'); // "10:45 AM"
  }

  // For older messages
  return format(date, 'MMM d at h:mm a'); // "Jan 15 at 10:45 AM"
}

/**
 * Get status icon based on message status
 * 
 * WHY: Visual feedback for message delivery status
 * WHAT:
 * - Clock: sending (message not yet uploaded)
 * - Single checkmark: sent (uploaded to Firestore)
 * - Double checkmark: delivered (recipient received) - PLACEHOLDER for Epic 2.4
 * - Blue double checkmark: read (recipient opened chat) - PLACEHOLDER for Epic 2.4
 * 
 * @param status - Message status
 * @returns Icon name and color
 */
function getStatusIcon(status: string): { name: keyof typeof Ionicons.glyphMap; color: string } {
  switch (status) {
    case 'sending':
      return { name: 'time-outline', color: '#999' }; // Clock icon (gray)
    case 'sent':
      return { name: 'checkmark', color: '#999' }; // Single checkmark (gray)
    case 'delivered':
      return { name: 'checkmark-done', color: '#999' }; // Double checkmark (gray)
    case 'read':
      return { name: 'checkmark-done', color: '#4FC3F7' }; // Double checkmark (blue)
    default:
      return { name: 'checkmark', color: '#999' };
  }
}

/**
 * Message Bubble Component
 * 
 * WHAT: Displays a single message with WhatsApp-style design
 * WHY: Users need clear, familiar message UI
 */
export function MessageBubble({ message, isSent }: MessageBubbleProps) {
  const statusIcon = getStatusIcon(message.status);

  return (
    <View style={[styles.container, isSent ? styles.sentContainer : styles.receivedContainer]}>
      <View style={[styles.bubble, isSent ? styles.sentBubble : styles.receivedBubble]}>
        {/* Message text */}
        <Text style={[styles.text, isSent ? styles.sentText : styles.receivedText]}>
          {message.text}
        </Text>

        {/* Timestamp and status row */}
        <View style={styles.metaRow}>
          <Text style={[styles.timestamp, isSent ? styles.sentTimestamp : styles.receivedTimestamp]}>
            {formatMessageTime(message.timestamp)}
          </Text>

          {/* Status icon (only show for sent messages) */}
          {isSent && (
            <Ionicons
              name={statusIcon.name}
              size={16}
              color={statusIcon.color}
              style={styles.statusIcon}
            />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    marginHorizontal: 8,
  },
  sentContainer: {
    alignItems: 'flex-end', // Align sent messages to right
  },
  receivedContainer: {
    alignItems: 'flex-start', // Align received messages to left
  },
  bubble: {
    maxWidth: '75%', // Don't let bubbles take full width
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    elevation: 1, // Subtle shadow on Android
    shadowColor: '#000', // Shadow on iOS
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  sentBubble: {
    backgroundColor: '#DCF8C6', // WhatsApp green (light)
    borderBottomRightRadius: 4, // Sharp corner on bottom-right (WhatsApp style)
  },
  receivedBubble: {
    backgroundColor: '#FFFFFF', // White
    borderBottomLeftRadius: 4, // Sharp corner on bottom-left (WhatsApp style)
  },
  text: {
    fontSize: 16,
    lineHeight: 20,
  },
  sentText: {
    color: '#000',
  },
  receivedText: {
    color: '#000',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    alignSelf: 'flex-end', // Always align meta row to right within bubble
  },
  timestamp: {
    fontSize: 11,
    marginRight: 4,
  },
  sentTimestamp: {
    color: '#667',
  },
  receivedTimestamp: {
    color: '#999',
  },
  statusIcon: {
    marginLeft: 2,
  },
});


