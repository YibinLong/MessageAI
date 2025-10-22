# Testing Guide for MessageAI - Expo Go

This guide provides exact step-by-step instructions for testing the implemented features on Expo Go.

## Setup (Required Before Testing)

### 1. Install Expo Go on Two Android Devices
- Download "Expo Go" from Google Play Store on two devices
- Make sure both devices are connected to the **same WiFi network**

### 2. Start the Development Server
```bash
# Navigate to the project root directory
npm start
```

### 3. Connect Both Devices
- A QR code will appear in your terminal
- Open Expo Go on both devices
- Scan the QR code on both devices
- Wait for the app to load

### 4. Create Test Accounts
- On Device A: Sign up with email `test1@example.com`, password `test123456`
- On Device B: Sign up with email `test2@example.com`, password `test123456`
- Complete profile setup on both devices (add name and optionally a profile picture)

---

## Test 1: Image Messaging (Epic 2.9)

### A. Send Image Online
1. **Device A**: Tap "New Chat" → select Device B's user
2. **Device A**: In the chat, tap the **image icon** (📷) next to the text input
3. **Device A**: Grant photo library permissions if prompted
4. **Device A**: Select a large image (>1MB if possible)
5. **Verify**: "Uploading image..." message appears
6. **Verify**: Image appears as a 200x200 thumbnail in the chat
7. **Device B**: Verify the image appears in the chat within 1-2 seconds
8. **Expected**: Original image >1MB gets compressed to <1MB

### B. View Image Full-Screen
1. **Device B**: Tap on the image thumbnail
2. **Verify**: Image opens in full-screen black overlay
3. **Verify**: You can **pinch to zoom** (1x to 3x)
4. **Verify**: You can **pan** when zoomed in
5. **Verify**: **Double-tap** toggles between 1x and 2x zoom
6. **Device B**: Tap the **X button** in top-right to close
7. **Expected**: Image viewer closes and returns to chat

### C. Send Image Offline
1. **Device A**: Turn on **Airplane Mode**
2. **Device A**: Tap image icon, select an image
3. **Verify**: Image shows with "sending" status (clock icon)
4. **Device A**: Turn off Airplane Mode
5. **Wait** 2-3 seconds
6. **Verify**: Image automatically uploads
7. **Device B**: Verify image appears
8. **Expected**: Offline queue works - image uploads when reconnected

---

## Test 2: Contact Discovery with Search (Epic 2.10)

### A. Search Users with Debouncing
1. **Device A**: Go back to chat list, tap **+ button**
2. **Device A**: In the search bar, type slowly: "tes"
3. **Verify**: Search results **don't update** immediately (500ms delay)
4. **Wait** 500ms
5. **Verify**: Results now show matching users
6. **Device A**: Clear search
7. **Verify**: All users appear again
8. **Expected**: Debounced search reduces filtering operations

### B. Online Status Indicators
1. **Device A**: On "New Chat" screen, look at user list
2. **Verify**: Device B's user has a **green dot** (online indicator)
3. **Device B**: Force close the app
4. **Wait** 5-10 seconds
5. **Device A**: Verify green dot disappears for Device B's user
6. **Device B**: Reopen app
7. **Device A**: Verify green dot reappears
8. **Expected**: Online status updates in real-time

---

## Test 3: Polish & Error Handling (Epic 2.11)

### A. Error Boundary
1. **Simulate**: Since we can't easily crash the app, this is automatically active
2. **Expected**: If React error occurs, user sees:
   - Red alert icon
   - "Oops! Something went wrong" message
   - "Try Again" button to recover
   - Error details in dev mode

### B. Performance (Memoization)
1. **Device A**: Send **20 messages rapidly** in the chat
2. **Verify**: Chat scrolls smoothly (no lag)
3. **Expected**: React.memo prevents unnecessary re-renders of message bubbles
4. **Device A**: Go to chat list, observe the list
5. **Verify**: Chat list items don't flicker when presence updates
6. **Expected**: ChatListItem memoization prevents excessive re-renders

### C. Empty States (Already Implemented)
1. **Create a new test account** (Device C or new profile)
2. **Verify**: Chat list shows:
   - "No chats yet"
   - "Tap the + button to start a conversation"
3. **Expected**: Empty state provides clear guidance

### D. Pull-to-Refresh (Already Implemented)
1. **Device A**: On chat list, **pull down** to refresh
2. **Verify**: Loading spinner appears
3. **Verify**: Chats reload
4. **Expected**: Manual refresh capability works

---

## Test 4: Existing MVP Features (Regression Testing)

### A. Real-Time Messaging
1. **Device A**: Type "Hello from Device A" → send
2. **Device B**: Verify message appears within 1 second
3. **Device B**: Type "Hello from Device B" → send
4. **Device A**: Verify message appears within 1 second
5. **Expected**: Bidirectional real-time messaging works

### B. Offline Messaging
1. **Device A**: Turn on Airplane Mode
2. **Device A**: Send 3 messages
3. **Verify**: Messages show clock icon (sending status)
4. **Device A**: Turn off Airplane Mode
5. **Wait** 2-3 seconds
6. **Verify**: All 3 messages send (checkmarks appear)
7. **Device B**: Verify all 3 messages received
8. **Expected**: Offline queue automatically retries

