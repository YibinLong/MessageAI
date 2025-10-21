/**
 * Connection Banner Component
 * 
 * Displays a banner at the top of the screen showing network connection status.
 * Shows when offline, reconnecting, or briefly when reconnected.
 * 
 * WHY: Users need to know when they're offline so they understand why messages
 * aren't sending immediately. This provides clear feedback about connection state.
 * 
 * WHAT: Banner with three states - offline (red), reconnecting (yellow), connected (green)
 */

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Text } from 'react-native-paper';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

/**
 * Connection Banner Component
 * 
 * WHAT: Fixed banner at top showing connection status
 * WHY: Users need immediate feedback when offline
 * 
 * BEHAVIOR:
 * - Offline: Shows "No internet connection" (red/orange)
 * - Reconnecting: Shows "Reconnecting..." (yellow)
 * - Connected: Shows "Connected" briefly (green), then auto-hides after 2s
 */
export function ConnectionBanner() {
  const { isConnected, isInternetReachable } = useNetworkStatus();
  const [visible, setVisible] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);
  const slideAnim = useState(new Animated.Value(-60))[0]; // Start off-screen (banner height 60)

  /**
   * Determine banner state based on connection status
   * 
   * WHY: Different network states need different visual feedback
   * WHAT: Returns color, message, and visibility based on connection state
   */
  const getBannerState = () => {
    // Offline: no connection at all
    if (!isConnected) {
      return {
        color: '#F44336', // Red
        message: 'No internet connection',
        shouldShow: true,
      };
    }
    
    // Reconnecting: connected to network but internet not reachable yet
    if (isConnected && !isInternetReachable) {
      return {
        color: '#FFC107', // Yellow/Amber
        message: 'Reconnecting...',
        shouldShow: true,
      };
    }
    
    // Connected: show briefly if was offline before
    if (isConnected && isInternetReachable && wasOffline) {
      return {
        color: '#4CAF50', // Green
        message: 'Connected',
        shouldShow: true,
      };
    }
    
    // Default: hide banner
    return {
      color: '#4CAF50',
      message: 'Connected',
      shouldShow: false,
    };
  };

  const bannerState = getBannerState();

  /**
   * Handle banner visibility with slide animation
   * 
   * WHY: Smooth animation looks more polished than instant show/hide
   * WHAT: Slides banner down when shown, up when hidden
   */
  useEffect(() => {
    // Track if we were offline (to show "Connected" message when reconnecting)
    if (!isConnected) {
      setWasOffline(true);
    }

    if (bannerState.shouldShow) {
      setVisible(true);
      
      // Slide down animation
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();

      // If showing "Connected" message, auto-hide after 2 seconds
      if (isConnected && isInternetReachable && wasOffline) {
        const hideTimer = setTimeout(() => {
          // Slide up animation
          Animated.timing(slideAnim, {
            toValue: -60,
            duration: 300,
            useNativeDriver: true,
          }).start(() => {
            setVisible(false);
            setWasOffline(false); // Reset flag
          });
        }, 2000);

        return () => clearTimeout(hideTimer);
      }
    } else {
      // Hide immediately if shouldn't show
      Animated.timing(slideAnim, {
        toValue: -60,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setVisible(false);
      });
    }
  }, [isConnected, isInternetReachable, bannerState.shouldShow, wasOffline]);

  // Don't render anything if not visible
  if (!visible && !bannerState.shouldShow) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.banner,
        {
          backgroundColor: bannerState.color,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <Text style={styles.text}>{bannerState.message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000, // Ensure banner appears above other content
    elevation: 4, // Shadow on Android
    paddingTop: 10, // Account for status bar
  },
  text: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});


