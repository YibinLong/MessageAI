/**
 * Response Drafting Service
 * 
 * WHY: Help content creators respond faster with AI-generated drafts
 * WHAT: Uses RAG to retrieve past messages and draft contextual responses
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { callOpenAI } from './aiService';
import { retrieveRelevantMessages } from './ragService';

/**
 * Draft Response
 * 
 * WHY: Generate reply suggestions matching creator's voice
 * WHAT: Callable function that uses RAG + OpenAI to draft 3 response options
 * 
 * @param data - { chatId, messageText, userId }
 * @returns { drafts: string[], context: string[] }
 */
export const draftResponse = functions.https.onCall(async (data, context) => {
  try {
    // Check auth
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be logged in');
    }

    const { chatId, messageText } = data;
    const userId = context.auth.uid;

    if (!chatId || !messageText) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'chatId and messageText are required'
      );
    }

    functions.logger.info('Drafting response', {
      userId,
      chatId,
      messageLength: messageText.length,
    });

    // Get user's display name
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    const userData = userDoc.data();
    const userName = userData?.displayName || 'User';

    // Retrieve relevant messages from RAG (user's past messages for voice matching)
    const similarMessages = await retrieveRelevantMessages(userId, messageText, 10);

    functions.logger.info('Retrieved similar messages', {
      count: similarMessages.length,
    });

    // Build context from similar messages
    const contextMessages = similarMessages
      .slice(0, 5) // Use top 5 most similar
      .map((msg) => `- "${msg.text}"`)
      .join('\n');

    // Build prompt
    const prompt = `You are helping ${userName}, a content creator, draft responses to messages.

INCOMING MESSAGE:
"${messageText}"

${
  contextMessages
    ? `EXAMPLES OF ${userName.toUpperCase()}'S PAST MESSAGES (for voice/tone reference):
${contextMessages}`
    : ''
}

Generate 3 different reply options that match ${userName}'s communication style:
1. A friendly, casual response
2. A professional, polite response
3. A brief, direct response

Each response should be 1-2 sentences maximum.

Respond in JSON format:
{
  "draft1": "response text",
  "draft2": "response text",
  "draft3": "response text"
}`;

    // Call OpenAI
    const response = await callOpenAI(prompt, {
      model: 'gpt-3.5-turbo',
      temperature: 0.8, // Higher temperature for creative variations
      max_tokens: 300,
    });

    // Parse response
    let drafts;
    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        drafts = [parsed.draft1, parsed.draft2, parsed.draft3];
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      functions.logger.error('Failed to parse AI response', {
        response: response.content,
        error: parseError,
      });
      // Fallback drafts
      drafts = [
        'Thanks for your message! I appreciate it.',
        "I'll get back to you soon.",
        'Got it, thanks!',
      ];
    }

    functions.logger.info('Response drafts generated', {
      count: drafts.length,
    });

    return {
      success: true,
      drafts,
      context: similarMessages.map((m) => m.text),
    };
  } catch (error: any) {
    functions.logger.error('Response drafting failed', {
      error: error.message,
    });
    throw error;
  }
});

