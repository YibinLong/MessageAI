/**
 * New Chat Screen (Contact Picker)
 * 
 * This screen displays a list of all users to start a new conversation.
 * It includes search functionality and creates/opens chat when user is tapped.
 * 
 * WHY: Users need a way to start new conversations with other users
 * WHAT: Searchable list of all users, tap to create/open chat
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, FlatList, Alert } from 'react-native';
import { Appbar, Searchbar, List, Avatar, Text, ActivityIndicator } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import { getAllUsers } from '../../services/userService';
import { createOrGetChat } from '../../services/chatService';
import { User } from '../../types';
import { ConnectionBanner } from '../../components/ConnectionBanner';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { listenToPresence, PresenceData } from '../../services/presenceService';

/**
 * New Chat Screen Component
 * 
 * WHAT: Contact picker for starting new chats
 * WHY: Provides user discovery and chat initiation
 */
export default function NewChatScreen() {
  const router = useRouter();
  const { user: currentUser } = useAuthStore();
  const { isConnected } = useNetworkStatus();
  
  // State
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [presenceData, setPresenceData] = useState<Map<string, PresenceData>>(new Map());
  
  // Refs for debouncing and cleanup
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const presenceCleanupRef = useRef<(() => void) | null>(null);

  /**
   * Load all users on mount
   * 
   * WHY: Contact picker needs to display all available users
   * WHAT: Fetches users from Firestore and filters out current user
   */
  useEffect(() => {
    loadUsers();
    
    // Cleanup function - called when component unmounts
    return () => {
      if (presenceCleanupRef.current) {
        presenceCleanupRef.current();
        presenceCleanupRef.current = null;
      }
    };
  }, []);

  /**
   * Filter users with debouncing (500ms)
   * 
   * WHY: Prevent excessive filtering on every keystroke
   * WHAT: Debounces search input and filters user list
   */
  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    
    // Clear existing timeout
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    
    // If empty query, show all users immediately
    if (!query.trim()) {
      setFilteredUsers(users);
      return;
    }
    
    // Debounce filter operation (500ms)
    searchDebounceRef.current = setTimeout(() => {
      const lowerQuery = query.toLowerCase();
      const filtered = users.filter(user =>
        user.displayName.toLowerCase().includes(lowerQuery) ||
        user.email?.toLowerCase().includes(lowerQuery)
      );
      setFilteredUsers(filtered);
    }, 500);
  }, [users]);
  
  /**
   * Cleanup debounce timeout on unmount
   */
  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, []);

  /**
   * Load all users from Firestore
   * 
   * WHY: Populate contact list
   * WHAT: Fetches all users and filters out current user
   */
  const loadUsers = async () => {
    if (!currentUser) return;

    try {
      setLoading(true);
      console.log('[NewChat] Loading users...');

      const allUsers = await getAllUsers();
      
      // Filter out current user
      const otherUsers = allUsers.filter(u => u.id !== currentUser.id);
      
      console.log(`[NewChat] Loaded ${otherUsers.length} users`);
      setUsers(otherUsers);
      setFilteredUsers(otherUsers);
      
      // Clean up any existing presence listeners before setting up new ones
      if (presenceCleanupRef.current) {
        presenceCleanupRef.current();
        presenceCleanupRef.current = null;
      }
      
      // Set up presence listeners for all users
      // WHY: Show online/offline status for each user
      const presenceUnsubscribers: (() => void)[] = [];
      otherUsers.forEach(user => {
        const unsubscribe = listenToPresence(user.id, (presence) => {
          setPresenceData(prev => {
            const updated = new Map(prev);
            updated.set(user.id, presence);
            return updated;
          });
        });
        presenceUnsubscribers.push(unsubscribe);
      });
      
      // Store cleanup function in ref so useEffect can call it on unmount
      presenceCleanupRef.current = () => {
        presenceUnsubscribers.forEach(unsub => unsub());
      };
    } catch (error) {
      console.error('[NewChat] Failed to load users:', error);
      Alert.alert('Error', 'Failed to load users. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle user tap - create/get chat and navigate to it
   * 
   * WHY: Start conversation with selected user
   * WHAT: Creates or retrieves existing chat, then navigates to chat screen
   * 
   * @param otherUser - The user to start a chat with
   */
  const handleUserPress = async (otherUser: User) => {
    if (!currentUser) {
      Alert.alert('Error', 'You must be signed in to create a chat');
      return;
    }

    setCreating(true);

    try {
      console.log('[NewChat] Creating chat with user:', otherUser.id);

      // Create or get existing chat
      const chat = await createOrGetChat(currentUser.id, otherUser.id);

      console.log('[NewChat] Chat created/retrieved:', chat.id);

      // Navigate to chat screen
      router.push(`/(app)/chat/${chat.id}`);
    } catch (error) {
      console.error('[NewChat] Failed to create chat:', error);
      Alert.alert('Error', 'Failed to create chat. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  /**
   * Render a single user item
   * 
   * WHY: Display user in the contact list
   * WHAT: Shows avatar, name, email/bio, and online status
   */
  const renderUserItem = ({ item }: { item: User }) => {
    const initials = item.displayName
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
    
    // Get presence data for this user
    const presence = presenceData.get(item.id);
    const isOnline = presence?.online || false;

    return (
      <List.Item
        title={item.displayName}
        description={item.email || item.bio || ''}
        onPress={() => handleUserPress(item)}
        disabled={creating}
        left={() => (
          <View style={styles.avatarContainer}>
            {item.photoURL ? (
              <Avatar.Image size={50} source={{ uri: item.photoURL }} />
            ) : (
              <Avatar.Text size={50} label={initials} />
            )}
            {/* Online status indicator */}
            {isOnline && (
              <View style={styles.onlineIndicator} />
            )}
          </View>
        )}
        titleStyle={styles.userName}
        descriptionStyle={styles.userEmail}
        descriptionNumberOfLines={1}
      />
    );
  };

  /**
   * Render empty state
   * 
   * WHY: Provide feedback when no users match search
   * WHAT: Shows message based on search query or user count
   */
  const renderEmptyState = () => {
    if (loading) {
      return null;
    }

    const message = searchQuery
      ? `No users found matching "${searchQuery}"`
      : 'No users available';

    return (
      <View style={styles.emptyState}>
        <Text variant="bodyLarge" style={styles.emptyText}>
          {message}
        </Text>
      </View>
    );
  };

  /**
   * Handle create group button press
   * 
   * WHY: Navigate to group creation screen
   * WHAT: Opens create-group screen
   */
  const handleCreateGroup = () => {
    router.push('/(app)/create-group');
  };

  return (
    <View style={styles.container}>
      {/* App Bar */}
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="New Chat" />
      </Appbar.Header>

      {/* Connection Banner */}
      <ConnectionBanner />

      {/* Create Group Button */}
      <List.Item
        title="Create Group"
        description="Create a group with multiple participants"
        onPress={handleCreateGroup}
        disabled={creating}
        left={() => (
          <View style={styles.avatarContainer}>
            <Avatar.Icon size={50} icon="account-multiple-plus" style={styles.groupIcon} />
          </View>
        )}
        titleStyle={styles.groupTitle}
        descriptionStyle={styles.userEmail}
        style={styles.groupListItem}
      />

      {/* Search Bar */}
      <Searchbar
        placeholder="Search users..."
        onChangeText={handleSearchChange}
        value={searchQuery}
        style={styles.searchBar}
        disabled={loading || creating}
      />

      {/* Loading Indicator */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#25D366" />
          <Text style={styles.loadingText}>Loading users...</Text>
        </View>
      )}

      {/* User List */}
      {!loading && (
        <FlatList
          data={filteredUsers}
          keyExtractor={(item) => item.id}
          renderItem={renderUserItem}
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={filteredUsers.length === 0 ? styles.emptyList : undefined}
        />
      )}

      {/* Creating indicator overlay */}
      {creating && (
        <View style={styles.creatingOverlay}>
          <ActivityIndicator size="large" color="#25D366" />
          <Text style={styles.creatingText}>Creating chat...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  groupListItem: {
    backgroundColor: '#F5F5F5',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 8,
  },
  groupIcon: {
    backgroundColor: '#25D366',
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#25D366',
  },
  searchBar: {
    margin: 16,
    elevation: 2,
  },
  avatarContainer: {
    justifyContent: 'center',
    marginRight: 12,
    position: 'relative',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#25D366',
    borderWidth: 2,
    borderColor: '#fff',
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
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
  emptyText: {
    color: '#999',
    textAlign: 'center',
  },
  emptyList: {
    flex: 1,
  },
  creatingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  creatingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
});

