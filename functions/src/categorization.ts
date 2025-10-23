/**
 * Message Categorization Service
 * 
 * WHY: Content creators get hundreds of DMs - need automatic categorization
 * WHAT: Uses AI to categorize messages as fan/business/spam/urgent
 * 
 * Also includes sentiment analysis and collaboration scoring (Epic 3.5, 3.6)
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { callOpenAI } from './aiService';

/**
 * Categorize Message on Creation
 * 
 * WHY: Automatically categorize messages when they arrive
 * WHAT: Firestore trigger that runs AI categorization on new messages
 * 
 * Triggered when: New message created in /chats/{chatId}/messages/{messageId}
 * Updates: aiCategory, aiSentiment, aiUrgency, aiCollaborationScore
 */
export const categorizeMessage = functions.firestore
  .document('chats/{chatId}/messages/{messageId}')
  .onCreate(async (snapshot, context) => {
    try {
      const messageData = snapshot.data();
      const { chatId, messageId } = context.params;

      // Only categorize text messages (not images, system messages, etc.)
      if (!messageData.text || messageData.type !== 'text') {
        functions.logger.info('Skipping non-text message', { messageId });
        return;
      }

      functions.logger.info('Categorizing message', { 
        messageId,
        chatId,
        textLength: messageData.text.length,
      });

      // Build comprehensive prompt for categorization, sentiment, and scoring
      const prompt = `You are analyzing direct messages for a content creator/influencer.

Analyze this message and provide:
1. Category (fan/business/spam/urgent)
2. Sentiment (positive/neutral/negative)
3. Urgency level (1-5, where 5 is most urgent)
4. Collaboration potential score (1-10, where 10 is highest potential for business collaboration)

Message: "${messageData.text}"

Guidelines:
- "fan": General fan messages, compliments, casual conversation
- "business": Collaboration offers, brand deals, professional inquiries
- "spam": Promotional content, scams, unsolicited sales
- "urgent": Time-sensitive matters that need immediate attention

For collaboration score, look for:
- Brand/company mentions
- Money/payment discussions
- Partnership/sponsorship keywords
- Professional tone

Respond in JSON format:
{
  "category": "fan" | "business" | "spam" | "urgent",
  "sentiment": "positive" | "neutral" | "negative",
  "urgency": 1-5,
  "collaborationScore": 1-10,
  "reasoning": "brief explanation"
}`;

      // Call OpenAI
      const response = await callOpenAI(prompt, {
        model: 'gpt-3.5-turbo',
        temperature: 0.3, // Lower temperature for consistent categorization
        max_tokens: 200,
      });

      // Parse response
      let analysis;
      try {
        // Extract JSON from response
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysis = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        functions.logger.error('Failed to parse AI response', { 
          response: response.content,
          error: parseError,
        });
        // Use defaults
        analysis = {
          category: 'fan',
          sentiment: 'neutral',
          urgency: 1,
          collaborationScore: 1,
        };
      }

      // Update message with AI analysis
      await snapshot.ref.update({
        aiCategory: analysis.category,
        aiSentiment: analysis.sentiment,
        aiUrgency: analysis.urgency,
        aiCollaborationScore: analysis.collaborationScore,
      });

      functions.logger.info('Message categorized successfully', {
        messageId,
        category: analysis.category,
        sentiment: analysis.sentiment,
        urgency: analysis.urgency,
        collaborationScore: analysis.collaborationScore,
      });

      // Update chat's lastMessage with AI data (for filtering)
      // WHY: We need to propagate AI data to chat document for filtering
      // WHAT: Verify this message is STILL the lastMessage before updating
      try {
        const chatDoc = await admin.firestore()
          .collection('chats')
          .doc(chatId)
          .get();

        if (chatDoc.exists && chatDoc.data()?.lastMessage) {
          const lastMessageData = chatDoc.data()?.lastMessage;
          
          // Check if this message is still the last message
          // WHY: Prevent race condition where newer message arrived during AI processing
          // WHAT: Compare message ID or timestamp to ensure we're updating the correct message
          const isStillLastMessage = 
            lastMessageData.id === messageId || 
            (lastMessageData.createdAt && 
             messageData.createdAt && 
             lastMessageData.createdAt.toMillis() === messageData.createdAt.toMillis());
          
          if (isStillLastMessage) {
            // Safe to update - this is still the most recent message
            await chatDoc.ref.update({
              'lastMessage.aiCategory': analysis.category,
              'lastMessage.aiSentiment': analysis.sentiment,
              'lastMessage.aiUrgency': analysis.urgency,
              'lastMessage.aiCollaborationScore': analysis.collaborationScore,
            });
            functions.logger.info('Chat lastMessage updated with AI data', { chatId, messageId });
          } else {
            // A newer message arrived while we were processing
            // Skip update to avoid overwriting newer message's data
            functions.logger.warn('Message is no longer the lastMessage, skipping AI data update', { 
              chatId, 
              messageId,
              currentLastMessageId: lastMessageData.id,
            });
          }
        } else {
          // lastMessage doesn't exist yet (race condition)
          // Skip update - it will be set when chat's lastMessage is created
          functions.logger.warn('Chat lastMessage not found, skipping AI data update', { chatId });
        }
      } catch (updateError: any) {
        // Don't throw - this is a non-critical update
        functions.logger.error('Failed to update chat with AI data', {
          chatId,
          error: updateError.message,
        });
      }

    } catch (error: any) {
      functions.logger.error('Message categorization failed', {
        error: error.message,
        messageId: context.params.messageId,
      });
      // Don't throw - categorization is optional, don't block message delivery
    }
  });

