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

import React, { useState } from 'react';
import { View, StyleSheet, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Text, Avatar } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';
import { Message, User } from '../types';
import { Timestamp } from 'firebase/firestore';

/**
 * Props for MessageBubble component
 */
interface MessageBubbleProps {
  message: Message;
  isSent: boolean; // True if message was sent by current user
  isGroupChat?: boolean; // True if this is a group chat
  senderUser?: User; // User object of message sender (for group chats)
  readByCount?: number; // Number of users who read this message (for group sent messages)
  onImagePress?: (imageUrl: string) => void; // Callback when image is tapped
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
 * - Double checkmark: delivered (recipient received)
 * - Blue double checkmark: read (recipient opened chat)
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
 * Get sender initials for avatar
 * 
 * WHY: Show initials when no profile photo available
 * WHAT: Takes first letter of each word in name
 */
function getSenderInitials(user: User | undefined): string {
  if (!user?.displayName) return '??';
  return user.displayName
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Get sentiment icon
 * 
 * WHY: Visual indication of message sentiment
 * WHAT: Returns emoji based on sentiment
 */
function getSentimentIcon(sentiment?: string): string | null {
  switch (sentiment) {
    case 'positive': return '😊';
    case 'negative': return '😞';
    case 'neutral': return '😐';
    default: return null;
  }
}

/**
 * Message Bubble Component
 * 
 * WHAT: Displays a single message with WhatsApp-style design
 * WHY: Users need clear, familiar message UI
 * 
 * NOTE: Memoized for performance in long message lists
 */
export const MessageBubble = React.memo(function MessageBubble({ message, isSent, isGroupChat, senderUser, readByCount, onImagePress }: MessageBubbleProps) {
  const statusIcon = getStatusIcon(message.status);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  // Check if this is an image message
  const isImageMessage = message.type === 'image' && message.mediaURL;
  
  // Get AI sentiment data (if available)
  const aiSentiment = (message as any).aiSentiment;
  const aiUrgency = (message as any).aiUrgency || 0;
  const sentimentIcon = getSentimentIcon(aiSentiment);
  
  // Check if this is urgent AND negative (needs highlighting)
  const isUrgentNegative = aiSentiment === 'negative' && aiUrgency >= 4;

  return (
    <View style={[styles.container, isSent ? styles.sentContainer : styles.receivedContainer]}>
      {/* Show avatar for received messages in group chats */}
      {isGroupChat && !isSent && (
        <View style={styles.avatarContainer}>
          {senderUser?.photoURL ? (
            <Avatar.Image size={32} source={{ uri: senderUser.photoURL }} />
          ) : (
            <Avatar.Text size={32} label={getSenderInitials(senderUser)} />
          )}
        </View>
      )}
      
      <View style={[
        styles.bubble, 
        isSent ? styles.sentBubble : styles.receivedBubble, 
        isImageMessage && styles.imageBubble,
        isUrgentNegative && styles.urgentBubble
      ]}>
        {/* Show sender name for received messages in group chats */}
        {isGroupChat && !isSent && senderUser && (
          <Text style={styles.senderName}>{senderUser.displayName}</Text>
        )}
        
        {/* Image message */}
        {isImageMessage ? (
          <TouchableOpacity
            onPress={() => onImagePress && onImagePress(message.mediaURL!)}
            activeOpacity={0.8}
            disabled={!onImagePress}
          >
            <View style={styles.imageContainer}>
              {imageLoading && !imageError && (
                <View style={styles.imagePlaceholder}>
                  <ActivityIndicator size="large" color="#25D366" />
                </View>
              )}
              {imageError ? (
                <View style={styles.imageError}>
                  <Ionicons name="image-outline" size={48} color="#999" />
                  <Text style={styles.imageErrorText}>Failed to load image</Text>
                </View>
              ) : (
                <Image
                  source={{ uri: message.mediaURL }}
                  style={styles.messageImage}
                  resizeMode="cover"
                  onLoad={() => setImageLoading(false)}
                  onError={() => {
                    setImageLoading(false);
                    setImageError(true);
                  }}
                />
              )}
            </View>
          </TouchableOpacity>
        ) : (
          /* Text message */
          <Text style={[styles.text, isSent ? styles.sentText : styles.receivedText]}>
            {message.text}
          </Text>
        )}

        {/* Timestamp and status row */}
        <View style={styles.metaRow}>
          {/* Sentiment icon (for received messages only) */}
          {!isSent && sentimentIcon && (
            <Text style={styles.sentimentIcon}>{sentimentIcon}</Text>
          )}
          
          <Text style={[styles.timestamp, isSent ? styles.sentTimestamp : styles.receivedTimestamp]}>
            {formatMessageTime(message.timestamp)}
          </Text>

          {/* Status icon or read count */}
          {isSent && (
            <>
              {isGroupChat && readByCount !== undefined ? (
                // Show "Read by X" for group messages
                readByCount > 0 && (
                  <Text style={styles.readByText}>Read by {readByCount}</Text>
                )
              ) : (
                // Show status icon for 1:1 messages
                <Ionicons
                  name={statusIcon.name}
                  size={16}
                  color={statusIcon.color}
                  style={styles.statusIcon}
                />
              )}
            </>
          )}
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginVertical: 4,
    marginHorizontal: 8,
    alignItems: 'flex-end',
  },
  sentContainer: {
    justifyContent: 'flex-end', // Align sent messages to right
  },
  receivedContainer: {
    justifyContent: 'flex-start', // Align received messages to left
  },
  avatarContainer: {
    marginRight: 8,
    marginBottom: 4,
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
  urgentBubble: {
    borderWidth: 2,
    borderColor: '#F44336', // Red border for urgent negative messages
    backgroundColor: '#FFEBEE', // Light red background
  },
  senderName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#075E54', // WhatsApp teal
    marginBottom: 4,
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
  readByText: {
    fontSize: 11,
    color: '#4FC3F7', // Blue, like read receipts
    marginLeft: 4,
  },
  statusIcon: {
    marginLeft: 2,
  },
  sentimentIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  imageBubble: {
    padding: 4, // Less padding for images
  },
  imageContainer: {
    width: 200,
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  messageImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  imageError: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  imageErrorText: {
    marginTop: 8,
    fontSize: 12,
    color: '#999',
  },
});


