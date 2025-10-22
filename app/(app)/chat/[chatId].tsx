/**
 * Chat Screen
 * 
 * Main messaging interface showing message list and input field.
 * Implements real-time messaging, offline support, and optimistic UI.
 * 
 * WHY: This is the core screen where users send and receive messages
 * WHAT: Message list + input field + real-time sync + offline queue
 */

import React, { useEffect, useState, useCallback, useLayoutEffect } from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Text } from 'react-native-paper';
import { useLocalSearchParams, Stack, useFocusEffect, useNavigation } from 'expo-router';
import { useAuthStore } from '../../../stores/authStore';
import { ConnectionBanner } from '../../../components/ConnectionBanner';
import { MessageBubble } from '../../../components/MessageBubble';
import { MessageInput } from '../../../components/MessageInput';
import { TypingIndicator } from '../../../components/TypingIndicator';
import { useNetworkStatus } from '../../../hooks/useNetworkStatus';
import { subscribeToUserTyping } from '../../../services/typingService';
import { 
  sendMessage, 
  subscribeToMessages, 
  loadMessagesFromCache,
  retryUnsentMessages,
  markChatAsRead,
  markMessagesAsDelivered,
  markMessagesAsRead
} from '../../../services/messageService';
import { getChatById } from '../../../services/chatService';
import { getUserById } from '../../../services/userService';
import { Message, User, Chat } from '../../../types';
import { listenToPresence, PresenceData } from '../../../services/presenceService';
import { formatDistanceToNow } from 'date-fns';

/**
 * Chat Screen Component
 * 
 * WHAT: Displays conversation with another user
 * WHY: Core messaging experience
 * 
 * FEATURES:
 * - Loads messages from SQLite instantly (offline-first)
 * - Subscribes to Firestore for real-time updates
 * - Optimistic UI (messages appear before upload completes)
 * - Offline queue (auto-retries when reconnected)
 * - Connection status banner
 */
