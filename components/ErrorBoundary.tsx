/**
 * Error Boundary Component
 * 
 * Catches React errors and displays a user-friendly error screen.
 * 
 * WHY: React errors crash the entire app. We need to catch them gracefully
 * and show a recovery option instead of a white screen.
 * 
 * WHAT: Class component that catches errors in child components and displays
 * a fallback UI with retry functionality.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  children: ReactNode;
  fallback?: ReactNode; // Custom fallback UI
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary Class Component
 * 
 * WHY: Function components can't be error boundaries (React limitation)
 * WHAT: Catches errors in child tree, displays fallback UI
 * 
 * HOW:
 * - componentDidCatch: Logs error details
 * - getDerivedStateFromError: Updates state when error occurs
 * - render: Shows error UI when hasError is true
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  /**
   * Update state when an error is thrown
   * 
   * WHY: Need to trigger re-render with error UI
   * WHAT: Sets hasError flag and stores error details
   */
  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  /**
   * Log error details
   * 
   * WHY: Developers need error info for debugging
   * WHAT: Logs error and component stack to console
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Error info:', errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });
    
    // TODO: Send to error tracking service (e.g., Sentry) in production
  }

  /**
   * Reset error state
   * 
   * WHY: Allow users to retry after an error
   * WHAT: Clears error state, causing re-render of children
   */
  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback } = this.props;

    if (hasError) {
      // Show custom fallback if provided
      if (fallback) {
        return fallback;
      }

      // Show default error UI
      return (
        <View style={styles.container}>
          <Ionicons name="alert-circle" size={64} color="#F44336" />
          
          <Text variant="headlineMedium" style={styles.title}>
            Oops! Something went wrong
          </Text>
          
          <Text variant="bodyLarge" style={styles.message}>
            The app encountered an unexpected error. Don't worry, your data is safe.
          </Text>
          
          <Button
            mode="contained"
            onPress={this.handleReset}
            style={styles.button}
            buttonColor="#25D366"
          >
            Try Again
          </Button>
          
          {/* Error details (for debugging) */}
          {__DEV__ && error && (
            <ScrollView style={styles.errorDetails}>
              <Text variant="labelSmall" style={styles.errorLabel}>
                Error Details (Development Mode):
              </Text>
              <Text variant="bodySmall" style={styles.errorText}>
                {error.toString()}
              </Text>
              {errorInfo && (
                <Text variant="bodySmall" style={styles.errorStack}>
                  {errorInfo.componentStack}
                </Text>
              )}
            </ScrollView>
          )}
        </View>
      );
    }

    return children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  title: {
    marginTop: 16,
    marginBottom: 8,
    color: '#000',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  message: {
    marginBottom: 24,
    color: '#666',
    textAlign: 'center',
  },
  button: {
    paddingHorizontal: 24,
  },
  errorDetails: {
    marginTop: 24,
    maxHeight: 200,
    width: '100%',
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  errorLabel: {
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#F44336',
  },
  errorText: {
    fontFamily: 'monospace',
    color: '#000',
    marginBottom: 8,
  },
  errorStack: {
    fontFamily: 'monospace',
    color: '#666',
    fontSize: 10,
  },
});

