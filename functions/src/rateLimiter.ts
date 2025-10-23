/**
 * Rate Limiter Service
 * 
 * WHY: Prevent AI abuse and control OpenAI costs
 * WHAT: Limit users to 100 AI calls per hour across all features
 * 
 * This service tracks AI usage per user per hour and enforces limits.
 * Simple approach: one counter for ALL AI features combined.
 */

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

/**
 * Rate limit configuration
 * 
 * WHY: 100 calls/hour is generous for testing but prevents spam bots
 * WHAT: If user exceeds this, they get a friendly error message
 */
const HOURLY_LIMIT = 100;

/**
 * Get current hour key
 * 
 * WHY: We reset counters every hour, so we use hour as the key
 * WHAT: Returns format like "2025-10-23-14" for 2pm on Oct 23, 2025
 * 
 * @returns Hour key string (YYYY-MM-DD-HH)
 */
function getCurrentHourKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  
  return `${year}-${month}-${day}-${hour}`;
}

/**
 * Calculate minutes until next hour
 * 
 * WHY: Show user how long they need to wait
 * WHAT: Calculates time remaining in current hour
 * 
 * @returns Minutes remaining in current hour
 */
function getMinutesUntilNextHour(): number {
  const now = new Date();
  const minutes = now.getMinutes();
  return 60 - minutes;
}

/**
 * Check if user is within rate limit
 * 
 * WHY: Before allowing AI call, verify user hasn't exceeded hourly limit
 * WHAT: 
 * 1. Get/create usage document for current hour
 * 2. Check if totalCalls < 100
 * 3. If yes, increment counter and allow
 * 4. If no, throw rate limit error
 * 
 * @param userId - User ID to check
 * @returns true if allowed (also increments counter)
 * @throws HttpsError if rate limit exceeded
 */
export async function checkAndIncrementRateLimit(userId: string): Promise<boolean> {
  const currentHour = getCurrentHourKey();
  
  const usageRef = admin.firestore()
    .collection('users')
    .doc(userId)
    .collection('aiUsage')
    .doc('hourly');
  
  try {
    // Use transaction to avoid race conditions
    // WHY: Multiple AI calls might happen simultaneously
    const result = await admin.firestore().runTransaction(async (transaction) => {
      const usageDoc = await transaction.get(usageRef);
      const data = usageDoc.data();
      
      // If document doesn't exist or it's a new hour, create/reset it
      if (!data || data.hour !== currentHour) {
        transaction.set(usageRef, {
          hour: currentHour,
          totalCalls: 1,
          resetAt: admin.firestore.Timestamp.now(),
          lastCallAt: admin.firestore.Timestamp.now(),
        });
        
        functions.logger.info('Rate limit: New hour started', {
          userId,
          hour: currentHour,
          calls: 1,
        });
        
        return { allowed: true, currentCalls: 1 };
      }
      
      // Check if user is over limit
      const currentCalls = data.totalCalls || 0;
      
      if (currentCalls >= HOURLY_LIMIT) {
        functions.logger.warn('Rate limit exceeded', {
          userId,
          hour: currentHour,
          calls: currentCalls,
          limit: HOURLY_LIMIT,
        });
        
        return { allowed: false, currentCalls };
      }
      
      // Increment counter
      transaction.update(usageRef, {
        totalCalls: admin.firestore.FieldValue.increment(1),
        lastCallAt: admin.firestore.Timestamp.now(),
      });
      
      functions.logger.info('Rate limit: Call allowed', {
        userId,
        hour: currentHour,
        calls: currentCalls + 1,
        limit: HOURLY_LIMIT,
      });
      
      return { allowed: true, currentCalls: currentCalls + 1 };
    });
    
    if (!result.allowed) {
      const minutesRemaining = getMinutesUntilNextHour();
      const message = `You've reached the hourly limit (${HOURLY_LIMIT} AI calls per hour). ` +
        `Try again in ${minutesRemaining} minute${minutesRemaining !== 1 ? 's' : ''}.`;
      
      throw new functions.https.HttpsError(
        'resource-exhausted',
        message
      );
    }
    
    return true;
  } catch (error: any) {
    // If it's already our error, re-throw it
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    // Otherwise, log and throw a generic error
    functions.logger.error('Rate limit check failed', {
      userId,
      error: error.message,
    });
    
    throw new functions.https.HttpsError(
      'internal',
      'Failed to check rate limit'
    );
  }
}

/**
 * Get user's current usage stats
 * 
 * WHY: Allow users to see how many calls they have left
 * WHAT: Returns current hour's usage data
 * 
 * @param userId - User ID
 * @returns Usage stats or null if no usage this hour
 */
export async function getUserUsageStats(userId: string): Promise<{
  hour: string;
  totalCalls: number;
  limit: number;
  remaining: number;
  minutesUntilReset: number;
} | null> {
  try {
    const currentHour = getCurrentHourKey();
    
    const usageDoc = await admin.firestore()
      .collection('users')
      .doc(userId)
      .collection('aiUsage')
      .doc('hourly')
      .get();
    
    const data = usageDoc.data();
    
    // If no data or old hour, return fresh stats
    if (!data || data.hour !== currentHour) {
      return {
        hour: currentHour,
        totalCalls: 0,
        limit: HOURLY_LIMIT,
        remaining: HOURLY_LIMIT,
        minutesUntilReset: getMinutesUntilNextHour(),
      };
    }
    
    const totalCalls = data.totalCalls || 0;
    
    return {
      hour: currentHour,
      totalCalls,
      limit: HOURLY_LIMIT,
      remaining: Math.max(0, HOURLY_LIMIT - totalCalls),
      minutesUntilReset: getMinutesUntilNextHour(),
    };
  } catch (error: any) {
    functions.logger.error('Failed to get usage stats', {
      userId,
      error: error.message,
    });
    return null;
  }
}

