/**
 * AI Service - OpenAI Wrapper
 * 
 * WHY: Centralized service for all OpenAI API calls with error handling
 * WHAT: Provides functions to call OpenAI for completions and embeddings
 * 
 * This service wraps OpenAI API calls used across all AI features:
 * - Text completion for categorization, sentiment, FAQ matching, etc.
 * - Embeddings generation for RAG pipeline
 * - Error handling and logging
 */

import * as functions from 'firebase-functions';
import OpenAI from 'openai';

/**
 * Initialize OpenAI client
 * 
 * WHY: We need a configured OpenAI client to make API calls
 * WHAT: Creates client with API key from Firebase config
 * 
 * NOTE: Using deprecated functions.config() for now. Will migrate to .env later.
 */
const openai = new OpenAI({
  apiKey: functions.config().openai.key,
});

/**
 * Call OpenAI for chat completion
 * 
 * WHY: Most AI features need text generation (categorization, drafting, etc.)
 * WHAT: Sends prompt to GPT-4 and returns response
 * 
 * @param prompt - The system/user prompt
 * @param options - Optional parameters (model, temperature, functions, etc.)
 * @returns AI response text or function call result
 */
export async function callOpenAI(
  prompt: string,
  options?: {
    model?: string;
    temperature?: number;
    functions?: any[];
    function_call?: any;
    max_tokens?: number;
  }
): Promise<any> {
  try {
    functions.logger.info('Calling OpenAI', { 
      promptLength: prompt.length,
      model: options?.model || 'gpt-4o-mini',
    });

    const response = await openai.chat.completions.create({
      model: options?.model || 'gpt-4o-mini',
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.max_tokens ?? 500,
      ...(options?.functions && { functions: options.functions }),
      ...(options?.function_call && { function_call: options.function_call }),
    });

    functions.logger.info('OpenAI response received', {
      finishReason: response.choices[0].finish_reason,
      tokensUsed: response.usage?.total_tokens,
    });

    // If function call was used, return the function call
    if (response.choices[0].message.function_call) {
      const functionCall = response.choices[0].message.function_call;
      return {
        type: 'function_call',
        name: functionCall.name,
        arguments: JSON.parse(functionCall.arguments || '{}'),
      };
    }

    // Otherwise return text content
    return {
      type: 'text',
      content: response.choices[0].message.content || '',
    };
  } catch (error: any) {
    functions.logger.error('OpenAI API call failed', { 
      error: error.message,
      code: error.code,
    });
    throw new functions.https.HttpsError(
      'internal',
      `AI service error: ${error.message}`
    );
  }
}

/**
 * Generate embedding for text using OpenAI
 * 
 * WHY: RAG pipeline needs embeddings to find similar messages
 * WHAT: Converts text into a vector embedding (1536 dimensions)
 * 
 * @param text - The text to embed
 * @returns Array of numbers representing the embedding
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    functions.logger.info('Generating embedding', { 
      textLength: text.length,
    });

    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });

    functions.logger.info('Embedding generated', {
      dimensions: response.data[0].embedding.length,
    });

    return response.data[0].embedding;
  } catch (error: any) {
    functions.logger.error('Embedding generation failed', { 
      error: error.message,
    });
    throw new functions.https.HttpsError(
      'internal',
      `Embedding generation error: ${error.message}`
    );
  }
}

/**
 * Calculate cosine similarity between two vectors
 * 
 * WHY: RAG needs to find most similar messages by comparing embeddings
 * WHAT: Computes similarity score (0-1, higher = more similar)
 * 
 * @param vecA - First embedding vector
 * @param vecB - Second embedding vector
 * @returns Similarity score (0-1)
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
