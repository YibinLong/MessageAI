/**
 * Image Compression Utilities
 * 
 * This file provides functions to compress images to a maximum file size.
 * Used for profile pictures and image messages to optimize storage and bandwidth.
 * 
 * WHY: Large images slow down uploads, waste storage, and consume user bandwidth.
 * Compressing images improves UX and reduces costs.
 * 
 * WHAT: Functions to compress images to max 1MB while maintaining quality.
 */

import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';

/**
 * Maximum allowed image size in bytes (1MB)
 * 
 * WHY: 1MB is a good balance between image quality and upload speed.
 * Most modern images compress well at this size without visible quality loss.
 */
const MAX_IMAGE_SIZE = 1024 * 1024; // 1MB in bytes

/**
 * Compress an image to max 1MB
 * 
 * WHY: Images from phone cameras can be 5-10MB. We need to compress them
 * before uploading to Firebase Storage to save bandwidth and storage costs.
 * 
 * WHAT: 
 * 1. Check current image size
 * 2. If > 1MB, resize and/or reduce quality until it fits
 * 3. Return compressed image URI
 * 
 * HOW: Uses iterative compression - starts at high quality (0.9) and reduces
 * if needed. Also resizes large images (max 1920px width).
 * 
 * @param uri - Local file URI of the image to compress
 * @returns Promise with compressed image URI
 */
export async function compressImage(uri: string): Promise<string> {
  try {
    console.log('[ImageCompression] Starting compression for:', uri);
    
    // Get original image size (handling deprecated API gracefully)
    let originalSize = 0;
    try {
      const imageInfo = await FileSystem.getInfoAsync(uri, { size: true });
      originalSize = (imageInfo as any).size || 0;
      console.log('[ImageCompression] Original size:', Math.round(originalSize / 1024), 'KB');
    } catch (sizeError) {
      // If getting size fails (deprecated API), assume image needs compression
      console.log('[ImageCompression] Could not get original size, will compress anyway');
      originalSize = MAX_IMAGE_SIZE + 1; // Force compression
    }
    
    // If image is already small enough, return as-is
    if (originalSize <= MAX_IMAGE_SIZE && originalSize > 0) {
      console.log('[ImageCompression] Image already small enough, no compression needed');
      return uri;
    }
    
    // Start with high quality
    let quality = 0.9;
    let compressedUri = uri;
    let currentSize = originalSize;
    
    // Get image dimensions to determine if we need to resize
    const imageAsset = await ImageManipulator.manipulateAsync(
      uri,
      [],
      { compress: 1, format: ImageManipulator.SaveFormat.JPEG }
    );
    
    // Calculate resize dimensions if image is very large
    // WHY: Very large dimensions (e.g., 4000x3000) contribute significantly to file size
    // We resize to max 1920px width while maintaining aspect ratio
    let resizeAction: ImageManipulator.Action[] = [];
    const maxWidth = 1920;
    
    // For very large images, resize first before quality compression
    // This significantly reduces file size while maintaining good quality for phone screens
    if (imageAsset.width > maxWidth) {
      const scaleFactor = maxWidth / imageAsset.width;
      resizeAction = [
        {
          resize: {
            width: maxWidth,
            height: Math.round(imageAsset.height * scaleFactor),
          },
        },
      ];
      
      console.log('[ImageCompression] Image will be resized from', imageAsset.width, 'x', imageAsset.height, 'to', maxWidth, 'x', Math.round(imageAsset.height * scaleFactor));
    }
    
    // Iterative compression: reduce quality until we reach target size
    // WHY: Different images compress differently, so we need to try multiple quality levels
    let attempts = 0;
    const maxAttempts = 5;
    
    while (currentSize > MAX_IMAGE_SIZE && attempts < maxAttempts) {
      attempts++;
      console.log('[ImageCompression] Compression attempt', attempts, 'with quality', quality);
      
      // Compress image with current quality setting
      // For first attempt, use original URI. For subsequent attempts, use the previously compressed URI
      // WHY: This allows each compression to build on the previous result, making compression more efficient
      const sourceUri = attempts === 1 ? uri : compressedUri;
      
      const result = await ImageManipulator.manipulateAsync(
        sourceUri,
        resizeAction, // Apply resize on first attempt, empty array thereafter
        {
          compress: quality,
          format: ImageManipulator.SaveFormat.JPEG, // JPEG compresses better than PNG for photos
        }
      );
      
      compressedUri = result.uri;
      
      // Check new file size (handling deprecated API gracefully)
      try {
        const compressedInfo = await FileSystem.getInfoAsync(compressedUri, { size: true });
        currentSize = (compressedInfo as any).size || 0;
      } catch (sizeError) {
        // If we can't get size, assume it's compressed enough
        currentSize = MAX_IMAGE_SIZE - 1;
      }
      
      console.log('[ImageCompression] New size:', Math.round(currentSize / 1024), 'KB');
      
      // If we've reached target size, we're done
      if (currentSize <= MAX_IMAGE_SIZE) {
        break;
      }
      
      // Reduce quality for next attempt
      quality -= 0.15;
      
      // Don't go below 0.3 quality (too degraded)
      if (quality < 0.3) {
        console.warn('[ImageCompression] Reached minimum quality threshold');
        break;
      }
      
      // Clear resize action after first attempt (only resize once)
      resizeAction = [];
    }
    
    // Log final result
    const compressionRatio = ((1 - currentSize / originalSize) * 100).toFixed(1);
    console.log('[ImageCompression] Compression complete:', {
      originalSize: Math.round(originalSize / 1024) + 'KB',
      compressedSize: Math.round(currentSize / 1024) + 'KB',
      ratio: compressionRatio + '%',
      attempts,
    });
    
    return compressedUri;
  } catch (error) {
    console.error('[ImageCompression] Compression failed:', error);
    // If compression fails, return original URI
    // WHY: Better to upload large image than fail completely
    console.warn('[ImageCompression] Returning original URI due to compression failure');
    return uri;
  }
}

/**
 * Get image file size in bytes
 * 
 * WHY: Helper function to check image size without needing full FileSystem import
 * WHAT: Returns file size for a given URI
 * 
 * @param uri - Image file URI
 * @returns Promise with file size in bytes, or 0 if file doesn't exist/error
 */
export async function getImageSize(uri: string): Promise<number> {
  try {
    const info = await FileSystem.getInfoAsync(uri, { size: true });
    return (info as any).size || 0;
  } catch (error) {
    console.error('[ImageCompression] Failed to get image size:', error);
    return 0;
  }
}

/**
 * Format bytes to human-readable string
 * 
 * WHY: Display file sizes in a user-friendly way (e.g., "2.5 MB" instead of "2621440")
 * WHAT: Converts bytes to KB/MB with one decimal place
 * 
 * @param bytes - File size in bytes
 * @returns Formatted string like "1.5 MB" or "500 KB"
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return bytes + ' B';
  } else if (bytes < 1024 * 1024) {
    return (bytes / 1024).toFixed(1) + ' KB';
  } else {
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
}

