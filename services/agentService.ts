/**
 * Agent Service
 * 
 * WHY: Frontend needs to interact with AI Agent functions
 * WHAT: Service layer for running agent, fetching logs, and managing suggestions
 */

import { getFunctions, httpsCallable } from 'firebase/functions';
import { collection, query, orderBy, limit, onSnapshot, getDocs, where } from 'firebase/firestore';
import { db, functions } from './firebase';
import { AgentLog, SuggestedAction } from '../types';

/**
 * Run the AI agent for a user
 * 
 * WHY: User wants to manually trigger agent to process unread messages
 * WHAT: Calls Cloud Function to run agent workflow
 * 
 * @param userId - User ID
 * @returns Summary of agent run
 */
export async function runAgent(userId: string): Promise<{
  messagesProcessed: number;
  actionsSuggested: number;
  errors: number;
}> {
  try {
    const runAgentFunction = httpsCallable(functions, 'runAgent');
    const result = await runAgentFunction({ userId });
    
    return result.data as {
      messagesProcessed: number;
      actionsSuggested: number;
      errors: number;
    };
  } catch (error: any) {
    console.error('[AgentService] Failed to run agent:', error);
    throw new Error(error.message || 'Failed to run agent');
  }
}

/**
 * Get agent logs for a user
 * 
 * WHY: User wants to see what the agent did
 * WHAT: Fetches recent agent logs from Firestore
 * 
 * @param userId - User ID
 * @param limitCount - Max number of logs to fetch (default 50)
 * @returns Array of agent logs
 */
export async function getAgentLogs(
  userId: string,
  limitCount: number = 50
): Promise<AgentLog[]> {
  try {
    const logsRef = collection(db, 'users', userId, 'agentLogs');
    const q = query(logsRef, orderBy('timestamp', 'desc'), limit(limitCount));
    
    const snapshot = await getDocs(q);
    
    const logs: AgentLog[] = [];
    snapshot.forEach((doc) => {
      logs.push({ id: doc.id, ...doc.data() } as AgentLog);
    });
    
    return logs;
  } catch (error) {
    console.error('[AgentService] Failed to get agent logs:', error);
    throw error;
  }
}

/**
 * Listen to agent logs in real-time
 * 
 * WHY: User wants live updates of agent activity
 * WHAT: Sets up Firestore listener for agent logs
 * 
 * @param userId - User ID
 * @param callback - Function to call when logs update
 * @returns Unsubscribe function
 */
export function listenToAgentLogs(
  userId: string,
  callback: (logs: AgentLog[]) => void
): () => void {
  const logsRef = collection(db, 'users', userId, 'agentLogs');
  const q = query(logsRef, orderBy('timestamp', 'desc'), limit(50));
  
  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const logs: AgentLog[] = [];
      snapshot.forEach((doc) => {
        logs.push({ id: doc.id, ...doc.data() } as AgentLog);
      });
      callback(logs);
    },
    (error) => {
      console.error('[AgentService] Agent logs listener error:', error);
    }
  );
  
  return unsubscribe;
}

/**
 * Get pending suggested actions
 * 
 * WHY: User needs to see what actions the agent suggested
 * WHAT: Fetches suggested actions with status 'pending'
 * 
 * @param userId - User ID
 * @returns Array of suggested actions
 */
export async function getSuggestedActions(userId: string): Promise<SuggestedAction[]> {
  try {
    const actionsRef = collection(db, 'users', userId, 'suggestedActions');
    const q = query(
      actionsRef,
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    
    const actions: SuggestedAction[] = [];
    snapshot.forEach((doc) => {
      actions.push({ id: doc.id, ...doc.data() } as SuggestedAction);
    });
    
    return actions;
  } catch (error) {
    console.error('[AgentService] Failed to get suggested actions:', error);
    throw error;
  }
}

/**
 * Listen to suggested actions in real-time
 * 
 * WHY: User wants live updates when agent creates new suggestions
 * WHAT: Sets up Firestore listener for pending suggested actions
 * 
 * @param userId - User ID
 * @param callback - Function to call when actions update
 * @returns Unsubscribe function
 */
export function listenToSuggestedActions(
  userId: string,
  callback: (actions: SuggestedAction[]) => void
): () => void {
  const actionsRef = collection(db, 'users', userId, 'suggestedActions');
  const q = query(
    actionsRef,
    where('status', '==', 'pending'),
    orderBy('createdAt', 'desc')
  );
  
  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const actions: SuggestedAction[] = [];
      snapshot.forEach((doc) => {
        actions.push({ id: doc.id, ...doc.data() } as SuggestedAction);
      });
      callback(actions);
    },
    (error) => {
      console.error('[AgentService] Suggested actions listener error:', error);
    }
  );
  
  return unsubscribe;
}

/**
 * Approve a suggested action and send the message
 * 
 * WHY: User reviewed the suggestion and wants to send it
 * WHAT: Calls Cloud Function to mark approved, then sends message
 * 
 * @param userId - User ID
 * @param actionId - Suggested action ID
 * @param chatId - Chat ID
 * @param text - Message text to send
 */
export async function approveSuggestion(
  userId: string,
  actionId: string,
  chatId: string,
  text: string
): Promise<void> {
  try {
    // Mark as approved
    const approveFn = httpsCallable(functions, 'approveSuggestion');
    await approveFn({ userId, actionId });
    
    // Send the message (import dynamically to avoid circular dependency)
    const { sendMessage } = await import('./messageService');
    await sendMessage(chatId, text, userId);
  } catch (error) {
    console.error('[AgentService] Failed to approve suggestion:', error);
    throw error;
  }
}

/**
 * Reject a suggested action
 * 
 * WHY: User reviewed the suggestion and doesn't want to use it
 * WHAT: Calls Cloud Function to mark rejected
 * 
 * @param userId - User ID
 * @param actionId - Suggested action ID
 */
export async function rejectSuggestion(
  userId: string,
  actionId: string
): Promise<void> {
  try {
    const rejectFn = httpsCallable(functions, 'rejectSuggestion');
    await rejectFn({ userId, actionId });
  } catch (error) {
    console.error('[AgentService] Failed to reject suggestion:', error);
    throw error;
  }
}

