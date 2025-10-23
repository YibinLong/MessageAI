/**
 * AI Chat Service
 * 
 * WHY: Users need an AI assistant to query and analyze their conversations
 * WHAT: Chat interface where users can ask questions about their DMs
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { callOpenAI } from './aiService';
import {
  searchConversations,
  getMessageStats,
  listHighPriorityChats,
} from './aiTools';
import { checkAndIncrementRateLimit } from './rateLimiter';

/**
 * Send a message to the AI assistant
 * 
 * WHY: User wants to ask questions about their conversations
 * WHAT: Processes user message and generates AI response using tools
 * 
 * The AI assistant can:
 * - Search conversations
 * - Summarize threads
 * - Get statistics
 * - List high-priority chats
 * 
 * @param data - { userId: string, message: string }
 * @param context - Auth context
 * @returns AI response text
 */
export const sendAIChatMessage = functions.https.onCall(async (data, context) => {
  try {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be logged in');
    }

    const { userId, message } = data;

    if (!userId || !message) {
      throw new functions.https.HttpsError('invalid-argument', 'userId and message are required');
    }

    // Verify user is requesting for themselves
    if (context.auth.uid !== userId) {
      throw new functions.https.HttpsError('permission-denied', 'Can only chat for yourself');
    }

    // ✅ RATE LIMITING: Check if user is within hourly limit (100 calls/hour)
    // WHY: Each AI chat message uses OpenAI API
    await checkAndIncrementRateLimit(userId);

    functions.logger.info('AI Chat message received', {
      userId,
      messageLength: message.length,
    });

    // Save user message to history
    const userMessageRef = admin.firestore()
      .collection('users')
      .doc(userId)
      .collection('aiChatHistory')
      .doc();

    await userMessageRef.set({
      id: userMessageRef.id,
      role: 'user',
      content: message,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Determine user intent and call appropriate tool
    const response = await processUserMessage(userId, message);

    // Save AI response to history
    const aiMessageRef = admin.firestore()
      .collection('users')
      .doc(userId)
      .collection('aiChatHistory')
      .doc();

    await aiMessageRef.set({
      id: aiMessageRef.id,
      role: 'assistant',
      content: response,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    functions.logger.info('AI Chat response sent', {
      userId,
      responseLength: response.length,
    });

    return { response };
  } catch (error: any) {
    functions.logger.error('AI Chat failed', {
      error: error.message,
    });
    throw error;
  }
});

/**
 * Process user message and generate response
 * 
 * WHY: Determine what the user wants and execute the appropriate action
 * WHAT: Analyzes intent and calls tools or generates direct response
 */
async function processUserMessage(userId: string, message: string): Promise<string> {
  const lowerMessage = message.toLowerCase();

  try {
    // Check for specific intents

    // INTENT: Search for messages
    if (lowerMessage.includes('search') || lowerMessage.includes('find')) {
      const searchTerm = extractSearchTerm(message);
      if (searchTerm) {
        const results = await searchConversations(userId, searchTerm, 5);

        if (results.length === 0) {
          return `I couldn't find any messages containing "${searchTerm}".`;
        }

        let response = `Found ${results.length} message(s) containing "${searchTerm}":\n\n`;
        results.forEach((result, i) => {
          response += `${i + 1}. ${result.chatName}: "${result.text.substring(0, 100)}..."\n`;
        });
        return response;
      }
    }

    // INTENT: Summarize conversations
    if (lowerMessage.includes('summarize') || lowerMessage.includes('summary')) {
      // For now, get stats instead of summarizing a specific chat
      // In a full implementation, we'd identify the chat from context
      const category = extractCategory(message);
      const days = extractTimePeriod(message);
      const stats = await getMessageStats(userId, category, days);

      // Format time period for display
      let timePeriod = 'the last 7 days';
      if (days === 1) {
        timePeriod = 'today';
      } else if (days < 1) {
        const hours = Math.round(days * 24);
        const minutes = Math.round(days * 24 * 60);
        if (hours >= 1) {
          timePeriod = `the last ${hours} hour${hours > 1 ? 's' : ''}`;
        } else {
          timePeriod = `the last ${minutes} minute${minutes > 1 ? 's' : ''}`;
        }
      } else if (days === 7) {
        timePeriod = 'this week';
      } else if (days === 30) {
        timePeriod = 'this month';
      } else {
        timePeriod = `the last ${days} days`;
      }

      let response = `Here's a summary of your DMs from ${timePeriod}:\n\n`;
      response += `📊 Total messages received: ${stats.totalMessages}\n\n`;
      response += `📂 By Category:\n`;
      response += `  • Fan messages: ${stats.categoryCounts.fan || 0}\n`;
      response += `  • Business: ${stats.categoryCounts.business || 0}\n`;
      response += `  • Urgent: ${stats.categoryCounts.urgent || 0}\n`;
      response += `  • Spam: ${stats.categoryCounts.spam || 0}\n\n`;
      response += `🌟 High-priority opportunities: ${stats.highPriorityCount}\n\n`;
      response += `😊 Sentiment breakdown:\n`;
      response += `  • Positive: ${stats.sentimentCounts.positive || 0}\n`;
      response += `  • Neutral: ${stats.sentimentCounts.neutral || 0}\n`;
      response += `  • Negative: ${stats.sentimentCounts.negative || 0}`;

      return response;
    }

    // INTENT: Get statistics
    if (lowerMessage.includes('stats') || lowerMessage.includes('how many') || lowerMessage.includes('count')) {
      const category = extractCategory(message);
      const days = extractTimePeriod(message);
      const stats = await getMessageStats(userId, category, days);

      // Format time period for display
      let timePeriod = 'Last 7 Days';
      if (days === 1) {
        timePeriod = 'Today';
      } else if (days < 1) {
        const hours = Math.round(days * 24);
        const minutes = Math.round(days * 24 * 60);
        if (hours >= 1) {
          timePeriod = `Last ${hours} Hour${hours > 1 ? 's' : ''}`;
        } else {
          timePeriod = `Last ${minutes} Minute${minutes > 1 ? 's' : ''}`;
        }
      } else if (days === 7) {
        timePeriod = 'This Week';
      } else if (days === 30) {
        timePeriod = 'This Month';
      } else {
        timePeriod = `Last ${days} Days`;
      }

      let response = `📊 **Your DM Statistics (${timePeriod})**\n\n`;
      response += `Total messages: ${stats.totalMessages}\n\n`;
      response += `**By Category:**\n`;
      response += `• Fan messages: ${stats.categoryCounts.fan || 0}\n`;
      response += `• Business: ${stats.categoryCounts.business || 0}\n`;
      response += `• Urgent: ${stats.categoryCounts.urgent || 0}\n`;
      response += `• Spam: ${stats.categoryCounts.spam || 0}\n\n`;
      response += `**High Priority:** ${stats.highPriorityCount} opportunities\n\n`;
      response += `**Sentiment:**\n`;
      response += `• Positive: ${stats.sentimentCounts.positive || 0}\n`;
      response += `• Neutral: ${stats.sentimentCounts.neutral || 0}\n`;
      response += `• Negative: ${stats.sentimentCounts.negative || 0}`;

      return response;
    }

    // INTENT: List urgent/important/priority messages
    if (lowerMessage.includes('urgent') || lowerMessage.includes('important') || lowerMessage.includes('priority')) {
      const chats = await listHighPriorityChats(userId, 5);

      if (chats.length === 0) {
        return "You don't have any high-priority messages at the moment. Great job staying on top of things! 🎉";
      }

      let response = `🌟 **High-Priority Chats** (Collaboration Score > 7):\n\n`;
      chats.forEach((chat, i) => {
        response += `${i + 1}. **${chat.chatName}** (Score: ${chat.score}/10)\n`;
        response += `   Category: ${chat.category}\n`;
        response += `   "${chat.lastMessage.substring(0, 100)}..."\n\n`;
      });

      return response;
    }

    // INTENT: Show business opportunities
    if (lowerMessage.includes('business') || lowerMessage.includes('collab') || lowerMessage.includes('partnership')) {
      const days = extractTimePeriod(message);
      const stats = await getMessageStats(userId, 'business', days);
      const highPriority = await listHighPriorityChats(userId, 3);

      // Format time period
      let timePeriod = 'the last 7 days';
      if (days === 1) timePeriod = 'today';
      else if (days === 7) timePeriod = 'this week';
      else if (days === 30) timePeriod = 'this month';
      else timePeriod = `the last ${days} days`;

      let response = `💼 **Business Opportunities**\n\n`;
      response += `You have ${stats.categoryCounts.business || 0} business messages in ${timePeriod}.\n\n`;

      if (highPriority.length > 0) {
        response += `**Top Opportunities:**\n`;
        highPriority.forEach((chat, i) => {
          response += `${i + 1}. ${chat.chatName} (Score: ${chat.score}/10)\n`;
        });
      } else {
        response += `No high-priority business opportunities at the moment.`;
      }

      return response;
    }

    // Default: Use GPT to generate a helpful response
    const prompt = `You are a helpful AI assistant for a content creator managing their DMs.

The user asked: "${message}"

You have access to their message data and can:
- Search for specific messages
- Summarize conversations
- Provide statistics (total messages, by category, by sentiment)
- List high-priority business opportunities

Respond helpfully and conversationally. If you need more specific information from them, ask clarifying questions.`;

    const gptResponse = await callOpenAI(prompt, {
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      max_tokens: 300,
    });

    return gptResponse.content.trim();
  } catch (error: any) {
    functions.logger.error('Message processing failed', { error: error.message });
    return "Sorry, I encountered an error processing your request. Please try again.";
  }
}

/**
 * Extract search term from user message
 */
function extractSearchTerm(message: string): string | null {
  const patterns = [
    /search for ["'](.+?)["']/i,
    /find ["'](.+?)["']/i,
    /containing ["'](.+?)["']/i,
    /about ["'](.+?)["']/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  // Fallback: take words after "search" or "find"
  const lowerMessage = message.toLowerCase();
  if (lowerMessage.includes('search ')) {
    const parts = message.split(/search /i);
    if (parts[1]) return parts[1].trim();
  }
  if (lowerMessage.includes('find ')) {
    const parts = message.split(/find /i);
    if (parts[1]) return parts[1].trim();
  }

  return null;
}

/**
 * Extract category from user message
 */
function extractCategory(message: string): string | undefined {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('fan')) return 'fan';
  if (lowerMessage.includes('business')) return 'business';
  if (lowerMessage.includes('spam')) return 'spam';
  if (lowerMessage.includes('urgent')) return 'urgent';

  return undefined;
}

/**
 * Extract time period from user message
 * 
 * WHY: User might ask for "today", "last hour", "last 5 minutes", etc.
 * WHAT: Parses common time phrases and returns number of days
 * 
 * @param message - User's query
 * @returns Number of days to look back (fractional for hours/minutes)
 */
function extractTimePeriod(message: string): number {
  const lowerMessage = message.toLowerCase();

  // Today
  if (lowerMessage.includes('today')) {
    return 1;
  }

  // Yesterday
  if (lowerMessage.includes('yesterday')) {
    return 1;
  }

  // This week
  if (lowerMessage.includes('this week') || lowerMessage.includes('week')) {
    return 7;
  }

  // This month (approximate)
  if (lowerMessage.includes('this month') || lowerMessage.includes('month')) {
    return 30;
  }

  // Last X hours
  const hoursMatch = lowerMessage.match(/last\s+(\d+)\s+hour/);
  if (hoursMatch) {
    const hours = parseInt(hoursMatch[1]);
    return hours / 24; // Convert to days
  }

  // Last X minutes
  const minutesMatch = lowerMessage.match(/last\s+(\d+)\s+minute/);
  if (minutesMatch) {
    const minutes = parseInt(minutesMatch[1]);
    return minutes / (24 * 60); // Convert to days
  }

  // Last X days
  const daysMatch = lowerMessage.match(/last\s+(\d+)\s+day/);
  if (daysMatch) {
    return parseInt(daysMatch[1]);
  }

  // Last 24 hours
  if (lowerMessage.includes('24 hours') || lowerMessage.includes('24h')) {
    return 1;
  }

  // Default: 7 days
  return 7;
}

