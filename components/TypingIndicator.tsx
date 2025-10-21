/**
 * Typing Indicator Component
 * 
 * Displays a subtle banner when another user is typing.
 * Shows "User is typing..." with animated dots.
 * 
 * WHY: Users need visual feedback when someone is composing a message
 * WHAT: Animated typing indicator banner (WhatsApp style)
 */

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Text } from 'react-native-paper';

/**
 * Props for TypingIndicator component
 */
interface TypingIndicatorProps {
  userName?: string; // Name of user who is typing (optional)
}

/**
 * Typing Indicator Component
 * 
 * WHAT: Shows "User is typing..." with animated dots
 * WHY: Provides real-time feedback during conversations
 * 
 * FEATURES:
 * - Displays user's name if provided
 * - Animated dots (...) for visual interest
 * - WhatsApp-style subtle gray banner
 */
export function TypingIndicator({ userName }: TypingIndicatorProps) {
  // Animated value for dot opacity (creates pulsing effect)
  const [dotOpacity] = useState(new Animated.Value(0));

  /**
   * Animate the dots with a pulsing effect
   * 
   * WHY: Animated dots look more polished than static text
   * WHAT: Loops opacity animation from 0 → 1 → 0
   */
  useEffect(() => {
    // Create looping animation
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(dotOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(dotOpacity, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    );

    // Start animation
    animation.start();

    // Cleanup on unmount
    return () => {
      animation.stop();
    };
  }, [dotOpacity]);

  const displayName = userName || 'User';

  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        {displayName} is typing
        <Animated.Text style={[styles.dots, { opacity: dotOpacity }]}>
          ...
        </Animated.Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f5f5f5', // Light gray background
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  text: {
    fontSize: 14,
    color: '#666', // Medium gray text
    fontStyle: 'italic',
  },
  dots: {
    fontSize: 14,
    color: '#666',
  },
});

