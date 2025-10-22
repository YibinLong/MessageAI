/**
 * Create Group Screen
 * 
 * This screen allows users to create a new group chat with multiple participants.
 * Features text input for group name, optional group photo, and multi-select user list.
 * 
 * WHY: Users need to be able to create group chats with 3+ people
 * WHAT: Group creation UI with name, photo, and participant selection
 */

import { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, Alert, Image, TouchableOpacity, ScrollView } from 'react-native';
import { Appbar, TextInput, Button, List, Avatar, Text, ActivityIndicator, Checkbox } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import { getAllUsers } from '../../services/userService';
import { createGroupChat } from '../../services/chatService';
import { User } from '../../types';
import * as ImagePicker from 'expo-image-picker';
import { uploadImage } from '../../utils/imageUpload';

/**
 * Create Group Screen Component
 * 
 * WHAT: Form to create a group chat
 * WHY: Enables group messaging feature
 */
export default function CreateGroupScreen() {
  const router = useRouter();
  const { user: currentUser } = useAuthStore();
  
  // State
  const [groupName, setGroupName] = useState('');
  const [groupPhotoUri, setGroupPhotoUri] = useState<string | null>(null);
  const [uploadedPhotoURL, setUploadedPhotoURL] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  /**
   * Load all users on mount
   * 
   * WHY: Need to display all available users for selection
   * WHAT: Fetches users from Firestore and filters out current user
   */
  useEffect(() => {
    loadUsers();
  }, []);

  /**
   * Load all users from Firestore
   * 
   * WHY: Populate user list for participant selection
   * WHAT: Fetches all users and filters out current user
   */
  const loadUsers = async () => {
    if (!currentUser) return;

    try {
      setLoading(true);
      console.log('[CreateGroup] Loading users...');

      const allUsers = await getAllUsers();
      
      // Filter out current user
      const otherUsers = allUsers.filter(u => u.id !== currentUser.id);
      
      console.log(`[CreateGroup] Loaded ${otherUsers.length} users`);
      setUsers(otherUsers);
    } catch (error) {
      console.error('[CreateGroup] Failed to load users:', error);
      Alert.alert('Error', 'Failed to load users. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle user selection toggle
   * 
   * WHY: Users need to select multiple participants
   * WHAT: Adds/removes user from selection set
   * 
   * @param userId - User ID to toggle
   */
  const toggleUserSelection = (userId: string) => {
    const newSelected = new Set(selectedUserIds);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUserIds(newSelected);
  };

  /**
   * Handle group photo selection
   * 
   * WHY: Groups can have custom photos
   * WHAT: Opens image picker and uploads to Firebase Storage
   */
  const handlePickPhoto = async () => {
    try {
      console.log('[CreateGroup] Requesting image picker permission...');
      
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'We need permission to access your photos.');
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        console.log('[CreateGroup] Image selected');
        setGroupPhotoUri(result.assets[0].uri);
        
        // Upload immediately
        setUploadingPhoto(true);
        try {
          // Use temporary ID for upload path
          const tempGroupId = `temp_${Date.now()}`;
          const photoURL = await uploadImage(result.assets[0].uri, `groups/${tempGroupId}/photo.jpg`);
          setUploadedPhotoURL(photoURL);
          console.log('[CreateGroup] Photo uploaded:', photoURL);
        } catch (uploadError) {
          console.error('[CreateGroup] Photo upload failed:', uploadError);
          Alert.alert('Upload Error', 'Failed to upload photo. You can try again later.');
          setGroupPhotoUri(null);
        } finally {
          setUploadingPhoto(false);
        }
      }
    } catch (error) {
      console.error('[CreateGroup] Image picker error:', error);
      Alert.alert('Error', 'Failed to pick image.');
    }
  };

  /**
   * Handle group creation
   * 
   * WHY: Create the group chat in Firestore
   * WHAT: Validates input, creates group, navigates to it
   */
  const handleCreateGroup = async () => {
    if (!currentUser) {
      Alert.alert('Error', 'You must be signed in to create a group');
      return;
    }

    // Validation
    if (!groupName.trim()) {
      Alert.alert('Group Name Required', 'Please enter a name for the group.');
      return;
    }

    if (selectedUserIds.size < 2) {
      Alert.alert('Select Participants', 'Please select at least 2 participants for the group.');
      return;
    }

    setCreating(true);

    try {
      console.log('[CreateGroup] Creating group...');

      // Participants = selected users + current user
      const participants = Array.from(selectedUserIds);
      participants.push(currentUser.id);

      // Create group chat
      const group = await createGroupChat(
        groupName.trim(),
        participants,
        currentUser.id,
        uploadedPhotoURL || undefined
      );

      console.log('[CreateGroup] Group created:', group.id);

      // Navigate to the new group chat
      router.replace(`/(app)/chat/${group.id}`);
    } catch (error) {
      console.error('[CreateGroup] Failed to create group:', error);
      Alert.alert('Error', 'Failed to create group. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  /**
   * Render a single user item with checkbox
   * 
   * WHY: Display user in the selectable list
   * WHAT: Shows avatar, name, checkbox
   */
  const renderUserItem = ({ item }: { item: User }) => {
    const isSelected = selectedUserIds.has(item.id);
    
    const initials = item.displayName
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

    return (
      <List.Item
        title={item.displayName}
        description={item.email || item.bio || ''}
        onPress={() => toggleUserSelection(item.id)}
        left={() => (
          <View style={styles.avatarContainer}>
            {item.photoURL ? (
              <Avatar.Image size={50} source={{ uri: item.photoURL }} />
            ) : (
              <Avatar.Text size={50} label={initials} />
            )}
          </View>
        )}
        right={() => (
          <Checkbox
            status={isSelected ? 'checked' : 'unchecked'}
            onPress={() => toggleUserSelection(item.id)}
          />
        )}
        titleStyle={styles.userName}
        descriptionStyle={styles.userEmail}
        descriptionNumberOfLines={1}
      />
    );
  };

  return (
    <View style={styles.container}>
      {/* App Bar */}
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Create Group" />
      </Appbar.Header>

      <ScrollView style={styles.content}>
        {/* Group Photo Section */}
        <View style={styles.photoSection}>
          <TouchableOpacity onPress={handlePickPhoto} disabled={uploadingPhoto}>
            <View style={styles.photoContainer}>
              {groupPhotoUri ? (
                <Image source={{ uri: groupPhotoUri }} style={styles.groupPhoto} />
              ) : (
                <Avatar.Icon size={100} icon="camera" style={styles.photoPlaceholder} />
              )}
              {uploadingPhoto && (
                <View style={styles.uploadingOverlay}>
                  <ActivityIndicator size="small" color="#fff" />
                </View>
              )}
            </View>
          </TouchableOpacity>
          <Text variant="bodySmall" style={styles.photoHint}>
            Tap to add group photo (optional)
          </Text>
        </View>

        {/* Group Name Input */}
        <TextInput
          label="Group Name"
          value={groupName}
          onChangeText={setGroupName}
          mode="outlined"
          style={styles.nameInput}
          maxLength={50}
          disabled={creating}
          placeholder="Enter group name"
        />

        {/* Selected Count */}
        <View style={styles.selectedCount}>
          <Text variant="titleSmall">
            Select Participants ({selectedUserIds.size} selected, minimum 2)
          </Text>
        </View>

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
            data={users}
            keyExtractor={(item) => item.id}
            renderItem={renderUserItem}
            scrollEnabled={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text variant="bodyLarge" style={styles.emptyText}>
                  No users available
                </Text>
              </View>
            }
          />
        )}
      </ScrollView>

      {/* Create Button */}
      <View style={styles.buttonContainer}>
        <Button
          mode="contained"
          onPress={handleCreateGroup}
          loading={creating}
          disabled={creating || loading || !groupName.trim() || selectedUserIds.size < 2}
          style={styles.createButton}
          contentStyle={styles.createButtonContent}
        >
          {creating ? 'Creating Group...' : `Create Group (${selectedUserIds.size + 1} members)`}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
  },
  photoSection: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  photoContainer: {
    position: 'relative',
  },
  groupPhoto: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  photoPlaceholder: {
    backgroundColor: '#E0E0E0',
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 50,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoHint: {
    marginTop: 8,
    color: '#666',
  },
  nameInput: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  selectedCount: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F5F5F5',
  },
  avatarContainer: {
    justifyContent: 'center',
    marginRight: 12,
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
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    color: '#999',
    textAlign: 'center',
  },
  buttonContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    backgroundColor: '#fff',
  },
  createButton: {
    backgroundColor: '#25D366',
  },
  createButtonContent: {
    paddingVertical: 8,
  },
});

