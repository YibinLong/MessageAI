/**
 * AI Chat Service
 * 
 * WHY: Frontend needs to interact with AI assistant
 * WHAT: Service layer for sending messages to AI and fetching chat history
 */

import { httpsCallable } from 'firebase/functions';
import { collection, query, orderBy, limit, onSnapshot, getDocs } from 'firebase/firestore';
import { db, functions } from './firebase';
import { AIChatMessage } from '../types';

/**
 * Send a message to the AI assistant
 * 
 * WHY: User wants to ask the AI a question
 * WHAT: Calls Cloud Function to process message and get AI response
 * 
 * @param userId - User ID
 * @param message - User's message text
 * @returns AI response text
 */
export async function sendMessage(
  userId: string,
  message: string
): Promise<string> {
  try {
    const sendMessageFn = httpsCallable(functions, 'sendAIChatMessage');
    const result = await sendMessageFn({ userId, message });
    
    const data = result.data as { response: string };
    return data.response;
  } catch (error: any) {
    console.error('[AIChatService] Failed to send message:', error);
    throw new Error(error.message || 'Failed to send message');
  }
}

/**
 * Get AI chat history
 * 
 * WHY: User wants to see past conversation with AI
 * WHAT: Fetches chat messages from Firestore
 * 
 * @param userId - User ID
 * @param limitCount - Max number of messages (default 50)
 * @returns Array of chat messages
 */
export async function getChatHistory(
  userId: string,
  limitCount: number = 50
): Promise<AIChatMessage[]> {
  try {
    const historyRef = collection(db, 'users', userId, 'aiChatHistory');
    const q = query(historyRef, orderBy('timestamp', 'asc'), limit(limitCount));
    
    const snapshot = await getDocs(q);
    
    const messages: AIChatMessage[] = [];
    snapshot.forEach((doc) => {
      messages.push({ id: doc.id, ...doc.data() } as AIChatMessage);
    });
    
    return messages;
  } catch (error) {
    console.error('[AIChatService] Failed to get chat history:', error);
    throw error;
  }
}

/**
 * Listen to AI chat history in real-time
 * 
 * WHY: User wants to see messages appear as they're saved
 * WHAT: Sets up Firestore listener for chat history
 * 
 * @param userId - User ID
 * @param callback - Function to call when messages update
 * @returns Unsubscribe function
 */
export function listenToChatHistory(
  userId: string,
  callback: (messages: AIChatMessage[]) => void
): () => void {
  const historyRef = collection(db, 'users', userId, 'aiChatHistory');
  const q = query(historyRef, orderBy('timestamp', 'asc'), limit(100));
  
  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const messages: AIChatMessage[] = [];
      snapshot.forEach((doc) => {
        messages.push({ id: doc.id, ...doc.data() } as AIChatMessage);
      });
      callback(messages);
    },
    (error) => {
      console.error('[AIChatService] Chat history listener error:', error);
    }
  );
  
  return unsubscribe;
}

