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
}

/**
 * ChatListItem Component
 * 
 * WHAT: Displays a single chat with avatar, name, last message, and unread count
 * WHY: Provides a consistent WhatsApp-style list item for all chats
 * 
 * @param chat - Chat object to display
 * @param currentUserId - Current user's ID (to filter out of participants)
 * @param otherUser - User object for the other participant (for displaying name/photo)
 * @param onPress - Handler for when the item is tapped
 */
export function ChatListItem({ chat, currentUserId, otherUser, onPress }: ChatListItemProps) {
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

  const displayName = getDisplayName();
  const avatarSource = getAvatarSource();
  const lastMessagePreview = getLastMessagePreview();
  const hasUnread = (chat.unreadCount || 0) > 0;

  return (
    <List.Item
      title={displayName}
      description={lastMessagePreview}
      onPress={onPress}
      left={() => (
        <View style={styles.avatarContainer}>
          {avatarSource ? (
            <Avatar.Image size={50} source={{ uri: avatarSource }} />
          ) : (
            <Avatar.Text size={50} label={getInitials()} />
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
          
          {/* Unread Badge */}
          {hasUnread && (
            <Badge size={20} style={styles.badge}>
              {chat.unreadCount}
            </Badge>
          )}
        </View>
      )}
      titleStyle={styles.title}
      descriptionStyle={styles.description}
      descriptionNumberOfLines={1}
      style={styles.listItem}
    />
  );
}

const styles = StyleSheet.create({
  listItem: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  avatarContainer: {
    justifyContent: 'center',
    marginRight: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
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
  badge: {
    backgroundColor: '#25D366', // WhatsApp green
    color: '#fff',
  },
});

