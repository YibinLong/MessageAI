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

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, ScrollView, Alert } from 'react-native';
import { FAB, Text, ActivityIndicator, Chip } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import { getUserById } from '../../services/userService';
import { listenToUserChats, getUserChats } from '../../services/chatService';
import { getAllChats as getSQLiteChats } from '../../services/sqlite';
import { Chat, User } from '../../types';
import { ChatListItem } from '../../components/ChatListItem';
import { ConnectionBanner } from '../../components/ConnectionBanner';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { Timestamp } from 'firebase/firestore';
import { firestoreChatDataToChat } from '../../utils/firestoreConverters';
import { timestampToMillis } from '../../utils/dateUtils';
import { usePresenceStore } from '../../stores/presenceStore';

/**
 * Chat List Screen Component
 * 
 * WHAT: Displays all user's conversations in a scrollable list
 * WHY: Main navigation hub for the messaging app
 */
export default function ChatListScreen() {
  const router = useRouter();
  const { user: currentUser } = useAuthStore();
  const { isConnected } = useNetworkStatus();
  
  // Check if user is a content creator (default to true for existing users)
  const isContentCreator = currentUser?.isContentCreator ?? true;
  
  // Get presence store
  const { startListening, stopListening, presenceMap } = usePresenceStore();
  
  // State
  const [chats, setChats] = useState<Chat[]>([]);
  const [userProfiles, setUserProfiles] = useState<Map<string, User>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // AI Filter State
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSentiment, setSelectedSentiment] = useState<string>('all');
  
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

    // Load from SQLite first (instant)
    loadChatsFromCache();

    // Then set up real-time listener
    const unsubscribe = listenToUserChats(currentUser.id, handleChatsUpdate);

    // Cleanup listener on unmount
    return () => {
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
      const cachedChats = await getSQLiteChats();
      
      const chatsFromCache: Chat[] = cachedChats.map(sqliteChat => ({
        id: sqliteChat.id,
        type: sqliteChat.type as '1:1' | 'group',
        participants: JSON.parse(sqliteChat.participants),
        name: sqliteChat.name,
        photoURL: sqliteChat.photoURL,
        lastMessage: sqliteChat.lastMessage ? JSON.parse(sqliteChat.lastMessage) : undefined,
        updatedAt: Timestamp.fromMillis(sqliteChat.updatedAt),
        createdAt: Timestamp.fromMillis(sqliteChat.createdAt),
        createdBy: '',
        unreadCount: sqliteChat.unreadCount || 0,
      }));

      setChats(chatsFromCache);
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
   * Set up presence listeners for users using global store
   * 
   * WHY: Need to show online/offline status in real-time
   * WHAT: Delegates to global presence store which handles all the heavy lifting
   * 
   * BENEFITS:
   * - Single listener per user across entire app (efficient)
   * - Automatic staleness detection from presenceService
   * - Instant consistency across all screens
   * 
   * @param userIds - User IDs to track presence for
   */
  const setupPresenceListeners = (userIds: string[]) => {
    userIds.forEach(userId => {
      // Start listening via global store
      // WHY: Store handles deduplication, so safe to call multiple times
      startListening(userId);
    });
  };

  /**
   * Load user profiles for all chat participants (optimized with Promise.all)
   * 
   * WHY: Need to display names and photos in chat list
   * WHAT: Batch fetches user documents in parallel, then sets up presence tracking
   * 
   * @param chatsToProcess - Chats to load profiles for
   */
  const loadUserProfiles = async (chatsToProcess: Chat[]) => {
    if (!currentUser) return;

    try {
      const userIds = new Set<string>();
      chatsToProcess.forEach(chat => {
        chat.participants.forEach(participantId => {
          if (participantId !== currentUser.id) {
            userIds.add(participantId);
          }
        });
      });

      const newProfiles = new Map(userProfiles);
      const userIdsToFetch = Array.from(userIds).filter(id => !newProfiles.has(id));
      
      if (userIdsToFetch.length > 0) {
        const results = await Promise.allSettled(
          userIdsToFetch.map(userId => getUserById(userId))
        );
        
        results.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value) {
            newProfiles.set(userIdsToFetch[index], result.value);
          }
        });
        
        setUserProfiles(newProfiles);
      }
      
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
   * WHAT: Uses ChatListItem component with presence data from global store
   */
  const renderChatItem = ({ item }: { item: Chat }) => {
    const otherUser = getOtherUser(item);
    
    // Get online status from GLOBAL store (1:1 chats only)
    // WHY: Global store means this updates instantly when presence changes in ANY screen
    let isOnline = false;
    if (item.type === '1:1' && otherUser) {
      const presence = presenceMap.get(otherUser.id);
      isOnline = presence?.online || false;
    }
    
    return (
      <ChatListItem
        chat={item}
        currentUserId={currentUser?.id || ''}
        otherUser={otherUser}
        isOnline={isOnline}
        isContentCreator={isContentCreator}
        onPress={() => handleChatPress(item.id)}
      />
    );
  };

  /**
   * Filter chats based on selected category and sentiment (memoized for performance)
   * 
   * WHY: Allow users to filter chats by AI-detected category/sentiment
   * WHAT: Filters chat list and sorts high-priority chats to top
   */
  const filteredChats = useMemo(() => {
    let filtered = [...chats];

    if (selectedCategory !== 'all') {
      if (selectedCategory === 'priority') {
        filtered = filtered.filter(chat => 
          (chat.lastMessage as any)?.aiCollaborationScore > 7
        );
      } else {
        filtered = filtered.filter(chat => 
          (chat.lastMessage as any)?.aiCategory === selectedCategory
        );
      }
    }

    if (selectedSentiment !== 'all') {
      filtered = filtered.filter(chat => 
        (chat.lastMessage as any)?.aiSentiment === selectedSentiment
      );
    }

    return filtered.sort((a, b) => {
      const aScore = (a.lastMessage as any)?.aiCollaborationScore || 0;
      const bScore = (b.lastMessage as any)?.aiCollaborationScore || 0;
      const aIsPriority = aScore > 7;
      const bIsPriority = bScore > 7;

      if (aIsPriority && !bIsPriority) return -1;
      if (!aIsPriority && bIsPriority) return 1;

      const aTime = timestampToMillis(a.updatedAt);
      const bTime = timestampToMillis(b.updatedAt);
      return bTime - aTime;
    });
  }, [chats, selectedCategory, selectedSentiment]);

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
      {/* Connection Banner */}
      <ConnectionBanner />

      {/* AI Filter Chips - Only visible to Content Creators */}
      {isContentCreator && !loading && chats.length > 0 && (
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
            showSelectedCheck={true}
            style={[styles.chip, selectedCategory === 'all' && styles.chipSelected]}
            textStyle={styles.chipText}
          >
            All
          </Chip>
          <Chip
            selected={selectedCategory === 'priority'}
            onPress={() => handleCategoryChange('priority')}
            icon="star"
            showSelectedCheck={true}
            style={[styles.chip, selectedCategory === 'priority' && styles.chipSelected]}
            textStyle={styles.chipText}
          >
            Priority
          </Chip>
          <Chip
            selected={selectedCategory === 'fan'}
            onPress={() => handleCategoryChange('fan')}
            showSelectedCheck={true}
            style={[styles.chip, selectedCategory === 'fan' && styles.chipSelected]}
            textStyle={styles.chipText}
          >
            Fan
          </Chip>
          <Chip
            selected={selectedCategory === 'business'}
            onPress={() => handleCategoryChange('business')}
            showSelectedCheck={true}
            style={[styles.chip, selectedCategory === 'business' && styles.chipSelected]}
            textStyle={styles.chipText}
          >
            Business
          </Chip>
          <Chip
            selected={selectedCategory === 'spam'}
            onPress={() => handleCategoryChange('spam')}
            showSelectedCheck={true}
            style={[styles.chip, selectedCategory === 'spam' && styles.chipSelected]}
            textStyle={styles.chipText}
          >
            Spam
          </Chip>
          <Chip
            selected={selectedCategory === 'urgent'}
            onPress={() => handleCategoryChange('urgent')}
            showSelectedCheck={true}
            style={[styles.chip, selectedCategory === 'urgent' && styles.chipSelected]}
            textStyle={styles.chipText}
          >
            Urgent
          </Chip>
          
          {/* Sentiment Filters */}
          <View style={styles.filterDivider} />
          
          <Text variant="labelSmall" style={styles.filterLabel}>Sentiment:</Text>
          <Chip
            selected={selectedSentiment === 'all'}
            onPress={() => setSelectedSentiment('all')}
            showSelectedCheck={true}
            style={[styles.chip, selectedSentiment === 'all' && styles.chipSelected]}
            textStyle={styles.chipText}
          >
            All
          </Chip>
          <Chip
            selected={selectedSentiment === 'positive'}
            onPress={() => setSelectedSentiment('positive')}
            icon="emoticon-happy-outline"
            showSelectedCheck={true}
            style={[styles.chip, selectedSentiment === 'positive' && styles.chipSelected]}
            textStyle={styles.chipText}
          >
            Positive
          </Chip>
          <Chip
            selected={selectedSentiment === 'neutral'}
            onPress={() => setSelectedSentiment('neutral')}
            icon="emoticon-neutral-outline"
            showSelectedCheck={true}
            style={[styles.chip, selectedSentiment === 'neutral' && styles.chipSelected]}
            textStyle={styles.chipText}
          >
            Neutral
          </Chip>
          <Chip
            selected={selectedSentiment === 'negative'}
            onPress={() => setSelectedSentiment('negative')}
            icon="emoticon-sad-outline"
            showSelectedCheck={true}
            style={[styles.chip, selectedSentiment === 'negative' && styles.chipSelected]}
            textStyle={styles.chipText}
          >
            Negative
          </Chip>
        </ScrollView>
      )}

      {/* Loading Indicator */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#128c7e" />
          <Text style={styles.loadingText}>Loading chats...</Text>
        </View>
      )}

      {/* Chat List */}
      {!loading && (
        <FlatList
          data={filteredChats}
          keyExtractor={(item) => item.id}
          renderItem={renderChatItem}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#128c7e']}
            />
          }
          contentContainerStyle={filteredChats.length === 0 ? styles.emptyList : undefined}
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
    color: '#128c7e',
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
    backgroundColor: '#128c7e',
  },
  chip: {
    marginRight: 2,
    paddingVertical: 2,
    paddingHorizontal: 2,
    minHeight: 32,
    backgroundColor: '#f0f0f0',
  },
  chipSelected: {
    backgroundColor: '#C8E6C9', // Light green (WhatsApp style)
  },
  chipText: {
    lineHeight: 20,
  },
});