### C. Read Receipts
1. **Device A**: Send a message
2. **Verify**: Single gray checkmark (sent)
3. **Wait** for Device B to receive
4. **Verify**: Double gray checkmark (delivered)
5. **Device B**: Open the chat
6. **Verify**: Double blue checkmark (read)
7. **Expected**: Message status indicators update correctly

### D. Typing Indicators
1. **Device A**: Start typing in the input field
2. **Wait** 500ms
3. **Device B**: Verify "User is typing..." appears at bottom of chat
4. **Device A**: Stop typing for 3 seconds
5. **Device B**: Verify typing indicator disappears
6. **Expected**: Typing indicators show and hide correctly

### E. Online/Offline Presence (in Chat Header)
1. **Device A**: Open chat with Device B
2. **Verify**: Chat header shows "Online"
3. **Device B**: Close or background the app
4. **Wait** 5-10 seconds
5. **Verify**: Header shows "Last seen X minutes ago"
6. **Expected**: Presence updates in chat header

### F. Group Chats
1. **Device A**: Tap **+ → Create Group**
2. **Device A**: Enter group name "Test Group"
3. **Device A**: Add Device B user
4. **Device A**: Tap **Create**
5. **Device A**: Send a message in the group
6. **Device B**: Verify message appears with sender name
7. **Device B**: Send a message
8. **Verify**: Both users see sender names above messages
9. **Expected**: Group chat works with proper sender attribution

### G. Push Notifications (Expo Go Limitation)
**Note**: Push notifications **do NOT work in Expo Go** (SDK 54 limitation).
To test notifications, you must build a development build:
```bash
eas build --profile development --platform android
```

Then install the APK and test:
1. **Device B**: Background the app
2. **Device A**: Send a message
3. **Device B**: Verify notification appears
4. **Device B**: Tap notification
5. **Expected**: App opens to that specific chat

---

## Common Issues & Solutions

### Issue: "Cannot connect to Metro bundler"
**Solution**: Make sure both devices are on the same WiFi network as your computer. Try restarting the Expo server with `npm start`.

### Issue: Images don't upload
**Solution**: 
1. Check Firebase Storage rules allow write access
2. Verify `google-services.json` is in the project
3. Check internet connection

### Issue: Presence doesn't update
**Solution**: 
1. Firebase Realtime Database must be enabled in Firebase Console
2. Check Realtime Database rules allow read/write
3. Wait 5-10 seconds for updates to propagate

### Issue: Messages don't sync after offline
**Solution**:
1. Make sure SQLite is initialized (check console logs)
2. Verify network connection is restored
3. Check Firestore security rules allow access

---

## Performance Benchmarks

### Target Metrics (Epic 2.11)
- ✅ App launch: <2 seconds to chat list screen
- ✅ Message send: Appears instantly (optimistic UI)
- ✅ Image upload: Progress visible, <5s for 1MB image
- ⏳ Scrolling: 60 FPS with 1000+ messages (needs testing with large dataset)
- ⏳ Offline→Online sync: <1 second for 20 messages (needs load testing)

### How to Test Scrolling Performance
1. Send 100+ messages in a chat (can script this if needed)
2. Scroll up and down rapidly
3. **Expected**: Smooth scrolling, no jank
4. **Why it works**: React.memo prevents re-renders of off-screen messages

---

## Testing Checklist

### Epic 2.9: Image Messaging
- [ ] Send image online
- [ ] Send image offline (queues and uploads when reconnected)
- [ ] View image full-screen
- [ ] Pinch to zoom (1x to 3x)
- [ ] Pan when zoomed
- [ ] Double-tap to zoom
- [ ] Image compressed to <1MB
- [ ] Loading indicator shows while uploading
- [ ] Image thumbnail displays correctly

### Epic 2.10: Contact Discovery
- [ ] Search users by name
- [ ] Search users by email
- [ ] Search is debounced (500ms delay)
- [ ] Online status shows green dot
- [ ] Offline users don't show green dot
- [ ] Tap user creates/opens chat

### Epic 2.11: Polish
- [ ] Error boundary catches errors
- [ ] Empty state shows when no chats
- [ ] Pull-to-refresh works on chat list
- [ ] Messages scroll smoothly (no lag)
- [ ] Chat list doesn't flicker on updates

### Regression (Existing Features)
- [ ] Real-time messaging works
- [ ] Offline messaging queues and retries
- [ ] Read receipts update (sent → delivered → read)
- [ ] Typing indicators appear/disappear
- [ ] Presence shows in chat header
- [ ] Group chats work with sender names

---

## Next Steps After Testing

1. **Fix any bugs found** during testing
2. **Build Android APK** to test push notifications:
   ```bash
   eas build --profile development --platform android
   ```
3. **Test on real device** outside Expo Go
4. **Run automated tests** (when implemented)
5. **Submit for review**

---

## Questions or Issues?

If you encounter any issues:
1. Check console logs in the terminal (Metro bundler)
2. Check device logs in Expo Go (shake device → view logs)
3. Verify Firebase configuration is correct
4. Ensure all dependencies are installed (`npm install`)

