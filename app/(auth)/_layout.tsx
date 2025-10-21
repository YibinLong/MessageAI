/**
 * Auth Layout
 * 
 * This layout wraps all authentication screens (sign in, sign up, profile setup).
 * It provides consistent styling and removes headers for a clean auth experience.
 * 
 * WHY: Auth screens should have a different look from the main app screens.
 * WHAT: Stack navigator for auth flow with no headers.
 */

import { Stack } from 'expo-router';

/**
 * Auth Layout Component
 * 
 * WHAT: Navigation stack for unauthenticated users
 * WHY: Separates auth UI from main app UI
 */
export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false, // No headers in auth screens
        contentStyle: {
          backgroundColor: '#fff', // White background
        },
      }}
    >
      <Stack.Screen name="signin" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="profile-setup" />
    </Stack>
  );
}