export default function ChatScreen() {
  const { chatId } = useLocalSearchParams<{ chatId: string }>();
  const { user: currentUser } = useAuthStore();
  const { isConnected } = useNetworkStatus();
  const navigation = useNavigation();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [chat, setChat] = useState<Chat | null>(null);
  const [otherUser, setOtherUser] = useState<User | null>(null);
  const [participantProfiles, setParticipantProfiles] = useState<Map<string, User>>(new Map());
  const [otherUserPresence, setOtherUserPresence] = useState<PresenceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);

  /**
   * Load chat metadata and all participant profiles
   * 
   * WHY: We need chat data for groups (name, type) and all participant profiles for displaying sender info
   * WHAT: Fetches chat from Firestore, then loads ALL participant profiles (needed for groups)
   */
  useEffect(() => {
    async function loadChatData() {
      try {
        if (!chatId || !currentUser) return;

        console.log('[ChatScreen] Loading chat data for:', chatId);

        // Get chat metadata
        const chatData = await getChatById(chatId);
        if (!chatData) {
          setError('Chat not found');
          return;
        }

        // Store chat object (needed to check if group)
        setChat(chatData);

        // Load ALL participant profiles (for groups, we need everyone)
        const profiles = new Map<string, User>();
        for (const participantId of chatData.participants) {
          if (participantId === currentUser.id) continue; // Skip current user
          
          try {
            const userProfile = await getUserById(participantId);
            if (userProfile) {
              profiles.set(participantId, userProfile);
            }
          } catch (error) {
            console.warn('[ChatScreen] Failed to load profile for:', participantId, error);
          }
        }
        
        setParticipantProfiles(profiles);

        // For 1:1 chats, also set the "other user" for backwards compatibility
        if (chatData.type === '1:1') {
          const otherUserId = chatData.participants.find(id => id !== currentUser.id);
          if (otherUserId) {
            const otherUserData = profiles.get(otherUserId);
            if (otherUserData) {
              setOtherUser(otherUserData);
            }
          }
        }

        // Mark chat as read (reset unread count for current user)
        // WHY: User is now viewing this chat, so it's no longer unread
        await markChatAsRead(chatId, currentUser.id);
        console.log('[ChatScreen] Chat marked as read');
      } catch (err) {
        console.error('[ChatScreen] Failed to load chat data:', err);
        setError('Failed to load chat');
      }
    }

    loadChatData();
  }, [chatId, currentUser]);

  /**
   * Set up presence listener for other user (1:1 chats only)
   * 
   * WHY: Show online/offline status and last seen in chat header
   * WHAT: Listens to Realtime Database for other user's presence
   */
  useEffect(() => {
    if (!otherUser || chat?.type === 'group') return; // Only for 1:1 chats

    console.log('[ChatScreen] Setting up presence listener for:', otherUser.id);
    
    const unsubscribe = listenToPresence(otherUser.id, (presence) => {
      setOtherUserPresence(presence);
    });

    return () => {
      console.log('[ChatScreen] Cleaning up presence listener');
      unsubscribe();
    };
  }, [otherUser, chat]);

  /**
   * Update header title dynamically with presence info
   * 
   * WHY: Need to show chat name and presence status reactively
   * WHAT: Updates navigation header whenever chat, presence, or profiles change
   */
  useLayoutEffect(() => {
    if (!chat) return;

    let title = '';
    let subtitle = '';

    if (chat.type === 'group') {
      // Group chat: show group name and member count
      title = chat.name || 'Group Chat';
      subtitle = `${chat.participants.length} members`;
    } else {
      // 1:1 chat: show user name and presence
      title = otherUser?.displayName || 'Chat';
      
      // Format presence status inline (can't use getPresenceStatus before it's defined)
      if (otherUserPresence) {
        if (otherUserPresence.online) {
          subtitle = 'Online';
        } else {
          try {
            const lastSeenDate = new Date(otherUserPresence.lastSeen);
            const now = new Date();
            const diffInSeconds = Math.floor((now.getTime() - lastSeenDate.getTime()) / 1000);
            
            if (diffInSeconds < 60) {
              subtitle = 'Last seen just now';
            } else {
              const distance = formatDistanceToNow(lastSeenDate, { addSuffix: false })
                .replace('about ', '')
                .replace('less than ', '');
              subtitle = `Last seen ${distance} ago`;
            }
          } catch (error) {
            subtitle = '';
          }
        }
      }
    }

    navigation.setOptions({
      title,
      // Note: headerSubtitle doesn't exist in expo-router, so we append to title
      headerTitle: subtitle ? `${title}\n${subtitle}` : title,
    });
  }, [chat, otherUser, otherUserPresence, navigation]);

  /**
   * Load messages from SQLite cache (instant display)
   * 
   * WHY: Instant message display provides better UX than waiting for Firestore
   * WHAT: Loads from SQLite when screen opens
   */
  useEffect(() => {
    async function loadCachedMessages() {
      if (!chatId) return;

      try {
        console.log('[ChatScreen] Loading cached messages');
        const cachedMessages = await loadMessagesFromCache(chatId);
        setMessages(cachedMessages);
        setLoading(false);
      } catch (err) {
        console.error('[ChatScreen] Failed to load cached messages:', err);
        setLoading(false);
      }
    }

    loadCachedMessages();
  }, [chatId]);

  /**
   * Subscribe to real-time message updates from Firestore
   * 
   * WHY: Real-time messaging requires listening for new messages
   * WHAT: Sets up Firestore listener, updates state when new messages arrive
   */
  useEffect(() => {
    if (!chatId || !currentUser) return;

    console.log('[ChatScreen] Setting up real-time message listener');

    const unsubscribe = subscribeToMessages(chatId, async (newMessages) => {
      console.log('[ChatScreen] Received', newMessages.length, 'messages from Firestore');
      setMessages(newMessages);
      
      // Mark incoming messages as delivered FIRST
      // WHY: When recipient receives messages, sender should see "delivered" status
      // IMPORTANT: Must complete before marking as read to ensure proper status progression
      const messageIds = newMessages.map(msg => msg.id);
      try {
        await markMessagesAsDelivered(chatId, messageIds, currentUser.id);
      } catch (error) {
        console.warn('[ChatScreen] Failed to mark messages as delivered:', error);
      }
      
      // Mark messages as read AFTER delivered
      // WHY: Any messages that arrive while user is viewing should be marked as read
      // This ensures status progression: sent → delivered → read
      markMessagesAsRead(chatId, currentUser.id).catch((error) => {
        console.warn('[ChatScreen] Failed to mark messages as read:', error);
      });
      
      // Mark chat as read (reset unread count)
      markChatAsRead(chatId, currentUser.id).catch((error) => {
        console.warn('[ChatScreen] Failed to mark chat as read:', error);
      });
    });

    // Cleanup listener on unmount
    return () => {
      console.log('[ChatScreen] Cleaning up message listener');
      unsubscribe();
    };
  }, [chatId, currentUser]);

  /**
   * Retry unsent messages when network reconnects
   * 
   * WHY: Messages sent while offline need to be uploaded when connection returns
   * WHAT: Calls retry function when isConnected changes from false to true
   */
  useEffect(() => {
    if (isConnected && chatId) {
      console.log('[ChatScreen] Network reconnected, retrying unsent messages');
      retryUnsentMessages(chatId).then((count) => {
        if (count > 0) {
          console.log('[ChatScreen] Successfully retried', count, 'messages');
        }
      });
    }
  }, [isConnected, chatId]);

  /**
   * Mark chat as read when screen is focused
   * 
   * WHY: When user returns to this chat screen, mark any new messages as read
   * WHAT: Calls markMessagesAsRead and markChatAsRead whenever screen gains focus
   */
  useFocusEffect(
    useCallback(() => {
      if (currentUser && chatId) {
        console.log('[ChatScreen] Screen focused, marking messages and chat as read');
        
        // Mark individual messages as read
        markMessagesAsRead(chatId, currentUser.id).catch((error) => {
          console.warn('[ChatScreen] Failed to mark messages as read on focus:', error);
        });
        
        // Mark chat as read (reset unread count)
        markChatAsRead(chatId, currentUser.id).catch((error) => {
          console.warn('[ChatScreen] Failed to mark chat as read on focus:', error);
        });
      }
    }, [chatId, currentUser])
  );

  /**
   * Subscribe to typing indicator (1:1 chats only)
   * 
   * WHY: Users need to see when the other person is typing
   * WHAT: Sets up listener for other user's typing status
   * 
   * NOTE: For MVP, typing indicators only work in 1:1 chats.
   * Group chat typing can be implemented later by subscribing to all participants.
   */
  useEffect(() => {
    // Only set up typing for 1:1 chats
    if (!chatId || !currentUser || !chat || chat.type !== '1:1' || !otherUser) {
      // For groups or when data not ready, don't show typing
      setIsOtherUserTyping(false);
      return;
    }

    console.log('[ChatScreen] Subscribing to typing indicator for:', otherUser.id);

    const unsubscribe = subscribeToUserTyping(
      chatId,
      otherUser.id,
      (isTyping) => {
        console.log('[ChatScreen] Other user typing status:', isTyping);
        setIsOtherUserTyping(isTyping);
      }
    );

    // Cleanup listener on unmount
    return () => {
      console.log('[ChatScreen] Cleaning up typing listener');
      unsubscribe();
    };
  }, [chatId, otherUser, currentUser, chat]);

  /**
   * Handle sending a new message
   * 
   * WHY: User taps send button, we need to save and upload the message
   * WHAT: Calls sendMessage service, updates local state optimistically
   */
  const handleSendMessage = useCallback(async (text: string) => {
    if (!chatId || !currentUser) {
      console.error('[ChatScreen] Cannot send message: missing chatId or currentUser');
      return;
    }

    try {
      console.log('[ChatScreen] Sending message:', text.substring(0, 50));

      // Send message (saves to SQLite immediately, uploads to Firestore in background)
      await sendMessage(chatId, text, currentUser.id);

      // Don't manually update state - let Firestore listener handle it
      // WHY: Prevents duplicate messages (one from optimistic update, one from listener)
      // The message will appear when Firestore listener fires (near-instant)
    } catch (err) {
      console.error('[ChatScreen] Failed to send message:', err);
      // Message is still saved to SQLite with 'sending' status, will retry later
    }
  }, [chatId, currentUser]);

  /**
   * Render individual message item
   * 
   * WHY: FlatList needs a render function for each message
   * WHAT: Returns MessageBubble component with group support
   */
  const renderMessage = useCallback(({ item }: { item: Message }) => {
    const isSent = item.senderId === currentUser?.id;
    const isGroupChat = chat?.type === 'group';
    
    // Get sender's profile (for group chats, to show name/avatar)
    const senderUser = participantProfiles.get(item.senderId);
    
    // Calculate read count for group sent messages
    let readByCount: number | undefined;
    if (isGroupChat && isSent && item.readBy) {
      // Count how many participants (excluding sender) have read the message
      readByCount = item.readBy.filter(userId => userId !== currentUser?.id).length;
    }
    
    return (
      <MessageBubble 
        message={item} 
        isSent={isSent}
        isGroupChat={isGroupChat}
        senderUser={senderUser}
        readByCount={readByCount}
      />
    );
  }, [currentUser, chat, participantProfiles]);

  /**
   * Format presence status for header
   * 
   * WHY: Show "Online" or "Last seen X ago" based on presence data
   * WHAT: Returns formatted presence string
   */
  const getPresenceStatus = useCallback((): string => {
    if (!otherUserPresence) return '';
    
    if (otherUserPresence.online) {
      return 'Online';
    }
    
    // Show last seen timestamp
    try {
      const lastSeenDate = new Date(otherUserPresence.lastSeen);
      const now = new Date();
      const diffInSeconds = Math.floor((now.getTime() - lastSeenDate.getTime()) / 1000);
      
      // If less than 1 minute, show "just now"
      if (diffInSeconds < 60) {
        return 'Last seen just now';
      }
      
      const distance = formatDistanceToNow(lastSeenDate, { addSuffix: false })
        .replace('about ', '')
        .replace('less than ', '');
      
      return `Last seen ${distance} ago`;
    } catch (error) {
      return '';
    }
  }, [otherUserPresence]);

  /**
   * Key extractor for FlatList
   * 
   * WHY: React needs unique keys for list items
   * WHAT: Returns message ID
   */
  const keyExtractor = useCallback((item: Message) => item.id, []);

  /**
   * Render empty state when no messages exist
   *
   * WHY: FlatList is inverted, so we need to counter-flip the empty state
   * WHAT: Wraps empty state in a container that re-inverts the view
   */
  const renderEmptyState = useCallback(() => (
    <View style={styles.emptyWrapper}>
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No messages yet</Text>
        <Text style={styles.emptySubtext}>Send a message to start the conversation</Text>
      </View>
    </View>
  ), []);

  // Loading state
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#25D366" />
        <Text style={styles.loadingText}>Loading messages...</Text>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <>
      {/* Header is updated dynamically via useLayoutEffect above */}
      
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Connection status banner */}
        <ConnectionBanner />

        {/* Messages list */}
        <FlatList
          data={messages}
          renderItem={renderMessage}
          keyExtractor={keyExtractor}
          inverted // Newest messages at bottom (WhatsApp style)
          contentContainerStyle={styles.messageList}
          style={styles.flatList}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          ListEmptyComponent={renderEmptyState}
        />

        {/* Typing indicator */}
        {isOtherUserTyping && <TypingIndicator userName={otherUser?.displayName} />}

        {/* Message input - only render when we have valid data */}
        {chatId && currentUser?.id && (
          <MessageInput 
            onSend={handleSendMessage} 
            chatId={chatId as string}
            userId={currentUser.id}
          />
        )}
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ECE5DD', // WhatsApp chat background color
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ECE5DD',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 16,
    color: '#F44336',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  flatList: {
    flex: 1,
  },
  messageList: {
    paddingVertical: 8,
  },
  emptyWrapper: {
    transform: [{ scaleY: -1 }],
    width: '100%',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    fontWeight: '600',
    writingDirection: 'ltr', // Force left-to-right text direction
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    writingDirection: 'ltr', // Force left-to-right text direction
    textAlign: 'center',
  },
});


