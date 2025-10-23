/**
 * AI Agent - Multi-Step Message Handler
 * 
 * WHY: Content creators need autonomous handling of routine DMs
 * WHAT: Processes unread messages and suggests actions (respond, flag, archive)
 * 
 * This agent implements a multi-step workflow:
 * 1. Query unread messages for the user
 * 2. For each message: analyze and decide action
 * 3. Create suggested actions for user approval
 * 4. Log all actions for transparency
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { callOpenAI } from './aiService';
import { logAgentAction } from './agentLogger';
import { createSuggestedAction } from './suggestedActions';

/**
 * Run AI Agent for a user
 * 
 * WHY: Process all unread messages and suggest actions
 * WHAT: HTTP-callable function that runs the agent workflow
 * 
 * FLOW:
 * 1. Check if agent is enabled for user
 * 2. Query unread messages (where user is participant but not sender)
 * 3. For each message:
 *    - Check if it already has AI categorization (from auto-categorization trigger)
 *    - If not categorized, categorize it now
 *    - Check for FAQ match
 *    - Decide action based on category
 *    - Create suggested action
 * 4. Return summary of actions taken
 * 
 * @param data - { userId: string }
 * @param context - Auth context
 * @returns { messagesProcessed, actionsSuggested, errors }
 */