/**
 * Manually Re-categorize Message
 * 
 * WHY: Allow users to trigger re-categorization if AI got it wrong
 * WHAT: Callable function that re-runs categorization on a message
 * 
 * @param data - { messageId, chatId }
 */
export const recategorizeMessage = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be logged in');
    }

    const { messageId, chatId } = data;

    if (!messageId || !chatId) {
      throw new functions.https.HttpsError('invalid-argument', 'messageId and chatId required');
    }

    functions.logger.info('Re-categorizing message', { messageId, chatId });

    // Get message
    const messageDoc = await admin.firestore()
      .collection('chats')
      .doc(chatId)
      .collection('messages')
      .doc(messageId)
      .get();

    if (!messageDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Message not found');
    }

    const messageData = messageDoc.data();
    if (!messageData) {
      throw new functions.https.HttpsError('not-found', 'Message data not found');
    }

    // Same categorization logic as onCreate trigger
    const prompt = `You are analyzing direct messages for a content creator/influencer.

Analyze this message and provide:
1. Category (fan/business/spam/urgent)
2. Sentiment (positive/neutral/negative)
3. Urgency level (1-5, where 5 is most urgent)
4. Collaboration potential score (1-10, where 10 is highest potential for business collaboration)

Message: "${messageData.text}"

Respond in JSON format:
{
  "category": "fan" | "business" | "spam" | "urgent",
  "sentiment": "positive" | "neutral" | "negative",
  "urgency": 1-5,
  "collaborationScore": 1-10
}`;

    const response = await callOpenAI(prompt, {
      model: 'gpt-3.5-turbo',
      temperature: 0.3,
      max_tokens: 200,
    });

    // Parse response
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    const analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : {
      category: 'fan',
      sentiment: 'neutral',
      urgency: 1,
      collaborationScore: 1,
    };

    // Update message
    await messageDoc.ref.update({
      aiCategory: analysis.category,
      aiSentiment: analysis.sentiment,
      aiUrgency: analysis.urgency,
      aiCollaborationScore: analysis.collaborationScore,
    });

    return {
      success: true,
      analysis,
    };
  } catch (error: any) {
    functions.logger.error('Re-categorization failed', { error: error.message });
    throw error;
  }
});

