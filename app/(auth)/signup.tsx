/**
 * Sign Up Screen
 * 
 * This screen allows new users to create an account with email, password, and display name.
 * 
 * WHY: New users need a way to create an account.
 * WHAT: Email/password/name form with validation, creates Firebase Auth account and Firestore user doc.
 */

import { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { TextInput, Button, Text, HelperText } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { signUp, getAuthErrorMessage } from '../../services/auth';
import { createUserDocument } from '../../services/userService';

/**
 * Sign Up Screen Component
 * 
 * WHAT: Form with email/password/name inputs and submit button
 * WHY: Create new user accounts
 */
export default function SignUpScreen() {
  const router = useRouter();
  
  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  /**
   * Validate email format
   */
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };
  
  /**
   * Handle sign up
   * 
   * WHAT: Validates inputs, creates Firebase Auth account, creates Firestore user doc
   * WHY: Register new user in the system
   */
  const handleSignUp = async () => {
    try {
      // Clear previous errors
      setError('');
      
      // Validate display name
      if (!displayName.trim()) {
        setError('Please enter your name');
        return;
      }
      
      if (displayName.trim().length < 2) {
        setError('Name must be at least 2 characters');
        return;
      }
      
      // Validate email
      if (!email.trim()) {
        setError('Please enter your email');
        return;
      }
      
      if (!isValidEmail(email)) {
        setError('Please enter a valid email address');
        return;
      }
      
      // Validate password
      if (!password) {
        setError('Please enter a password');
        return;
      }
      
      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }
      
      // Validate password confirmation
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      
      setLoading(true);
      
      // Create Firebase Auth account
      // WHY: This creates the authentication credentials
      const firebaseUser = await signUp(email, password, displayName.trim());
      
      // Create Firestore user document
      // WHY: Store additional user data (name, photo, bio) in Firestore
      await createUserDocument(firebaseUser.uid, {
        email: firebaseUser.email || undefined,
        displayName: displayName.trim(),
      });
      
      console.log('[SignUp] Account created successfully');
      
      // Navigate to profile setup
      // WHY: Let user add profile picture and bio
      router.replace('/(auth)/profile-setup');
    } catch (err: any) {
      console.error('[SignUp] Sign up failed:', err);
      
      // Show user-friendly error message
      const errorMessage = err.code ? getAuthErrorMessage(err.code) : err.message;
      setError(errorMessage);
      setLoading(false);
    }
  };
  
  /**
   * Navigate to sign in screen
   */
  const handleGoToSignIn = () => {
    router.back();
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
          {/* Header */}
          <View style={styles.header}>
            <Text variant="displaySmall" style={styles.title}>
              Create Account
            </Text>
            <Text variant="bodyLarge" style={styles.subtitle}>
              Join MessageAI today
            </Text>
          </View>
          
          {/* Display Name Input */}
          <TextInput
            label="Display Name"
            value={displayName}
            onChangeText={setDisplayName}
            mode="outlined"
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            style={styles.input}
            disabled={loading}
            error={!!error && !displayName.trim()}
          />
          
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
            autoComplete="password-new"
            textContentType="newPassword"
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
          
          {/* Confirm Password Input */}
          <TextInput
            label="Confirm Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            mode="outlined"
            secureTextEntry={!showConfirmPassword}
            autoCapitalize="none"
            autoComplete="password-new"
            textContentType="newPassword"
            style={styles.input}
            disabled={loading}
            error={!!error && password !== confirmPassword}
            right={
              <TextInput.Icon
                icon={showConfirmPassword ? 'eye-off' : 'eye'}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              />
            }
          />
          
          {/* Error Message */}
          {error ? (
            <HelperText type="error" visible={true} style={styles.error}>
              {error}
            </HelperText>
          ) : null}
          
          {/* Sign Up Button */}
          <Button
            mode="contained"
            onPress={handleSignUp}
            loading={loading}
            disabled={loading}
            style={styles.button}
            buttonColor="#25D366"
          >
            Sign Up
          </Button>
          
          {/* Sign In Link */}
          <View style={styles.footer}>
            <Text variant="bodyMedium">Already have an account? </Text>
            <Button
              mode="text"
              onPress={handleGoToSignIn}
              disabled={loading}
              compact
              textColor="#25D366"
            >
              Sign In
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

