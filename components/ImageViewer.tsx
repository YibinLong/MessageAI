/**
 * Image Viewer Component
 * 
 * Full-screen image viewer with zoom capability.
 * 
 * WHY: Users need to view images in full-screen mode
 * WHAT: Modal overlay with image viewing (simplified for Expo Go compatibility)
 */

import React, { useState } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * Props for ImageViewer component
 */
interface ImageViewerProps {
  visible: boolean; // Whether modal is visible
  imageUrl: string; // URL of image to display
  onClose: () => void; // Callback when user closes viewer
}

/**
 * Image Viewer Component
 * 
 * WHAT: Full-screen modal for viewing images
 * WHY: Users need to see image details and zoom in/out
 * 
 * FEATURES:
 * - Pinch to zoom (using ScrollView for Expo Go compatibility)
 * - Close button
 * - Loading state
 * - Error handling
 */
export function ImageViewer({ visible, imageUrl, onClose }: ImageViewerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  /**
   * Handle close button press
   * 
   * WHY: User wants to exit full-screen view
   * WHAT: Calls onClose callback and resets state
   */
  const handleClose = () => {
    setLoading(true);
    setError(false);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent={true}
    >
      <View style={styles.container}>
        {/* Close button */}
        <TouchableOpacity
          style={styles.closeButton}
          onPress={handleClose}
          activeOpacity={0.8}
        >
          <Ionicons name="close" size={32} color="#fff" />
        </TouchableOpacity>

        {/* Loading indicator */}
        {loading && !error && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#25D366" />
          </View>
        )}

        {/* Error state */}
        {error && (
          <View style={styles.errorContainer}>
            <Ionicons name="image-outline" size={64} color="#fff" />
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => {
                setError(false);
                setLoading(true);
              }}
            >
              <Ionicons name="refresh" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {/* Image with zoom (ScrollView provides pinch-to-zoom on both iOS and Android) */}
        {!error && (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            maximumZoomScale={3}
            minimumZoomScale={1}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <Image
              source={{ uri: imageUrl }}
              style={styles.image}
              resizeMode="contain"
              onLoad={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setError(true);
              }}
            />
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    right: 20,
    zIndex: 1000,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  retryButton: {
    marginTop: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
});