export const runAgent = functions.https.onCall(async (data, context) => {
  try {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be logged in');
    }

    const { userId } = data;

    if (!userId) {
      throw new functions.https.HttpsError('invalid-argument', 'userId is required');
    }

    // Verify user is requesting for themselves
    if (context.auth.uid !== userId) {
      throw new functions.https.HttpsError('permission-denied', 'Can only run agent for yourself');
    }

    functions.logger.info('Running agent', { userId });

    // Check if agent is enabled
    const agentSettings = await admin.firestore()
      .collection('users')
      .doc(userId)
      .collection('agentSettings')
      .doc('config')
      .get();

    const isEnabled = agentSettings.exists && agentSettings.data()?.agentEnabled === true;

    if (!isEnabled) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Agent is not enabled. Enable it in settings first.'
      );
    }

    // Get user's chats
    const chatsSnapshot = await admin.firestore()
      .collection('chats')
      .where('participants', 'array-contains', userId)
      .get();

    if (chatsSnapshot.empty) {
      return {
        messagesProcessed: 0,
        actionsSuggested: 0,
        errors: 0,
      };
    }

    let messagesProcessed = 0;
    let actionsSuggested = 0;
    let errors = 0;

    // Process each chat
    for (const chatDoc of chatsSnapshot.docs) {
      const chatId = chatDoc.id;

      try {
        // Get only the MOST RECENT message from other users (not sent by this user)
        // WHY: Only suggest actions for the latest message to avoid confusion
        const messagesSnapshot = await admin.firestore()
          .collection('chats')
          .doc(chatId)
          .collection('messages')
          .where('senderId', '!=', userId)
          .orderBy('senderId')
          .orderBy('timestamp', 'desc')
          .limit(1) // Only process the most recent message per chat
          .get();

        // Process each message
        for (const messageDoc of messagesSnapshot.docs) {
          try {
            const messageData = messageDoc.data();
            const messageId = messageDoc.id;

            // Skip if not a text message
            if (messageData.type !== 'text' || !messageData.text) {
              continue;
            }

            // Skip if already processed (has ANY suggested action - pending, approved, or rejected)
            // WHY: Prevent duplicate suggestions when agent runs multiple times
            const existingAction = await admin.firestore()
              .collection('users')
              .doc(userId)
              .collection('suggestedActions')
              .where('messageId', '==', messageId)
              .get();

            if (!existingAction.empty) {
              continue; // Already has a suggestion (any status)
            }

            messagesProcessed++;

            // Fetch sender details for display in UI
            let senderName: string | undefined;
            let senderPhotoURL: string | undefined;
            try {
              const senderDoc = await admin.firestore()
                .collection('users')
                .doc(messageData.senderId)
                .get();
              
              if (senderDoc.exists) {
                const senderData = senderDoc.data();
                senderName = senderData?.displayName;
                senderPhotoURL = senderData?.photoURL;
              }
            } catch (error: any) {
              functions.logger.warn('Failed to fetch sender details', {
                senderId: messageData.senderId,
                error: error.message,
              });
            }

            // Get or create AI categorization
            let category = messageData.aiCategory;
            let sentiment = messageData.aiSentiment;
            let collaborationScore = messageData.aiCollaborationScore;

            // If not categorized yet, categorize now
            if (!category) {
              const analysis = await categorizeMessageNow(messageData.text);
              category = analysis.category;
              sentiment = analysis.sentiment;
              collaborationScore = analysis.collaborationScore;

              // Update message with categorization
              await messageDoc.ref.update({
                aiCategory: category,
                aiSentiment: sentiment,
                aiCollaborationScore: collaborationScore,
              });
            }

            // Check for FAQ match
            const faqMatch = await checkFAQMatch(userId, messageData.text);

            // Decide action based on category and FAQ match
            if (faqMatch) {
              // FAQ matched - suggest FAQ response
              await createSuggestedAction(
                userId,
                'respond',
                messageId,
                chatId,
                messageData.senderId,
                senderName,
                senderPhotoURL,
                messageData.text,
                messageData.timestamp,
                faqMatch.answer,
                `Matched FAQ: "${faqMatch.question}"`
              );

              await logAgentAction(
                userId,
                'respond',
                messageId,
                chatId,
                `Suggested FAQ answer: ${faqMatch.question}`
              );

              actionsSuggested++;
            } else if (category === 'spam') {
              // Spam - suggest archiving
              await createSuggestedAction(
                userId,
                'archive',
                messageId,
                chatId,
                messageData.senderId,
                senderName,
                senderPhotoURL,
                messageData.text,
                messageData.timestamp,
                undefined,
                'Message appears to be spam'
              );

              await logAgentAction(
                userId,
                'archive',
                messageId,
                chatId,
                'Suggested archiving spam message'
              );

              actionsSuggested++;
            } else if (category === 'business' || category === 'urgent' || collaborationScore > 7) {
              // Business/urgent/high-value - flag for review
              const reason = category === 'urgent'
                ? 'Urgent message requiring immediate attention'
                : category === 'business'
                ? 'Business opportunity detected'
                : `High collaboration potential (score: ${collaborationScore})`;

              await createSuggestedAction(
                userId,
                'flag',
                messageId,
                chatId,
                messageData.senderId,
                senderName,
                senderPhotoURL,
                messageData.text,
                messageData.timestamp,
                undefined,
                reason
              );

              await logAgentAction(
                userId,
                'flag',
                messageId,
                chatId,
                `Flagged: ${reason}`
              );

              actionsSuggested++;
            } else if (category === 'fan') {
              // Fan message - suggest friendly response
              const draftedResponse = await draftFriendlyResponse(messageData.text);

              await createSuggestedAction(
                userId,
                'respond',
                messageId,
                chatId,
                messageData.senderId,
                senderName,
                senderPhotoURL,
                messageData.text,
                messageData.timestamp,
                draftedResponse,
                'Auto-drafted friendly response to fan message'
              );

              await logAgentAction(
                userId,
                'respond',
                messageId,
                chatId,
                'Suggested friendly response to fan'
              );

              actionsSuggested++;
            }
          } catch (messageError: any) {
            functions.logger.error('Failed to process message', {
              error: messageError.message,
              messageId: messageDoc.id,
            });
            errors++;
          }
        }
      } catch (chatError: any) {
        functions.logger.error('Failed to process chat', {
          error: chatError.message,
          chatId,
        });
        errors++;
      }
    }

    functions.logger.info('Agent run complete', {
      userId,
      messagesProcessed,
      actionsSuggested,
      errors,
    });

    return {
      messagesProcessed,
      actionsSuggested,
      errors,
    };
  } catch (error: any) {
    functions.logger.error('Agent run failed', {
      error: error.message,
    });
    throw error;
  }
});

