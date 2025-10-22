# Epic 2.3: Chat List & Conversations - Testing Guide

## Testing on Expo Go - Exact Steps

### Prerequisites
- 2 Android devices (or Android + iOS)
- Expo Go app installed on both
- 3 test accounts created (User A, User B, User C)

---

## Test 1: Setup (2 devices/accounts)

### Device A
1. Open Expo Go
2. Scan QR code from `npm start`
3. Sign in as **User A**
4. **✅ VERIFY:** Chat list screen shows
5. **✅ VERIFY:** Header shows "MessageAI"
6. **✅ VERIFY:** Empty state shows "No chats yet. Tap the + button to start a conversation"
7. **✅ VERIFY:** Green FAB (+) button visible at bottom-right

### Device B
1. Open Expo Go
2. Scan same QR code
3. Sign in as **User B**
4. **✅ VERIFY:** Same empty state as Device A

---

## Test 2: Create New Chat

### Device A
1. **Tap** the green FAB (+) button at bottom-right
2. **✅ VERIFY:** "New Chat" screen appears
3. **✅ VERIFY:** Search bar shows at top
4. **✅ VERIFY:** List of users displays (should see User B and User C)
5. **Type** "B" in search bar
6. **✅ VERIFY:** List filters to show only users matching "B" (User B)
7. **Clear** search
8. **Tap** User B from the list
9. **✅ VERIFY:** Chat screen opens for conversation with User B
10. **✅ VERIFY:** Header shows "User B's Name"
11. **Type** "Hello from A" in message input
12. **Tap** send button
13. **✅ VERIFY:** Message appears instantly in chat
14. **Tap** back arrow (←) in header
15. **✅ VERIFY:** Returns to chat list
16. **✅ VERIFY:** Chat list now shows:
    - User B's name
    - Last message: "Hello from A"
    - Timestamp (e.g., "0m" or "1m")
    - **NO** unread badge (you sent it, so it's read for you)

---

## Test 3: Real-Time Updates & Unread Badges

### Device B
1. **✅ VERIFY:** Chat list automatically updates (no refresh needed)
2. **✅ VERIFY:** New chat with User A appears
3. **✅ VERIFY:** Shows:
   - User A's name
   - Last message: "Hello from A"
   - Timestamp (e.g., "0m")
   - **Green unread badge showing "1"**
4. **Tap** the chat with User A
5. **✅ VERIFY:** Chat screen opens
6. **✅ VERIFY:** Message "Hello from A" is visible
7. **✅ VERIFY:** Go back to chat list
8. **✅ VERIFY:** Unread badge is **GONE** (you opened it, so it's read)
9. **Tap** the chat again
10. **Type** "Hi from B" and send
11. **Tap** back arrow

### Device A
12. **✅ VERIFY:** Chat list updates automatically
13. **✅ VERIFY:** Last message now shows "Hi from B"
14. **✅ VERIFY:** **Green unread badge showing "1"** appears
15. **✅ VERIFY:** Timestamp updated (e.g., "0m")

---

## Test 4: Sorting (Most Recent First)

### Device A
1. **Tap** FAB (+) button
2. **Tap** User C from contact list
3. **Type** "Hello User C" and send
4. **Tap** back arrow
5. **✅ VERIFY:** Chat list shows **User C at the top** (most recent)
6. **✅ VERIFY:** User B is below User C (older conversation)

### Device B (as User B)
7. **Tap** chat with User A
8. **Type** "Another message from B" and send
9. **Tap** back arrow

### Device A
10. **✅ VERIFY:** Chat list automatically re-sorts
11. **✅ VERIFY:** **User B now at the top** (most recent message)
12. **✅ VERIFY:** User C is now second (older)

---

## Test 5: Pull-to-Refresh

### Device A
1. **Pull down** on the chat list (drag from top)
2. **✅ VERIFY:** Spinner appears
3. **✅ VERIFY:** List refreshes
4. **✅ VERIFY:** No errors
5. **✅ VERIFY:** Chat order remains correct

---

## Test 6: Offline Mode (SQLite Cache)

### Device A
1. **Enable airplane mode** on device
2. **✅ VERIFY:** Connection banner appears at top (orange/red)
3. **✅ VERIFY:** Chat list still shows all chats (from SQLite cache)
4. **✅ VERIFY:** User names still display
5. **✅ VERIFY:** Profile pictures still show (if cached)
6. **Tap** a chat (e.g., User B)
7. **✅ VERIFY:** Messages still load and display
8. **Type** a message and send
9. **✅ VERIFY:** Message appears with "sending" status (clock icon)
10. **Tap** back arrow
11. **✅ VERIFY:** Chat list works offline
12. **Disable airplane mode**
13. **✅ VERIFY:** Connection banner disappears
14. **✅ VERIFY:** Pending message syncs (status changes to "sent")
15. **✅ VERIFY:** Chat list updates with any new messages

---

## Test 7: Empty State

### Sign in with new account (User D)
1. Sign out from Device A
2. Create/sign in with **User D** (new account)
3. **✅ VERIFY:** Empty state shows:
   - "No chats yet"
   - "Tap the + button to start a conversation"
4. **Tap** FAB (+) button
5. **✅ VERIFY:** "New Chat" screen opens
6. **✅ VERIFY:** Contact list shows other users (A, B, C)
7. **Tap** any user
8. **✅ VERIFY:** Chat screen opens
9. Send a message
10. Go back
11. **✅ VERIFY:** Chat list now shows the conversation

---

## Test 8: Navigation Flow

### Device A
1. From chat list → **Tap** a chat
2. **✅ VERIFY:** Opens chat screen with correct user
3. **Type** and send a message
4. **Tap** back arrow (←)
5. **✅ VERIFY:** Returns to chat list
6. **✅ VERIFY:** Unread badge cleared (if you read the latest message)
7. **Tap** menu icon (⋮) in app bar
8. **✅ VERIFY:** Menu shows "Edit Profile" and "Sign Out"
9. **Tap** "Edit Profile"
10. **✅ VERIFY:** Edit profile screen opens
11. **Tap** back
12. **✅ VERIFY:** Returns to chat list

---

## Test 9: Unread Count Accuracy

### Setup: Device A and Device B

#### Device B (User B sends 3 messages)
1. Open chat with User A
2. Send message: "Message 1"
3. Send message: "Message 2"
4. Send message: "Message 3"
5. **Tap** back to chat list

#### Device A (User A checks unread)
6. **✅ VERIFY:** Chat with User B shows **unread badge "3"**
7. **Tap** the chat with User B
8. **✅ VERIFY:** All 3 messages visible
9. **Tap** back to chat list
10. **✅ VERIFY:** Unread badge is **GONE** (all messages read)

---

## Test 10: Search Functionality in Contact Picker

### Device A
1. **Tap** FAB (+) button
2. **✅ VERIFY:** "New Chat" screen shows all users
3. **Type** partial name in search (e.g., if user is "John Doe", type "joh")
4. **✅ VERIFY:** List filters to matching users (case-insensitive)
5. **Type** email in search
6. **✅ VERIFY:** Filters by email too
7. **Type** "zzz999" (nonsense)
8. **✅ VERIFY:** Empty state: "No users found matching 'zzz999'"
9. **Clear** search
10. **✅ VERIFY:** All users show again

---

## Success Criteria Checklist

- ✅ Chat list displays all conversations sorted by most recent
- ✅ Real-time updates work (new messages appear instantly)
- ✅ Unread badges show correct counts
- ✅ Unread badges clear when chat is opened
- ✅ Tap chat opens conversation screen
- ✅ Pull-to-refresh works without errors
- ✅ Offline mode shows cached chats
- ✅ Offline mode shows cached user names/photos
- ✅ New chat screen lists all users with search
- ✅ Search filters users by name and email
- ✅ FAB button navigates to contact picker
- ✅ Chat list re-sorts when new messages arrive
- ✅ No crashes or errors throughout testing

---

## Common Issues & Troubleshooting

### Issue: Unread badge doesn't appear
- **Check:** Ensure you're testing with 2 different users
- **Check:** Make sure sender and receiver are different
- **Fix:** Reload app (close and reopen Expo Go)

### Issue: Chat list doesn't update in real-time
- **Check:** Network connection (disable airplane mode)
- **Check:** Firestore listener is active (check console logs)
- **Fix:** Pull-to-refresh to force sync

### Issue: User photos don't show
- **Check:** User uploaded a profile photo during setup
- **Fix:** Normal behavior if user has no photo (shows initials instead)

### Issue: "No users found" in contact picker
- **Check:** At least 2 users are registered
- **Check:** Network connection (users fetched from Firestore)
- **Fix:** Disable airplane mode and retry

---

## Console Logs to Watch For

When testing, watch for these console logs (helpful for debugging):

```
[ChatList] Loading chats for user: <userId>
[ChatList] Loaded X chats from cache
[ChatList] Received X chats from Firestore
[ChatList] Loaded X user profiles
[ChatService] Setting up real-time listener for user chats
[MessageService] Marking chat as read
[NewChat] Loading users...
[NewChat] Loaded X users
[NewChat] Creating chat with user: <userId>
```

---

## Post-Testing Cleanup

After completing all tests:

1. No cleanup needed - app is ready for Epic 2.4
2. All test chats can remain (useful for future testing)
3. Database is properly initialized and cached

---

## Next Steps After Epic 2.3

Once all tests pass:
- ✅ Mark Epic 2.3 as complete in TASK_LIST.md
- ➡️ Proceed to Epic 2.4: Read Receipts & Delivery Status

