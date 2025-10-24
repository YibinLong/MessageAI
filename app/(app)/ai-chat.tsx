/**
 * AI Chat Screen
 * 
 * WHY: Users need an AI assistant to query their conversation data
 * WHAT: Chat interface to ask questions and get insights about DMs
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Appbar, Text, ActivityIndicator, Chip } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import {
  listenToChatHistory,
  sendMessage as sendAIMessage,
} from '../../services/aiChatService';
import { AIChatMessage } from '../../types';
import { MessageInput } from '../../components/MessageInput';

/**
 * AI Chat Screen Component
 * 
 * WHAT: Chat with AI assistant about your DMs
 * WHY: Users want insights and analysis of their conversations
 */
export default function AIChatScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const flatListRef = useRef<FlatList>(null);

  // State
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [inputText, setInputText] = useState('');

  /**
   * Set up real-time listener for chat history
   * 
   * WHY: Show conversation as messages are saved
   * WHAT: Firestore listener that updates UI when messages change
   */
  useEffect(() => {
    if (!user) return;

    const unsubscribe = listenToChatHistory(user.id, (updatedMessages) => {
      setMessages(updatedMessages);
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  /**
   * Scroll to bottom when messages update
   */
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  /**
   * Handle sending a message to AI
   * 
   * WHY: User wants to ask the AI a question
   * WHAT: Sends message to Cloud Function and gets AI response
   */
  const handleSendMessage = async (text: string) => {
    if (!user || !text.trim()) return;

    try {
      setSending(true);
      setInputText(''); // Clear input after sending
      await sendAIMessage(user.id, text.trim());
      // Real-time listener will update messages automatically
    } catch (error: any) {
      console.error('[AIChat] Failed to send message:', error);
      // Show error in chat
      // In a full implementation, you'd show a toast/snackbar
    } finally {
      setSending(false);
    }
  };

  /**
   * Handle suggested query
   * 
   * WHY: Make it easy for users to ask common questions
   * WHAT: Pre-fills the input field with the query (user can edit before sending)
   */
  const handleSuggestedQuery = (query: string) => {
    setInputText(query);
  };

  /**
   * Render a chat message
   */
  const renderMessage = ({ item }: { item: AIChatMessage }) => {
    const isUser = item.role === 'user';

    return (
      <View
        style={[
          styles.messageContainer,
          isUser ? styles.userMessageContainer : styles.aiMessageContainer,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isUser ? styles.userBubble : styles.aiBubble,
          ]}
        >
          {!isUser && <Text style={styles.aiLabel}>AI Assistant</Text>}
          <Text style={[styles.messageText, isUser ? styles.userText : styles.aiText]}>
            {item.content}
          </Text>
        </View>
      </View>
    );
  };

  /**
   * Suggested queries data
   */
  const suggestedQueries = [
    { text: 'How many messages did I get today?', icon: 'calendar-today' },
    { text: 'Show stats from this week', icon: 'chart-bar' },
    { text: 'How many messages in the last hour?', icon: 'clock-outline' },
    { text: 'Show high-priority chats', icon: 'star' },
    { text: 'List business opportunities', icon: 'briefcase' },
    { text: 'What are my urgent messages?', icon: 'alert-circle' },
    { text: 'Search for collaboration', icon: 'magnify' },
    { text: 'Find messages about rates', icon: 'magnify' },
    { text: 'Show my fan messages', icon: 'heart' },
    { text: 'List spam from today', icon: 'cancel' },
    { text: 'Show positive messages this week', icon: 'emoticon-happy' },
    { text: 'Count negative messages', icon: 'emoticon-sad' },
  ];

  /**
   * Render empty state
   */
  const renderEmptyState = () => {
    if (loading) return null;

    return (
      <View style={styles.emptyState}>
        <Text variant="headlineSmall" style={styles.emptyTitle}>
          👋 Ask me anything!
        </Text>
        <Text variant="bodyLarge" style={styles.emptyText}>
          I can help you analyze your DMs and find insights.{'\n\n'}
          Tap any suggestion above to get started, or type your own question!
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >

      {/* Persistent Suggested Queries Bar */}
      <View style={styles.suggestionsBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.suggestionsContent}
        >
          {suggestedQueries.map((query, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => handleSuggestedQuery(query.text)}
              activeOpacity={0.7}
            >
              <Chip
                style={styles.queryChip}
                icon={query.icon}
                mode="outlined"
              >
                {query.text}
              </Chip>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Loading State */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#128c7e" />
          <Text style={styles.loadingText}>Loading chat...</Text>
        </View>
      )}

      {/* Messages List */}
      {!loading && (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={
            messages.length === 0 ? styles.emptyList : styles.messagesList
          }
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />
      )}

      {/* Typing Indicator */}
      {sending && (
        <View style={styles.typingContainer}>
          <View style={styles.typingBubble}>
            <Text style={styles.typingText}>AI is thinking...</Text>
          </View>
        </View>
      )}

      {/* Message Input */}
      <MessageInput
        onSend={handleSendMessage}
        placeholder="Ask me about your DMs..."
        disabled={sending}
        value={inputText}
        onChangeText={setInputText}
        showAIDraftButton={false}
        showImageButton={false}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  suggestionsBar: {
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#f9f9f9',
    paddingVertical: 8,
  },
  suggestionsContent: {
    paddingHorizontal: 12,
    gap: 8,
  },
  queryChip: {
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
  messagesList: {
    padding: 16,
    paddingBottom: 8,
  },
  messageContainer: {
    marginBottom: 12,
    maxWidth: '80%',
  },
  userMessageContainer: {
    alignSelf: 'flex-end',
  },
  aiMessageContainer: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    padding: 12,
    borderRadius: 16,
  },
  userBubble: {
    backgroundColor: '#128c7e',
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: '#E8E8E8',
    borderBottomLeftRadius: 4,
  },
  aiLabel: {
    fontSize: 11,
    color: '#666',
    marginBottom: 4,
    fontWeight: '600',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  userText: {
    color: '#fff',
  },
  aiText: {
    color: '#000',
  },
  typingContainer: {
    padding: 16,
    paddingTop: 0,
  },
  typingBubble: {
    backgroundColor: '#E8E8E8',
    padding: 12,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    alignSelf: 'flex-start',
  },
  typingText: {
    color: '#666',
    fontSize: 14,
    fontStyle: 'italic',
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
    textAlign: 'center',
  },
  emptyText: {
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
  },
  emptyList: {
    flex: 1,
  },
});

