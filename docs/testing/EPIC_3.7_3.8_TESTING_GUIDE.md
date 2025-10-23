# Testing Instructions for Epic 3.7 & 3.8

## Prerequisites

1. **Deploy Cloud Functions** (Required!)
   ```bash
   cd functions
   npm run build
   cd ..
   firebase deploy --only functions
   ```
   
   This will deploy:
   - `runAgent` - Multi-step agent function
   - `sendAIChatMessage` - AI chat function
   - `approveSuggestion` - Approve suggested actions
   - `rejectSuggestion` - Reject suggested actions

2. **Start Expo Dev Server**
   ```bash
   npx expo start
   ```

3. **Open on Android Device**
   - Scan QR code with Expo Go app
   - Make sure you're logged in with a user account

---

## Epic 3.7: Multi-Step AI Agent Testing

### Setup (5 minutes)

1. **Add Some Test FAQs**
   - Tap menu (three dots) in top right
   - Select "FAQ Settings"
   - Tap "Add FAQ" button
   - Example FAQ 1:
     - Question: "What are your rates?"
     - Answer: "My rates start at $500 for sponsored posts. Email me for details!"
   - Example FAQ 2:
     - Question: "Do you accept collaborations?"
     - Answer: "Yes! I'm always open to brand partnerships. DM me your proposal."

2. **Enable the AI Agent**
   - Go back to menu
   - Select "Smart Replies"
   - Toggle "Enable AI Agent" switch to ON
   - You should now see:
     - "Run Agent Now" button
     - "View Agent Activity" button
     - Pending suggestions count (0 at first)

### Test 1: Agent Processes Messages

**What we're testing:** Agent can analyze unread messages and suggest actions

**Steps:**