/**
 * Categorize a message now (if not already categorized)
 * 
 * WHY: Some messages might not have been categorized by the auto-trigger
 * WHAT: Calls OpenAI to categorize the message
 */
async function categorizeMessageNow(text: string): Promise<{
  category: string;
  sentiment: string;
  collaborationScore: number;
}> {
  const prompt = `You are analyzing direct messages for a content creator/influencer.

Analyze this message and provide:
1. Category (fan/business/spam/urgent)
2. Sentiment (positive/neutral/negative)
3. Collaboration potential score (1-10)

Message: "${text}"

Respond in JSON format:
{
  "category": "fan" | "business" | "spam" | "urgent",
  "sentiment": "positive" | "neutral" | "negative",
  "collaborationScore": 1-10
}`;

  const response = await callOpenAI(prompt, {
    model: 'gpt-3.5-turbo',
    temperature: 0.3,
    max_tokens: 150,
  });

  try {
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const analysis = JSON.parse(jsonMatch[0]);
      return {
        category: analysis.category || 'fan',
        sentiment: analysis.sentiment || 'neutral',
        collaborationScore: analysis.collaborationScore || 1,
      };
    }
  } catch (error) {
    functions.logger.warn('Failed to parse categorization', { error });
  }

  // Default fallback
  return {
    category: 'fan',
    sentiment: 'neutral',
    collaborationScore: 1,
  };
}

/**
 * Check if message matches any FAQ
 * 
 * WHY: Agent should suggest FAQ answers when applicable
 * WHAT: Queries user's FAQs and checks for match
 */
async function checkFAQMatch(
  userId: string,
  messageText: string
): Promise<{ question: string; answer: string } | null> {
  try {
    // Get user's FAQs
    const faqsSnapshot = await admin.firestore()
      .collection('users')
      .doc(userId)
      .collection('faqs')
      .get();

    if (faqsSnapshot.empty) {
      return null;
    }

    const faqs: any[] = [];
    faqsSnapshot.forEach((doc) => {
      faqs.push({ id: doc.id, ...doc.data() });
    });

    // Build FAQ matching prompt
    const faqList = faqs.map((faq, i) =>
      `${i + 1}. Q: "${faq.question}" | A: "${faq.answer}"`
    ).join('\n');

    const prompt = `You are helping match incoming messages to FAQs.

INCOMING MESSAGE:
"${messageText}"

AVAILABLE FAQs:
${faqList}

Does this message match any of the FAQs? If yes, return the FAQ number.

Respond in JSON format:
{
  "matched": true/false,
  "faqNumber": 1-${faqs.length} or null
}`;

    const response = await callOpenAI(prompt, {
      model: 'gpt-3.5-turbo',
      temperature: 0.2,
      max_tokens: 100,
    });

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const match = JSON.parse(jsonMatch[0]);
      if (match.matched && match.faqNumber) {
        const matchedFAQ = faqs[match.faqNumber - 1];
        if (matchedFAQ) {
          return {
            question: matchedFAQ.question,
            answer: matchedFAQ.answer,
          };
        }
      }
    }

    return null;
  } catch (error: any) {
    functions.logger.warn('FAQ matching failed', { error: error.message });
    return null;
  }
}

/**
 * Draft a friendly response to a fan message
 * 
 * WHY: Agent should suggest responses to fan messages
 * WHAT: Uses GPT to generate a friendly, concise reply
 */
async function draftFriendlyResponse(messageText: string): Promise<string> {
  try {
    const prompt = `You are a friendly content creator responding to a fan message.

Fan message: "${messageText}"

Draft a warm, friendly, concise response (1-2 sentences max). Be appreciative and genuine.

Respond with ONLY the message text, no JSON or formatting.`;

    const response = await callOpenAI(prompt, {
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      max_tokens: 100,
    });

    return response.content.trim() || 'Thanks for your message! I really appreciate your support! 💚';
  } catch (error: any) {
    functions.logger.warn('Draft response failed', { error: error.message });
    return 'Thanks for your message! I really appreciate your support! 💚';
  }
}

