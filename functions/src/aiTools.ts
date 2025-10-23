/**
 * AI Tools Service
 * 
 * WHY: AI Assistant needs tools to query conversation data
 * WHAT: Tool functions for searching, summarizing, and analyzing messages
 */

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { callOpenAI } from './aiService';

/**
 * Search conversations for messages matching a query
 * 
 * WHY: User wants to find specific messages or topics
 * WHAT: Searches message text across all user's chats
 * 
 * @param userId - User ID
 * @param query - Search query
 * @param limit - Max results (default 10)
 * @returns Array of matching messages with chat info
 */
export async function searchConversations(
  userId: string,
  query: string,
  limit: number = 10
): Promise<any[]> {
  try {
    functions.logger.info('Searching conversations', { userId, query });

    // Get user's chats
    const chatsSnapshot = await admin.firestore()
      .collection('chats')
      .where('participants', 'array-contains', userId)
      .get();

    const results: any[] = [];

    // Search messages in each chat
    for (const chatDoc of chatsSnapshot.docs) {
      if (results.length >= limit) break;

      const chatData = chatDoc.data();
      const chatId = chatDoc.id;

      // Query messages containing the search term (case-insensitive)
      const messagesSnapshot = await admin.firestore()
        .collection('chats')
        .doc(chatId)
        .collection('messages')
        .where('type', '==', 'text')
        .orderBy('timestamp', 'desc')
        .limit(20)
        .get();

      // Filter messages that contain the query (Firestore doesn't support text search)
      for (const messageDoc of messagesSnapshot.docs) {
        const messageData = messageDoc.data();
        if (messageData.text?.toLowerCase().includes(query.toLowerCase())) {
          results.push({
            messageId: messageDoc.id,
            chatId,
            chatName: chatData.name || 'Direct Message',
            text: messageData.text,
            senderId: messageData.senderId,
            timestamp: messageData.timestamp,
            category: messageData.aiCategory,
          });

          if (results.length >= limit) break;
        }
      }
    }

    functions.logger.info('Search complete', { results: results.length });
    return results;
  } catch (error: any) {
    functions.logger.error('Search failed', { error: error.message });
    throw error;
  }
}

/**
 * Summarize messages in a chat thread
 * 
 * WHY: User wants a quick summary of a conversation
 * WHAT: Fetches recent messages and uses GPT to summarize
 * 
 * @param userId - User ID
 * @param chatId - Chat ID to summarize
 * @param days - Number of days to look back (default 7)
 * @returns Summary text
 */
export async function summarizeThread(
  userId: string,
  chatId: string,
  days: number = 7
): Promise<string> {
  try {
    functions.logger.info('Summarizing thread', { userId, chatId, days });

    // Calculate timestamp for X days ago
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffTimestamp = admin.firestore.Timestamp.fromDate(cutoffDate);

    // Get messages from last X days
    const messagesSnapshot = await admin.firestore()
      .collection('chats')
      .doc(chatId)
      .collection('messages')
      .where('timestamp', '>=', cutoffTimestamp)
      .orderBy('timestamp', 'asc')
      .limit(50)
      .get();

    if (messagesSnapshot.empty) {
      return 'No messages found in this time period.';
    }

    // Build conversation text
    const messages = messagesSnapshot.docs.map((doc) => {
      const data = doc.data();
      const isUser = data.senderId === userId;
      return `${isUser ? 'You' : 'Them'}: ${data.text}`;
    }).join('\n');

    // Ask GPT to summarize
    const prompt = `Summarize this conversation in 2-3 sentences. Focus on key topics and any important decisions or action items.

Conversation:
${messages}

Summary:`;

    const response = await callOpenAI(prompt, {
      model: 'gpt-3.5-turbo',
      temperature: 0.5,
      max_tokens: 200,
    });

    return response.content.trim();
  } catch (error: any) {
    functions.logger.error('Summarization failed', { error: error.message });
    throw error;
  }
}