1. **Create test messages from another account** (use a friend's phone or another device):
   - Fan message: "OMG I love your content! You're amazing! 🔥"
   - FAQ message: "Hey, what are your rates for sponsored posts?"
   - Business message: "Hi, I represent Nike. We'd like to partner with you for a $5000 campaign. Are you interested?"
   - Spam message: "Click here for FREE followers! Limited time offer!!!"

2. **Run the agent**:
   - Go to Menu → Smart Replies (look for red badge if there are pending suggestions)
   - Tap "Run Agent Now"
   - Wait 10-20 seconds (AI is processing)
   - **Auto-navigates to Suggested Actions** if suggestions were created

3. **Verify suggested actions**:
   - You should see 4 suggested actions with:
     - ✅ **Sender's name and photo** at the top
     - ✅ **Original message** in gray box
     - ✅ **Actual message timestamp** (e.g., "2 hours ago", not "less than a minute ago")
     - ✅ **Fan message** → Suggested friendly response
     - ✅ **FAQ message** → Suggested FAQ answer
     - ✅ **Business message** → Flagged for review (with "View Chat" button)
     - ✅ **Spam message** → Suggested archive (with "View Chat" button)

4. **Test running agent again**:
   - Go back to Menu → Smart Replies
   - Tap "Run Agent Now" again
   - Should show: "Processed 0 messages, No new suggestions"
   - **Why:** Agent now tracks processed messages, won't re-suggest

5. **Test accessing previous suggestions**:
   - Go to Menu → Smart Replies
   - See pending count (should show how many are left)
   - Tap "Review Suggestions" button
   - Opens Suggested Actions with remaining suggestions
   - **Why:** Can always access suggestions, even if agent didn't just run

**Expected Results:**
- Agent processes all 4 messages (first run only)
- Creates appropriate suggestions with full context
- Auto-navigates to suggestions screen
- Running again doesn't create duplicates
- No errors

### Test 2: Approve Suggested Response (Rapid Testing)

**What we're testing:** User can quickly approve multiple suggestions without blocking alerts

**Steps:**

1. In Suggested Actions screen (should be there from Test 1)
2. Find the **fan message** suggestion
3. Review the suggested response (should be friendly and appreciative)
4. Tap "Send" button
5. **Notice:** Snackbar shows "Message sent! ✓" at bottom
6. **Immediately** tap "Send" on another suggestion without waiting
7. Open the chat with that contact to verify

**Expected Results:**
- ✅ Message sends successfully
- ✅ Snackbar shows success (non-blocking, disappears after 3 seconds)
- ✅ Can approve multiple suggestions rapidly
- ✅ Suggested action disappears from list
- ✅ Message appears in chat

### Test 3: Edit Before Sending

**What we're testing:** User can modify suggested responses

**Steps:**

1. Go to Menu → Suggested Actions
2. Find the **FAQ message** suggestion
3. Tap "Edit" button
4. Modify the text (e.g., add a personal note)
5. Tap "Send" in the dialog
6. Open the chat to verify

**Expected Results:**
- Edit dialog opens with suggested text
- Modified message sends successfully
- Suggested action disappears from list

### Test 4: Reject Suggestion (Instant, No Confirmation)

**What we're testing:** User can quickly dismiss suggestions

**Steps:**

1. In Suggested Actions screen
2. Find the **spam message** suggestion
3. Tap "Dismiss" button
4. **Notice:** Suggestion disappears immediately (no confirmation dialog)
5. Snackbar shows "Suggestion dismissed"

**Expected Results:**
- ✅ Suggestion disappears instantly
- ✅ No confirmation dialog (fast workflow)
- ✅ Snackbar confirms dismissal
- ✅ No message is sent

### Test 5: View Chat from Flagged Messages

**What we're testing:** User can navigate to chat from flag/archive suggestions

**Steps:**

1. In Suggested Actions screen
2. Find a **business** or **spam** suggestion (has "View Chat" button)
3. Tap "View Chat"
4. **Notice:** Opens the chat conversation
5. **Notice:** Suggestion auto-dismisses (gone when you go back)

**Expected Results:**
- ✅ Navigates to the chat
- ✅ Suggestion automatically disappears from list
- ✅ User can respond manually in the chat

### Test 6: Filter Checkmarks (Chat List)

**What we're testing:** All filter chips show checkmarks when selected

**Steps:**

1. Go back to Chat List (main screen)
2. Look at filter chips at the top
3. Tap "Priority" → Should see checkmark ✓
4. Tap "Fan" → Should see checkmark ✓
5. Tap "Positive" sentiment → Should see checkmark ✓
6. Tap "Negative" sentiment → Should see checkmark ✓
7. Verify filters work (chat list updates)

**Expected Results:**
- ✅ ALL chips show checkmark when selected (including Priority and Sentiment)
- ✅ Filters work correctly
- ✅ Can see which filter is active at a glance

### Test 7: View Agent Activity

**What we're testing:** Agent logs all actions for transparency

**Steps:**

1. Go to Menu → Smart Replies → "View Agent Activity"
2. You should see a log of all agent actions:
   - "RESPOND: Suggested friendly response to fan"
   - "RESPOND: Suggested FAQ answer: What are your rates?"
   - "FLAG: Business opportunity detected"
   - "ARCHIVE: Suggested archiving spam message"

3. **Test filtering:**
   - Tap "Responses" filter → shows only response suggestions
   - Tap "Flagged" filter → shows only flagged messages
   - Tap "All" → shows everything

**Expected Results:**
- All agent actions are logged
- Timestamps show "X minutes ago"
- Filters work correctly

---

## Epic 3.8: AI Chat Interface Testing

### Test 1: Ask for Statistics

**What we're testing:** AI can provide DM statistics

**Steps:**

1. Go to Menu → "AI Assistant"
2. Type: "How many messages did I get today?"
3. Wait for AI response (5-10 seconds)

**Expected Results:**
- AI responds with statistics:
  - Total messages
  - Breakdown by category (fan, business, spam, urgent)
  - Sentiment breakdown
  - High-priority count

### Test 2: Search for Messages

**What we're testing:** AI can search conversations

**Steps:**

1. In AI Assistant chat, type: "Search for 'Nike'"
2. Wait for response

**Expected Results:**
- AI finds messages containing "Nike"
- Shows chat name and message preview
- If no results: "I couldn't find any messages containing 'Nike'"

### Test 3: List Priority Messages

**What we're testing:** AI can identify high-value opportunities

**Steps:**

1. Type: "Show me urgent messages"
2. Wait for response

**Expected Results:**
- AI lists chats with collaboration score > 7
- Shows chat name, score, and last message preview
- If none: "You don't have any high-priority messages"

### Test 4: Get Business Insights

**What we're testing:** AI can analyze business opportunities

**Steps:**

1. Type: "Show me my business opportunities"
2. Wait for response

**Expected Results:**
- AI shows count of business messages
- Lists top 3 opportunities by score
- Includes collaboration scores

### Test 5: Suggested Queries

**What we're testing:** Users can tap suggested questions

**Steps:**

1. If chat is empty, you'll see suggested query chips:
   - "How many messages did I get today?"
   - "Show me my business messages"
   - "List urgent messages"
   - "Summarize my DMs from this week"

2. Tap any chip

**Expected Results:**
- Query is sent automatically
- AI responds appropriately

### Test 6: Conversation History

**What we're testing:** Chat history persists

**Steps:**

1. Ask several questions (use steps above)
2. Go back to chat list
3. Return to AI Assistant

**Expected Results:**
- All previous messages are still visible
- Messages from you appear on right (green)
- Messages from AI appear on left (gray)

---

## Common Issues & Fixes

### Cloud Functions Not Deployed
**Error:** "Failed to run agent" or "Failed to send message"

**Fix:**
```bash
cd functions
npm run build
firebase deploy --only functions
```

### OpenAI API Key Not Set
**Error:** "AI service error: API key not found"

**Fix:**
```bash
firebase functions:config:set openai.key="sk-proj-YOUR_KEY_HERE"
firebase deploy --only functions
```

### Agent Not Enabled
**Error:** "Agent is not enabled"

**Fix:**
- Go to FAQ Settings
- Toggle "Enable AI Agent" to ON

### No Messages to Process
**Result:** "Processed 0 messages"

**Fix:**
- Make sure you have unread messages from other users
- Messages you sent won't be processed
- Run agent after receiving new messages

---

## Success Criteria

### Epic 3.7 (Multi-Step Agent) ✅ Complete When:
- [x] Agent processes multiple message types correctly
- [x] Suggested actions appear in Suggested Actions screen
- [x] User can approve, edit, and reject suggestions
- [x] All actions are logged in Agent Activity
- [x] No crashes or errors during agent run

### Epic 3.8 (AI Chat Interface) ✅ Complete When:
- [x] AI responds to statistics queries
- [x] AI can search conversations
- [x] AI lists high-priority chats
- [x] Suggested queries work
- [x] Chat history persists across sessions
- [x] No crashes or errors during AI chat

---

## Performance Benchmarks

- **Agent Processing:** Should complete in < 30 seconds for 10 messages
- **AI Chat Response:** Should respond in < 10 seconds
- **Suggested Actions Load:** Should appear instantly (real-time listener)
- **Agent Activity Load:** Should load in < 2 seconds

---

## Next Steps After Testing

1. **Update TASK_LIST.md:**
   - Mark Task 3.7.11 as ✅
   - Mark Task 3.8.6 as ✅
   - Mark Epics 3.7 and 3.8 as ✅ COMPLETE

2. **Report any bugs** you find

3. **Proceed to Phase 4:** Final testing and submission preparation

---

**IMPORTANT:** All testing should be done on a real Android device via Expo Go for accurate results. The agent and AI chat require actual Firebase Cloud Functions to run.

