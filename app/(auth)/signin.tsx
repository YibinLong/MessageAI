/**
 * Sign In Screen
 * 
 * This screen allows existing users to sign in with email and password.
 * 
 * WHY: Users need a way to access their account after signing up.
 * WHAT: Email/password form with validation and error handling.
 */

import { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { TextInput, Button, Text, HelperText } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { signIn, getAuthErrorMessage } from '../../services/auth';
import { getUserById } from '../../services/userService';
import { useAuthStore } from '../../stores/authStore';

/**
 * Sign In Screen Component
 * 
 * WHAT: Form with email/password inputs and submit button
 * WHY: Authenticate existing users
 */
export default function SignInScreen() {
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  
  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  /**
   * Validate email format
   * 
   * WHY: Prevents invalid email submissions
   * WHAT: Checks if email matches standard email regex
   */
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };
  
  /**
   * Handle sign in
   * 
   * WHAT: Validates inputs, calls Firebase Auth, fetches user data, updates store
   * WHY: Authenticate user and load their profile
   */
  const handleSignIn = async () => {
    try {
      // Clear previous errors
      setError('');
      
      // Validate inputs
      if (!email.trim()) {
        setError('Please enter your email');
        return;
      }
      
      if (!isValidEmail(email)) {
        setError('Please enter a valid email address');
        return;
      }
      
      if (!password) {
        setError('Please enter your password');
        return;
      }
      
      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }
      
      setLoading(true);
      
      // Sign in with Firebase Auth
      // WHY: This authenticates the user and gives us their user ID
      const firebaseUser = await signIn(email, password);
      
      // Fetch full user profile from Firestore
      // WHY: Firebase Auth only has basic info, we need full profile
      const userData = await getUserById(firebaseUser.uid);
      
      if (!userData) {
        throw new Error('User profile not found');
      }
      
      // Update Zustand store with user data
      // WHY: This makes user data available throughout the app
      setUser(userData);
      
      console.log('[SignIn] User signed in successfully');
      
      // Navigation handled by root layout when isAuthenticated becomes true
    } catch (err: any) {
      console.error('[SignIn] Sign in failed:', err);
      
      // Show user-friendly error message
      const errorMessage = err.code ? getAuthErrorMessage(err.code) : err.message;
      setError(errorMessage);
      setLoading(false);
    }
  };
  
  /**
   * Navigate to sign up screen
   */
  const handleGoToSignUp = () => {
    router.push('/(auth)/signup');
  };
  
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          {/* App Logo/Title */}
          <View style={styles.header}>
            <Text variant="displaySmall" style={styles.title}>
              MessageAI
            </Text>
            <Text variant="bodyLarge" style={styles.subtitle}>
              Sign in to your account
            </Text>
          </View>
          
          {/* Email Input */}
          <TextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            mode="outlined"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            style={styles.input}
            disabled={loading}
            error={!!error && !email}
          />
          
          {/* Password Input */}
          <TextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            mode="outlined"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoComplete="password"
            textContentType="password"
            style={styles.input}
            disabled={loading}
            error={!!error && !password}
            right={
              <TextInput.Icon
                icon={showPassword ? 'eye-off' : 'eye'}
                onPress={() => setShowPassword(!showPassword)}
              />
            }
          />
          
          {/* Error Message */}
          {error ? (
            <HelperText type="error" visible={true} style={styles.error}>
              {error}
            </HelperText>
          ) : null}
          
          {/* Sign In Button */}
          <Button
            mode="contained"
            onPress={handleSignIn}
            loading={loading}
            disabled={loading}
            style={styles.button}
            buttonColor="#25D366"
          >
            Sign In
          </Button>
          
          {/* Sign Up Link */}
          <View style={styles.footer}>
            <Text variant="bodyMedium">Don't have an account? </Text>
            <Button
              mode="text"
              onPress={handleGoToSignUp}
              disabled={loading}
              compact
              textColor="#25D366"
            >
              Sign Up
            </Button>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontWeight: 'bold',
    color: '#25D366',
    marginBottom: 8,
  },
  subtitle: {
    color: '#666',
  },
  input: {
    marginBottom: 16,
  },
  error: {
    marginBottom: 8,
  },
  button: {
    marginTop: 8,
    paddingVertical: 6,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
});

