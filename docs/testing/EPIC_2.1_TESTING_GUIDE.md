# Epic 2.1: Authentication & User Profiles - Testing Guide

## Overview
This guide provides **exact, step-by-step instructions** for testing all authentication and user profile features implemented in Epic 2.1.

## Prerequisites
Before testing, ensure:
1. ✅ Firebase project is set up and configured
2. ✅ `.env` file contains valid Firebase credentials
3. ✅ Firebase Authentication is enabled (Email/Password provider)
4. ✅ Firestore database is created
5. ✅ Firebase Storage is enabled
6. ✅ Android device with Expo Go installed OR Android emulator running

## How to Run the App

### Method 1: Physical Android Device (Recommended)
```bash
# From project root
npm start

# On your Android device:
# 1. Open Expo Go app
# 2. Scan the QR code from terminal
# 3. Wait for app to load
```

### Method 2: Android Emulator
```bash
# From project root
npm run android

# This will automatically launch in the emulator
```

---

## Test 1: Sign Up Flow

### Purpose
Verify that new users can create an account and Firestore user document is created correctly.

### Steps to Execute

1. **Open the app** on your Android device via Expo Go
   - Expected: You should see the **Sign In screen** (you're not logged in yet)
   - The screen should show:
     - "MessageAI" title in green (#25D366)
     - "Sign in to your account" subtitle
     - Email input field
     - Password input field
     - "Sign In" button
     - "Don't have an account? Sign Up" link

2. **Tap "Sign Up"** at the bottom
   - Expected: Navigate to **Sign Up screen**
   - The screen should show:
     - "Create Account" title
     - "Join MessageAI today" subtitle
     - Display Name input
     - Email input
     - Password input
     - Confirm Password input
     - "Sign Up" button

3. **Enter the following test credentials:**
   - Display Name: `Test User`
   - Email: `test@example.com`
   - Password: `Password123!`
   - Confirm Password: `Password123!`

4. **Tap "Sign Up" button**
   - Expected: 
     - Button shows loading indicator
     - Screen navigates to **Profile Setup screen**
     - No errors displayed

### Verification Steps

**Check Firebase Console:**

1. Open Firebase Console → Authentication
   - ✅ You should see a new user with email `test@example.com`
   - ✅ User ID (UID) should be visible

2. Open Firebase Console → Firestore Database
   - ✅ Navigate to `users` collection
   - ✅ You should see a document with ID matching the UID
   - ✅ Document should contain:
     ```
     id: "[UID]"
     email: "test@example.com"
     displayName: "Test User"
     createdAt: [Timestamp]
     lastSeen: [Timestamp]
     online: true
     photoURL: null
     bio: null
     ```

### Expected Result
✅ **PASS** if:
- Account is created without errors
- User is navigated to Profile Setup screen
- Firebase Auth shows the new user
- Firestore has the user document with correct fields

❌ **FAIL** if:
- Error is displayed
- Navigation doesn't happen
- Firebase Console doesn't show the user
- Firestore document is missing or has wrong fields

---

## Test 2: Profile Picture Upload

### Purpose
Verify that users can upload a profile picture and it's stored in Firebase Storage.

### Steps to Execute

1. **You should be on the Profile Setup screen** (from Test 1)
   - Expected: Screen shows:
     - "Complete Your Profile" title
     - Profile icon placeholder (gray circle with account icon)
     - "Add Photo" button
     - Display Name input (pre-filled with "Test User")
     - Bio input (empty)
     - "Complete Setup" button
     - "Skip for now" button

2. **Tap "Add Photo" button**
   - Expected:
     - Permission dialog appears: "Allow MessageAI to access photos?"
     - (First time only)

3. **Grant permission** by tapping "Allow"
   - Expected: Image picker opens showing your device's photo gallery

4. **Select any image** from your gallery
   - Expected:
     - Image picker shows crop interface (square crop)
     - You can adjust the crop area

5. **Confirm the crop** by tapping checkmark/done
   - Expected:
     - Image picker closes
     - Selected image appears in the Avatar (replacing gray icon)
     - "Add Photo" button changes to "Change Photo"

6. **Optionally: Add a bio**
   - Enter: `Content creator 🎨`
   - Expected: Character counter updates (e.g., "18/150 characters")

7. **Tap "Complete Setup" button**
   - Expected:
     - Button shows loading indicator
     - "Uploading image..." text appears
     - After upload completes (5-10 seconds):
       - Navigate to **Chat List screen**
       - Screen shows "Welcome, Test User!"
       - Your profile picture is displayed

### Verification Steps

**Check Firebase Console:**

1. Open Firebase Console → Storage
   - ✅ Navigate to `profiles/[UID]/avatar.jpg`
   - ✅ You should see the uploaded image
   - ✅ Click on it to preview - it should be your selected image

2. Open Firebase Console → Firestore → `users/[UID]`
   - ✅ Document should now have:
     ```
     photoURL: "https://firebasestorage.googleapis.com/..."
     bio: "Content creator 🎨"
     ```

3. **On the app (Chat List screen):**
   - ✅ Avatar displays your uploaded image (not gray icon)
   - ✅ Welcome message shows "Welcome, Test User!"

### Expected Result
✅ **PASS** if:
- Image picker opens and allows selection
- Selected image previews in avatar
- Image uploads successfully to Firebase Storage
- Firestore document is updated with photoURL and bio
- Chat List shows the uploaded image

❌ **FAIL** if:
- Permission is denied and not prompted again
- Image picker doesn't open
- Selected image doesn't appear
- Upload fails or hangs
- Chat List doesn't show the image

---

## Test 3: Sign Out & Sign In

### Purpose
Verify that users can sign out and sign back in with existing credentials.

### Steps to Execute

#### Part A: Sign Out

1. **You should be on the Chat List screen** (from Test 2)

2. **Tap "Sign Out" button**
   - Expected: Confirmation dialog appears
     - Title: "Sign Out"
     - Message: "Are you sure you want to sign out?"
     - Buttons: "Cancel" and "Sign Out"

3. **Tap "Sign Out"** (the red destructive option)
   - Expected:
     - Dialog closes
     - App navigates to **Sign In screen**
     - Screen is blank (no user data visible)

#### Part B: Sign In

4. **On the Sign In screen, enter credentials:**
   - Email: `test@example.com`
   - Password: `Password123!`

5. **Tap "Sign In" button**
   - Expected:
     - Button shows loading indicator
     - After 1-2 seconds:
       - Navigate to **Chat List screen**
       - Shows "Welcome, Test User!"
       - Profile picture is displayed

### Verification Steps

**Check Firestore Console:**
- ✅ Open `users/[UID]` document
- ✅ `online` field should be `true`
- ✅ `lastSeen` timestamp should be updated to current time

**On the app:**
- ✅ User data loads correctly (name, photo, bio)
- ✅ Avatar displays correctly

### Expected Result
✅ **PASS** if:
- Sign out confirmation dialog appears
- Sign out successfully returns to Sign In screen
- Sign in succeeds with correct credentials
- User data loads from Firestore (name, photo, bio)
- Chat List displays correctly

❌ **FAIL** if:
- Sign out doesn't work
- Sign in fails with correct credentials
- User data doesn't load
- Avatar doesn't display

---

## Test 4: Auth Persistence (Stay Logged In)

### Purpose
Verify that users stay logged in after force-closing and reopening the app.

### Steps to Execute

1. **Ensure you're signed in** (from Test 3)
   - You should be on the Chat List screen
   - "Welcome, Test User!" should be visible

2. **Force-close the app**
   - On Android: Swipe up to recent apps, swipe MessageAI away
   - OR: Press home button, then swipe away from recent apps

3. **Wait 5 seconds** (to ensure app is fully closed)

4. **Reopen the app** by tapping the MessageAI icon in Expo Go

5. **Observe the loading screen**
   - Expected:
     - "Initializing MessageAI..." loading screen appears briefly (1-2 seconds)
     - App initializes SQLite database
     - Firebase Auth checks for logged-in user
     - User data loads from Firestore

6. **After loading completes:**
   - Expected:
     - App navigates **directly to Chat List screen** (NOT Sign In screen)
     - "Welcome, Test User!" is displayed
     - Profile picture is visible
     - No sign-in required

### Verification Steps

**On the app:**
- ✅ App does NOT show Sign In screen
- ✅ App loads directly to Chat List
- ✅ User data is correct (name, photo)
- ✅ No re-authentication required

### Expected Result
✅ **PASS** if:
- App reopens directly to Chat List
- User data persists (name, photo visible)
- No sign-in required

❌ **FAIL** if:
- App shows Sign In screen
- User is logged out
- User data doesn't load

---

## Test 5: Profile Update

### Purpose
Verify that users can update their profile and changes persist.

### Steps to Execute

1. **From the Chat List screen, tap "Edit Profile" button**
   - Expected: Navigate to **Profile Setup screen**
   - Screen should show:
     - Current profile picture
     - Current display name: "Test User"
     - Current bio: "Content creator 🎨"
     - "Save Changes" button (not "Complete Setup")

2. **Update the display name**
   - Change "Test User" to: `Updated Name`

3. **Change the profile picture**
   - Tap "Change Photo"
   - Select a DIFFERENT image from gallery
   - Confirm crop
   - Expected: New image displays in avatar

4. **Update the bio**
   - Change "Content creator 🎨" to: `Full-stack developer 💻`

5. **Tap "Save Changes" button**
   - Expected:
     - Button shows loading indicator
     - "Uploading image..." appears (if image changed)
     - Navigate back to Chat List

6. **Verify changes on Chat List:**
   - Expected:
     - Welcome message shows "Welcome, Updated Name!"
     - New profile picture is displayed
     - Bio is NOT visible on Chat List (normal - will show in user profile later)

### Verification Steps

**Check Firestore Console:**
1. Open `users/[UID]` document
   - ✅ `displayName` should be `"Updated Name"`
   - ✅ `photoURL` should be updated (new URL)
   - ✅ `bio` should be `"Full-stack developer 💻"`

**Check Firebase Storage:**
1. Navigate to `profiles/[UID]/avatar.jpg`
   - ✅ Image should be the new one you selected
   - ✅ File modified timestamp should be recent

**On the app:**
- ✅ Chat List immediately shows updated name (no app restart needed)
- ✅ New avatar is displayed

### Expected Result
✅ **PASS** if:
- All fields can be edited
- New image uploads successfully
- Firestore document is updated
- Changes are immediately visible in UI

❌ **FAIL** if:
- Fields can't be edited
- Upload fails
- Firestore not updated
- UI doesn't reflect changes

---

## Test 6: Validation Errors

### Purpose
Verify that form validation works correctly for all auth screens.

### Steps to Execute

#### Part A: Invalid Email

1. **Sign out if logged in** (tap Sign Out → confirm)

2. **On Sign Up screen, enter:**
   - Display Name: `Test`
   - Email: `notanemail` (invalid format)
   - Password: `Password123!`
   - Confirm Password: `Password123!`

3. **Tap "Sign Up"**
   - Expected:
     - ❌ Red error message appears: **"Please enter a valid email address"**
     - Form is NOT submitted
     - User stays on Sign Up screen

#### Part B: Short Password

4. **Fix the email, enter short password:**
   - Display Name: `Test`
   - Email: `valid@email.com`
   - Password: `123` (too short)
   - Confirm Password: `123`

5. **Tap "Sign Up"**
   - Expected:
     - ❌ Red error message: **"Password must be at least 6 characters"**
     - Form is NOT submitted

#### Part C: Password Mismatch

6. **Fix password length, but make them different:**
   - Password: `Password123!`
   - Confirm Password: `Different123!`

7. **Tap "Sign Up"**
   - Expected:
     - ❌ Red error message: **"Passwords do not match"**
     - Form is NOT submitted

#### Part D: Email Already in Use

8. **Fix all fields, but use existing email:**
   - Display Name: `Another User`
   - Email: `test@example.com` (already registered)
   - Password: `Password123!`
   - Confirm Password: `Password123!`

9. **Tap "Sign Up"**
   - Expected:
     - Form submits (loading indicator)
     - After 1-2 seconds:
     - ❌ Red error message: **"This email is already registered"**
     - Loading stops, button re-enables

#### Part E: Invalid Sign In

10. **Go to Sign In screen**

11. **Enter wrong password:**
    - Email: `test@example.com`
    - Password: `WrongPassword!`

12. **Tap "Sign In"**
    - Expected:
      - ❌ Red error message: **"Incorrect password"**
      - Form is NOT submitted successfully

13. **Enter non-existent email:**
    - Email: `nonexistent@example.com`
    - Password: `AnyPassword123`

14. **Tap "Sign In"**
    - Expected:
      - ❌ Red error message: **"No account found with this email"**

### Expected Result
✅ **PASS** if:
- All validation errors are caught
- Appropriate error messages are displayed
- Forms don't submit with invalid data
- Error messages are user-friendly

❌ **FAIL** if:
- Validation doesn't work
- Generic error messages shown
- App crashes on invalid input

---

## Test 7: Network Error Handling

### Purpose
Verify that the app handles network errors gracefully.

### Steps to Execute

#### Part A: Offline Sign In

1. **Sign out if logged in**

2. **Turn on Airplane Mode** on your device
   - Swipe down notification shade
   - Tap Airplane Mode icon

3. **On Sign In screen, enter valid credentials:**
   - Email: `test@example.com`
   - Password: `Password123!`

4. **Tap "Sign In"**
   - Expected:
     - Button shows loading indicator briefly
     - After 5-10 seconds (timeout):
     - ❌ Red error message: **"Network error. Check your connection."**
     - Button re-enables (NOT stuck in loading state)
     - User can try again

5. **Turn off Airplane Mode**
   - Swipe down notification shade
   - Tap Airplane Mode icon to disable

6. **Wait 5 seconds** for connection to restore

7. **Tap "Sign In" again** (same credentials)
   - Expected:
     - ✅ Sign in succeeds
     - Navigate to Chat List

#### Part B: Offline Profile Upload

8. **Tap "Edit Profile"**

9. **Turn on Airplane Mode again**

10. **Select a new profile picture**
    - Tap "Change Photo"
    - Select image
    - Expected: Image previews locally (no upload yet)

11. **Tap "Save Changes"**
    - Expected:
      - "Uploading image..." appears
      - After timeout (10-15 seconds):
      - ❌ Error alert: **"Failed to save profile"** (or network error)
      - User stays on Profile Setup screen

12. **Turn off Airplane Mode**

13. **Tap "Save Changes" again**
    - Expected:
      - ✅ Upload succeeds
      - Navigate to Chat List

### Expected Result
✅ **PASS** if:
- Network errors are caught and displayed
- Error messages are clear
- Buttons re-enable (not stuck loading)
- Operations succeed when connection is restored

❌ **FAIL** if:
- App crashes on network error
- Buttons get stuck in loading state
- No error message is shown
- App doesn't recover when connection returns

---

## Summary Checklist

After completing all tests, verify:

- [ ] **Test 1:** Sign up creates account and Firestore doc
- [ ] **Test 2:** Profile picture uploads to Storage
- [ ] **Test 3:** Sign out and sign in work correctly
- [ ] **Test 4:** User stays logged in after app restart
- [ ] **Test 5:** Profile updates persist to Firestore
- [ ] **Test 6:** All validation errors work
- [ ] **Test 7:** Network errors are handled gracefully

### Acceptance Criteria (from TASK_LIST.md)

- ✅ User can sign up with email/password
- ✅ User can upload profile picture during setup
- ✅ User can sign in with existing credentials
- ✅ User can sign out
- ✅ User stays logged in after app restart
- ✅ Profile data persists in Firestore
- ✅ Profile updates reflect immediately in UI
- ✅ Validation errors show for invalid inputs
- ✅ Network errors handled gracefully

---

## Troubleshooting

### Issue: "Permission denied" when picking image
**Solution:** 
- Go to device Settings → Apps → Expo Go → Permissions
- Enable "Photos and media"
- Restart app

### Issue: "Network error" even with WiFi on
**Solution:**
- Check Firebase `.env` configuration
- Verify Firebase project has Authentication enabled
- Check Firestore security rules (should allow authenticated writes)

### Issue: App crashes on sign up
**Solution:**
- Check console logs in terminal running `npm start`
- Verify Firebase config is correct
- Ensure Firestore database is created

### Issue: Image upload hangs forever
**Solution:**
- Check Firebase Storage is enabled
- Verify Storage security rules
- Check internet connection speed (large images take longer)

### Issue: User data doesn't load
**Solution:**
- Open Firestore Console and verify user document exists
- Check that `getUserById()` isn't throwing errors (see console)
- Verify user ID matches between Auth and Firestore

---

## Next Steps

After all tests pass:
1. Mark Task 2.1.8 as complete in TASK_LIST.md
2. Update Epic 2.1 status to ✅ COMPLETE
3. Move on to Epic 2.2: Basic 1:1 Messaging

**Epic 2.1 is complete when all 7 tests pass! 🎉**

