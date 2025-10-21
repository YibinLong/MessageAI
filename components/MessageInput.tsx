/**
 * Message Input Component
 * 
 * Text input field with send button for composing messages.
 * 
 * WHY: Users need a clear, accessible way to type and send messages
 * WHAT: Text input + send button with WhatsApp-style design
 */

import React, { useState } from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Props for MessageInput component
 */
interface MessageInputProps {
  onSend: (text: string) => void; // Callback when user sends message
  disabled?: boolean; // Whether input is disabled
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
 */
export function MessageInput({ onSend, disabled = false }: MessageInputProps) {
  const [text, setText] = useState('');
  const insets = useSafeAreaInsets();

  /**
   * Handle send button press
   * 
   * WHY: When user taps send, we call parent's onSend callback and clear input
   * WHAT: Validates text, calls callback, clears field
   */
  const handleSend = () => {
    const trimmedText = text.trim();
    
    // Don't send empty messages
    if (!trimmedText) {
      return;
    }

    // Call parent callback
    onSend(trimmedText);

    // Clear input field
    setText('');
  };

  return (
    <View style={[
      styles.container,
      { paddingBottom: Math.max(insets.bottom, 8) } // Account for navigation bar or default padding
    ]}>
      {/* Text input field */}
      <TextInput
        style={styles.input}
        placeholder="Type a message..."
        placeholderTextColor="#999"
        value={text}
        onChangeText={setText}
        multiline
        maxLength={10000} // Reasonable limit to prevent abuse
        editable={!disabled}
        returnKeyType="default" // Allow line breaks with Enter key
        blurOnSubmit={false}
      />

      {/* Send button */}
      <TouchableOpacity
        style={[
          styles.sendButton,
          (!text.trim() || disabled) && styles.sendButtonDisabled, // Disabled style when no text
        ]}
        onPress={handleSend}
        disabled={!text.trim() || disabled}
        activeOpacity={0.7}
      >
        <Ionicons
          name="send"
          size={24}
          color={text.trim() && !disabled ? '#fff' : '#999'}
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


