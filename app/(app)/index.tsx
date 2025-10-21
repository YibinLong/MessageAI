/**
 * Chat List Screen (Placeholder)
 * 
 * This is the main screen of the app, showing a list of all conversations.
 * For now, it's a placeholder that displays a welcome message and sign-out button.
 * 
 * WHY: We need a landing screen for authenticated users.
 * WHAT: Shows user's name, avatar, and sign-out button. Will be replaced with
 * actual chat list in Epic 2.3.
 */

import { View, StyleSheet, Alert } from 'react-native';
import { Text, Button, Avatar, Card } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import { signOut } from '../../services/auth';
import { updateUserPresence } from '../../services/userService';

/**
 * Chat List Screen Component (Placeholder)
 * 
 * WHAT: Displays welcome message and user info
 * WHY: Temporary screen while we build the full chat list in Epic 2.3
 */
export default function ChatListScreen() {
  const router = useRouter();
  const { user, clearUser } = useAuthStore();
  
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
});

