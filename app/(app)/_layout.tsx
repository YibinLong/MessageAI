/**
 * App Layout
 * 
 * This layout wraps all authenticated app screens (chat list, chat screen, etc.).
 * It provides consistent navigation and styling for the main app experience.
 * 
 * WHY: Authenticated screens need different navigation than auth screens.
 * WHAT: Stack navigator for main app with WhatsApp-style headers.
 */

import { Stack } from 'expo-router';

/**
 * App Layout Component
 * 
 * WHAT: Navigation stack for authenticated users
 * WHY: Separates main app UI from auth UI
 */
export default function AppLayout() {
  return (
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
    </Stack>
  );
}

