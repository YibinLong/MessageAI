/**
 * AI Service (Frontend)
 * 
 * WHY: Interface for calling AI Cloud Functions from the frontend
 * WHAT: Wrapper functions for all AI features (drafting, FAQ, etc.)
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

/**
 * AI Assistant User ID
 * 
 * WHY: Special user ID for AI assistant chat
 * WHAT: Constant used to identify AI assistant in chats
 */
export const AI_ASSISTANT_ID = 'ai-assistant';

/**
 * Request draft responses for a message
 * 
 * WHY: Get AI-generated reply suggestions
 * WHAT: Calls draftResponse Cloud Function
 * 
 * @param chatId - ID of the chat
 * @param messageText - The message to respond to
 * @returns Promise with { drafts, context }
 */
export async function requestDraftResponse(
  chatId: string,
  messageText: string
): Promise<{ drafts: string[]; context: string[] }> {
  try {
    const draftResponseFn = httpsCallable(functions, 'draftResponse');
    const result = await draftResponseFn({ chatId, messageText });

    const data = result.data as any;

    if (!data.success) {
      throw new Error('Draft response failed');
    }

    return {
      drafts: data.drafts,
      context: data.context || [],
    };
  } catch (error: any) {
    console.error('[AIService] Draft response error:', error);
    throw new Error(`Failed to generate drafts: ${error.message}`);
  }
}

/**
 * Test OpenAI connection
 * 
 * WHY: Verify AI features are working
 * WHAT: Calls testOpenAI Cloud Function
 * 
 * @returns Promise with test result
 */
export async function testOpenAIConnection(): Promise<{ success: boolean; message: string; response?: string }> {
  try {
    const testOpenAIFn = httpsCallable(functions, 'testOpenAI');
    const result = await testOpenAIFn({});

    const data = result.data as any;

    return data;
  } catch (error: any) {
    console.error('[AIService] OpenAI test error:', error);
    return {
      success: false,
      message: `Test failed: ${error.message}`,
    };
  }
}

/**
 * Manually re-categorize a message
 * 
 * WHY: Allow users to trigger re-categorization if AI got it wrong
 * WHAT: Calls recategorizeMessage Cloud Function
 * 
 * @param messageId - ID of the message
 * @param chatId - ID of the chat
 * @returns Promise with categorization result
 */
export async function recategorizeMessage(
  messageId: string,
  chatId: string
): Promise<{ success: boolean; analysis: any }> {
  try {
    const recategorizeFn = httpsCallable(functions, 'recategorizeMessage');
    const result = await recategorizeFn({ messageId, chatId });

    const data = result.data as any;

    return data;
  } catch (error: any) {
    console.error('[AIService] Re-categorization error:', error);
    throw new Error(`Failed to re-categorize: ${error.message}`);
  }
}
