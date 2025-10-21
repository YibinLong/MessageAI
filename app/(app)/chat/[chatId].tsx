/**
 * Chat Screen
 * 
 * Main messaging interface showing message list and input field.
 * Implements real-time messaging, offline support, and optimistic UI.
 * 
 * WHY: This is the core screen where users send and receive messages
 * WHAT: Message list + input field + real-time sync + offline queue
 */

import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Text } from 'react-native-paper';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useAuthStore } from '../../../stores/authStore';
import { ConnectionBanner } from '../../../components/ConnectionBanner';
import { MessageBubble } from '../../../components/MessageBubble';
import { MessageInput } from '../../../components/MessageInput';
import { useNetworkStatus } from '../../../hooks/useNetworkStatus';
import { 
  sendMessage, 
  subscribeToMessages, 
  loadMessagesFromCache,
  retryUnsentMessages 
} from '../../../services/messageService';
import { getChatById } from '../../../services/chatService';
import { getUserById } from '../../../services/userService';
import { Message, User } from '../../../types';

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
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [otherUser, setOtherUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load chat metadata and other user's profile
   * 
   * WHY: We need to show the other person's name in the header
   * WHAT: Fetches chat from Firestore, then fetches the other participant's profile
   */
  useEffect(() => {
    async function loadChatData() {
      try {
        if (!chatId || !currentUser) return;

        console.log('[ChatScreen] Loading chat data for:', chatId);

        // Get chat metadata
        const chat = await getChatById(chatId);
        if (!chat) {
          setError('Chat not found');
          return;
        }

        // Find the other participant (not current user)
        const otherUserId = chat.participants.find(id => id !== currentUser.id);
        if (!otherUserId) {
          setError('No other participant found');
          return;
        }

        // Load other user's profile
        const otherUserData = await getUserById(otherUserId);
        if (otherUserData) {
          setOtherUser(otherUserData);
        }
      } catch (err) {
        console.error('[ChatScreen] Failed to load chat data:', err);
        setError('Failed to load chat');
      }
    }

    loadChatData();
  }, [chatId, currentUser]);

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
    if (!chatId) return;

    console.log('[ChatScreen] Setting up real-time message listener');

    const unsubscribe = subscribeToMessages(chatId, (newMessages) => {
      console.log('[ChatScreen] Received', newMessages.length, 'messages from Firestore');
      setMessages(newMessages);
    });

    // Cleanup listener on unmount
    return () => {
      console.log('[ChatScreen] Cleaning up message listener');
      unsubscribe();
    };
  }, [chatId]);

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
   * WHAT: Returns MessageBubble component
   */
  const renderMessage = useCallback(({ item }: { item: Message }) => {
    const isSent = item.senderId === currentUser?.id;
    return <MessageBubble message={item} isSent={isSent} />;
  }, [currentUser]);

  /**
   * Key extractor for FlatList
   * 
   * WHY: React needs unique keys for list items
   * WHAT: Returns message ID
   */
  const keyExtractor = useCallback((item: Message) => item.id, []);

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
      {/* Update header with other user's name */}
      <Stack.Screen
        options={{
          title: otherUser?.displayName || 'Chat',
        }}
      />

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
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No messages yet</Text>
              <Text style={styles.emptySubtext}>Send a message to start the conversation</Text>
            </View>
          }
        />

        {/* Message input */}
        <MessageInput onSend={handleSendMessage} />
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
    transform: [{ scaleY: -1 }], // Flip back (since FlatList is inverted)
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
});


