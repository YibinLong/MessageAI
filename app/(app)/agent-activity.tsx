/**
 * Agent Activity Screen
 * 
 * WHY: Users need to see what the AI agent has done
 * WHAT: Displays log of agent actions with filtering
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Text, ActivityIndicator, Chip, Card } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import { listenToAgentLogs } from '../../services/agentService';
import { AgentLog } from '../../types';
import { formatDistanceToNow } from 'date-fns';

/**
 * Agent Activity Screen Component
 * 
 * WHAT: Shows history of agent actions
 * WHY: Users want transparency into what the agent did
 */
export default function AgentActivityScreen() {
  const router = useRouter();
  const { user } = useAuthStore();

  // State
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  /**
   * Set up real-time listener for agent logs
   * 
   * WHY: Show latest agent activity as it happens
   * WHAT: Firestore listener that updates UI when logs change
   */
  useEffect(() => {
    if (!user) return;

    const unsubscribe = listenToAgentLogs(user.id, (updatedLogs) => {
      setLogs(updatedLogs);
      setLoading(false);
      setRefreshing(false);
    });

    return unsubscribe;
  }, [user]);

  /**
   * Handle pull-to-refresh
   * 
   * WHY: User wants to manually refresh the logs
   * WHAT: Triggers a refresh (real-time listener will update automatically)
   */
  const handleRefresh = () => {
    setRefreshing(true);
    // Real-time listener will update the data
    setTimeout(() => setRefreshing(false), 1000);
  };

  /**
   * Filter logs by action type
   * 
   * WHY: User wants to see specific types of actions
   * WHAT: Filters log list based on selected type
   */
  const getFilteredLogs = (): AgentLog[] => {
    if (filter === 'all') {
      return logs;
    }
    return logs.filter((log) => log.action === filter);
  };

  /**
   * Get icon for action type
   */
  const getActionIcon = (action: string): string => {
    switch (action) {
      case 'respond':
        return '💬';
      case 'flag':
        return '🚩';
      case 'archive':
        return '📦';
      case 'categorize':
        return '🏷️';
      default:
        return '📝';
    }
  };

  /**
   * Get color for action type
   */
  const getActionColor = (action: string): string => {
    switch (action) {
      case 'respond':
        return '#4CAF50';
      case 'flag':
        return '#FF9800';
      case 'archive':
        return '#9E9E9E';
      case 'categorize':
        return '#2196F3';
      default:
        return '#666';
    }
  };

  /**
   * Render a log item
   */
  const renderLogItem = ({ item }: { item: AgentLog }) => {
    const timeAgo = item.timestamp
      ? formatDistanceToNow(item.timestamp.toDate(), { addSuffix: true })
      : 'Just now';

    return (
      <Card style={styles.logCard}>
        <Card.Content>
          <View style={styles.logHeader}>
            <View style={styles.logTitle}>
              <Text style={styles.actionIcon}>{getActionIcon(item.action)}</Text>
              <Text
                variant="titleMedium"
                style={[styles.actionType, { color: getActionColor(item.action) }]}
              >
                {item.action.toUpperCase()}
              </Text>
            </View>
            <Text variant="bodySmall" style={styles.timeAgo}>
              {timeAgo}
            </Text>
          </View>
          <Text variant="bodyMedium" style={styles.result}>
            {item.result}
          </Text>
        </Card.Content>
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
          No Agent Activity
        </Text>
        <Text variant="bodyLarge" style={styles.emptyText}>
          Run the agent from FAQ Settings to see activity here
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Filter Chips */}
      <View style={styles.filterContainer}>
        <Chip
          selected={filter === 'all'}
          onPress={() => setFilter('all')}
          style={styles.filterChip}
        >
          All
        </Chip>
        <Chip
          selected={filter === 'respond'}
          onPress={() => setFilter('respond')}
          style={styles.filterChip}
        >
          Responses
        </Chip>
        <Chip
          selected={filter === 'flag'}
          onPress={() => setFilter('flag')}
          style={styles.filterChip}
        >
          Flagged
        </Chip>
        <Chip
          selected={filter === 'archive'}
          onPress={() => setFilter('archive')}
          style={styles.filterChip}
        >
          Archived
        </Chip>
      </View>

      {/* Loading State */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#25D366" />
          <Text style={styles.loadingText}>Loading activity...</Text>
        </View>
      )}

      {/* Logs List */}
      {!loading && (
        <FlatList
          data={getFilteredLogs()}
          keyExtractor={(item) => item.id}
          renderItem={renderLogItem}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#25D366']}
            />
          }
          contentContainerStyle={
            getFilteredLogs().length === 0 ? styles.emptyList : styles.listContent
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  filterContainer: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  filterChip: {
    marginHorizontal: 4,
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
  logCard: {
    marginBottom: 12,
    elevation: 2,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  logTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionIcon: {
    fontSize: 20,
  },
  actionType: {
    fontWeight: 'bold',
  },
  timeAgo: {
    color: '#999',
  },
  result: {
    color: '#666',
    marginTop: 4,
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
    color: '#999',
    textAlign: 'center',
  },
  emptyList: {
    flex: 1,
  },
});

