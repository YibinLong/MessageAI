/**
 * Image Upload Utilities
 * 
 * This file provides helper functions for picking, compressing, and uploading images.
 * Used for profile pictures and image messages.
 * 
 * WHY: Image handling requires multiple steps (pick, compress, upload) that we'll
 * use in multiple places (profile setup, image messages).
 * 
 * WHAT: Functions to pick images from gallery and upload to Firebase Storage.
 */

import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../services/firebase';

/**
 * Pick an image from the device gallery
 * 
 * WHY: Users need to select profile pictures and images to send in chats.
 * WHAT: Opens the device image picker with specific options (square crop, 80% quality).
 * 
 * @returns Promise with the selected image URI or null if cancelled
 */
export async function pickImage(): Promise<string | null> {
  try {
    console.log('[ImageUpload] Requesting media library permissions...');
    
    // Request permission to access media library
    // WHY: iOS/Android require explicit permission to access photos
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      console.error('[ImageUpload] Permission denied');
      throw new Error('Permission to access media library was denied');
    }
    
    console.log('[ImageUpload] Opening image picker...');
    
    // Open image picker
    // WHAT: These options ensure we get a square image with good quality
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, // Only images, no videos
      allowsEditing: true, // Let user crop the image
      aspect: [1, 1], // Square aspect ratio (for profile pictures)
      quality: 0.8, // 80% quality - good balance between size and quality
    });
    
    if (result.canceled) {
      console.log('[ImageUpload] User cancelled image picker');
      return null;
    }
    
    console.log('[ImageUpload] Image selected:', result.assets[0].uri);
    return result.assets[0].uri;
  } catch (error) {
    console.error('[ImageUpload] Failed to pick image:', error);
    throw error;
  }
}

/**
 * Upload an image to Firebase Storage
 * 
 * WHY: We need to store images in the cloud so they're accessible from any device.
 * Firebase Storage provides secure, scalable image storage.
 * 
 * WHAT: Converts image to blob, uploads to Firebase Storage, returns download URL.
 * 
 * @param uri - Local file URI of the image to upload
 * @param path - Storage path (e.g., 'profiles/userId/avatar.jpg')
 * @returns Promise with the download URL of the uploaded image
 */
export async function uploadImage(uri: string, path: string): Promise<string> {
  try {
    console.log('[ImageUpload] Uploading image to:', path);
    
    // Fetch the image file from local URI
    // WHY: Firebase Storage needs a Blob, but we have a local file URI
    const response = await fetch(uri);
    const blob = await response.blob();
    
    console.log('[ImageUpload] Image size:', Math.round(blob.size / 1024), 'KB');
    
    // Check if image is too large (max 1MB)
    // WHY: Large images slow down uploads and waste storage/bandwidth
    if (blob.size > 1024 * 1024) {
      console.warn('[ImageUpload] Image is larger than 1MB, consider compressing');
      // Note: For now we allow it, but in production we'd compress here
    }
    
    // Create a reference to the storage location
    const storageRef = ref(storage, path);
    
    // Upload the blob
    // WHAT: Uploads the image bytes to Firebase Storage
    console.log('[ImageUpload] Starting upload...');
    await uploadBytes(storageRef, blob);
    
    // Get the download URL
    // WHY: We need a public URL to display the image in the app
    const downloadURL = await getDownloadURL(storageRef);
    
    console.log('[ImageUpload] Upload successful:', downloadURL);
    return downloadURL;
  } catch (error) {
    console.error('[ImageUpload] Upload failed:', error);
    throw error;
  }
}

/**
 * Upload a profile picture for a user
 * 
 * WHY: Convenience function specifically for profile pictures.
 * WHAT: Uploads image to /profiles/{userId}/avatar.jpg and returns URL.
 * 
 * @param userId - User's Firebase Auth ID
 * @param imageUri - Local URI of the image to upload
 * @returns Promise with the download URL
 */
export async function uploadProfilePicture(
  userId: string,
  imageUri: string
): Promise<string> {
  // Create consistent path for profile pictures
  // WHY: Using a consistent naming scheme makes it easy to find/delete later
  const path = `profiles/${userId}/avatar.jpg`;
  
  return uploadImage(imageUri, path);
}

/**
 * Upload a chat image
 * 
 * WHY: Convenience function for uploading images sent in chats.
 * WHAT: Uploads image to /media/{userId}/{messageId}.jpg and returns URL.
 * 
 * @param userId - User's Firebase Auth ID (sender)
 * @param messageId - Unique message ID
 * @param imageUri - Local URI of the image to upload
 * @returns Promise with the download URL
 */
export async function uploadChatImage(
  userId: string,
  messageId: string,
  imageUri: string
): Promise<string> {
  const path = `media/${userId}/${messageId}.jpg`;
  
  return uploadImage(imageUri, path);
}

