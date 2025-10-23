/**
 * FAQ Service
 * 
 * WHY: Content creators need to manage FAQs for auto-responses
 * WHAT: CRUD operations for FAQs stored in Firestore
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { FAQ } from '../types';
import uuid from 'react-native-uuid';

/**
 * Get all FAQs for a user
 * 
 * WHY: Display user's FAQ list
 * WHAT: Fetches all FAQs from Firestore
 * 
 * @param userId - ID of the user
 * @returns Array of FAQ objects
 */
export async function getFAQs(userId: string): Promise<FAQ[]> {
  try {
    const faqsRef = collection(db, 'users', userId, 'faqs');
    const q = query(faqsRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);

    const faqs: FAQ[] = [];
    snapshot.forEach((doc) => {
      faqs.push({ id: doc.id, ...doc.data() } as FAQ);
    });

    return faqs;
  } catch (error) {
    console.error('[FAQService] Error getting FAQs:', error);
    throw error;
  }
}

/**
 * Add a new FAQ
 * 
 * WHY: User wants to create a new FAQ
 * WHAT: Creates FAQ document in Firestore
 * 
 * @param userId - ID of the user
 * @param question - The question text
 * @param answer - The answer text
 * @returns The created FAQ
 */
export async function addFAQ(
  userId: string,
  question: string,
  answer: string
): Promise<FAQ> {
  try {
    const faqId = uuid.v4() as string;
    const faqRef = doc(db, 'users', userId, 'faqs', faqId);

    const newFAQ: Partial<FAQ> = {
      id: faqId,
      question,
      answer,
      usageCount: 0,
      createdAt: serverTimestamp() as any,
      updatedAt: serverTimestamp() as any,
    };

    await setDoc(faqRef, newFAQ);

    return newFAQ as FAQ;
  } catch (error) {
    console.error('[FAQService] Error adding FAQ:', error);
    throw error;
  }
}

/**
 * Update an existing FAQ
 * 
 * WHY: User wants to edit FAQ
 * WHAT: Updates FAQ document in Firestore
 * 
 * @param userId - ID of the user
 * @param faqId - ID of the FAQ
 * @param updates - Fields to update
 */
export async function updateFAQ(
  userId: string,
  faqId: string,
  updates: { question?: string; answer?: string }
): Promise<void> {
  try {
    const faqRef = doc(db, 'users', userId, 'faqs', faqId);

    await updateDoc(faqRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('[FAQService] Error updating FAQ:', error);
    throw error;
  }
}

/**
 * Delete a FAQ
 * 
 * WHY: User wants to remove FAQ
 * WHAT: Deletes FAQ document from Firestore
 * 
 * @param userId - ID of the user
 * @param faqId - ID of the FAQ
 */
export async function deleteFAQ(userId: string, faqId: string): Promise<void> {
  try {
    const faqRef = doc(db, 'users', userId, 'faqs', faqId);
    await deleteDoc(faqRef);
  } catch (error) {
    console.error('[FAQService] Error deleting FAQ:', error);
    throw error;
  }
}

/**
 * Get agent settings for user
 * 
 * WHY: Check if auto-respond to FAQs is enabled
 * WHAT: Fetches agent settings from Firestore
 * 
 * @param userId - ID of the user
 * @returns Agent settings or null
 */
export async function getAgentSettings(userId: string): Promise<any | null> {
  try {
    const settingsRef = doc(db, 'users', userId, 'agentSettings', 'config');
    const settingsDoc = await getDoc(settingsRef);

    if (settingsDoc.exists()) {
      return settingsDoc.data();
    }

    return null;
  } catch (error) {
    console.error('[FAQService] Error getting agent settings:', error);
    return null;
  }
}

/**
 * Update agent settings
 * 
 * WHY: User wants to toggle auto-respond to FAQs
 * WHAT: Updates agent settings in Firestore
 * 
 * @param userId - ID of the user
 * @param settings - Settings to update
 */
export async function updateAgentSettings(
  userId: string,
  settings: any
): Promise<void> {
  try {
    const settingsRef = doc(db, 'users', userId, 'agentSettings', 'config');

    await setDoc(settingsRef, {
      ...settings,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    console.error('[FAQService] Error updating agent settings:', error);
    throw error;
  }
}

