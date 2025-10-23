/**
 * RAG Service - Retrieval-Augmented Generation
 * 
 * WHY: AI needs context from past messages to generate better responses
 * WHAT: Stores message embeddings and retrieves similar messages
 * 
 * This service implements a RAG pipeline:
 * 1. Store embeddings when messages are sent (via Firestore trigger)
 * 2. Retrieve similar messages for context when drafting responses
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { generateEmbedding, cosineSimilarity } from './aiService';

/**
 * Firestore Trigger: Store message embedding on creation
 * 
 * WHY: RAG needs embeddings to find similar messages
 * WHAT: When a text message is created, generate and store its embedding
 * 
 * Triggered when: New message created in /chats/{chatId}/messages/{messageId}
 * Stores: Embedding in /users/{userId}/messageEmbeddings/{messageId}
 */
export const storeEmbeddingOnMessageCreate = functions.firestore
  .document('chats/{chatId}/messages/{messageId}')
  .onCreate(async (snapshot, context) => {
    try {
      const messageData = snapshot.data();
      const { chatId, messageId } = context.params;

      // Only store embeddings for text messages with content
      if (!messageData.text || messageData.type !== 'text' || !messageData.text.trim()) {
        functions.logger.info('Skipping embedding for non-text or empty message', { messageId });
        return;
      }

      functions.logger.info('Storing embedding for message', { 
        messageId,
        chatId,
        senderId: messageData.senderId,
      });

      // Store embedding for the sender (so they can search their own messages)
      await storeMessageEmbedding(
        messageId,
        messageData.senderId,
        messageData.text,
        chatId
      );

      functions.logger.info('Embedding stored successfully', { messageId });
    } catch (error: any) {
      functions.logger.error('Failed to store embedding', {
        error: error.message,
        messageId: context.params.messageId,
      });
      // Don't throw - embedding storage is optional, don't block message delivery
    }
  });

/**
 * Store message embedding in Firestore
 * 
 * WHY: We need to store embeddings to search for similar messages later
 * WHAT: Generates embedding and saves to /users/{userId}/messageEmbeddings
 * 
 * @param messageId - ID of the message
 * @param userId - ID of the user who sent the message
 * @param text - Message text content
 * @param chatId - ID of the chat
 */
export async function storeMessageEmbedding(
  messageId: string,
  userId: string,
  text: string,
  chatId: string
): Promise<void> {
  try {
    functions.logger.info('Storing message embedding', { 
      messageId,
      userId,
      textLength: text.length,
    });

    // Generate embedding
    const embedding = await generateEmbedding(text);

    // Store in Firestore
    await admin.firestore()
      .collection('users')
      .doc(userId)
      .collection('messageEmbeddings')
      .doc(messageId)
      .set({
        messageId,
        embedding,
        textSnippet: text.substring(0, 100), // First 100 chars for reference
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        chatId,
      });

    functions.logger.info('Message embedding stored successfully', { messageId });
  } catch (error: any) {
    functions.logger.error('Failed to store message embedding', { 
      error: error.message,
      messageId,
    });
    // Don't throw - embeddings are optional, don't block message sending
  }
}

/**
 * Retrieve relevant messages using RAG
 * 
 * WHY: AI needs context from similar past conversations to draft good responses
 * WHAT: Finds top N most similar messages using cosine similarity
 * 
 * @param userId - ID of the user
 * @param queryText - Text to find similar messages for
 * @param limit - Maximum number of messages to return (default 10)
 * @returns Array of similar message text snippets with similarity scores
 */
export async function retrieveRelevantMessages(
  userId: string,
  queryText: string,
  limit: number = 10
): Promise<Array<{ text: string; similarity: number; messageId: string }>> {
  try {
    functions.logger.info('Retrieving relevant messages', { 
      userId,
      queryLength: queryText.length,
      limit,
    });

    // Generate embedding for query
    const queryEmbedding = await generateEmbedding(queryText);

    // Get all stored embeddings for user
    const embeddingsSnapshot = await admin.firestore()
      .collection('users')
      .doc(userId)
      .collection('messageEmbeddings')
      .orderBy('timestamp', 'desc')
      .limit(100) // Only check last 100 messages for performance
      .get();

    if (embeddingsSnapshot.empty) {
      functions.logger.info('No embeddings found for user', { userId });
      return [];
    }

    // Calculate similarity scores
    const similarities: Array<{ text: string; similarity: number; messageId: string }> = [];

    embeddingsSnapshot.forEach((doc) => {
      const data = doc.data();
      const similarity = cosineSimilarity(queryEmbedding, data.embedding);
      
      similarities.push({
        text: data.textSnippet,
        similarity,
        messageId: data.messageId,
      });
    });

    // Sort by similarity (highest first) and return top N
    const topResults = similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    functions.logger.info('Retrieved relevant messages', { 
      count: topResults.length,
      topSimilarity: topResults[0]?.similarity,
    });

    return topResults;
  } catch (error: any) {
    functions.logger.error('Failed to retrieve relevant messages', { 
      error: error.message,
      userId,
    });
    // Return empty array on error - RAG is optional
    return [];
  }
}

/**
 * Search similar messages by embedding
 * 
 * WHY: Allows querying user's message history by semantic meaning
 * WHAT: Takes a vector embedding and finds similar stored embeddings
 * 
 * @param queryEmbedding - The embedding vector to search with
 * @param userId - ID of the user whose messages to search
 * @param limit - Maximum number of results (default 10)
 * @returns Array of similar messages with scores
 */
export async function searchSimilarMessages(
  queryEmbedding: number[],
  userId: string,
  limit: number = 10
): Promise<Array<{ messageId: string; text: string; similarity: number; chatId: string }>> {
  try {
    functions.logger.info('Searching similar messages', { 
      userId,
      limit,
    });

    // Get all stored embeddings for user
    const embeddingsSnapshot = await admin.firestore()
      .collection('users')
      .doc(userId)
      .collection('messageEmbeddings')
      .orderBy('timestamp', 'desc')
      .limit(100) // Performance optimization
      .get();

    if (embeddingsSnapshot.empty) {
      return [];
    }

    // Calculate similarities
    const results: Array<{ messageId: string; text: string; similarity: number; chatId: string }> = [];

    embeddingsSnapshot.forEach((doc) => {
      const data = doc.data();
      const similarity = cosineSimilarity(queryEmbedding, data.embedding);
      
      results.push({
        messageId: data.messageId,
        text: data.textSnippet,
        similarity,
        chatId: data.chatId,
      });
    });

    // Sort and return top results
    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  } catch (error: any) {
    functions.logger.error('Failed to search similar messages', { 
      error: error.message,
      userId,
    });
    return [];
  }
}

