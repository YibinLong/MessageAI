/**
 * Chat List Screen (Placeholder)
 * 
 * This is the main screen of the app, showing a list of all conversations.
 * For now, it's a placeholder that displays a welcome message and sign-out button.
 * 
 * WHY: We need a landing screen for authenticated users.
 * WHAT: Shows user's name, avatar, and sign-out button. Will be replaced with
 * actual chat list in Epic 2.3.
 * 
 * NOTE: Temporary "Create Test Chat" button added for Epic 2.2 testing.
 * TODO: Remove in Epic 2.10 - replace with proper contact discovery.
 */

import { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Text, Button, Avatar, Card, TextInput as PaperTextInput, Dialog, Portal } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import { signOut } from '../../services/auth';
import { updateUserPresence } from '../../services/userService';
import { findUserByEmail, createOrGetChat } from '../../services/chatService';

/**
 * Chat List Screen Component (Placeholder)
 * 
 * WHAT: Displays welcome message and user info
 * WHY: Temporary screen while we build the full chat list in Epic 2.3
 */
export default function ChatListScreen() {
  const router = useRouter();
  const { user, clearUser } = useAuthStore();
  
  // State for "Create Test Chat" dialog
  const [dialogVisible, setDialogVisible] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [creating, setCreating] = useState(false);
  
  /**
   * Handle sign out
   * 
   * WHAT: Updates user presence, signs out from Firebase, clears Zustand store
   * WHY: Log out the user and return to sign-in screen
   */
  const handleSignOut = async () => {
    try {
      // Show confirmation dialog
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
                
                // Update user presence to offline before signing out
                if (user) {
                  await updateUserPresence(user.id, false);
                }
                
                // Sign out from Firebase
                await signOut();
                
                // Clear Zustand store
                // WHY: Remove user data from app state
                clearUser();
                
                console.log('[ChatList] Signed out successfully');
                
                // Navigation handled by root layout when isAuthenticated becomes false
              } catch (error: any) {
                console.error('[ChatList] Sign out failed:', error);
                Alert.alert('Error', 'Failed to sign out. Please try again.');
              }
            },
          },
        ],
        { cancelable: true }
      );
    } catch (error) {
      console.error('[ChatList] Sign out error:', error);
    }
  };
  
  /**
   * Navigate to edit profile screen
   */
  const handleEditProfile = () => {
    router.push('/(app)/edit-profile');
  };
  
  /**
   * Handle creating a test chat
   * 
   * WHAT: Looks up user by email, creates chat, navigates to chat screen
   * WHY: Temporary testing feature for Epic 2.2 (remove in Epic 2.10)
   * 
   * TODO: Remove this in Epic 2.10 - replace with proper contact discovery
   */
  const handleCreateTestChat = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be signed in to create a chat');
      return;
    }
    
    const email = emailInput.trim().toLowerCase();
    
    if (!email) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }
    
    if (email === user.email?.toLowerCase()) {
      Alert.alert('Error', 'You cannot create a chat with yourself');
      return;
    }
    
    setCreating(true);
    
    try {
      console.log('[ChatList] Creating chat with user:', email);
      
      // Find user by email
      const otherUserId = await findUserByEmail(email);
      
      if (!otherUserId) {
        Alert.alert('User Not Found', `No user found with email: ${email}`);
        setCreating(false);
        return;
      }
      
      // Create or get chat
      const chat = await createOrGetChat(user.id, otherUserId);
      
      console.log('[ChatList] Chat created/retrieved:', chat.id);
      
      // Close dialog
      setDialogVisible(false);
      setEmailInput('');
      setCreating(false);
      
      // Navigate to chat screen
      router.push(`/(app)/chat/${chat.id}`);
    } catch (error: any) {
      console.error('[ChatList] Failed to create chat:', error);
      Alert.alert('Error', 'Failed to create chat. Please try again.');
      setCreating(false);
    }
  };
  
  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Card.Content style={styles.cardContent}>
          {/* User Avatar */}
          {user?.photoURL ? (
            <Avatar.Image size={80} source={{ uri: user.photoURL }} />
          ) : (
            <Avatar.Icon size={80} icon="account" />
          )}
          
          {/* Welcome Message */}
          <Text variant="headlineMedium" style={styles.welcomeText}>
            Welcome, {user?.displayName || 'User'}!
          </Text>
          
          {/* User Email */}
          {user?.email && (
            <Text variant="bodyMedium" style={styles.email}>
              {user.email}
            </Text>
          )}
          
          {/* User Bio */}
          {user?.bio && (
            <Text variant="bodyMedium" style={styles.bio}>
              "{user.bio}"
            </Text>
          )}
          
          {/* Info Text */}
          <Text variant="bodySmall" style={styles.infoText}>
            Chat list will be implemented in Epic 2.3
          </Text>
        </Card.Content>
      </Card>
      
      {/* Create Test Chat Button */}
      {/* TODO: Remove in Epic 2.10 - replace with proper contact discovery */}
      <Button
        mode="contained"
        onPress={() => setDialogVisible(true)}
        style={styles.button}
        buttonColor="#25D366"
        icon="message-plus"
      >
        Create Test Chat
      </Button>
      
      {/* Edit Profile Button */}
      <Button
        mode="outlined"
        onPress={handleEditProfile}
        style={styles.button}
        icon="account-edit"
      >
        Edit Profile
      </Button>
      
      {/* Sign Out Button */}
      <Button
        mode="contained"
        onPress={handleSignOut}
        style={styles.button}
        buttonColor="#075E54"
        icon="logout"
      >
        Sign Out
      </Button>
      
      {/* Create Chat Dialog */}
      {/* TODO: Remove in Epic 2.10 */}
      <Portal>
        <Dialog visible={dialogVisible} onDismiss={() => !creating && setDialogVisible(false)}>
          <Dialog.Title>Create Test Chat</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={styles.dialogText}>
              Enter the email address of the user you want to chat with:
            </Text>
            <PaperTextInput
              mode="outlined"
              label="Email Address"
              value={emailInput}
              onChangeText={setEmailInput}
              autoCapitalize="none"
              keyboardType="email-address"
              disabled={creating}
              style={styles.textInput}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialogVisible(false)} disabled={creating}>
              Cancel
            </Button>
            <Button 
              onPress={handleCreateTestChat} 
              loading={creating}
              disabled={creating || !emailInput.trim()}
            >
              Create Chat
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
    justifyContent: 'center',
  },
  card: {
    marginBottom: 24,
    elevation: 4,
  },
  cardContent: {
    alignItems: 'center',
    padding: 24,
  },
  welcomeText: {
    marginTop: 16,
    fontWeight: 'bold',
    color: '#25D366',
    textAlign: 'center',
  },
  email: {
    marginTop: 8,
    color: '#666',
  },
  bio: {
    marginTop: 8,
    fontStyle: 'italic',
    color: '#666',
    textAlign: 'center',
  },
  infoText: {
    marginTop: 16,
    color: '#999',
    textAlign: 'center',
  },
  button: {
    marginBottom: 12,
  },
  dialogText: {
    marginBottom: 16,
  },
  textInput: {
    marginTop: 8,
  },
});

