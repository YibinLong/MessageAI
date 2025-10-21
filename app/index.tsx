/**
 * Test Screen
 * 
 * This screen tests that Firebase and SQLite are working correctly.
 * It will be replaced with the actual chat list screen later.
 * 
 * WHY: We need to verify setup is working before building features
 * WHAT: Tests Firebase connection and SQLite operations
 */

import { useState } from 'react';
import { View, ScrollView, StyleSheet, Platform } from 'react-native';
import { Button, Card, Text, Divider } from 'react-native-paper';
import { testFirebaseConnection } from '../services/firebase';
import { insertMessage, getMessagesByChat, getAllChats, clearDatabase } from '../services/sqlite';
import { SQLiteMessage } from '../types';

/**
 * Test Screen Component
 * 
 * WHAT: Provides buttons to test each service
 * WHY: Manual testing to ensure everything is configured correctly
 */
export default function TestScreen() {
  const [firebaseStatus, setFirebaseStatus] = useState<string>('Not tested');
  const [sqliteStatus, setSqliteStatus] = useState<string>('Not tested');
  const [testResults, setTestResults] = useState<string[]>([]);

  /**
   * Test Firebase connection
   * 
   * WHAT: Tries to write and read from Firestore
   * WHY: Verifies Firebase config is correct and we have network access
   */
  const handleTestFirebase = async () => {
    try {
      addLog('Testing Firebase connection...');
      setFirebaseStatus('Testing...');
      
      const success = await testFirebaseConnection();
      
      if (success) {
        setFirebaseStatus('✅ Connected');
        addLog('Firebase connection successful!');
      } else {
        setFirebaseStatus('❌ Failed');
        addLog('Firebase connection failed');
      }
    } catch (error) {
      setFirebaseStatus('❌ Error');
      addLog(`Firebase error: ${error}`);
    }
  };

  /**
   * Test SQLite database
   * 
   * WHAT: Inserts a test message and reads it back
   * WHY: Verifies SQLite is working correctly
   * NOTE: Skips on web platform (SQLite doesn't work in browsers)
   */
  const handleTestSQLite = async () => {
    try {
      // Skip SQLite test on web platform
      if (Platform.OS === 'web') {
        setSqliteStatus('⚠️ Skipped (web)');
        addLog('SQLite test skipped - not supported on web platform');
        addLog('Use Expo Go on phone or Android emulator to test SQLite');
        return;
      }

      addLog('Testing SQLite database...');
      setSqliteStatus('Testing...');
      
      // Create a test message
      const testMessage: SQLiteMessage = {
        id: 'test-msg-' + Date.now(),
        chatId: 'test-chat-1',
        senderId: 'test-user-1',
        text: 'This is a test message!',
        timestamp: Date.now(),
        status: 'sent',
        readBy: JSON.stringify(['test-user-1']),
        type: 'text',
        synced: 1,
      };
      
      // Insert test message
      await insertMessage(testMessage);
      addLog('Test message inserted');
      
      // Read it back
      const messages = await getMessagesByChat('test-chat-1', 10);
      addLog(`Retrieved ${messages.length} messages`);
      
      // Get all chats
      const chats = await getAllChats();
      addLog(`Retrieved ${chats.length} chats`);
      
      setSqliteStatus('✅ Working');
      addLog('SQLite test successful!');
    } catch (error) {
      setSqliteStatus('❌ Error');
      addLog(`SQLite error: ${error}`);
    }
  };

  /**
   * Clear SQLite test data
   * 
   * WHAT: Removes all test data from database
   * WHY: Clean up after testing
   */
  const handleClearData = async () => {
    try {
      if (Platform.OS === 'web') {
        addLog('Clear data skipped - SQLite not available on web');
        return;
      }
      addLog('Clearing database...');
      await clearDatabase();
      addLog('Database cleared successfully');
    } catch (error) {
      addLog(`Clear failed: ${error}`);
    }
  };

  /**
   * Helper to add log messages
   */
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setTestResults(prev => [`[${timestamp}] ${message}`, ...prev]);
  };

  const clearLogs = () => {
    setTestResults([]);
  };

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Title title="🔥 Firebase Connection" />
        <Card.Content>
          <Text variant="bodyMedium" style={styles.status}>
            Status: {firebaseStatus}
          </Text>
          <Text variant="bodySmall" style={styles.help}>
            Tests connection to Firestore by writing and reading a test document.
          </Text>
        </Card.Content>
        <Card.Actions>
          <Button mode="contained" onPress={handleTestFirebase}>
            Test Firebase
          </Button>
        </Card.Actions>
      </Card>

      <Card style={styles.card}>
        <Card.Title title="💾 SQLite Database" />
        <Card.Content>
          <Text variant="bodyMedium" style={styles.status}>
            Status: {sqliteStatus}
          </Text>
          <Text variant="bodySmall" style={styles.help}>
            Tests local database by inserting and reading a test message.
          </Text>
        </Card.Content>
        <Card.Actions>
          <Button mode="contained" onPress={handleTestSQLite}>
            Test SQLite
          </Button>
          <Button mode="outlined" onPress={handleClearData}>
            Clear Data
          </Button>
        </Card.Actions>
      </Card>

      <Divider style={styles.divider} />

      <Card style={styles.card}>
        <Card.Title title="📋 Test Results Log" />
        <Card.Content>
          {testResults.length === 0 ? (
            <Text variant="bodySmall" style={styles.help}>
              No tests run yet. Press the buttons above to test each service.
            </Text>
          ) : (
            testResults.map((log, index) => (
              <Text key={index} variant="bodySmall" style={styles.logEntry}>
                {log}
              </Text>
            ))
          )}
        </Card.Content>
        {testResults.length > 0 && (
          <Card.Actions>
            <Button mode="text" onPress={clearLogs}>
              Clear Logs
            </Button>
          </Card.Actions>
        )}
      </Card>

      <View style={styles.infoBox}>
        <Text variant="titleMedium" style={styles.infoTitle}>
          ℹ️ Next Steps
        </Text>
        <Text variant="bodySmall" style={styles.infoText}>
          1. Create .env file with Firebase config (if not done)
        </Text>
        <Text variant="bodySmall" style={styles.infoText}>
          2. Test Firebase connection (should see ✅)
        </Text>
        <Text variant="bodySmall" style={styles.infoText}>
          3. Test SQLite database (should see ✅)
        </Text>
        <Text variant="bodySmall" style={styles.infoText}>
          4. Initialize Firebase Cloud Functions
        </Text>
        <Text variant="bodySmall" style={styles.infoText}>
          5. Deploy security rules
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  card: {
    marginBottom: 16,
    elevation: 2,
  },
  status: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  help: {
    color: '#666',
  },
  divider: {
    marginVertical: 16,
  },
  logEntry: {
    fontFamily: 'monospace',
    fontSize: 11,
    marginBottom: 4,
    color: '#333',
  },
  infoBox: {
    backgroundColor: '#E3F2FD',
    padding: 16,
    borderRadius: 8,
    marginBottom: 32,
  },
  infoTitle: {
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#1976D2',
  },
  infoText: {
    color: '#1565C0',
    marginBottom: 4,
    paddingLeft: 8,
  },
});

