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
import { View, StyleSheet, FlatList, RefreshControl, Alert, ScrollView, Modal, TouchableOpacity, Pressable } from 'react-native';
import { Appbar, FAB, Text, ActivityIndicator, Chip, Divider } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
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
import { listenToPresence, PresenceData, updatePresence } from '../../services/presenceService';

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
  const [userPresence, setUserPresence] = useState<Map<string, PresenceData>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  
  // AI Filter State
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSentiment, setSelectedSentiment] = useState<string>('all');
  
  // Agent State
  const [pendingSuggestionsCount, setPendingSuggestionsCount] = useState(0);
  
  // Ref to track previous connection state for auto-refresh
  const wasOfflineRef = useRef(false);
  
  // Ref to store presence listener cleanup functions
  const presenceListenersRef = useRef<Map<string, () => void>>(new Map());
  

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

    // Load from SQLite first (instant)
    loadChatsFromCache();

    // Then set up real-time listener
    const unsubscribe = listenToUserChats(currentUser.id, handleChatsUpdate);

    // Cleanup listener on unmount
    return () => {
      unsubscribe();
      
      // Clean up all presence listeners
      const listeners = presenceListenersRef.current;
      listeners.forEach(unsubscribe => unsubscribe());
      listeners.clear();
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
      handleRefresh();
      wasOfflineRef.current = false;
    } else if (!isConnected) {
      wasOfflineRef.current = true;
    }
  }, [isConnected, currentUser]);

  /**
   * Listen to pending suggestions count for badge
   * 
   * WHY: Show badge on FAQ Settings to indicate pending actions
   * WHAT: Real-time listener for pending suggested actions
   */
  useEffect(() => {
    if (!currentUser) return;

    // Store unsubscribe function to clean up on unmount
    let unsubscribe: (() => void) | undefined;

    // Import agentService dynamically to avoid circular deps
    import('../../services/agentService').then(({ listenToSuggestedActions }) => {
      unsubscribe = listenToSuggestedActions(currentUser.id, (actions) => {
        setPendingSuggestionsCount(actions.length);
      });
    });

    // Return cleanup function that calls unsubscribe if it exists
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [currentUser]);

  /**
   * Load chats from SQLite cache
   * 
   * WHY: Provide instant display even when offline
   * WHAT: Reads chats from local SQLite database
   */
  const loadChatsFromCache = async () => {
    try {
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
    setChats(updatedChats);
    setLoading(false);
    setRefreshing(false);
    
    // Load user profiles for new chats
    await loadUserProfiles(updatedChats);
  };

  /**
   * Set up presence listeners for users
   * 
   * WHY: Need to show online/offline status in real-time
   * WHAT: Sets up Realtime Database listeners for each user
   * 
   * @param userIds - User IDs to track presence for
   */
  const setupPresenceListeners = (userIds: string[]) => {
    const existingListeners = presenceListenersRef.current;
    
    userIds.forEach(userId => {
      // Skip if listener already exists
      if (existingListeners.has(userId)) return;
      
      // Set up presence listener
      const unsubscribe = listenToPresence(userId, (presence) => {
        setUserPresence(prev => {
          const newMap = new Map(prev);
          if (presence) {
            newMap.set(userId, presence);
          } else {
            newMap.delete(userId);
          }
          return newMap;
        });
      });
      
      existingListeners.set(userId, unsubscribe);
    });
  };

  /**
   * Load user profiles for all chat participants
   * 
   * WHY: Need to display names and photos in chat list
   * WHAT: Fetches user documents for all unique participants and sets up presence tracking
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
      
      // Set up presence listeners for all users
      setupPresenceListeners(Array.from(userIds));
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
      // Force fetch from Firestore (bypasses cache)
      const latestChats = await getUserChats(currentUser.id);
      setChats(latestChats);
      
      // Reload user profiles
      await loadUserProfiles(latestChats);
    } catch (error) {
      console.error('[ChatList] Refresh failed:', error);
      Alert.alert('Error', 'Failed to refresh chats');
    } finally {
      setRefreshing(false);
    }
  };

  /**
   * Handle category filter change
   * 
   * WHY: When user selects "All" categories, also reset sentiment filter
   * WHAT: Sets category and resets sentiment to 'all' if category is 'all'
   * 
   * @param category - Category to filter by
   */
  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    // Reset sentiment filter when "All" is selected for better UX
    if (category === 'all') {
      setSelectedSentiment('all');
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
              // Update user presence to offline in Realtime Database
              // WHY: This ensures other users see the green dot disappear immediately
              if (currentUser) {
                await updatePresence(currentUser.id, false);
              }
              
              // Sign out from Firebase
              await signOut();
              
              // Clear Zustand store
              clearUser();
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
   * WHAT: Uses ChatListItem component with presence data
   */
  const renderChatItem = ({ item }: { item: Chat }) => {
    const otherUser = getOtherUser(item);
    
    // Get online status for the other user (1:1 chats only)
    let isOnline = false;
    if (item.type === '1:1' && otherUser) {
      const presence = userPresence.get(otherUser.id);
      isOnline = presence?.online || false;
    }
    
    return (
      <ChatListItem
        chat={item}
        currentUserId={currentUser?.id || ''}
        otherUser={otherUser}
        isOnline={isOnline}
        onPress={() => handleChatPress(item.id)}
      />
    );
  };

  /**
   * Filter chats based on selected category and sentiment
   * 
   * WHY: Allow users to filter chats by AI-detected category/sentiment
   * WHAT: Filters chat list and sorts high-priority chats to top
   */
  const getFilteredChats = (): Chat[] => {
    let filtered = [...chats];

    // Filter by category
    if (selectedCategory !== 'all') {
      if (selectedCategory === 'priority') {
        // High priority = collaboration score > 7
        filtered = filtered.filter(chat => 
          (chat.lastMessage as any)?.aiCollaborationScore > 7
        );
      } else {
        filtered = filtered.filter(chat => 
          (chat.lastMessage as any)?.aiCategory === selectedCategory
        );
      }
    }

    // Filter by sentiment
    if (selectedSentiment !== 'all') {
      filtered = filtered.filter(chat => 
        (chat.lastMessage as any)?.aiSentiment === selectedSentiment
      );
    }

    // Sort: high-priority chats first, then by update time
    return filtered.sort((a, b) => {
      const aScore = (a.lastMessage as any)?.aiCollaborationScore || 0;
      const bScore = (b.lastMessage as any)?.aiCollaborationScore || 0;
      const aIsPriority = aScore > 7;
      const bIsPriority = bScore > 7;

      if (aIsPriority && !bIsPriority) return -1;
      if (!aIsPriority && bIsPriority) return 1;

      // Same priority level, sort by time
      // Handle null/undefined updatedAt fields
      const aTime = a.updatedAt?.toMillis?.() || 0;
      const bTime = b.updatedAt?.toMillis?.() || 0;
      return bTime - aTime;
    });
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
        <Appbar.Action
          icon="dots-vertical"
          onPress={() => setMenuVisible(true)}
        />
      </Appbar.Header>

      {/* Custom Menu Modal (replaces buggy Paper Menu) */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable 
          style={styles.modalOverlay} 
          onPress={() => setMenuVisible(false)}
        >
          <View style={styles.menuContainer}>
            {/* Edit Profile */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleEditProfile}
              activeOpacity={0.7}
            >
              <Ionicons name="person-outline" size={22} color="#333" style={styles.menuIcon} />
              <Text style={styles.menuText}>Edit Profile</Text>
            </TouchableOpacity>

            <Divider style={styles.menuDivider} />

            {/* FAQ Settings */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                router.push('/(app)/faq-settings');
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="help-circle-outline" size={22} color="#333" style={styles.menuIcon} />
              <Text style={styles.menuText}>FAQ Settings</Text>
            </TouchableOpacity>

            <Divider style={styles.menuDivider} />

            {/* Smart Replies (AI Agent) */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                router.push('/(app)/smart-replies');
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="sparkles-outline" size={22} color="#333" style={styles.menuIcon} />
              <Text style={styles.menuText}>Smart Replies</Text>
              {pendingSuggestionsCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{pendingSuggestionsCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            <Divider style={styles.menuDivider} />

            {/* Sign Out */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleSignOut}
              activeOpacity={0.7}
            >
              <Ionicons name="log-out-outline" size={22} color="#F44336" style={styles.menuIcon} />
              <Text style={[styles.menuText, styles.menuTextDanger]}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Connection Banner */}
      <ConnectionBanner />

      {/* AI Filter Chips */}
      {!loading && chats.length > 0 && (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.filterContainer}
          contentContainerStyle={styles.filterContent}
        >
          {/* Category Filters */}
          <Text variant="labelSmall" style={styles.filterLabel}>Category:</Text>
          <Chip
            selected={selectedCategory === 'all'}
            onPress={() => handleCategoryChange('all')}
            style={styles.filterChip}
            showSelectedCheck={true}
          >
            All
          </Chip>
          <Chip
            selected={selectedCategory === 'priority'}
            onPress={() => handleCategoryChange('priority')}
            style={styles.filterChip}
            icon="star"
            showSelectedCheck={true}
          >
            Priority
          </Chip>
          <Chip
            selected={selectedCategory === 'fan'}
            onPress={() => handleCategoryChange('fan')}
            style={styles.filterChip}
            showSelectedCheck={true}
          >
            Fan
          </Chip>
          <Chip
            selected={selectedCategory === 'business'}
            onPress={() => handleCategoryChange('business')}
            style={styles.filterChip}
            showSelectedCheck={true}
          >
            Business
          </Chip>
          <Chip
            selected={selectedCategory === 'spam'}
            onPress={() => handleCategoryChange('spam')}
            style={styles.filterChip}
            showSelectedCheck={true}
          >
            Spam
          </Chip>
          <Chip
            selected={selectedCategory === 'urgent'}
            onPress={() => handleCategoryChange('urgent')}
            style={styles.filterChip}
            showSelectedCheck={true}
          >
            Urgent
          </Chip>
          
          {/* Sentiment Filters */}
          <View style={styles.filterDivider} />
          
          <Text variant="labelSmall" style={styles.filterLabel}>Sentiment:</Text>
          <Chip
            selected={selectedSentiment === 'all'}
            onPress={() => setSelectedSentiment('all')}
            style={styles.filterChip}
            showSelectedCheck={true}
          >
            All
          </Chip>
          <Chip
            selected={selectedSentiment === 'positive'}
            onPress={() => setSelectedSentiment('positive')}
            style={styles.filterChip}
            icon="emoticon-happy-outline"
            showSelectedCheck={true}
          >
            Positive
          </Chip>
          <Chip
            selected={selectedSentiment === 'neutral'}
            onPress={() => setSelectedSentiment('neutral')}
            style={styles.filterChip}
            icon="emoticon-neutral-outline"
            showSelectedCheck={true}
          >
            Neutral
          </Chip>
          <Chip
            selected={selectedSentiment === 'negative'}
            onPress={() => setSelectedSentiment('negative')}
            style={styles.filterChip}
            icon="emoticon-sad-outline"
            showSelectedCheck={true}
          >
            Negative
          </Chip>
        </ScrollView>
      )}

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
          data={getFilteredChats()}
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
          contentContainerStyle={getFilteredChats().length === 0 ? styles.emptyList : undefined}
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
  filterContainer: {
    maxHeight: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
  },
  filterContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  filterLabel: {
    alignSelf: 'center',
    color: '#666',
    marginHorizontal: 8,
    fontWeight: '600',
  },
  filterChip: {
    marginHorizontal: 4,
  },
  filterDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#ddd',
    marginHorizontal: 12,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 56, // Below app bar
    paddingRight: 8,
  },
  menuContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    minWidth: 200,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  menuIcon: {
    marginRight: 16,
    width: 24,
  },
  menuText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  menuTextDanger: {
    color: '#F44336',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#e0e0e0',
  },
  badge: {
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
