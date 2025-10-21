/**
 * Profile Setup Screen
 * 
 * This screen allows users to complete their profile by adding a profile picture and bio.
 * Shown after sign up or can be accessed later to edit profile.
 * 
 * WHY: Profile pictures and bios make the app more personal and help users recognize each other.
 * WHAT: Avatar image picker, bio text input, and save button.
 */

import { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { TextInput, Button, Text, Avatar } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { auth } from '../../services/firebase';
import { pickImage, uploadProfilePicture } from '../../utils/imageUpload';
import { updateUserProfile, getUserById } from '../../services/userService';
import { updateProfile } from '../../services/auth';
import { useAuthStore } from '../../stores/authStore';

/**
 * Profile Setup Screen Component
 * 
 * WHAT: Form to add/edit profile picture and bio
 * WHY: Complete user profile after signup or allow editing
 */
export default function ProfileSetupScreen() {
  const router = useRouter();
  const { user, setUser, updateUser } = useAuthStore();
  
  // Form state
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  /**
   * Load existing profile data if user is logged in
   * 
   * WHY: If user is editing profile (not first-time setup), show existing data
   */
  useEffect(() => {
    const loadUserData = async () => {
      const currentUser = auth.currentUser;
      if (currentUser) {
        setDisplayName(currentUser.displayName || '');
        setPhotoURL(currentUser.photoURL || null);
        
        // Try to load bio from Firestore
        const userData = await getUserById(currentUser.uid);
        if (userData?.bio) {
          setBio(userData.bio);
        }
      }
    };
    
    loadUserData();
  }, []);
  
  /**
   * Handle profile picture selection
   * 
   * WHAT: Opens image picker, displays selected image
   * WHY: User needs to pick a profile picture
   */
  const handlePickImage = async () => {
    try {
      const uri = await pickImage();
      if (uri) {
        setLocalImageUri(uri);
        console.log('[ProfileSetup] Image selected');
      }
    } catch (error: any) {
      console.error('[ProfileSetup] Failed to pick image:', error);
      Alert.alert('Error', error.message || 'Failed to pick image');
    }
  };
  
  /**
   * Handle profile save
   * 
   * WHAT: Uploads image (if selected), updates Firestore user doc, updates auth profile
   * WHY: Save user's profile data
   */
  const handleSave = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('No user is signed in');
      }
      
      setLoading(true);
      
      let uploadedPhotoURL = photoURL;
      
      // Upload profile picture if a new one was selected
      if (localImageUri) {
        setUploading(true);
        console.log('[ProfileSetup] Uploading profile picture...');
        uploadedPhotoURL = await uploadProfilePicture(currentUser.uid, localImageUri);
        console.log('[ProfileSetup] Profile picture uploaded');
        setUploading(false);
      }
      
      // Update Firestore user document
      // WHY: Store bio and photo URL in Firestore (Firebase Auth doesn't have bio field)
      await updateUserProfile(currentUser.uid, {
        displayName: displayName.trim() || currentUser.displayName || 'User',
        photoURL: uploadedPhotoURL || undefined,
        bio: bio.trim() || undefined,
      });
      
      // Update Firebase Auth profile (for displayName and photoURL)
      // WHY: Keep Auth profile in sync with Firestore
      await updateProfile({
        displayName: displayName.trim() || currentUser.displayName || 'User',
        photoURL: uploadedPhotoURL || undefined,
      });
      
      // Fetch updated user data and update Zustand store
      const updatedUserData = await getUserById(currentUser.uid);
      if (updatedUserData) {
        setUser(updatedUserData);
      }
      
      console.log('[ProfileSetup] Profile saved successfully');
      
      // Navigate to main app
      // Note: Root layout will handle navigation when isAuthenticated is true
      router.replace('/(app)');
    } catch (error: any) {
      console.error('[ProfileSetup] Failed to save profile:', error);
      Alert.alert('Error', error.message || 'Failed to save profile');
      setLoading(false);
      setUploading(false);
    }
  };
  
  /**
   * Handle skip (for optional profile setup)
   * 
   * WHY: Profile picture and bio are optional, user can skip and add later
   */
  const handleSkip = () => {
    router.replace('/(app)');
  };
  
  // Determine which image to show in avatar
  const avatarUri = localImageUri || photoURL;
  
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.title}>
          Complete Your Profile
        </Text>
        <Text variant="bodyLarge" style={styles.subtitle}>
          Add a photo and tell us about yourself
        </Text>
      </View>
      
      {/* Profile Picture */}
      <View style={styles.avatarSection}>
        {avatarUri ? (
          <Avatar.Image size={120} source={{ uri: avatarUri }} />
        ) : (
          <Avatar.Icon size={120} icon="account" />
        )}
        
        <Button
          mode="outlined"
          onPress={handlePickImage}
          disabled={loading}
          style={styles.avatarButton}
          icon="camera"
        >
          {avatarUri ? 'Change Photo' : 'Add Photo'}
        </Button>
      </View>
      
      {/* Display Name (optional, can change) */}
      <TextInput
        label="Display Name"
        value={displayName}
        onChangeText={setDisplayName}
        mode="outlined"
        autoCapitalize="words"
        style={styles.input}
        disabled={loading}
      />
      
      {/* Bio Input */}
      <TextInput
        label="Bio (optional)"
        value={bio}
        onChangeText={setBio}
        mode="outlined"
        multiline
        numberOfLines={3}
        placeholder="Tell us about yourself..."
        style={styles.input}
        disabled={loading}
        maxLength={150}
      />
      
      <Text variant="bodySmall" style={styles.helperText}>
        {bio.length}/150 characters
      </Text>
      
      {/* Upload progress indicator */}
      {uploading && (
        <Text variant="bodyMedium" style={styles.uploadingText}>
          Uploading image...
        </Text>
      )}
      
      {/* Save Button */}
      <Button
        mode="contained"
        onPress={handleSave}
        loading={loading}
        disabled={loading}
        style={styles.button}
        buttonColor="#25D366"
      >
        {user ? 'Save Changes' : 'Complete Setup'}
      </Button>
      
      {/* Skip Button (only show for new users, not when editing) */}
      {!user && (
        <Button
          mode="text"
          onPress={handleSkip}
          disabled={loading}
          style={styles.skipButton}
        >
          Skip for now
        </Button>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 24,
  },
  title: {
    fontWeight: 'bold',
    color: '#25D366',
    marginBottom: 8,
  },
  subtitle: {
    color: '#666',
    textAlign: 'center',
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarButton: {
    marginTop: 16,
  },
  input: {
    marginBottom: 16,
  },
  helperText: {
    color: '#666',
    textAlign: 'right',
    marginBottom: 16,
  },
  uploadingText: {
    color: '#25D366',
    textAlign: 'center',
    marginBottom: 16,
  },
  button: {
    marginTop: 8,
    paddingVertical: 6,
  },
  skipButton: {
    marginTop: 8,
  },
});

