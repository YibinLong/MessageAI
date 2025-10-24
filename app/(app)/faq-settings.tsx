/**
 * FAQ Settings Screen
 * 
 * WHY: Allow users to manage their FAQs for auto-responder feature
 * WHAT: CRUD interface for FAQs with auto-respond toggle
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, Alert, ScrollView } from 'react-native';
import { 
  Appbar, 
  Text, 
  FAB, 
  Card, 
  IconButton, 
  Dialog, 
  Portal, 
  TextInput as PaperTextInput,
  Button,
  Switch,
  ActivityIndicator,
  Chip
} from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import { getFAQs, addFAQ, updateFAQ, deleteFAQ, getAgentSettings, updateAgentSettings } from '../../services/faqService';
import { FAQ } from '../../types';

/**
 * FAQ Settings Screen Component
 * 
 * WHAT: Manage FAQs and auto-respond settings
 * WHY: Users need to configure what questions get auto-responses
 */
export default function FAQSettingsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();

  // State
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRespond, setAutoRespond] = useState(false);
  
  // Dialog state
  const [dialogVisible, setDialogVisible] = useState(false);
  const [editingFAQ, setEditingFAQ] = useState<FAQ | null>(null);
  const [questionText, setQuestionText] = useState('');
  const [answerText, setAnswerText] = useState('');
  const [saving, setSaving] = useState(false);

  /**
   * Load FAQs and settings on mount with real-time updates
   * 
   * WHY: Display existing FAQs and auto-respond setting, update live when FAQs are used
   * WHAT: Sets up Firestore listener for real-time FAQ updates
   */
  useEffect(() => {
    if (!user) return;

    // Load agent settings once
    loadAgentSettings();

    // Set up real-time listener for FAQs
    const unsubscribe = setupFAQListener();

    // Cleanup listener on unmount
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user]);

  /**
   * Set up real-time listener for FAQs
   * 
   * WHY: Update usage counts in real-time when FAQs are used
   * WHAT: Listens to Firestore changes on FAQs collection
   * 
   * @returns Cleanup function to unsubscribe
   */
  const setupFAQListener = () => {
    if (!user) return;

    setLoading(true);

    // Import Firestore listener
    const { collection, onSnapshot, query, orderBy } = require('firebase/firestore');
    const { db } = require('../../services/firebase');

    try {
      // Create query for user's FAQs
      const faqsRef = collection(db, 'users', user.id, 'faqs');
      const faqsQuery = query(faqsRef, orderBy('createdAt', 'desc'));

      // Set up real-time listener
      const unsubscribe = onSnapshot(
        faqsQuery,
        (snapshot) => {
          const faqsData: FAQ[] = [];
          snapshot.forEach((doc) => {
            faqsData.push({ id: doc.id, ...doc.data() } as FAQ);
          });
          
          setFaqs(faqsData);
          setLoading(false);
          
          console.log('[FAQSettings] FAQs updated in real-time:', faqsData.length);
        },
        (error) => {
          console.error('[FAQSettings] FAQ listener error:', error);
          Alert.alert('Error', 'Failed to load FAQs');
          setLoading(false);
        }
      );

      return unsubscribe;
    } catch (error) {
      console.error('[FAQSettings] Failed to set up FAQ listener:', error);
      setLoading(false);
      return undefined;
    }
  };

  /**
   * Load agent settings
   * 
   * WHY: Get auto-respond toggle state
   * WHAT: Fetches agent settings from Firestore
   */
  const loadAgentSettings = async () => {
    if (!user) return;

    try {
      const settings = await getAgentSettings(user.id);
      if (settings) {
        setAutoRespond(settings.autoRespondFAQs || false);
      }
    } catch (error) {
      console.error('[FAQSettings] Failed to load agent settings:', error);
    }
  };

  /**
   * Handle adding new FAQ
   * 
   * WHY: User tapped "Add FAQ" button
   * WHAT: Opens dialog with empty fields
   */
  const handleAddFAQ = () => {
    setEditingFAQ(null);
    setQuestionText('');
    setAnswerText('');
    setDialogVisible(true);
  };

  /**
   * Handle editing existing FAQ
   * 
   * WHY: User tapped edit button on FAQ card
   * WHAT: Opens dialog with pre-filled fields
   */
  const handleEditFAQ = (faq: FAQ) => {
    setEditingFAQ(faq);
    setQuestionText(faq.question);
    setAnswerText(faq.answer);
    setDialogVisible(true);
  };

  /**
   * Handle saving FAQ (create or update)
   * 
   * WHY: User tapped save in dialog
   * WHAT: Creates new or updates existing FAQ in Firestore
   */
  const handleSaveFAQ = async () => {
    if (!user) return;

    if (!questionText.trim() || !answerText.trim()) {
      Alert.alert('Error', 'Please fill in both question and answer');
      return;
    }

    try {
      setSaving(true);

      if (editingFAQ) {
        // Update existing FAQ
        await updateFAQ(user.id, editingFAQ.id, {
          question: questionText.trim(),
          answer: answerText.trim(),
        });
      } else {
        // Create new FAQ
        await addFAQ(user.id, questionText.trim(), answerText.trim());
      }

      // No need to reload - real-time listener will update automatically!

      // Close dialog
      setDialogVisible(false);
      setQuestionText('');
      setAnswerText('');
      setEditingFAQ(null);
    } catch (error) {
      console.error('[FAQSettings] Failed to save FAQ:', error);
      Alert.alert('Error', 'Failed to save FAQ');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Handle deleting FAQ
   * 
   * WHY: User tapped delete button
   * WHAT: Confirms and deletes FAQ from Firestore
   */
  const handleDeleteFAQ = (faq: FAQ) => {
    Alert.alert(
      'Delete FAQ',
      `Are you sure you want to delete this FAQ?\n\nQuestion: ${faq.question}`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!user) return;

            try {
              await deleteFAQ(user.id, faq.id);
              // No need to reload - real-time listener will update automatically!
            } catch (error) {
              console.error('[FAQSettings] Failed to delete FAQ:', error);
              Alert.alert('Error', 'Failed to delete FAQ');
            }
          },
        },
      ]
    );
  };

  /**
   * Handle toggling auto-respond
   * 
   * WHY: User toggled the switch
   * WHAT: Updates agent settings in Firestore
   */
  const handleToggleAutoRespond = async (value: boolean) => {
    if (!user) return;

    try {
      setAutoRespond(value);
      await updateAgentSettings(user.id, { autoRespondFAQs: value });
    } catch (error) {
      console.error('[FAQSettings] Failed to update auto-respond:', error);
      Alert.alert('Error', 'Failed to update settings');
      // Revert on error
      setAutoRespond(!value);
    }
  };

  /**
   * Render FAQ card
   * 
   * WHY: Display each FAQ in the list
   * WHAT: Shows question, answer, usage count, and action buttons
   */
  const renderFAQItem = ({ item }: { item: FAQ }) => (
    <Card style={styles.faqCard}>
      <Card.Content>
        <View style={styles.faqHeader}>
          <Text variant="titleMedium" style={styles.question}>
            Q: {item.question}
          </Text>
          {item.usageCount > 0 && (
            <Chip icon="check-circle" style={styles.usageChip}>
              Used {item.usageCount}x
            </Chip>
          )}
        </View>
        <Text variant="bodyMedium" style={styles.answer}>
          A: {item.answer}
        </Text>
      </Card.Content>
      <Card.Actions>
        <Button onPress={() => handleEditFAQ(item)}>Edit</Button>
        <Button 
          onPress={() => handleDeleteFAQ(item)} 
          textColor="#E53935"
          mode="text"
        >
          Delete
        </Button>
      </Card.Actions>
    </Card>
  );

  /**
   * Render empty state
   * 
   * WHY: Show message when no FAQs exist
   * WHAT: Prompts user to add their first FAQ
   */
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text variant="headlineSmall" style={styles.emptyTitle}>
        No FAQs yet
      </Text>
      <Text variant="bodyLarge" style={styles.emptyText}>
        Add FAQs to automatically respond to common questions
      </Text>
      <Button mode="contained" onPress={handleAddFAQ} style={styles.emptyButton}>
        Add Your First FAQ
      </Button>
    </View>
  );

  return (
    <View style={styles.container}>

      {/* Auto-Respond Toggle */}
      <View style={styles.settingRow}>
        <View style={styles.settingText}>
          <Text variant="titleMedium">Auto-Respond to FAQs</Text>
          <Text variant="bodySmall" style={styles.settingSubtext}>
            Automatically send FAQ answers when matched
          </Text>
        </View>
        <Switch
          value={autoRespond}
          onValueChange={handleToggleAutoRespond}
          color="#128c7e"
        />
      </View>

      {/* Loading State */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#128c7e" />
          <Text style={styles.loadingText}>Loading FAQs...</Text>
        </View>
      )}

      {/* FAQ List */}
      {!loading && (
        <FlatList
          data={faqs}
          renderItem={renderFAQItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={faqs.length === 0 ? styles.emptyList : styles.listContent}
          ListEmptyComponent={renderEmptyState}
        />
      )}

      {/* Add FAQ Button */}
      {!loading && faqs.length > 0 && (
        <FAB
          icon="plus"
          style={styles.fab}
          onPress={handleAddFAQ}
          label="Add FAQ"
        />
      )}

      {/* Add/Edit Dialog */}
      <Portal>
        <Dialog visible={dialogVisible} onDismiss={() => setDialogVisible(false)}>
          <Dialog.Title>{editingFAQ ? 'Edit FAQ' : 'Add FAQ'}</Dialog.Title>
          <Dialog.Content>
            <PaperTextInput
              label="Question"
              value={questionText}
              onChangeText={setQuestionText}
              mode="outlined"
              multiline
              numberOfLines={2}
              placeholder="e.g., What are your rates?"
              style={styles.input}
            />
            <PaperTextInput
              label="Answer"
              value={answerText}
              onChangeText={setAnswerText}
              mode="outlined"
              multiline
              numberOfLines={4}
              placeholder="e.g., My rates start at $500 for a sponsored post..."
              style={styles.input}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialogVisible(false)}>Cancel</Button>
            <Button
              onPress={handleSaveFAQ}
              loading={saving}
              disabled={saving || !questionText.trim() || !answerText.trim()}
            >
              {editingFAQ ? 'Update' : 'Add'}
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
    backgroundColor: '#fff',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#f9f9f9',
  },
  settingText: {
    flex: 1,
    marginRight: 16,
  },
  settingSubtext: {
    color: '#666',
    marginTop: 4,
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
  listContent: {
    padding: 16,
  },
  emptyList: {
    flex: 1,
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
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: '#128c7e',
  },
  faqCard: {
    marginBottom: 12,
    elevation: 2,
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  question: {
    fontWeight: '600',
    color: '#000',
    flex: 1,
    marginRight: 8,
  },
  usageChip: {
    backgroundColor: '#E8F5E9',
  },
  answer: {
    color: '#666',
    marginTop: 4,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: '#128c7e',
  },
  input: {
    marginBottom: 12,
  },
});

