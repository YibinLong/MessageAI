/**
 * Chat List Screen
 * 
 * This is the main screen of the app, showing a list of all conversations.
 * Features:
 * - Real-time updates from Firestore
 * - Offline support with SQLite cache
 * - Pull-to-refresh
 * - Unread message counts
 * - FAB to create new chats
 * 
 * WHY: Central hub for navigating to all conversations
 * WHAT: FlatList of chats with real-time sync and offline fallback
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert } from 'react-native';
import { Appbar, FAB, Text, ActivityIndicator, Menu } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import { signOut } from '../../services/auth';
import { updateUserPresence, getUserById } from '../../services/userService';
import { listenToUserChats, getUserChats } from '../../services/chatService';
import { getAllChats as getSQLiteChats } from '../../services/sqlite';
import { Chat, User } from '../../types';
import { ChatListItem } from '../../components/ChatListItem';
import { ConnectionBanner } from '../../components/ConnectionBanner';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { Timestamp } from 'firebase/firestore';

/**
 * Chat List Screen Component
 * 
 * WHAT: Displays all user's conversations in a scrollable list
 * WHY: Main navigation hub for the messaging app
 */
export default function ChatListScreen() {
  const router = useRouter();
  const { user: currentUser, clearUser } = useAuthStore();
  const { isConnected } = useNetworkStatus();
  
  // State
  const [chats, setChats] = useState<Chat[]>([]);
  const [userProfiles, setUserProfiles] = useState<Map<string, User>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  
  // Ref to track previous connection state for auto-refresh
  const wasOfflineRef = useRef(false);

  /**
   * Load chats on mount
   * 
   * WHY: Need to display chats immediately when screen loads
   * WHAT: 
   * 1. Load chats from SQLite (instant)
   * 2. Set up Firestore real-time listener
   * 3. Fetch user profiles for all participants
   */
  useEffect(() => {
    if (!currentUser) return;

    console.log('[ChatList] Loading chats for user:', currentUser.id);

    // Load from SQLite first (instant)
    loadChatsFromCache();

    // Then set up real-time listener
    const unsubscribe = listenToUserChats(currentUser.id, handleChatsUpdate);

    // Cleanup listener on unmount
    return () => {
      console.log('[ChatList] Cleaning up chat listener');
      unsubscribe();
    };
  }, [currentUser]);

  /**
   * Auto-refresh when network reconnects
   * 
   * WHY: When user goes back online, we need to fetch latest messages immediately
   * WHAT: Triggers handleRefresh when isConnected changes from false to true
   */
  useEffect(() => {
    if (isConnected && wasOfflineRef.current && currentUser) {
      console.log('[ChatList] Network reconnected, auto-refreshing chats...');
      handleRefresh();
      wasOfflineRef.current = false;
    } else if (!isConnected) {
      wasOfflineRef.current = true;
    }
  }, [isConnected, currentUser]);

  /**
   * Load chats from SQLite cache
   * 
   * WHY: Provide instant display even when offline
   * WHAT: Reads chats from local SQLite database
   */
  const loadChatsFromCache = async () => {
    try {
      console.log('[ChatList] Loading chats from SQLite cache...');
      const cachedChats = await getSQLiteChats();
      
      // Convert SQLite chats to Chat objects
      const chatsFromCache: Chat[] = cachedChats.map(sqliteChat => ({
        id: sqliteChat.id,
        type: sqliteChat.type as '1:1' | 'group',
        participants: JSON.parse(sqliteChat.participants),
        name: sqliteChat.name,
        photoURL: sqliteChat.photoURL,
        lastMessage: sqliteChat.lastMessage ? JSON.parse(sqliteChat.lastMessage) : undefined,
        updatedAt: Timestamp.fromMillis(sqliteChat.updatedAt),
        createdAt: Timestamp.fromMillis(sqliteChat.createdAt),
        createdBy: '', // Not stored in SQLite
        unreadCount: sqliteChat.unreadCount || 0,
      }));

      console.log(`[ChatList] Loaded ${chatsFromCache.length} chats from cache`);
      setChats(chatsFromCache);
      
      // Load user profiles for cached chats
      await loadUserProfiles(chatsFromCache);
      
      setLoading(false);
    } catch (error) {
      console.error('[ChatList] Failed to load chats from cache:', error);
      setLoading(false);
    }
  };

  /**
   * Handle real-time chat updates from Firestore
   * 
   * WHY: Keep chat list current with latest messages
   * WHAT: Called by Firestore listener when chats change
   * 
   * @param updatedChats - Latest chats from Firestore
   */
  const handleChatsUpdate = async (updatedChats: Chat[]) => {
    console.log(`[ChatList] Received ${updatedChats.length} chats from Firestore`);
    setChats(updatedChats);
    setLoading(false);
    setRefreshing(false);
    
    // Load user profiles for new chats
    await loadUserProfiles(updatedChats);
  };

  /**
   * Load user profiles for all chat participants
   * 
   * WHY: Need to display names and photos in chat list
   * WHAT: Fetches user documents for all unique participants
   * 
   * @param chatsToProcess - Chats to load profiles for
   */
  const loadUserProfiles = async (chatsToProcess: Chat[]) => {
    if (!currentUser) return;

    try {
      // Get unique user IDs from all chats (excluding current user)
      const userIds = new Set<string>();
      chatsToProcess.forEach(chat => {
        chat.participants.forEach(participantId => {
          if (participantId !== currentUser.id) {
            userIds.add(participantId);
          }
        });
      });

      console.log(`[ChatList] Loading ${userIds.size} user profiles...`);

      // Fetch each user profile
      const newProfiles = new Map(userProfiles);
      for (const userId of userIds) {
        // Skip if already loaded
        if (newProfiles.has(userId)) continue;

        try {
          const userProfile = await getUserById(userId);
          if (userProfile) {
            newProfiles.set(userId, userProfile);
          }
        } catch (error) {
          console.warn(`[ChatList] Failed to load profile for user ${userId}:`, error);
        }
      }

      setUserProfiles(newProfiles);
      console.log(`[ChatList] Loaded ${newProfiles.size} user profiles`);
    } catch (error) {
      console.error('[ChatList] Failed to load user profiles:', error);
    }
  };

  /**
   * Handle pull-to-refresh
   * 
   * WHY: Allow manual refresh of chat list
   * WHAT: Fetches latest chats from Firestore and updates UI immediately
   */
  const handleRefresh = async () => {
    if (!currentUser) return;

    setRefreshing(true);
    try {
      console.log('[ChatList] Refreshing chats...');
      // Force fetch from Firestore (bypasses cache)
      const latestChats = await getUserChats(currentUser.id);
      setChats(latestChats);
      
      // Reload user profiles
      await loadUserProfiles(latestChats);
      
      console.log('[ChatList] Refresh complete');
    } catch (error) {
      console.error('[ChatList] Refresh failed:', error);
      Alert.alert('Error', 'Failed to refresh chats');
    } finally {
      setRefreshing(false);
    }
  };

  /**
   * Handle chat item press
   * 
   * WHY: Navigate to chat screen when user taps a chat
   * WHAT: Opens the chat conversation screen
   * 
   * @param chatId - ID of chat to open
   */
  const handleChatPress = (chatId: string) => {
    router.push(`/(app)/chat/${chatId}`);
  };

  /**
   * Handle new chat button press
   * 
   * WHY: Allow users to start new conversations
   * WHAT: Navigate to contact picker screen
   */
  const handleNewChat = () => {
    router.push('/(app)/new-chat');
  };

  /**
   * Handle edit profile
   * 
   * WHY: Allow users to update their profile
   * WHAT: Navigate to edit profile screen
   */
  const handleEditProfile = () => {
    setMenuVisible(false);
    router.push('/(app)/edit-profile');
  };

  /**
   * Handle sign out
   * 
   * WHY: Allow users to log out
   * WHAT: Signs out from Firebase and clears local state
   */
  const handleSignOut = async () => {
    setMenuVisible(false);
    
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('[ChatList] Signing out...');
              
              // Update user presence to offline
              if (currentUser) {
                await updateUserPresence(currentUser.id, false);
              }
              
              // Sign out from Firebase
              await signOut();
              
              // Clear Zustand store
              clearUser();
              
              console.log('[ChatList] Signed out successfully');
            } catch (error: any) {
              console.error('[ChatList] Sign out failed:', error);
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  /**
   * Get the other user in a 1:1 chat
   * 
   * WHY: Need to display other user's name and photo
   * WHAT: Filters out current user from participants
   * 
   * @param chat - Chat to get other user from
   * @returns User object or undefined
   */
  const getOtherUser = (chat: Chat): User | undefined => {
    if (!currentUser || chat.type !== '1:1') return undefined;
    
    const otherUserId = chat.participants.find(id => id !== currentUser.id);
    if (!otherUserId) return undefined;
    
    return userProfiles.get(otherUserId);
  };

  /**
   * Render a single chat item
   * 
   * WHY: Display each chat in the list
   * WHAT: Uses ChatListItem component
   */
  const renderChatItem = ({ item }: { item: Chat }) => {
    const otherUser = getOtherUser(item);
    
    return (
      <ChatListItem
        chat={item}
        currentUserId={currentUser?.id || ''}
        otherUser={otherUser}
        onPress={() => handleChatPress(item.id)}
      />
    );
  };

  /**
   * Render empty state
   * 
   * WHY: Provide feedback when no chats exist
   * WHAT: Shows message prompting user to start a chat
   */
  const renderEmptyState = () => {
    if (loading) {
      return null;
    }

    return (
      <View style={styles.emptyState}>
        <Text variant="headlineSmall" style={styles.emptyTitle}>
          No chats yet
        </Text>
        <Text variant="bodyLarge" style={styles.emptyText}>
          Tap the + button to start a conversation
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* App Bar */}
      <Appbar.Header>
        <Appbar.Content title="MessageAI" />
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <Appbar.Action
              icon="dots-vertical"
              onPress={() => setMenuVisible(true)}
            />
          }
        >
          <Menu.Item
            onPress={handleEditProfile}
            title="Edit Profile"
            leadingIcon="account-edit"
          />
          <Menu.Item
            onPress={handleSignOut}
            title="Sign Out"
            leadingIcon="logout"
          />
        </Menu>
      </Appbar.Header>

      {/* Connection Banner */}
      <ConnectionBanner />

      {/* Loading Indicator */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#25D366" />
          <Text style={styles.loadingText}>Loading chats...</Text>
        </View>
      )}

      {/* Chat List */}
      {!loading && (
        <FlatList
          data={chats}
          keyExtractor={(item) => item.id}
          renderItem={renderChatItem}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#25D366']}
            />
          }
          contentContainerStyle={chats.length === 0 ? styles.emptyList : undefined}
        />
      )}

      {/* Floating Action Button (New Chat) */}
      <FAB
        icon="message-plus"
        style={styles.fab}
        onPress={handleNewChat}
        color="#fff"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    color: '#666',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    color: '#25D366',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptyText: {
    color: '#999',
    textAlign: 'center',
  },
  emptyList: {
    flex: 1,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: '#25D366',
  },
});
