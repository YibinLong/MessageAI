/**
 * App Layout
 * 
 * This layout wraps all authenticated app screens (chat list, chat screen, etc.).
 * It provides consistent navigation and styling for the main app experience.
 * 
 * WHY: Authenticated screens need different navigation than auth screens.
 * WHAT: Stack navigator for main app with WhatsApp-style headers.
 */

import { Stack, useRouter } from 'expo-router';
import { Appbar } from 'react-native-paper';
import { useState } from 'react';
import { Modal, View, TouchableOpacity, Pressable, StyleSheet } from 'react-native';
import { Text, Divider } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { signOut } from '../../services/auth';
import { useAuthStore } from '../../stores/authStore';

/**
 * App Layout Component
 * 
 * WHAT: Navigation stack for authenticated users
 * WHY: Separates main app UI from auth UI
 */
export default function AppLayout() {
  const router = useRouter();
  const { clearUser } = useAuthStore();
  const [menuVisible, setMenuVisible] = useState(false);

  const handleEditProfile = () => {
    setMenuVisible(false);
    router.push('/(app)/edit-profile');
  };

  const handleSignOut = async () => {
    try {
      setMenuVisible(false);
      await signOut();
      clearUser();
      router.replace('/(auth)/signin');
    } catch (error) {
      console.error('[AppLayout] Sign out failed:', error);
    }
  };

  return (
    <>
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: '#128c7e', // WhatsApp green
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            title: 'MessageAI',
            headerRight: () => (
              <Appbar.Action
                icon="dots-vertical"
                onPress={() => setMenuVisible(true)}
                color="#fff"
              />
            ),
          }}
        />
        <Stack.Screen
          name="edit-profile"
          options={{
            title: 'Edit Profile',
            presentation: 'modal', // Shows as modal on iOS
          }}
        />
        <Stack.Screen
          name="chat/[chatId]"
          options={{
            title: 'Chat',
            // Header will be updated dynamically in chat screen with participant name
          }}
        />
        <Stack.Screen
          name="new-chat"
          options={{
            title: 'New Chat',
          }}
        />
        <Stack.Screen
          name="create-group"
          options={{
            title: 'Create Group',
          }}
        />
        <Stack.Screen
          name="ai-chat"
          options={{
            title: 'AI Assistant',
          }}
        />
        <Stack.Screen
          name="faq-settings"
          options={{
            title: 'FAQ Settings',
          }}
        />
        <Stack.Screen
          name="smart-replies"
          options={{
            title: 'Smart Replies',
          }}
        />
        <Stack.Screen
          name="suggested-actions"
          options={{
            title: 'Suggested Actions',
          }}
        />
        <Stack.Screen
          name="agent-activity"
          options={{
            title: 'Agent Activity',
          }}
        />
        <Stack.Screen
          name="profile-setup"
          options={{
            title: 'Profile Setup',
          }}
        />
      </Stack>

      {/* Custom Menu Modal */}
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

            {/* AI Assistant */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                router.push('/(app)/ai-chat');
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="chatbubbles-outline" size={22} color="#333" style={styles.menuIcon} />
              <Text style={styles.menuText}>AI Assistant</Text>
            </TouchableOpacity>

            <Divider style={styles.menuDivider} />

            {/* Smart Replies */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                router.push('/(app)/smart-replies');
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="flash-outline" size={22} color="#333" style={styles.menuIcon} />
              <Text style={styles.menuText}>Smart Replies</Text>
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
    </>
  );
}

const styles = StyleSheet.create({
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
});

