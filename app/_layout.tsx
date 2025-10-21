/**
 * Root Layout
 * 
 * This is the entry point for the app's navigation structure.
 * It wraps all screens with providers (theme, navigation, etc.)
 * 
 * WHY: Expo Router requires a _layout.tsx file to define the app structure
 * WHAT: Sets up React Native Paper theme and navigation stack
 */

import { Stack } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { useEffect, useState } from 'react';
import { initDatabase } from '../services/sqlite';
import { View, Text, ActivityIndicator, Platform } from 'react-native';

/**
 * Root Layout Component
 * 
 * WHY: Initializes the database when the app starts
 * WHAT: 
 * - Shows loading screen while database initializes
 * - Wraps app in PaperProvider for Material Design components
 * - Sets up Stack navigation
 */
export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function prepare() {
      try {
        console.log('[App] Initializing...');
        
        // Initialize SQLite database (skip on web - doesn't work well in browsers)
        // WHY: Database must be ready before app can load/save messages
        if (Platform.OS !== 'web') {
          await initDatabase();
        } else {
          console.log('[App] Skipping SQLite on web (not supported)');
        }
        
        console.log('[App] Ready');
        setIsReady(true);
      } catch (err) {
        console.error('[App] Initialization failed:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    }

    prepare();
  }, []);

  // Show loading screen while initializing
  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#25D366" />
        <Text style={{ marginTop: 16, color: '#666' }}>Initializing MessageAI...</Text>
        {error && <Text style={{ marginTop: 8, color: 'red' }}>{error}</Text>}
      </View>
    );
  }

  // WHY: PaperProvider enables Material Design 3 components throughout the app
  // WHAT: Stack provides screen-by-screen navigation
  return (
    <PaperProvider>
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: '#25D366',
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
            title: 'MessageAI Setup Test',
          }} 
        />
      </Stack>
    </PaperProvider>
  );
}