/**
 * Get message statistics
 * 
 * WHY: User wants to see DM metrics
 * WHAT: Counts messages by category, sentiment, etc.
 * 
 * @param userId - User ID
 * @param category - Optional category filter
 * @param days - Number of days to look back (default 7)
 * @returns Statistics object
 */
export async function getMessageStats(
  userId: string,
  category?: string,
  days: number = 7
): Promise<any> {
  try {
    functions.logger.info('Getting message stats', { userId, category, days });

    // Calculate timestamp for X days ago
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffTimestamp = admin.firestore.Timestamp.fromDate(cutoffDate);

    // Get user's chats
    const chatsSnapshot = await admin.firestore()
      .collection('chats')
      .where('participants', 'array-contains', userId)
      .get();

    let totalMessages = 0;
    const categoryCounts: { [key: string]: number } = {
      fan: 0,
      business: 0,
      spam: 0,
      urgent: 0,
    };
    const sentimentCounts: { [key: string]: number } = {
      positive: 0,
      neutral: 0,
      negative: 0,
    };
    let highPriorityCount = 0;

    // Count messages in each chat
    for (const chatDoc of chatsSnapshot.docs) {
      const messagesSnapshot = await admin.firestore()
        .collection('chats')
        .doc(chatDoc.id)
        .collection('messages')
        .where('timestamp', '>=', cutoffTimestamp)
        .where('senderId', '!=', userId) // Only count messages TO the user
        .orderBy('senderId')
        .orderBy('timestamp', 'desc')
        .get();

      for (const messageDoc of messagesSnapshot.docs) {
        const data = messageDoc.data();

        // Skip if filtering by category and doesn't match
        if (category && data.aiCategory !== category) {
          continue;
        }

        totalMessages++;

        // Count by category
        if (data.aiCategory) {
          categoryCounts[data.aiCategory] = (categoryCounts[data.aiCategory] || 0) + 1;
        }

        // Count by sentiment
        if (data.aiSentiment) {
          sentimentCounts[data.aiSentiment] = (sentimentCounts[data.aiSentiment] || 0) + 1;
        }

        // Count high priority (collaboration score > 7)
        if (data.aiCollaborationScore && data.aiCollaborationScore > 7) {
          highPriorityCount++;
        }
      }
    }

    return {
      totalMessages,
      categoryCounts,
      sentimentCounts,
      highPriorityCount,
      days,
    };
  } catch (error: any) {
    functions.logger.error('Stats failed', { error: error.message });
    throw error;
  }
}

/**
 * Get chats with high collaboration potential
 * 
 * WHY: User wants to see business opportunities
 * WHAT: Returns chats with messages scored > 7
 * 
 * @param userId - User ID
 * @param limit - Max results (default 10)
 * @returns Array of high-priority chats
 */
export async function listHighPriorityChats(
  userId: string,
  limit: number = 10
): Promise<any[]> {
  try {
    functions.logger.info('Listing high priority chats', { userId });

    // Get user's chats
    const chatsSnapshot = await admin.firestore()
      .collection('chats')
      .where('participants', 'array-contains', userId)
      .get();

    const highPriorityChats: any[] = [];

    // Check each chat for high-score messages
    for (const chatDoc of chatsSnapshot.docs) {
      const chatData = chatDoc.data();
      const chatId = chatDoc.id;

      // Check if last message has high collaboration score
      if (chatData.lastMessage?.aiCollaborationScore > 7) {
        highPriorityChats.push({
          chatId,
          chatName: chatData.name || 'Direct Message',
          lastMessage: chatData.lastMessage.text,
          score: chatData.lastMessage.aiCollaborationScore,
          category: chatData.lastMessage.aiCategory,
        });
      }
    }

    // Sort by score (highest first)
    highPriorityChats.sort((a, b) => b.score - a.score);

    return highPriorityChats.slice(0, limit);
  } catch (error: any) {
    functions.logger.error('List high priority failed', { error: error.message });
    throw error;
  }
}

