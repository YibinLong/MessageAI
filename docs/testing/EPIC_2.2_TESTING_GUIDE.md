# Epic 2.2: Basic 1:1 Messaging - Testing Guide

## Testing on Expo Go (2 Android Devices)

This guide provides **exact step-by-step instructions** for testing Epic 2.2 messaging features using Expo Go on 2 physical Android devices.

---

## Prerequisites

### Required Hardware
- **2 Android phones or tablets** with Expo Go installed from Google Play Store
- Both devices on **same WiFi network** (important for local development)
- USB cable for connecting one device to computer (optional, for logs)

### Setup Steps

1. **Install Expo Go on both devices:**
   - Open Google Play Store on each Android device
   - Search for "Expo Go"
   - Install the app
   - Open Expo Go to verify it works

2. **Start the development server:**
   ```bash
   cd /Users/yibin/Documents/WORKZONE/VSCODE/GAUNTLET_AI/2_Week/Whatsapp_Clone
   npm start
   ```

3. **Connect Device 1 (Phone A):**
   - Open Expo Go on Phone A
   - Tap "Scan QR code"
   - Point camera at the QR code in your terminal
   - Wait for app to load (may take 1-2 minutes on first load)

4. **Connect Device 2 (Phone B):**
   - Open Expo Go on Phone B
   - Tap "Scan QR code"
   - Point camera at the **same QR code**
   - Wait for app to load

5. **Create test accounts:**
   - Phone A: Sign up with email `test1@example.com` (or use an existing account)
   - Phone B: Sign up with email `test2@example.com` (or use a different existing account)
   - Complete profile setup on both phones

---

## Test 1: Create Test Chat

**Goal:** Verify chat creation works between two users

**Steps:**

1. **Phone A:** On the home screen, tap the green **"Create Test Chat"** button
2. **Phone A:** In the dialog, enter `test2@example.com` (the email from Phone B)
3. **Phone A:** Tap **"Create Chat"**
4. **Phone A:** Verify you're navigated to the chat screen
5. **Phone A:** Verify the header shows "Test User 2" (or the display name from Phone B)

**Expected Result:**
- ✅ Dialog opens and accepts email input
- ✅ Chat is created successfully
- ✅ Navigation to chat screen works
- ✅ Header shows other user's name

---

## Test 2: Send Message Online (Real-time Sync)

**Goal:** Verify messages sync in real-time when both users are online

**Steps:**

1. **Phone B:** Tap **"Create Test Chat"**, enter `test1@example.com`, create chat
2. **Phone A:** Type "Hello from Phone A" and tap send button
3. **Phone B:** Observe the chat screen

**Expected Result:**
- ✅ Message appears **instantly** on Phone A (green bubble on right)
- ✅ Message appears **within 1-2 seconds** on Phone B (white bubble on left)
- ✅ Phone A shows checkmark icon (status: sent)
- ✅ Timestamp shows "Just now"

4. **Phone B:** Reply with "Hi from Phone B"
5. **Phone A:** Observe the chat screen

**Expected Result:**
- ✅ Message appears on Phone B immediately
- ✅ Message appears on Phone A within 1-2 seconds
- ✅ Messages are in correct order

6. **Both Phones:** Send 5 messages back and forth rapidly

**Expected Result:**
- ✅ All messages appear in correct order
- ✅ No duplicate messages
- ✅ No missing messages

---

## Test 3: Offline Message Queue (Send Offline → Reconnect → Sync)

**Goal:** Verify messages sent offline are queued and uploaded when reconnected

**Steps:**

1. **Phone A:** Enable **Airplane Mode** (swipe down, tap airplane icon)
2. **Phone A:** Verify connection banner appears: **"No internet connection"** (red banner)
3. **Phone A:** Type "This message was sent offline" and tap send

**Expected Result:**
- ✅ Red banner shows "No internet connection"
- ✅ Message appears in chat immediately (optimistic UI)
- ✅ Message shows **clock icon** (status: sending)
- ✅ Phone B does **not** receive the message yet

4. **Phone A:** Send 2 more messages while still offline:
   - "Second offline message"
   - "Third offline message"

**Expected Result:**
- ✅ All messages appear on Phone A with clock icon
- ✅ Phone B has not received any of them yet

5. **Phone A:** Disable **Airplane Mode**
6. **Phone A:** Wait 2-3 seconds and observe

**Expected Result:**
- ✅ Banner changes to **"Reconnecting..."** (yellow)
- ✅ Banner changes to **"Connected"** (green), then hides after 2 seconds
- ✅ Clock icons change to **checkmarks** within 2 seconds
- ✅ Phone B receives all 3 messages in correct order

---

## Test 4: Connection Status Banner

**Goal:** Verify connection banner shows correct states

**Steps:**

1. **Phone A:** With app open in chat screen, enable **Airplane Mode**

**Expected Result:**
- ✅ Red banner slides down from top
- ✅ Banner shows **"No internet connection"**
- ✅ Banner stays visible while offline

2. **Phone A:** Disable **Airplane Mode**

**Expected Result:**
- ✅ Banner changes to yellow **"Reconnecting..."** briefly
- ✅ Banner changes to green **"Connected"**
- ✅ Green banner **auto-hides after 2 seconds**

3. **Phone A:** Enable/disable airplane mode 3 times rapidly

**Expected Result:**
- ✅ Banner responds correctly to each state change
- ✅ No UI glitches or stuck banners

---

## Test 5: Message Timestamps

