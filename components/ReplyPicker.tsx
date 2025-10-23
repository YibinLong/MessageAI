/**
 * Reply Picker Component
 * 
 * WHY: Display AI-generated draft responses for user to choose from
 * WHAT: Modal showing 3 draft options with regenerate capability
 */

import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Modal, Portal, Text, Button, Card, IconButton, ActivityIndicator } from 'react-native-paper';
import { requestDraftResponse } from '../services/aiService';

/**
 * Props for ReplyPicker component
 */
interface ReplyPickerProps {
  visible: boolean;
  onDismiss: () => void;
  onSelectDraft: (draft: string) => void;
  chatId: string;
  messageText: string;
}

/**
 * ReplyPicker Component
 * 
 * WHAT: Modal that shows AI-generated draft responses
 * WHY: Allows users to quickly select a draft reply instead of typing
 * 
 * @param visible - Whether modal is visible
 * @param onDismiss - Handler for closing modal
 * @param onSelectDraft - Handler when draft is selected
 * @param chatId - ID of the chat
 * @param messageText - The message to respond to
 */
export function ReplyPicker({ visible, onDismiss, onSelectDraft, chatId, messageText }: ReplyPickerProps) {
  const [drafts, setDrafts] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load drafts when modal opens
   * 
   * WHY: Generate drafts when user requests them
   * WHAT: Calls AI service to get 3 draft options
   */
  React.useEffect(() => {
    if (visible && drafts.length === 0) {
      loadDrafts();
    }
  }, [visible]);

  /**
   * Load draft responses from AI
   * 
   * WHY: Get AI-generated response suggestions
   * WHAT: Calls Cloud Function and updates state
   */
  const loadDrafts = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await requestDraftResponse(chatId, messageText);
      setDrafts(result.drafts);
    } catch (err: any) {
      console.error('[ReplyPicker] Failed to load drafts:', err);
      
      // Provide user-friendly error messages
      let errorMessage = 'Failed to generate drafts';
      
      if (err.message) {
        if (err.message.includes('internal') || err.message.includes('network') || err.message.includes('fetch')) {
          errorMessage = 'Unable to connect. Please check your internet connection.';
        } else if (err.message.includes('timeout')) {
          errorMessage = 'Request timed out. Please try again.';
        } else {
          errorMessage = err.message;
        }
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle regenerate button
   * 
   * WHY: Allow users to get new draft options if not satisfied
   * WHAT: Clears drafts and calls loadDrafts again
   */
  const handleRegenerate = () => {
    setDrafts([]);
    loadDrafts();
  };

  /**
   * Handle draft selection
   * 
   * WHY: User chose a draft to use
   * WHAT: Passes draft to parent and closes modal
   */
  const handleSelect = (draft: string) => {
    onSelectDraft(draft);
    onDismiss();
    // Clear drafts for next time
    setDrafts([]);
  };

  /**
   * Handle modal close
   * 
   * WHY: Clean up state when modal closes
   * WHAT: Clears drafts and errors
   */
  const handleDismiss = () => {
    setDrafts([]);
    setError(null);
    onDismiss();
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={handleDismiss}
        contentContainerStyle={styles.modal}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text variant="headlineSmall" style={styles.title}>
              AI Draft Responses
            </Text>
            <IconButton icon="close" onPress={handleDismiss} />
          </View>

          {/* Message being responded to */}
          <Card style={styles.messageCard}>
            <Card.Content>
              <Text variant="labelSmall" style={styles.label}>
                Responding to:
              </Text>
              <Text variant="bodyMedium" numberOfLines={2}>
                {messageText}
              </Text>
            </Card.Content>
          </Card>

          {/* Loading State */}
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#25D366" />
              <Text style={styles.loadingText}>AI is drafting responses...</Text>
            </View>
          )}

          {/* Error State */}
          {error && !loading && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>
                {error.includes('internal') 
                  ? 'Unable to connect. Please check your internet connection and try again.'
                  : error
                }
              </Text>
              <Button 
                mode="contained" 
                onPress={handleRegenerate} 
                style={styles.retryButton}
                buttonColor="#25D366"
              >
                Try Again
              </Button>
            </View>
          )}

          {/* Draft Options */}
          {!loading && !error && drafts.length > 0 && (
            <ScrollView style={styles.draftsContainer}>
              {drafts.map((draft, index) => (
                <Card key={index} style={styles.draftCard} onPress={() => handleSelect(draft)}>
                  <Card.Content>
                    <View style={styles.draftHeader}>
                      <Text variant="labelMedium" style={styles.draftLabel}>
                        Option {index + 1}
                      </Text>
                      {index === 0 && <Text style={styles.badge}>Casual</Text>}
                      {index === 1 && <Text style={styles.badge}>Professional</Text>}
                      {index === 2 && <Text style={styles.badge}>Brief</Text>}
                    </View>
                    <Text variant="bodyLarge" style={styles.draftText}>
                      {draft}
                    </Text>
                  </Card.Content>
                </Card>
              ))}
            </ScrollView>
          )}

          {/* Actions */}
          {!loading && !error && drafts.length > 0 && (
            <View style={styles.actions}>
              <Button
                mode="outlined"
                onPress={handleRegenerate}
                icon="refresh"
                style={styles.actionButton}
              >
                Regenerate
              </Button>
            </View>
          )}
        </View>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modal: {
    margin: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    maxHeight: '80%',
  },
  container: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontWeight: '600',
    color: '#000',
  },
  messageCard: {
    backgroundColor: '#f5f5f5',
    marginBottom: 16,
  },
  label: {
    color: '#666',
    marginBottom: 4,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#666',
  },
  errorContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  errorText: {
    color: '#F44336',
    fontSize: 15,
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 22,
  },
  retryButton: {
    backgroundColor: '#25D366',
    minWidth: 150,
  },
  draftsContainer: {
    maxHeight: 400,
  },
  draftCard: {
    marginBottom: 12,
    elevation: 2,
  },
  draftHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  draftLabel: {
    color: '#25D366',
    fontWeight: '600',
  },
  badge: {
    fontSize: 11,
    color: '#666',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  draftText: {
    color: '#000',
    lineHeight: 22,
  },
  actions: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  actionButton: {
    borderColor: '#25D366',
  },
});

