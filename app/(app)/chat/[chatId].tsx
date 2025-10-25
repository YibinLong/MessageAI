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
import { View, StyleSheet, FlatList, ActivityIndicator, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { useLocalSearchParams, Stack, useFocusEffect, useNavigation } from 'expo-router';
import { useAuthStore } from '../../../stores/authStore';
import { ConnectionBanner } from '../../../components/ConnectionBanner';
import { MessageBubble } from '../../../components/MessageBubble';
import { MessageInput } from '../../../components/MessageInput';
import { TypingIndicator } from '../../../components/TypingIndicator';
import { ImageViewer } from '../../../components/ImageViewer';
import { useNetworkStatus } from '../../../hooks/useNetworkStatus';
import { subscribeToUserTyping } from '../../../services/typingService';
import { 
  sendMessage, 
  sendImageMessage,
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
import { PresenceData } from '../../../services/presenceService';
import { usePresenceStore } from '../../../stores/presenceStore';
import { formatDistanceToNow } from 'date-fns';

/**
 * Custom Header Title Component
 * 
 * WHY: Navigation headers need proper multi-line support for title + subtitle
 * WHAT: Renders title and optional subtitle with proper styling
 * 
 * This replaces the hacky newline approach which caused rendering issues
 */
interface HeaderTitleProps {
  title: string;
  subtitle?: string;
}

function HeaderTitle({ title, subtitle }: HeaderTitleProps) {
  return (
    <View style={headerStyles.container}>
      <Text style={headerStyles.title} numberOfLines={1}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={headerStyles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const headerStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#e9edef',
  },
  subtitle: {
    fontSize: 12,
    color: '#d1d5d7',
    marginTop: 2,
  },
});

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
  
  // Get presence store
  const { startListening, stopListening, presenceMap } = usePresenceStore();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [chat, setChat] = useState<Chat | null>(null);
  const [otherUser, setOtherUser] = useState<User | null>(null);
  const [participantProfiles, setParticipantProfiles] = useState<Map<string, User>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string>('');

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
      } catch (err) {
        console.error('[ChatScreen] Failed to load chat data:', err);
        setError('Failed to load chat');
      }
    }

    loadChatData();
  }, [chatId, currentUser]);

  /**
   * Set up presence listener for other user using global store (1:1 chats only)
   * 
   * WHY: Show online/offline status and last seen in chat header
   * WHAT: Uses global presence store - when presence updates here, it updates EVERYWHERE
   * 
   * THIS IS THE KEY: When we detect someone went offline in this chat screen,
   * the global store updates, and the green dot on the chat list disappears instantly!
   */
  useEffect(() => {
    if (!otherUser || chat?.type === 'group') return; // Only for 1:1 chats
    
    // Start listening via global store
    startListening(otherUser.id);

    // Cleanup: stop listening when unmounting
    return () => {
      stopListening(otherUser.id);
    };
  }, [otherUser, chat, startListening, stopListening]);

  /**
   * Update header title dynamically with presence info from global store
   * 
   * WHY: Need to show chat name and presence status reactively
   * WHAT: Reads presence from global store and updates navigation header
   * 
   * HOW IT WORKS WITH GLOBAL STORE:
   * - presenceMap is reactive (from Zustand)
   * - When presence updates in ANY screen, this effect re-runs
   * - Header shows current online/offline status instantly
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
      // 1:1 chat: show user name and presence from GLOBAL store
      title = otherUser?.displayName || 'Chat';
      
      // Get presence from global store
      const otherUserPresence = otherUser ? presenceMap.get(otherUser.id) : null;
      
      // Format presence status with client-side staleness detection
      if (otherUserPresence) {
        // CLIENT-SIDE STALENESS CHECK
        // WHY: Don't wait for Firebase listener to update, check heartbeat immediately
        // WHAT: If lastHeartbeat exists and is older than 4s, treat as offline
        let isActuallyOnline = otherUserPresence.online;
        
        if (isActuallyOnline && otherUserPresence.lastHeartbeat) {
          const heartbeatAge = Date.now() - otherUserPresence.lastHeartbeat;
          if (heartbeatAge > 4000) { // 4 second threshold
            console.log(`[ChatScreen] Stale heartbeat detected: ${heartbeatAge}ms old, showing offline`);
            isActuallyOnline = false;
          }
        }
        
        if (isActuallyOnline) {
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
      // Use custom header component for proper title + subtitle rendering
      // WHY: Avoids newline hack which causes rendering issues
      // WHAT: Passes a React component that properly styles multi-line headers
      headerTitle: () => <HeaderTitle title={title} subtitle={subtitle} />,
    });
  }, [chat, otherUser, presenceMap, navigation]);

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

    const unsubscribe = subscribeToMessages(chatId, async (newMessages) => {
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
      retryUnsentMessages(chatId);
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

    const unsubscribe = subscribeToUserTyping(
      chatId,
      otherUser.id,
      (isTyping) => {
        setIsOtherUserTyping(isTyping);
      }
    );

    // Cleanup listener on unmount
    return () => {
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
   * Handle sending an image message
   * 
   * WHY: User selected image to send
   * WHAT: Calls sendImageMessage service which compresses, uploads, and creates message
   */
  const handleSendImage = useCallback(async (imageUri: string) => {
    if (!chatId || !currentUser) {
      console.error('[ChatScreen] Cannot send image: missing chatId or currentUser');
      return;
    }

    try {
      // Send image message (compresses, uploads to Storage, creates message)
      await sendImageMessage(chatId, imageUri, currentUser.id);
    } catch (err) {
      console.error('[ChatScreen] Failed to send image:', err);
      throw err; // Re-throw so MessageInput can show error
    }
  }, [chatId, currentUser]);

  /**
   * Handle image press in message bubble
   * 
   * WHY: User tapped an image in chat
   * WHAT: Opens full-screen image viewer
   */
  const handleImagePress = useCallback((imageUrl: string) => {
    setSelectedImageUrl(imageUrl);
    setImageViewerVisible(true);
  }, []);

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
        onImagePress={handleImagePress}
      />
    );
  }, [currentUser, chat, participantProfiles, handleImagePress]);

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
   * WHY: FlatList needs an empty component, but we don't want to show any text
   * WHAT: Returns null (empty view)
   */
  const renderEmptyState = useCallback(() => null, []);

  // Loading state
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#128c7e" />
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

  /**
   * Get last received message (not sent by current user)
   * 
   * WHY: AI Draft needs context of what message to respond to
   * WHAT: Returns text of most recent message from other participant
   */
  const getLastReceivedMessage = (): string | undefined => {
    if (!messages || !currentUser) return undefined;
    
    // Find most recent message NOT sent by current user
    const receivedMessages = messages.filter(msg => msg.senderId !== currentUser.id);
    if (receivedMessages.length === 0) return undefined;
    
    return receivedMessages[0].text; // Messages are sorted newest first
  };

  return (
    <>
      {/* Header is updated dynamically via useLayoutEffect above */}
      
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 106 : 0}
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
            onSendImage={handleSendImage}
            chatId={chatId as string}
            userId={currentUser.id}
            lastReceivedMessage={getLastReceivedMessage()}
          />
        )}
      </KeyboardAvoidingView>

      {/* Image Viewer Modal */}
      <ImageViewer
        visible={imageViewerVisible}
        imageUrl={selectedImageUrl}
        onClose={() => setImageViewerVisible(false)}
      />
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
    direction: 'ltr', // Force left-to-right layout direction
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
    direction: 'ltr', // Force left-to-right layout direction
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    fontWeight: '600',
    textAlign: 'center',
    direction: 'ltr', // Force left-to-right layout direction
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
    direction: 'ltr', // Force left-to-right layout direction
  },
});


