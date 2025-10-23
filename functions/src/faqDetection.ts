/**
 * FAQ Detection Service
 * 
 * WHY: Automatically detect and respond to FAQ matches
 * WHAT: Firestore trigger that checks incoming messages against FAQs
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { callOpenAI } from './aiService';

/**
 * Detect FAQ Match on Message Creation
 * 
 * WHY: Automatically respond to common questions
 * WHAT: Checks if message matches any FAQ, auto-responds if enabled
 * 
 * Triggered when: New message created in /chats/{chatId}/messages/{messageId}
 */
export const detectFAQ = functions.firestore
  .document('chats/{chatId}/messages/{messageId}')
  .onCreate(async (snapshot, context) => {
    try {
      const messageData = snapshot.data();
      const { chatId, messageId } = context.params;

      // Only process text messages from other users (not the creator's own messages)
      if (!messageData.text || messageData.type !== 'text') {
        return;
      }

      // Get chat to find the recipient (creator)
      const chatDoc = await admin.firestore().collection('chats').doc(chatId).get();
      if (!chatDoc.exists) {
        return;
      }

      const chatData = chatDoc.data();
      if (!chatData) {
        return;
      }

      // Find the other participant (assume they're the creator with FAQs)
      const creatorId = chatData.participants.find((id: string) => id !== messageData.senderId);
      if (!creatorId) {
        return;
      }

      functions.logger.info('Checking FAQs for message', {
        messageId,
        chatId,
        creatorId,
      });

      // Get creator's FAQs
      const faqsSnapshot = await admin.firestore()
        .collection('users')
        .doc(creatorId)
        .collection('faqs')
        .get();

      if (faqsSnapshot.empty) {
        functions.logger.info('No FAQs found for creator');
        return;
      }

      const faqs: any[] = [];
      faqsSnapshot.forEach((doc) => {
        faqs.push({ id: doc.id, ...doc.data() });
      });

      // Check agent settings
      const settingsDoc = await admin.firestore()
        .collection('users')
        .doc(creatorId)
        .collection('agentSettings')
        .doc('config')
        .get();

      const autoRespond = settingsDoc.exists ? settingsDoc.data()?.autoRespondFAQs : false;

      // Build prompt
      const faqList = faqs.map((faq, i) => 
        `${i + 1}. Q: "${faq.question}" | A: "${faq.answer}"`
      ).join('\n');

      const prompt = `You are helping match incoming messages to FAQs.

INCOMING MESSAGE:
"${messageData.text}"

AVAILABLE FAQs:
${faqList}

Does this message match any of the FAQs? If yes, return the FAQ number and ID.

Respond in JSON format:
{
  "matched": true/false,
  "faqNumber": 1-${faqs.length} or null,
  "confidence": "high" | "medium" | "low"
}`;

      // Call OpenAI
      const response = await callOpenAI(prompt, {
        model: 'gpt-3.5-turbo',
        temperature: 0.2,
        max_tokens: 100,
      });

      // Parse response
      let match;
      try {
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          match = JSON.parse(jsonMatch[0]);
        }
      } catch (parseError) {
        functions.logger.error('Failed to parse FAQ match response', { error: parseError });
        return;
      }

      if (!match || !match.matched || !match.faqNumber) {
        functions.logger.info('No FAQ match found');
        return;
      }

      const matchedFAQ = faqs[match.faqNumber - 1];
      if (!matchedFAQ) {
        return;
      }

      functions.logger.info('FAQ matched', {
        faqId: matchedFAQ.id,
        question: matchedFAQ.question,
        confidence: match.confidence,
      });

      // Update message with matched FAQ ID
      await snapshot.ref.update({
        matchedFAQId: matchedFAQ.id,
      });

      // Increment usage count
      await admin.firestore()
        .collection('users')
        .doc(creatorId)
        .collection('faqs')
        .doc(matchedFAQ.id)
        .update({
          usageCount: admin.firestore.FieldValue.increment(1),
        });

      // Auto-respond if enabled
      if (autoRespond) {
        functions.logger.info('Auto-responding to FAQ');

        // Create response message
        const responseMessageRef = admin.firestore()
          .collection('chats')
          .doc(chatId)
          .collection('messages')
          .doc();

        await responseMessageRef.set({
          id: responseMessageRef.id,
          chatId,
          senderId: creatorId,
          text: matchedFAQ.answer,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          status: 'sent',
          readBy: [creatorId],
          type: 'text',
        });

        // Update chat's last message
        await admin.firestore().collection('chats').doc(chatId).update({
          lastMessage: {
            text: matchedFAQ.answer,
            senderId: creatorId,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
          },
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        functions.logger.info('FAQ auto-response sent');
      }

    } catch (error: any) {
      functions.logger.error('FAQ detection failed', {
        error: error.message,
        messageId: context.params.messageId,
      });
      // Don't throw - FAQ detection is optional
    }
  });

