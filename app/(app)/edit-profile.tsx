/**
 * Edit Profile Screen
 * 
 * This screen allows users to edit their profile (name, photo, bio).
 * It's a copy of the profile-setup screen but lives in the (app) group
 * so authenticated users can access it.
 * 
 * WHY: Authenticated users need to edit their profile without triggering auth guards.
 * WHAT: Profile editing form with avatar, name, and bio inputs.
 */

import { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { TextInput, Button, Text, Avatar, RadioButton } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { auth } from '../../services/firebase';
import { pickImage, uploadProfilePicture } from '../../utils/imageUpload';
import { updateUserProfile, getUserById } from '../../services/userService';
import { updateProfile } from '../../services/auth';
import { useAuthStore } from '../../stores/authStore';

/**
 * Edit Profile Screen Component
 * 
 * WHAT: Form to edit profile picture, name, and bio
 * WHY: Allow users to update their profile information
 */
export default function EditProfileScreen() {
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  
  // Form state
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);
  const [isContentCreator, setIsContentCreator] = useState<boolean>(true);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  /**
   * Load existing profile data
   * 
   * WHY: Show current profile data so user can edit it
   */
  useEffect(() => {
    const loadUserData = async () => {
      const currentUser = auth.currentUser;
      if (currentUser) {
        setDisplayName(currentUser.displayName || '');
        setPhotoURL(currentUser.photoURL || null);
        
        // Load bio and user type from Firestore
        const userData = await getUserById(currentUser.uid);
        if (userData) {
          if (userData.bio) {
            setBio(userData.bio);
          }
          if (userData.isContentCreator !== undefined) {
            setIsContentCreator(userData.isContentCreator);
          }
        }
      }
    };
    
    loadUserData();
  }, []);
  
  /**
   * Handle profile picture selection
   * 
   * WHAT: Opens image picker, displays selected image
   * WHY: User needs to pick a new profile picture
   */
  const handlePickImage = async () => {
    try {
      const uri = await pickImage();
      if (uri) {
        setLocalImageUri(uri);
        console.log('[EditProfile] Image selected');
      }
    } catch (error: any) {
      console.error('[EditProfile] Failed to pick image:', error);
      Alert.alert('Error', error.message || 'Failed to pick image');
    }
  };
  
  /**
   * Handle profile save
   * 
   * WHAT: Uploads image (if changed), updates Firestore and Auth profile
   * WHY: Save user's updated profile data
   */
  const handleSave = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('No user is signed in');
      }
      
      setLoading(true);
      
      let uploadedPhotoURL = photoURL;
      
      // Upload new profile picture if selected
      if (localImageUri) {
        setUploading(true);
        console.log('[EditProfile] Uploading profile picture...');
        uploadedPhotoURL = await uploadProfilePicture(currentUser.uid, localImageUri);
        console.log('[EditProfile] Profile picture uploaded');
        setUploading(false);
      }
      
      // Update Firestore user document
      await updateUserProfile(currentUser.uid, {
        displayName: displayName.trim() || currentUser.displayName || 'User',
        photoURL: uploadedPhotoURL || undefined,
        bio: bio.trim() || undefined,
        isContentCreator: isContentCreator,
      });
      
      // Update Firebase Auth profile
      await updateProfile({
        displayName: displayName.trim() || currentUser.displayName || 'User',
        photoURL: uploadedPhotoURL || undefined,
      });
      
      // Fetch updated user data and update Zustand store
      const updatedUserData = await getUserById(currentUser.uid);
      if (updatedUserData) {
        setUser(updatedUserData);
      }
      
      console.log('[EditProfile] Profile updated successfully');
      
      // Show success message
      Alert.alert('Success', 'Profile updated successfully!', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error: any) {
      console.error('[EditProfile] Failed to save profile:', error);
      Alert.alert('Error', error.message || 'Failed to save profile');
      setLoading(false);
      setUploading(false);
    }
  };
  
  /**
   * Handle cancel
   */
  const handleCancel = () => {
    router.back();
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
          Edit Profile
        </Text>
        <Text variant="bodyLarge" style={styles.subtitle}>
          Update your profile information
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
      
      {/* Display Name */}
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
      
      {/* Account Type Selection */}
      <View style={styles.accountTypeSection}>
        <Text variant="titleMedium" style={styles.accountTypeTitle}>
          Account Type
        </Text>
        <Text variant="bodySmall" style={styles.accountTypeDescription}>
          Change your account type
        </Text>
        
        {/* Content Creator Option */}
        <TouchableOpacity
          style={[
            styles.accountTypeOption,
            isContentCreator === true && styles.accountTypeOptionSelected,
          ]}
          onPress={() => {
            if (!isContentCreator) {
              // Switching from Regular User to Content Creator - no warning needed
              setIsContentCreator(true);
            } else {
              setIsContentCreator(true);
            }
          }}
          disabled={loading}
          activeOpacity={0.7}
        >
          <RadioButton
            value="creator"
            status={isContentCreator === true ? 'checked' : 'unchecked'}
            onPress={() => setIsContentCreator(true)}
            disabled={loading}
          />
          <View style={styles.accountTypeContent}>
            <Text variant="titleSmall" style={styles.accountTypeLabel}>
              Content Creator
            </Text>
            <Text variant="bodySmall" style={styles.accountTypeDesc}>
              Get AI tools for managing DMs, FAQs, and smart replies
            </Text>
          </View>
        </TouchableOpacity>
        
        {/* Regular User Option */}
        <TouchableOpacity
          style={[
            styles.accountTypeOption,
            isContentCreator === false && styles.accountTypeOptionSelected,
          ]}
          onPress={() => {
            if (isContentCreator) {
              // Switching from Content Creator to Regular User - show warning
              Alert.alert(
                'Change Account Type?',
                'You will lose access to AI features like FAQ settings, AI assistant, smart replies, and agent activity.',
                [
                  {
                    text: 'Cancel',
                    style: 'cancel',
                  },
                  {
                    text: 'Continue',
                    onPress: () => setIsContentCreator(false),
                  },
                ]
              );
            } else {
              setIsContentCreator(false);
            }
          }}
          disabled={loading}
          activeOpacity={0.7}
        >
          <RadioButton
            value="regular"
            status={isContentCreator === false ? 'checked' : 'unchecked'}
            onPress={() => {
              if (isContentCreator) {
                Alert.alert(
                  'Change Account Type?',
                  'You will lose access to AI features like FAQ settings, AI assistant, smart replies, and agent activity.',
                  [
                    {
                      text: 'Cancel',
                      style: 'cancel',
                    },
                    {
                      text: 'Continue',
                      onPress: () => setIsContentCreator(false),
                    },
                  ]
                );
              } else {
                setIsContentCreator(false);
              }
            }}
            disabled={loading}
          />
          <View style={styles.accountTypeContent}>
            <Text variant="titleSmall" style={styles.accountTypeLabel}>
              Regular User
            </Text>
            <Text variant="bodySmall" style={styles.accountTypeDesc}>
              Standard messaging experience
            </Text>
          </View>
        </TouchableOpacity>
      </View>
      
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
        Save Changes
      </Button>
      
      {/* Cancel Button */}
      <Button
        mode="text"
        onPress={handleCancel}
        disabled={loading}
        style={styles.cancelButton}
      >
        Cancel
      </Button>
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
  cancelButton: {
    marginTop: 8,
  },
  accountTypeSection: {
    marginTop: 24,
    marginBottom: 16,
  },
  accountTypeTitle: {
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  accountTypeDescription: {
    color: '#666',
    marginBottom: 16,
  },
  accountTypeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  accountTypeOptionSelected: {
    borderColor: '#25D366',
    backgroundColor: '#f0f9f4',
  },
  accountTypeContent: {
    flex: 1,
    marginLeft: 8,
  },
  accountTypeLabel: {
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  accountTypeDesc: {
    color: '#666',
    lineHeight: 18,
  },
});

