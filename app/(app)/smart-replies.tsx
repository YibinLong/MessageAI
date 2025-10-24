/**
 * Smart Replies Screen
 * 
 * WHY: Unified place for AI agent controls and pending suggestions
 * WHAT: Agent settings, run button, and quick access to suggestions
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import {
  Text,
  Switch,
  Button,
  Card,
  Divider,
} from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import { getAgentSettings, updateAgentSettings } from '../../services/faqService';
import { listenToSuggestedActions, runAgent } from '../../services/agentService';
import { SuggestedAction } from '../../types';

/**
 * Smart Replies Screen Component
 * 
 * WHAT: Central hub for AI agent features
 * WHY: Makes agent accessible and shows pending suggestions count
 */
export default function SmartRepliesScreen() {
  const router = useRouter();
  const { user } = useAuthStore();

  // State
  const [agentEnabled, setAgentEnabled] = useState(false);
  const [runningAgent, setRunningAgent] = useState(false);
  const [pendingSuggestions, setPendingSuggestions] = useState<SuggestedAction[]>([]);
  const [loading, setLoading] = useState(true);

  /**
   * Load agent settings on mount
   */
  useEffect(() => {
    if (!user) return;
    loadSettings();
  }, [user]);

  /**
   * Listen to pending suggestions
   */
  useEffect(() => {
    if (!user) return;

    const unsubscribe = listenToSuggestedActions(user.id, (actions) => {
      setPendingSuggestions(actions);
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  /**
   * Load agent settings
   */
  const loadSettings = async () => {
    if (!user) return;

    try {
      const settings = await getAgentSettings(user.id);
      if (settings) {
        setAgentEnabled(settings.agentEnabled || false);
      }
      setLoading(false);
    } catch (error) {
      console.error('[SmartReplies] Failed to load settings:', error);
      setLoading(false);
    }
  };

  /**
   * Handle toggling AI agent
   */
  const handleToggleAgent = async (value: boolean) => {
    if (!user) return;

    try {
      setAgentEnabled(value);
      await updateAgentSettings(user.id, { agentEnabled: value });
    } catch (error) {
      console.error('[SmartReplies] Failed to update agent enabled:', error);
      Alert.alert('Error', 'Failed to update settings');
      setAgentEnabled(!value);
    }
  };

  /**
   * Handle running agent
   */
  const handleRunAgent = async () => {
    if (!user) return;

    if (!agentEnabled) {
      Alert.alert('Agent Disabled', 'Please enable the AI Agent first.');
      return;
    }

    try {
      setRunningAgent(true);

      const result = await runAgent(user.id);

      // Auto-navigate to suggestions if any were created
      if (result.actionsSuggested > 0) {
        router.push('/(app)/suggested-actions');
      } else {
        Alert.alert(
          'Agent Run Complete',
          `Processed ${result.messagesProcessed} messages\n` +
          `No new suggestions created\n` +
          `${result.errors > 0 ? `Errors: ${result.errors}` : ''}`
        );
      }
    } catch (error: any) {
      console.error('[SmartReplies] Failed to run agent:', error);
      Alert.alert('Error', error.message || 'Failed to run agent');
    } finally {
      setRunningAgent(false);
    }
  };

  /**
   * Handle viewing agent activity
   */
  const handleViewActivity = () => {
    router.push('/(app)/agent-activity');
  };

  /**
   * Handle reviewing suggestions
   */
  const handleReviewSuggestions = () => {
    router.push('/(app)/suggested-actions');
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content}>
        {/* Agent Settings Section */}
        <View style={styles.section}>
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.settingRow}>
                <View style={styles.settingText}>
                  <Text variant="titleMedium">Enable AI Agent</Text>
                  <Text variant="bodySmall" style={styles.settingSubtext}>
                    AI will analyze incoming messages and suggest actions
                  </Text>
                </View>
                <Switch
                  value={agentEnabled}
                  onValueChange={handleToggleAgent}
                  color="#25D366"
                />
              </View>
            </Card.Content>
          </Card>
        </View>

        <Divider style={styles.divider} />

        {/* Agent Controls Section */}
        <View style={styles.section}>
          <Button
            mode="contained"
            onPress={handleRunAgent}
            loading={runningAgent}
            disabled={runningAgent || !agentEnabled}
            style={styles.button}
            icon="robot"
            buttonColor="#25D366"
          >
            {runningAgent ? 'Running Agent...' : 'Run Agent Now'}
          </Button>

          <Button
            mode="outlined"
            onPress={handleViewActivity}
            style={styles.button}
            icon="history"
          >
            View Agent Activity
          </Button>

          {!agentEnabled && (
            <Text variant="bodySmall" style={styles.disabledText}>
              Enable the AI Agent above to use these controls
            </Text>
          )}
        </View>

        <Divider style={styles.divider} />

        {/* Pending Suggestions Section */}
        <View style={styles.section}>
          <Card style={styles.card}>
            <Card.Content>
              {loading ? (
                <Text style={styles.loadingText}>Loading...</Text>
              ) : (
                <>
                  {pendingSuggestions.length > 0 ? (
                    <>
                      <Text variant="titleLarge" style={styles.countText}>
                        {pendingSuggestions.length}
                      </Text>
                      <Text variant="bodyMedium" style={styles.countLabel}>
                        {pendingSuggestions.length === 1
                          ? 'pending suggestion'
                          : 'pending suggestions'}
                      </Text>
                      <Text variant="bodySmall" style={styles.countDescription}>
                        Review and approve AI-suggested replies
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text variant="titleMedium" style={styles.emptyTitle}>
                        No pending suggestions
                      </Text>
                      <Text variant="bodySmall" style={styles.emptyDescription}>
                        {agentEnabled
                          ? 'Run the agent to get smart reply suggestions for your messages'
                          : 'Enable the AI Agent and run it to get suggestions'}
                      </Text>
                    </>
                  )}
                </>
              )}
            </Card.Content>
            {pendingSuggestions.length > 0 && (
              <Card.Actions style={styles.cardActions}>
                <Button
                  mode="contained"
                  onPress={handleReviewSuggestions}
                  buttonColor="#25D366"
                  icon="check-circle"
                >
                  Review Suggestions
                </Button>
              </Card.Actions>
            )}
          </Card>
        </View>

        {/* Info Section */}
        <View style={styles.infoSection}>
          <Text variant="bodySmall" style={styles.infoText}>
            💡 The AI Agent analyzes your messages and suggests:
          </Text>
          <Text variant="bodySmall" style={styles.infoItem}>
            • Friendly responses to fan messages
          </Text>
          <Text variant="bodySmall" style={styles.infoItem}>
            • Answers to FAQ matches
          </Text>
          <Text variant="bodySmall" style={styles.infoItem}>
            • Flags for business opportunities
          </Text>
          <Text variant="bodySmall" style={styles.infoItem}>
            • Spam detection and archiving
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  sectionDescription: {
    color: '#666',
    marginBottom: 16,
  },
  card: {
    elevation: 2,
  },
  cardActions: {
    justifyContent: 'center',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingText: {
    flex: 1,
    marginRight: 16,
  },
  settingSubtext: {
    color: '#666',
    marginTop: 4,
  },
  button: {
    marginBottom: 12,
  },
  disabledText: {
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  divider: {
    height: 8,
    backgroundColor: '#f0f0f0',
  },
  loadingText: {
    color: '#999',
    textAlign: 'center',
  },
  countText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#25D366',
    textAlign: 'center',
    paddingTop: 8,
  },
  countLabel: {
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  countDescription: {
    color: '#999',
    textAlign: 'center',
    marginTop: 4,
  },
  emptyTitle: {
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyDescription: {
    color: '#999',
    textAlign: 'center',
    fontSize: 13,
  },
  infoSection: {
    padding: 16,
    backgroundColor: '#F5F5F5',
    marginTop: 16,
  },
  infoText: {
    color: '#666',
    marginBottom: 12,
    fontWeight: '600',
  },
  infoItem: {
    color: '#666',
    marginBottom: 6,
    paddingLeft: 8,
  },
});

