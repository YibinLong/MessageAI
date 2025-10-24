/**
 * ChatListItem Component
 * 
 * This component displays a single chat in the chat list.
 * It shows the contact's avatar, name, last message preview, timestamp, and unread badge.
 * 
 * WHY: Reusable component for the chat list keeps code organized
 * WHAT: Material Design 3 styled list item for a chat conversation
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { List, Avatar, Badge, Text } from 'react-native-paper';
import { formatDistanceToNow } from 'date-fns';
import { Chat, User } from '../types';
import { Timestamp } from 'firebase/firestore';

/**
 * Props for ChatListItem component
 */
interface ChatListItemProps {
  chat: Chat;
  currentUserId: string;
  otherUser?: User; // The other participant in the chat (for 1:1 chats)
  onPress: () => void;
  isOnline?: boolean; // Whether the other user is online (for 1:1 chats)
}

/**
 * ChatListItem Component
 * 
 * WHAT: Displays a single chat with avatar, name, last message, and unread count
 * WHY: Provides a consistent WhatsApp-style list item for all chats
 * 
 * NOTE: Memoized for performance in long chat lists
 * 
 * @param chat - Chat object to display
 * @param currentUserId - Current user's ID (to filter out of participants)
 * @param otherUser - User object for the other participant (for displaying name/photo)
 * @param onPress - Handler for when the item is tapped
 */