**Goal:** Verify timestamps display correctly

**Steps:**

1. **Phone A:** Send a message "Testing timestamp"
2. **Phone A:** Immediately check the timestamp

**Expected Result:**
- ✅ Shows **"Just now"** (for messages < 1 minute old)

3. **Phone A:** Wait 2-3 minutes, check same message

**Expected Result:**
- ✅ Shows **"2 minutes ago"** or **"3 minutes ago"**

4. **Phone A:** Wait 1 hour (or manually change message timestamp in SQLite for faster testing)

**Expected Result:**
- ✅ Shows **"1 hour ago"** or time like **"10:45 AM"**

---

## Test 6: Message Persistence (Offline Loading)

**Goal:** Verify messages load from SQLite when app reopens

**Steps:**

1. **Phone A:** With chat screen open showing 10+ messages, **force close Expo Go**
   - Open Android recent apps (square button or swipe up gesture)
   - Swipe Expo Go up to close
2. **Phone A:** Enable **Airplane Mode**
3. **Phone A:** Reopen Expo Go, scan QR code again
4. **Phone A:** Sign in (should happen automatically)
5. **Phone A:** Tap **"Create Test Chat"**, enter Phone B's email, open chat

**Expected Result:**
- ✅ Messages load **instantly** (from SQLite)
- ✅ All previous messages are visible
- ✅ Red banner shows "No internet connection"
- ✅ Can scroll through message history offline

---

## Test 7: Rapid-Fire Messages (Performance Test)

**Goal:** Verify app handles many messages quickly without issues

**Steps:**

1. **Phone A:** Send 10 messages as fast as possible:
   - "Message 1"
   - "Message 2"
   - ... (up to 10)

**Expected Result:**
- ✅ All messages appear on Phone A immediately
- ✅ All messages appear on Phone B within 3-5 seconds
- ✅ Messages are in correct order (1, 2, 3... 10)
- ✅ No duplicate messages
- ✅ No missing messages
- ✅ No app crashes or freezes

2. **Phone B:** Scroll up and down through all messages

**Expected Result:**
- ✅ Scrolling is smooth (no lag)
- ✅ All messages render correctly

---

## Test 8: Empty State

**Goal:** Verify empty chat shows helpful message

**Steps:**

1. **Phone A:** Create a **new chat** with a different test user who hasn't sent any messages
2. **Phone A:** View the chat screen

**Expected Result:**
- ✅ Shows **"No messages yet"** text
- ✅ Shows **"Send a message to start the conversation"** subtext
- ✅ Message input is visible and functional

---

## Test 9: Multiple Chats (Context Switching)

**Goal:** Verify switching between chats works correctly

**Steps:**

1. **Phone A:** Create chat with User 2, send message "Chat 2 message"
2. **Phone A:** Go back to home, create chat with User 3 (if available, or use same user), send "Chat 3 message"
3. **Phone A:** Go back to home, open first chat

**Expected Result:**
- ✅ Each chat shows correct messages
- ✅ No message mixing between chats
- ✅ Messages load instantly from cache

---

## Test 10: App Lifecycle (Background/Foreground)

**Goal:** Verify messages arrive when app is backgrounded

**Steps:**

1. **Phone A:** Open chat with Phone B
2. **Phone A:** Press home button (background the app, don't close it)
3. **Phone B:** Send message "Testing background delivery"
4. **Phone A:** Wait 5 seconds, then reopen Expo Go

**Expected Result:**
- ✅ Message appears in chat
- ✅ May show notification (if push notifications are configured)

---

## Troubleshooting

### Issue: "No user found with email"
- **Solution:** Make sure both test accounts are created and signed in
- Verify email is spelled correctly (case-insensitive, but must match)

### Issue: Messages not syncing
- **Solution:** 
  - Check both phones are on same WiFi
  - Check internet connection
  - Look for red connection banner
  - Try disabling/re-enabling WiFi

### Issue: App crashes or freezes
- **Solution:**
  - Check terminal for error logs
  - Try closing and reopening Expo Go
  - Restart development server: `npm start`

### Issue: Chat not created
- **Solution:**
  - Check Firebase connection (look for errors in terminal)
  - Verify Firestore security rules allow chat creation
  - Check console logs for error messages

### Issue: QR code not scanning
- **Solution:**
  - Make sure phone camera has permission
  - Try manually entering the URL shown in terminal
  - Ensure phone and computer are on same network

---

## Success Criteria

Epic 2.2 is **complete** when all these tests pass:

- ✅ Real-time messaging works (Test 2)
- ✅ Offline queue works (Test 3)
- ✅ Connection banner shows correct states (Test 4)
- ✅ Timestamps format correctly (Test 5)
- ✅ Messages persist offline (Test 6)
- ✅ Rapid messages work without issues (Test 7)
- ✅ Message sync completes in <1 second after reconnection (Test 3, step 6)

---

## Next Steps

After all tests pass:
- Mark Epic 2.2 tasks as complete in TASK_LIST.md
- Move to Epic 2.3: Chat List & Conversations
- **Remember:** Remove "Create Test Chat" button in Epic 2.10

---

## Notes

- These tests use Expo Go, which is development mode. Performance may be better in production build.
- First load is slow (1-2 minutes) due to bundling. Subsequent loads are faster.
- Network conditions may affect sync times. Test on good WiFi for consistent results.
- For debugging, connect Phone A to computer via USB and run: `adb logcat *:S ReactNative:V ReactNativeJS:V` to see logs.


