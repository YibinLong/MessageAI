/**
 * Suggested Actions Screen
 * 
 * WHY: Users need to review and approve/reject agent suggestions
 * WHAT: Displays pending suggested actions from the AI agent
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, Alert, RefreshControl, Image } from 'react-native';
import {
  Appbar,
  Text,
  ActivityIndicator,
  Card,
  Button,
  TextInput as PaperTextInput,
  Dialog,
  Portal,
  Snackbar,
  Avatar,
} from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import {
  listenToSuggestedActions,
  approveSuggestion,
  rejectSuggestion,
} from '../../services/agentService';
import { SuggestedAction } from '../../types';
import { formatDistanceToNow } from 'date-fns';

/**
 * Suggested Actions Screen Component
 * 
 * WHAT: Manage suggested actions from AI agent
 * WHY: Users need to approve/reject agent suggestions
 */
export default function SuggestedActionsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();

  // State
  const [actions, setActions] = useState<SuggestedAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);

  // Edit dialog state
  const [editDialogVisible, setEditDialogVisible] = useState(false);
  const [editingAction, setEditingAction] = useState<SuggestedAction | null>(null);
  const [editedText, setEditedText] = useState('');

  // Snackbar state
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  /**
   * Set up real-time listener for suggested actions
   * 
   * WHY: Show new suggestions as agent creates them
   * WHAT: Firestore listener that updates UI when actions change
   */
  useEffect(() => {
    if (!user) return;

    const unsubscribe = listenToSuggestedActions(user.id, (updatedActions) => {
      setActions(updatedActions);
      setLoading(false);
      setRefreshing(false);
    });

    return unsubscribe;
  }, [user]);

  /**
   * Handle pull-to-refresh
   */
  const handleRefresh = () => {
    setRefreshing(true);
    // Real-time listener will update the data
    setTimeout(() => setRefreshing(false), 1000);
  };

  /**
   * Handle approving a suggestion
   * 
   * WHY: User wants to send the suggested response
   * WHAT: Approves the action and sends the message
   */
  const handleApprove = async (action: SuggestedAction) => {
    if (!user || action.type !== 'respond' || !action.suggestedText) return;

    try {
      setProcessing(action.id);
      await approveSuggestion(user.id, action.id, action.chatId, action.suggestedText);
      // Use snackbar instead of Alert for non-blocking feedback
      setSnackbarMessage('Message sent! ✓');
      setSnackbarVisible(true);
    } catch (error: any) {
      console.error('[SuggestedActions] Failed to approve:', error);
      setSnackbarMessage('Error: ' + (error.message || 'Failed to send'));
      setSnackbarVisible(true);
    } finally {
      setProcessing(null);
    }
  };

  /**
   * Handle editing a suggestion
   * 
   * WHY: User wants to modify the suggested text before sending
   * WHAT: Opens edit dialog
   */
  const handleEdit = (action: SuggestedAction) => {
    setEditingAction(action);
    setEditedText(action.suggestedText || '');
    setEditDialogVisible(true);
  };

  /**
   * Handle sending edited suggestion
   */
  const handleSendEdited = async () => {
    if (!user || !editingAction || !editedText.trim()) return;

    try {
      setProcessing(editingAction.id);
      setEditDialogVisible(false);

      await approveSuggestion(user.id, editingAction.id, editingAction.chatId, editedText.trim());
      setSnackbarMessage('Message sent! ✓');
      setSnackbarVisible(true);

      setEditingAction(null);
      setEditedText('');
    } catch (error: any) {
      console.error('[SuggestedActions] Failed to send edited:', error);
      setSnackbarMessage('Error: ' + (error.message || 'Failed to send'));
      setSnackbarVisible(true);
    } finally {
      setProcessing(null);
    }
  };

  /**
   * Handle rejecting a suggestion
   * 
   * WHY: User doesn't want to use this suggestion
   * WHAT: Marks the action as rejected immediately (no confirmation)
   */
  const handleReject = async (action: SuggestedAction) => {
    if (!user) return;

    try {
      setProcessing(action.id);
      await rejectSuggestion(user.id, action.id);
      setSnackbarMessage('Suggestion dismissed');
      setSnackbarVisible(true);
    } catch (error: any) {
      console.error('[SuggestedActions] Failed to reject:', error);
      setSnackbarMessage('Error: ' + (error.message || 'Failed to reject'));
      setSnackbarVisible(true);
    } finally {
      setProcessing(null);
    }
  };

  /**
   * Handle opening chat
   * 
   * WHY: User wants to view the chat to handle flagged/archived message
   * WHAT: Navigates to the chat screen
   */
  const handleViewChat = (action: SuggestedAction) => {
    // Navigate to chat and auto-dismiss suggestion
    router.push(`/(app)/chat/${action.chatId}`);
    
    // Auto-dismiss this suggestion after navigating
    if (user) {
      rejectSuggestion(user.id, action.id).catch(error => {
        console.error('[SuggestedActions] Failed to auto-dismiss:', error);
      });
    }
  };

  /**
   * Get icon for action type
   */
  const getTypeIcon = (type: string): string => {
    switch (type) {
      case 'respond':
        return '💬';
      case 'flag':
        return '🚩';
      case 'archive':
        return '📦';
      default:
        return '📝';
    }
  };

  /**
   * Render a suggested action item
   */
  const renderActionItem = ({ item }: { item: SuggestedAction }) => {
    // Use messageTimestamp (when message was sent) instead of createdAt (when suggestion was created)
    const timeAgo = item.messageTimestamp
      ? formatDistanceToNow(item.messageTimestamp.toDate(), { addSuffix: true })
      : item.createdAt
      ? formatDistanceToNow(item.createdAt.toDate(), { addSuffix: true })
      : 'Just now';

    const isProcessing = processing === item.id;

    return (
      <Card style={styles.actionCard}>
        <Card.Content>
          {/* Sender Info */}
          <View style={styles.senderInfo}>
            {item.senderPhotoURL ? (
              <Avatar.Image size={40} source={{ uri: item.senderPhotoURL }} />
            ) : (
              <Avatar.Text size={40} label={(item.senderName || 'U').substring(0, 1).toUpperCase()} />
            )}
            <View style={styles.senderDetails}>
              <Text variant="titleMedium" style={styles.senderName}>
                {item.senderName || 'Unknown User'}
              </Text>
              <Text variant="bodySmall" style={styles.timeAgo}>
                {timeAgo}
              </Text>
            </View>
            <Text style={styles.typeIcon}>{getTypeIcon(item.type)}</Text>
          </View>

          {/* Original Message */}
          {item.messageText && (
            <View style={styles.originalMessageContainer}>
              <Text variant="bodySmall" style={styles.originalMessageLabel}>
                Message:
              </Text>
              <Text variant="bodyMedium" style={styles.originalMessage}>
                "{item.messageText}"
              </Text>
            </View>
          )}

          {/* AI Reasoning */}
          <Text variant="bodyMedium" style={styles.reasoning}>
            {item.reasoning}
          </Text>

          {/* Suggested Response (for respond type) */}
          {item.suggestedText && (
            <View style={styles.suggestedTextContainer}>
              <Text variant="bodySmall" style={styles.suggestedLabel}>
                Suggested Response:
              </Text>
              <Text variant="bodyMedium" style={styles.suggestedText}>
                "{item.suggestedText}"
              </Text>
            </View>
          )}
        </Card.Content>

        {item.type === 'respond' && item.suggestedText && (
          <Card.Actions>
            <Button
              onPress={() => handleReject(item)}
              disabled={isProcessing}
              textColor="#F44336"
            >
              Reject
            </Button>
            <Button
              onPress={() => handleEdit(item)}
              disabled={isProcessing}
            >
              Edit
            </Button>
            <Button
              onPress={() => handleApprove(item)}
              loading={isProcessing}
              disabled={isProcessing}
              mode="contained"
              buttonColor="#25D366"
            >
              Send
            </Button>
          </Card.Actions>
        )}

        {item.type !== 'respond' && (
          <Card.Actions>
            <Button
              onPress={() => handleReject(item)}
              disabled={isProcessing}
              textColor="#666"
            >
              Dismiss
            </Button>
            <Button
              onPress={() => handleViewChat(item)}
              disabled={isProcessing}
              mode="contained"
              buttonColor="#25D366"
            >
              View Chat
            </Button>
          </Card.Actions>
        )}
      </Card>
    );
  };

  /**
   * Render empty state
   */
  const renderEmptyState = () => {
    if (loading) return null;

    return (
      <View style={styles.emptyState}>
        <Text variant="headlineSmall" style={styles.emptyTitle}>
          No Pending Suggestions
        </Text>
        <Text variant="bodyLarge" style={styles.emptyText}>
          The AI Agent analyzes your messages and suggests smart replies.
        </Text>
        <Text variant="bodyMedium" style={styles.emptySteps}>
          {'\n'}To get started:{'\n\n'}
          1. Go to Smart Replies{'\n'}
          2. Enable the AI Agent{'\n'}
          3. Tap "Run Agent Now"{'\n\n'}
          The agent will automatically bring you here if it finds suggestions!
        </Text>
        <Button
          mode="contained"
          onPress={() => router.push('/(app)/smart-replies')}
          style={styles.emptyButton}
        >
          Go to Smart Replies
        </Button>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* App Bar */}
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Suggested Actions" />
      </Appbar.Header>

      {/* Loading State */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#25D366" />
          <Text style={styles.loadingText}>Loading suggestions...</Text>
        </View>
      )}

      {/* Actions List */}
      {!loading && (
        <FlatList
          data={actions}
          keyExtractor={(item) => item.id}
          renderItem={renderActionItem}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#25D366']}
            />
          }
          contentContainerStyle={
            actions.length === 0 ? styles.emptyList : styles.listContent
          }
        />
      )}

      {/* Edit Dialog */}
      <Portal>
        <Dialog visible={editDialogVisible} onDismiss={() => setEditDialogVisible(false)}>
          <Dialog.Title>Edit Message</Dialog.Title>
          <Dialog.Content>
            <PaperTextInput
              label="Message"
              value={editedText}
              onChangeText={setEditedText}
              mode="outlined"
              multiline
              numberOfLines={4}
              style={styles.input}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setEditDialogVisible(false)}>Cancel</Button>
            <Button
              onPress={handleSendEdited}
              disabled={!editedText.trim()}
              mode="contained"
              buttonColor="#25D366"
            >
              Send
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Snackbar for success/error feedback */}
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        style={styles.snackbar}
      >
        {snackbarMessage}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
  actionCard: {
    marginBottom: 16,
    elevation: 2,
  },
  senderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  senderDetails: {
    flex: 1,
    marginLeft: 12,
  },
  senderName: {
    fontWeight: 'bold',
    color: '#000',
  },
  typeIcon: {
    fontSize: 24,
  },
  timeAgo: {
    color: '#999',
    marginTop: 2,
  },
  originalMessageContainer: {
    backgroundColor: '#F5F5F5',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  originalMessageLabel: {
    color: '#999',
    marginBottom: 4,
  },
  originalMessage: {
    color: '#333',
  },
  reasoning: {
    color: '#666',
    marginBottom: 12,
  },
  suggestedTextContainer: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#25D366',
  },
  suggestedLabel: {
    color: '#999',
    marginBottom: 4,
  },
  suggestedText: {
    color: '#000',
    fontStyle: 'italic',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    color: '#25D366',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptyText: {
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySteps: {
    color: '#999',
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyButton: {
    marginTop: 24,
    backgroundColor: '#25D366',
  },
  emptyList: {
    flex: 1,
  },
  input: {
    marginBottom: 12,
  },
  snackbar: {
    backgroundColor: '#323232',
  },
});