export const ChatListItem = React.memo(function ChatListItem({ chat, currentUserId, otherUser, onPress, isOnline }: ChatListItemProps) {
  /**
   * Get display name for the chat
   * 
   * WHY: Group chats have a name field, 1:1 chats use the other user's name
   * WHAT: Returns group name or other user's display name
   */
  const getDisplayName = (): string => {
    if (chat.type === 'group') {
      return chat.name || 'Unnamed Group';
    }
    return otherUser?.displayName || 'Unknown User';
  };

  /**
   * Get avatar source
   * 
   * WHY: Display profile picture for visual identification
   * WHAT: Returns photo URL for groups or other user's photo
   */
  const getAvatarSource = (): string | undefined => {
    if (chat.type === 'group') {
      return chat.photoURL;
    }
    return otherUser?.photoURL;
  };

  /**
   * Get initials for avatar fallback
   * 
   * WHY: When no photo is available, show initials
   * WHAT: Returns first letters of display name
   */
  const getInitials = (): string => {
    const name = getDisplayName();
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  /**
   * Format timestamp for display
   * 
   * WHY: Show relative time (e.g., "2m ago") for recent messages
   * WHAT: Converts Firestore Timestamp to relative time string
   */
  const formatTimestamp = (timestamp: Timestamp): string => {
    try {
      const date = timestamp.toDate();
      const now = new Date();
      const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
      
      // Handle very recent messages (< 1 minute)
      // WHY: formatDistanceToNow returns "less than a minute" which becomes "am" after replacements
      if (diffInSeconds < 60) {
        return 'now';
      }
      
      return formatDistanceToNow(date, { addSuffix: false })
        .replace('about ', '')
        .replace('less than ', '')
        .replace(' minutes', 'm')
        .replace(' minute', 'm')
        .replace(' hours', 'h')
        .replace(' hour', 'h')
        .replace(' days', 'd')
        .replace(' day', 'd');
    } catch (error) {
      return '';
    }
  };

  /**
   * Get last message preview text
   * 
   * WHY: Show snippet of last message in chat list
   * WHAT: Returns last message text or placeholder
   */
  const getLastMessagePreview = (): string => {
    if (!chat.lastMessage) {
      return 'No messages yet';
    }
    return chat.lastMessage.text;
  };

  /**
   * Get read count text for group chats
   * 
   * WHY: Show how many group members have read the last message
   * WHAT: Returns "Read by X/Y" where X is readers and Y is total recipients
   */
  const getReadCountText = (): string | null => {
    // Only show for group chats
    if (chat.type !== 'group' || !chat.lastMessage) {
      return null;
    }

    // Get readBy array from last message
    const readBy = (chat.lastMessage as any).readBy || [];
    const readCount = readBy.length;
    
    // Total recipients = all participants minus the sender
    const totalRecipients = chat.participants.length - 1;
    
    // Only show if there's at least one participant to read
    if (totalRecipients > 0) {
      return `Read by ${readCount}/${totalRecipients}`;
    }
    
    return null;
  };

  /**
   * Get category badge color
   * 
   * WHY: Visual indication of message category for quick scanning
   * WHAT: Returns color based on AI category
   */
  const getCategoryColor = (category?: string): string => {
    switch (category) {
      case 'fan': return '#2196F3'; // Blue
      case 'business': return '#4CAF50'; // Green
      case 'spam': return '#F44336'; // Red
      case 'urgent': return '#FF9800'; // Orange
      default: return '#999'; // Gray
    }
  };

  /**
   * Get category label
   * 
   * WHY: Show short text label for category
   * WHAT: Returns uppercase category name
   */
  const getCategoryLabel = (category?: string): string => {
    if (!category) return '';
    return category.toUpperCase();
  };

  const displayName = getDisplayName();
  const avatarSource = getAvatarSource();
  const lastMessagePreview = getLastMessagePreview();
  const readCountText = getReadCountText();
  const hasUnread = (chat.unreadCount || 0) > 0;
  const aiCategory = (chat.lastMessage as any)?.aiCategory;
  const collaborationScore = (chat.lastMessage as any)?.aiCollaborationScore || 0;
  const isHighPriority = collaborationScore > 7;

  return (
    <List.Item
      title={displayName}
      description={() => (
        <View>
          <Text style={styles.description} numberOfLines={1}>
            {lastMessagePreview}
          </Text>
          {readCountText && (
            <Text style={styles.readCount}>
              {readCountText}
            </Text>
          )}
        </View>
      )}
      onPress={onPress}
      left={() => (
        <View style={styles.avatarContainer}>
          {avatarSource ? (
            <Avatar.Image size={50} source={{ uri: avatarSource }} />
          ) : (
            <Avatar.Text size={50} label={getInitials()} />
          )}
          {/* Show green online indicator for 1:1 chats */}
          {chat.type === '1:1' && isOnline && (
            <View style={styles.onlineIndicator} />
          )}
        </View>
      )}
      right={() => (
        <View style={styles.rightContainer}>
          {/* Timestamp */}
          {chat.lastMessage && (
            <Text variant="labelSmall" style={styles.timestamp}>
              {formatTimestamp(chat.lastMessage.timestamp)}
            </Text>
          )}
          
          {/* Category Badge */}
          {aiCategory && (
            <Badge 
              size={18} 
              style={[styles.categoryBadge, { backgroundColor: getCategoryColor(aiCategory) }]}
            >
              {getCategoryLabel(aiCategory).slice(0, 3)}
            </Badge>
          )}

          {/* High Priority Star */}
          {isHighPriority && (
            <Text style={styles.priorityStar}>⭐</Text>
          )}
          
          {/* Unread Badge */}
          {hasUnread && (
            <Badge size={20} style={styles.badge}>
              {chat.unreadCount}
            </Badge>
          )}
        </View>
      )}
      titleStyle={[styles.title, isHighPriority && styles.priorityTitle]}
      style={styles.listItem}
    />
  );
});

const styles = StyleSheet.create({
  listItem: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  avatarContainer: {
    justifyContent: 'center',
    marginRight: 12,
    position: 'relative', // For absolute positioning of online indicator
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#4CAF50', // Green for online
    borderWidth: 2,
    borderColor: '#fff', // White border for contrast
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  priorityTitle: {
    fontWeight: '700', // Bold for high priority chats
    color: '#000',
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  readCount: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  rightContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 4,
  },
  timestamp: {
    color: '#999',
    fontSize: 12,
  },
  categoryBadge: {
    fontSize: 9,
    fontWeight: '600',
    color: '#fff',
    paddingHorizontal: 4,
  },
  priorityStar: {
    fontSize: 16,
  },
  badge: {
    backgroundColor: '#128c7e', // WhatsApp green
    color: '#fff',
  },
});

