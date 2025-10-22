/**
 * Message Input Component
 * 
 * Text input field with send button for composing messages.
 * 
 * WHY: Users need a clear, accessible way to type and send messages
 * WHAT: Text input + send button with WhatsApp-style design
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity, Platform, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import { startTyping, stopTyping } from '../services/typingService';
import { pickImage } from '../utils/imageUpload';
import { compressImage, formatFileSize, getImageSize } from '../utils/imageCompression';

/**
 * Props for MessageInput component
 */
interface MessageInputProps {
  onSend: (text: string) => void; // Callback when user sends message
  onSendImage?: (imageUri: string) => Promise<void>; // Callback when user sends image
  disabled?: boolean; // Whether input is disabled
  chatId: string; // Chat ID for typing indicators
  userId: string; // Current user ID for typing indicators
}

/**
 * Message Input Component
 * 
 * WHAT: Text field and send button for composing messages
 * WHY: Core messaging UI element
 * 
 * FEATURES:
 * - Multi-line text input
 * - Send button (only enabled when text is not empty)
 * - Auto-clears after sending
 * - Handles keyboard properly
 * - Typing indicators with debouncing
 * - Image picker with compression
 */
export function MessageInput({ onSend, onSendImage, disabled = false, chatId, userId }: MessageInputProps) {
  const [text, setText] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const insets = useSafeAreaInsets();
  
  // Refs for managing typing indicator timeouts
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

  /**
   * Handle text change with typing indicator
   * 
   * WHY: Update typing status as user types, with debouncing to prevent excessive writes
   * WHAT: 
   * - Debounces typing indicator updates (500ms)
   * - Keeps updating timestamp while user continues typing
   * - Clears typing indicator after 3 seconds of inactivity
   */
  const handleTextChange = (newText: string) => {
    setText(newText);
    
    // Clear existing debounce timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    // If user is typing (text is not empty)
    if (newText.trim()) {
      // Debounce the typing indicator update (500ms)
      // WHY: Prevents excessive Firestore writes while user is actively typing
      debounceTimeoutRef.current = setTimeout(() => {
        // Update typing indicator (refreshes timestamp in Firestore)
        // WHY: Even if already typing, we need to keep the timestamp fresh
        // so the indicator doesn't disappear due to staleness check
        startTyping(chatId, userId);
        isTypingRef.current = true;
        
        // Clear any existing typing timeout
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        
        // Set timeout to clear typing indicator after 3 seconds of inactivity
        // WHY: If user stops typing, indicator should disappear
        typingTimeoutRef.current = setTimeout(() => {
          stopTyping(chatId, userId);
          isTypingRef.current = false;
        }, 3000);
      }, 500);
    } else {
      // Text is empty, stop typing indicator
      stopTyping(chatId, userId);
      isTypingRef.current = false;
    }
  };

  /**
   * Handle send button press
   * 
   * WHY: When user taps send, we call parent's onSend callback and clear input
   * WHAT: Validates text, calls callback, clears field, stops typing indicator
   */
  const handleSend = () => {
    const trimmedText = text.trim();
    
    // Don't send empty messages
    if (!trimmedText) {
      return;
    }

    // Stop typing indicator immediately
    // WHY: User sent the message, so they're no longer typing
    stopTyping(chatId, userId);
    isTypingRef.current = false;
    
    // Clear timeouts
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Call parent callback
    onSend(trimmedText);

    // Clear input field
    setText('');
  };

  /**
   * Handle image picker button press
   * 
   * WHY: Users need to send images in chats
   * WHAT:
   * 1. Pick image from gallery
   * 2. Compress to max 1MB
   * 3. Call onSendImage callback
   * 4. Show loading state during upload
   */
  const handleImagePick = async () => {
    if (!onSendImage) {
      Alert.alert('Not Supported', 'Image messaging is not available');
      return;
    }

    try {
      console.log('[MessageInput] Picking image...');
      
      // Pick image from gallery
      const imageUri = await pickImage();
      
      if (!imageUri) {
        // User cancelled
        console.log('[MessageInput] User cancelled image picker');
        return;
      }

      setIsUploadingImage(true);

      // Check original size for logging
      const originalSize = await getImageSize(imageUri);
      console.log('[MessageInput] Original image size:', formatFileSize(originalSize));

      // Compress image to max 1MB
      console.log('[MessageInput] Compressing image...');
      const compressedUri = await compressImage(imageUri);
      
      const compressedSize = await getImageSize(compressedUri);
      console.log('[MessageInput] Compressed image size:', formatFileSize(compressedSize));

      // Send image
      console.log('[MessageInput] Sending image...');
      await onSendImage(compressedUri);
      
      console.log('[MessageInput] Image sent successfully');
    } catch (error) {
      console.error('[MessageInput] Failed to send image:', error);
      Alert.alert('Error', 'Failed to send image. Please try again.');
    } finally {
      setIsUploadingImage(false);
    }
  };

  /**
   * Cleanup typing indicator on unmount
   * 
   * WHY: If user leaves chat while typing, we should clear the indicator
   * WHAT: Stops typing indicator and clears all timeouts
   */
  useEffect(() => {
    return () => {
      // Clear typing indicator
      if (isTypingRef.current) {
        stopTyping(chatId, userId);
      }
      
      // Clear timeouts
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [chatId, userId]);

  return (
    <View style={[
      styles.container,
      { paddingBottom: Math.max(insets.bottom, 8) } // Account for navigation bar or default padding
    ]}>
      {/* Upload progress indicator */}
      {isUploadingImage && (
        <View style={styles.uploadingOverlay}>
          <ActivityIndicator size="small" color="#25D366" />
          <Text style={styles.uploadingText}>Uploading image...</Text>
        </View>
      )}

      {/* Image picker button */}
      <TouchableOpacity
        style={styles.imageButton}
        onPress={handleImagePick}
        disabled={disabled || isUploadingImage}
        activeOpacity={0.7}
      >
        <Ionicons
          name="image-outline"
          size={24}
          color={disabled || isUploadingImage ? '#999' : '#25D366'}
        />
      </TouchableOpacity>

      {/* Text input field */}
      <TextInput
        style={styles.input}
        placeholder="Type a message..."
        placeholderTextColor="#999"
        value={text}
        onChangeText={handleTextChange}
        multiline
        maxLength={10000} // Reasonable limit to prevent abuse
        editable={!disabled && !isUploadingImage}
        returnKeyType="default" // Allow line breaks with Enter key
        blurOnSubmit={false}
      />

      {/* Send button */}
      <TouchableOpacity
        style={[
          styles.sendButton,
          (!text.trim() || disabled || isUploadingImage) && styles.sendButtonDisabled, // Disabled style when no text
        ]}
        onPress={handleSend}
        disabled={!text.trim() || disabled || isUploadingImage}
        activeOpacity={0.7}
      >
        <Ionicons
          name="send"
          size={24}
          color={text.trim() && !disabled && !isUploadingImage ? '#fff' : '#999'}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingTop: 8,
    // paddingBottom is set dynamically to account for navigation bar
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    position: 'relative',
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    zIndex: 1000,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  uploadingText: {
    marginLeft: 12,
    fontSize: 14,
    color: '#666',
  },
  imageButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100, // Limit height to prevent taking over screen
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: '#000',
    marginRight: 8,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#25D366', // WhatsApp green
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2, // Shadow on Android
    shadowColor: '#000', // Shadow on iOS
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  sendButtonDisabled: {
    backgroundColor: '#e0e0e0', // Gray when disabled
    elevation: 0,
    shadowOpacity: 0,
  },
});


