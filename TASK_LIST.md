# **MessageAI - Task List**

**Status Legend:** ⬜ Not Started | 🟦 In Progress | ✅ Done | ❌ Blocked

---

## **PHASE 1: PROJECT SETUP** ✅

### **Epic 1.1: Initialize Project & Environment** ✅

**Story:** Set up development environment and project structure

- ✅ **Task 1.1.1:** Create Firebase project, enable Auth/Firestore/Storage/Functions/FCM
- ✅ **Task 1.1.2:** Initialize Expo React Native project with TypeScript
- ✅ **Task 1.1.3:** Install dependencies (React Native Paper, Firebase SDK, SQLite, etc.)
- ✅ **Task 1.1.4:** Configure `app.json` (bundle ID, permissions, splash screen)
- ✅ **Task 1.1.5:** Set up `.env` file with Firebase config
- ✅ **Task 1.1.6:** Create project folder structure (`/app`, `/components`, `/services`, `/utils`, `/types`)
- ✅ **Task 1.1.7:** Initialize Firebase Cloud Functions project (`firebase init functions`)
- ✅ **Task 1.1.8:** Deploy Firestore security rules (basic MVP rules)
- ✅ **Task 1.1.9:** Test Firebase connection (frontend → Firestore read/write)
- ✅ **Task 1.1.10:** Set up SQLite database with initial schema (messages, chats, users tables)

**Acceptance:** Project runs on Android device via Expo Go, can read/write Firestore, SQLite initialized. ✅ COMPLETE

---

## **PHASE 2: MVP - CORE MESSAGING**

### **Epic 2.1: Authentication & User Profiles** ✅

**Story:** Users can sign up, sign in, and create profiles

- ✅ **Task 2.1.1:** Create auth screens (SignIn, SignUp, Profile Setup)
- ✅ **Task 2.1.2:** Implement Firebase email/password auth
- ✅ **Task 2.1.3:** Create Firestore `/users/{userId}` document on signup
- ✅ **Task 2.1.4:** Build profile setup screen (display name, profile picture upload)
- ✅ **Task 2.1.5:** Implement image picker + upload to Firebase Storage
- ✅ **Task 2.1.6:** Create auth context/store (Zustand) for user state
- ✅ **Task 2.1.7:** Add auth persistence (stay logged in)
- ⬜ **Task 2.1.8:** Test: Sign up → upload photo → sign out → sign in → profile persists

**Acceptance:** User can create account, upload profile pic, stay logged in across app restarts. ✅ IMPLEMENTATION COMPLETE - READY FOR TESTING

---

### **Epic 2.2: Basic 1:1 Messaging**

**Story:** Users can send and receive text messages in real-time

- ⬜ **Task 2.2.1:** Design Firestore schema for `/chats` and `/chats/{chatId}/messages`
- ⬜ **Task 2.2.2:** Create SQLite schema for messages table
- ⬜ **Task 2.2.3:** Build Chat Screen UI (message list, input box, send button)
- ⬜ **Task 2.2.4:** Implement send message flow:
  - Add to SQLite (status: 'sending')
  - Show optimistically in UI
  - Write to Firestore
  - Update SQLite (status: 'sent')
- ⬜ **Task 2.2.5:** Implement receive message flow:
  - Firestore listener on `/chats/{chatId}/messages`
  - Write to SQLite
  - Display in UI
- ⬜ **Task 2.2.6:** Add message timestamps (relative: "2m ago", absolute: "10:45 AM")
- ⬜ **Task 2.2.7:** Implement offline queue:
  - Retry unsent messages on reconnect
  - Handle network status changes
- ⬜ **Task 2.2.8:** Style message bubbles (WhatsApp Material Design 3 style)
- ⬜ **Task 2.2.9:** Test: Send message online → works. Send offline → queues → reconnect → sends.
  - **NOTE:** Temporary "Create Test Chat" button added to index.tsx for testing Epic 2.2. **REMOVE in Epic 2.10** when implementing proper contact discovery.
- ⬜ **Task 2.2.10:** Add connection status indicator UI (show online/offline/reconnecting banner at top of chat screen)
- ⬜ **Task 2.2.11:** Add "pending" badge/icon on messages with status 'sending' (offline queue indicator)
- ⬜ **Task 2.2.12:** Optimize sync performance to achieve <1 second sync time after reconnection

**Acceptance:** Two devices can exchange text messages in real-time. Messages persist offline and sync on reconnect. Connection status visible, sync completes in <1s.

---

### **Epic 2.3: Chat List & Conversations**

**Story:** Users see all conversations in a list, sorted by recency

- ⬜ **Task 2.3.1:** Build Chat List screen UI (list of chats)
- ⬜ **Task 2.3.2:** Query user's chats from Firestore (via `/users/{userId}/chatIds`)
- ⬜ **Task 2.3.3:** Display: contact name, profile pic, last message preview, timestamp
- ⬜ **Task 2.3.4:** Sort chats by `updatedAt` (most recent first)
- ⬜ **Task 2.3.5:** Add unread message count badge
- ⬜ **Task 2.3.6:** Implement tap to open conversation
- ⬜ **Task 2.3.7:** Add "New Chat" button → contact picker → create chat
- ⬜ **Task 2.3.8:** Cache chat list in SQLite for offline viewing
- ⬜ **Task 2.3.9:** Pull-to-refresh to sync latest chats
- ⬜ **Task 2.3.10:** Test: Chat list updates in real-time when new message arrives

**Acceptance:** Chat list displays all conversations, updates in real-time, works offline (shows cached data).

---

### **Epic 2.4: Read Receipts & Delivery Status**

**Story:** Users see message delivery and read status

- ⬜ **Task 2.4.1:** Add `status` field to message model ('sending', 'sent', 'delivered', 'read')
- ⬜ **Task 2.4.2:** Add `readBy` array field to message model
- ⬜ **Task 2.4.3:** Update message status icons:
  - Clock (sending)
  - Single checkmark (sent)
  - Double checkmark (delivered)
  - Blue double checkmark (read)
- ⬜ **Task 2.4.4:** Implement "delivered" logic: recipient device receives → update Firestore
- ⬜ **Task 2.4.5:** Implement "read" logic: recipient opens chat → mark all messages as read
- ⬜ **Task 2.4.6:** Update sender's UI when status changes (Firestore listener)
- ⬜ **Task 2.4.7:** Test: Send message → see checkmarks update in real-time

**Acceptance:** Message status indicators work correctly (sending → sent → delivered → read).

---

### **Epic 2.5: Typing Indicators**

**Story:** Users see when others are typing

- ⬜ **Task 2.5.1:** Create Firestore collection `/chats/{chatId}/typing/{userId}`
- ⬜ **Task 2.5.2:** Update typing status on `onChangeText` (debounced 500ms)
- ⬜ **Task 2.5.3:** Clear typing status after 3s of inactivity or on send
- ⬜ **Task 2.5.4:** Listen to typing collection → display "User is typing..." banner
- ⬜ **Task 2.5.5:** Style typing indicator (WhatsApp style: bottom of chat)
- ⬜ **Task 2.5.6:** Test: Type in chat → other device shows indicator → stops after 3s

**Acceptance:** Typing indicators appear and disappear correctly across devices.

---

### **Epic 2.6: Online/Offline Presence**

**Story:** Users see who's online and last seen timestamps

- ⬜ **Task 2.6.1:** Set up Firebase Realtime Database (for presence)
- ⬜ **Task 2.6.2:** Create `/status/{userId}` node in Realtime DB
- ⬜ **Task 2.6.3:** Update presence on app foreground/background
- ⬜ **Task 2.6.4:** Use `.onDisconnect()` to set offline on connection loss
- ⬜ **Task 2.6.5:** Display green dot when user is online
- ⬜ **Task 2.6.6:** Display "Last seen" timestamp when offline
- ⬜ **Task 2.6.7:** Show presence in chat header
- ⬜ **Task 2.6.8:** Test: Close app → other device shows "last seen X minutes ago"

**Acceptance:** Online/offline status updates within 5 seconds across devices.

---

### **Epic 2.7: Group Chats**

**Story:** Users can create group chats with 3+ participants

- ⬜ **Task 2.7.1:** Extend chat schema with `type: '1:1' | 'group'`, `name`, `admins` fields
- ⬜ **Task 2.7.2:** Build "Create Group" screen (name, add participants, group photo)
- ⬜ **Task 2.7.3:** Create group chat in Firestore (add all participants to `participants` array)
- ⬜ **Task 2.7.4:** Update message display: show sender name/photo for group messages
- ⬜ **Task 2.7.5:** Update read receipts for groups: "Read by 3" instead of blue checkmarks
- ⬜ **Task 2.7.6:** Update typing indicators for groups: "Alice is typing..."
- ⬜ **Task 2.7.7:** Test: Create group with 3 users → send message → all receive in real-time
- ⬜ **Task 2.7.8:** Build group info screen (tap group header → see member list with names, photos, and online status indicators)

**Acceptance:** Group chats work with 3+ users, all features (messages, receipts, typing) function correctly. Group member list accessible with presence indicators.

---

### **Epic 2.8: Push Notifications**

**Story:** Users receive notifications for new messages

- ⬜ **Task 2.8.1:** Set up Expo Notifications permissions
- ⬜ **Task 2.8.2:** Get FCM device token on app launch
- ⬜ **Task 2.8.3:** Store device token in Firestore `/users/{userId}/tokens/{tokenId}`
- ⬜ **Task 2.8.4:** Create Cloud Function `onMessageCreated` (triggers on new message)
- ⬜ **Task 2.8.5:** In function: fetch recipient tokens, send FCM notification
- ⬜ **Task 2.8.6:** Handle notification tap → navigate to specific chat
- ⬜ **Task 2.8.7:** Handle foreground notifications (show toast/banner)
- ⬜ **Task 2.8.8:** Test: Send message while recipient app is closed → notification appears → tap → opens chat

**Acceptance:** Push notifications work in foreground, background, and closed app states.

---

### **Epic 2.9: Image Messaging**

**Story:** Users can send and receive images in chats

- ⬜ **Task 2.9.1:** Add `type: 'text' | 'image'` and `mediaURL` fields to message model
- ⬜ **Task 2.9.2:** Add image picker button to chat input
- ⬜ **Task 2.9.3:** Compress image before upload (max 1MB)
- ⬜ **Task 2.9.4:** Upload to Firebase Storage `/media/{userId}/{messageId}.jpg`
- ⬜ **Task 2.9.5:** Show upload progress bar
- ⬜ **Task 2.9.6:** Create message with `mediaURL` after upload completes
- ⬜ **Task 2.9.7:** Display image thumbnails in chat
- ⬜ **Task 2.9.8:** Implement image loading placeholders (skeleton/blur effect while image loads)
- ⬜ **Task 2.9.9:** Tap image → full-screen view with zoom/pan
- ⬜ **Task 2.9.10:** Handle offline: queue image uploads for later
- ⬜ **Task 2.9.11:** Test: Send image → recipient sees thumbnail → tap → full view

**Acceptance:** Images upload, display as thumbnails with loading placeholders, and open in full-screen view.

---

### **Epic 2.10: Contact Discovery & Search**

**Story:** Users can find and start chats with other users

- ⬜ **Task 2.10.1:** Build "New Chat" screen with search bar
- ⬜ **Task 2.10.2:** Create Firestore query to search users by display name
- ⬜ **Task 2.10.3:** Display search results with profile pic + name
- ⬜ **Task 2.10.4:** Tap user → create or open existing 1:1 chat
- ⬜ **Task 2.10.5:** Add "Share Profile" feature (generate invite link)
- ⬜ **Task 2.10.6:** Test: Search for user → tap → chat opens

**Acceptance:** Users can search for others and start new conversations.

---

### **Epic 2.11: Polish & Testing**

**Story:** MVP is production-ready and reliable

- ⬜ **Task 2.11.1:** Add loading states to all screens
- ⬜ **Task 2.11.2:** Add error handling (network errors, permission denials, etc.)
- ⬜ **Task 2.11.3:** Add empty states (no chats, no messages, etc.)
- ⬜ **Task 2.11.4:** Implement message pagination (20 messages per page, load more on scroll)
- ⬜ **Task 2.11.5:** Add pull-to-refresh on all lists
- ⬜ **Task 2.11.6:** Optimize performance (memo components, virtualized lists)
- ⬜ **Task 2.11.7:** Implement keyboard handling (auto-dismiss on scroll, prevent input field obstruction, no UI jank)
- ⬜ **Task 2.11.8:** Optimize app launch time (target: <2 seconds from tap to chat list screen)
- ⬜ **Task 2.11.9:** Test scrolling performance with 1000+ messages (ensure smooth 60 FPS)
- ⬜ **Task 2.11.10:** Optimize battery usage (review background listener strategy, batch Firestore writes)
- ⬜ **Task 2.11.11:** Test all MVP scenarios:
  - Two devices chatting in real-time
  - One device offline → receive messages → come back online
  - Messages sent while app backgrounded
  - App force-quit and reopened (persistence check)
  - Poor network (airplane mode, throttled connection)
  - Rapid-fire messages (20+ in a row)
  - Group chat with 3+ users
- ⬜ **Task 2.11.12:** Build Android APK with EAS Build
- ⬜ **Task 2.11.13:** Install APK on real device and test end-to-end
- ⬜ **Task 2.11.14:** Fix any bugs found during testing

**Acceptance:** All MVP features work reliably on real Android device. App launches in <2s, scrolls smoothly at 60 FPS with 1000+ messages, keyboard handles perfectly, battery optimized. APK builds successfully.

---

## **PHASE 3: AI FEATURES (POST-MVP)**

### **Epic 3.1: AI Infrastructure**

**Story:** Set up AI backend and agent framework

- ⬜ **Task 3.1.1:** Add OpenAI API key to Cloud Functions config
- ⬜ **Task 3.1.2:** Install AI SDK by Vercel in Cloud Functions
- ⬜ **Task 3.1.3:** Create `aiService.ts` wrapper for OpenAI calls
- ⬜ **Task 3.1.4:** Implement RAG pipeline:
  - Store message history in Firestore
  - Create embeddings for messages (OpenAI embeddings API)
  - Store embeddings in Firestore `/users/{userId}/messageEmbeddings`
  - Create similarity search function
- ⬜ **Task 3.1.5:** Test: Call OpenAI API from Cloud Function → returns response
- ⬜ **Task 3.1.6:** Implement rate limiting for AI calls (per-user quotas, prevent abuse)
- ⬜ **Task 3.1.7:** Add response streaming for long AI operations (optional but improves UX for agent)

**Acceptance:** Cloud Functions can call OpenAI API successfully. RAG pipeline retrieves relevant conversation history. Rate limiting prevents abuse.

---

### **Epic 3.2: AI Feature 1 - Auto-Categorization**

**Story:** Messages are automatically tagged as fan/business/spam/urgent

- ⬜ **Task 3.2.1:** Create Cloud Function `categorizeMessage` (triggers on new message)
- ⬜ **Task 3.2.2:** Implement categorization prompt with function calling:
  - "You are analyzing DMs for a content creator. Categorize this message: {text}"
  - Return: { category: 'fan' | 'business' | 'spam' | 'urgent' }
- ⬜ **Task 3.2.3:** Store category in message doc: `aiCategory` field
- ⬜ **Task 3.2.4:** Add category badges to chat list (colored tags)
- ⬜ **Task 3.2.5:** Add filter buttons on chat list (show only business, etc.)
- ⬜ **Task 3.2.6:** Add loading indicator while AI categorizes (show subtle spinner on message)
- ⬜ **Task 3.2.7:** Handle AI errors (timeout, rate limit exceeded, API failure) with retry option
- ⬜ **Task 3.2.8:** Test: Send different message types → verify correct categorization

**Acceptance:** Messages are categorized automatically in <2 seconds, visible as tags in chat list, filterable. Graceful error handling with retry option.

---

### **Epic 3.3: AI Feature 2 - Response Drafting**

**Story:** AI generates reply suggestions matching creator's voice

- ⬜ **Task 3.3.1:** Build "Draft Reply" button in chat input area
- ⬜ **Task 3.3.2:** Create Cloud Function `draftResponse`
- ⬜ **Task 3.3.3:** Implement RAG: retrieve creator's past messages for context
- ⬜ **Task 3.3.4:** Implement drafting prompt:
  - "You are {creator name}. Draft a reply to this message matching their tone."
  - Include 5-10 past messages as examples
  - Generate 3 variations
- ⬜ **Task 3.3.5:** Build reply picker UI (show 3 options, pick one or regenerate)
- ⬜ **Task 3.3.6:** Insert selected draft into input field (user can edit before sending)
- ⬜ **Task 3.3.7:** Add loading UI (show "AI is drafting responses..." with spinner while processing)
- ⬜ **Task 3.3.8:** Handle AI errors (timeout after 8s, API failure, rate limit) with clear error message and retry button
- ⬜ **Task 3.3.9:** Test: Tap "Draft Reply" → 3 options appear → pick one → editable in input

**Acceptance:** AI generates 3 contextual reply options that match creator's style in <8 seconds. Clear loading states and error handling.

---

### **Epic 3.4: AI Feature 3 - FAQ Auto-Responder**

**Story:** AI detects common questions and auto-responds

- ⬜ **Task 3.4.1:** Build "FAQs" settings screen (add/edit/delete Q&A pairs)
- ⬜ **Task 3.4.2:** Store FAQs in Firestore `/users/{userId}/faqs`
- ⬜ **Task 3.4.3:** Create Cloud Function `detectFAQ` (triggers on new message)
- ⬜ **Task 3.4.4:** Implement FAQ matching prompt:
  - "Does this message match any of these FAQs: {faq list}?"
  - Return: { matched: boolean, faqId: string | null }
- ⬜ **Task 3.4.5:** If matched: auto-send FAQ answer OR show suggestion to creator
- ⬜ **Task 3.4.6:** Add toggle in settings: "Auto-respond to FAQs" (on/off)
- ⬜ **Task 3.4.7:** Track FAQ usage stats (which FAQs are used most)
- ⬜ **Task 3.4.8:** Add loading indicator (show "Checking FAQs..." while AI matches)
- ⬜ **Task 3.4.9:** Handle AI errors (timeout, API failure) gracefully, fall back to manual response
- ⬜ **Task 3.4.10:** Test: Send message matching FAQ → auto-response sent

**Acceptance:** FAQs can be configured, AI detects matches in <2 seconds, auto-responds or suggests response. Graceful error handling.

---

### **Epic 3.5: AI Feature 4 - Sentiment Analysis**

**Story:** Messages show sentiment indicators (positive/neutral/negative)

- ⬜ **Task 3.5.1:** Extend `categorizeMessage` function to include sentiment analysis
- ⬜ **Task 3.5.2:** Implement sentiment prompt:
  - "Analyze sentiment and urgency: {message text}"
  - Return: { sentiment: 'positive' | 'neutral' | 'negative', urgency: 1-5 }
- ⬜ **Task 3.5.3:** Store `aiSentiment` and `aiUrgency` in message doc
- ⬜ **Task 3.5.4:** Display sentiment icon in message bubble (😊😐😞)
- ⬜ **Task 3.5.5:** Add filter by sentiment in chat list
- ⬜ **Task 3.5.6:** Highlight urgent negative messages (red border/badge)
- ⬜ **Task 3.5.7:** Add loading indicator while sentiment is analyzed (subtle processing indicator)
- ⬜ **Task 3.5.8:** Handle AI errors (timeout, API failure) with fallback to neutral sentiment
- ⬜ **Task 3.5.9:** Test: Send positive/negative messages → correct icons appear

**Acceptance:** Sentiment icons display on messages in <2 seconds, urgent negatives are highlighted. Error handling with neutral fallback.

---

### **Epic 3.6: AI Feature 5 - Collaboration Scoring**

**Story:** Business opportunities are scored and highlighted

- ⬜ **Task 3.6.1:** Extend `categorizeMessage` to include collaboration scoring
- ⬜ **Task 3.6.2:** Implement scoring prompt:
  - "Rate this DM's collaboration potential for a content creator (1-10)"
  - Look for: brand mentions, payment offers, collab keywords
  - Return: { collaborationScore: number }
- ⬜ **Task 3.6.3:** Store `aiCollaborationScore` in message doc
- ⬜ **Task 3.6.4:** Highlight high-score messages (>7) with gold star icon
- ⬜ **Task 3.6.5:** Add "High Priority" filter in chat list (score > 7)
- ⬜ **Task 3.6.6:** Send push notification for high-score messages
- ⬜ **Task 3.6.7:** Add loading indicator while collaboration score is calculated
- ⬜ **Task 3.6.8:** Handle AI errors (timeout, API failure) with fallback to score of 0
- ⬜ **Task 3.6.9:** Test: Send collab offer → high score → highlighted

**Acceptance:** Collaboration opportunities are scored in <2 seconds, high-value messages are highlighted and prioritized. Error handling with zero-score fallback.

---

### **Epic 3.7: AI Feature 6 - Multi-Step Agent (ADVANCED)**

**Story:** AI agent autonomously handles routine DMs

- ⬜ **Task 3.7.1:** Build "AI Agent" settings screen:
  - Enable/disable agent per chat
  - Set agent behavior (auto-respond to fans, auto-archive spam, etc.)
  - View agent activity log
- ⬜ **Task 3.7.2:** Store agent settings in Firestore `/users/{userId}/agentSettings`
- ⬜ **Task 3.7.3:** Set up Cloud Scheduler (runs every 5 minutes)
- ⬜ **Task 3.7.4:** Create Cloud Function `aiAgent` (triggered by scheduler)
- ⬜ **Task 3.7.5:** Implement agent tools using AI SDK:
  - `categorizeMessage({ messageId, chatId })`
  - `matchFAQ({ messageText })`
  - `draftResponse({ chatId, messageText })`
  - `sendMessage({ chatId, text })`
  - `flagForReview({ chatId, messageId, reason })`
  - `archiveChat({ chatId })`
- ⬜ **Task 3.7.6:** Implement agent logic:
  - Query unread messages for creator
  - For each message:
    - Categorize
    - If fan → auto-respond with friendly reply
    - If FAQ → auto-respond with FAQ answer
    - If business/urgent → flag for review + send notification
    - If spam → auto-archive
- ⬜ **Task 3.7.7:** Log all agent actions in Firestore `/users/{userId}/agentLogs`
- ⬜ **Task 3.7.8:** Build "Agent Activity" screen (show log of actions taken)
- ⬜ **Task 3.7.9:** Add "Undo Agent Action" feature (if agent made a mistake)
- ⬜ **Task 3.7.10:** Add loading/processing indicators in agent activity screen (show "Agent is processing..." during runs)
- ⬜ **Task 3.7.11:** Handle AI errors (timeout after 15s, API failures, partial completion) with detailed error logging
- ⬜ **Task 3.7.12:** Test: Enable agent → send 10 test messages → verify correct actions

**Acceptance:** Agent runs autonomously in <15 seconds per batch, handles FAQs, responds to fans, flags important messages, logs all actions. Clear status indicators and error handling.

---

### **Epic 3.8: AI Chat Interface (Optional Enhancement)**

**Story:** Dedicated AI assistant chat for asking questions

- ⬜ **Task 3.8.1:** Create special chat with AI assistant (user ID: 'ai-assistant')
- ⬜ **Task 3.8.2:** Build AI chat UI (same as regular chat but with AI avatar)
- ⬜ **Task 3.8.3:** Create Cloud Function `aiChatResponse`
- ⬜ **Task 3.8.4:** Implement AI assistant with tools:
  - Search conversations
  - Summarize threads
  - Extract action items
  - Translate messages
  - Get stats (total DMs, by category, etc.)
- ⬜ **Task 3.8.5:** Test: Ask "Summarize my business DMs from this week" → AI responds

**Acceptance:** Users can chat with AI assistant to query conversation data and get insights.

---

## **PHASE 4: FINAL POLISH & SUBMISSION**

### **Epic 4.1: Testing & Bug Fixes**

**Story:** All features work reliably in production

- ⬜ **Task 4.1.1:** Test all AI features end-to-end on real device
- ⬜ **Task 4.1.2:** Test edge cases:
  - Empty conversations (AI has no context)
  - Mixed language messages
  - Very long messages
  - Rapid-fire messages
  - Agent running while user is actively chatting
- ⬜ **Task 4.1.3:** Optimize AI costs (cache common responses, batch requests)
- ⬜ **Task 4.1.4:** Add rate limiting (prevent spam/abuse)
- ⬜ **Task 4.1.5:** Fix any bugs found during testing
- ⬜ **Task 4.1.6:** Test AI response times (verify: simple commands <2s, complex operations <8s, agent workflows <15s)
- ⬜ **Task 4.1.7:** Test AI error scenarios (offline, rate limit, timeout, API key invalid)

**Acceptance:** All features work reliably, no critical bugs, AI costs are reasonable. All AI performance targets met, error scenarios handled gracefully.

---

### **Epic 4.2: Submission Materials**

**Story:** Project is ready to submit

- ⬜ **Task 4.2.1:** Update README.md with:
  - Project description
  - Step-by-step setup instructions
  - Tech stack
  - Features list
  - Screenshots
  - Architecture diagram (data flow: Frontend → Firestore → Cloud Functions → OpenAI)
  - System component diagram (show SQLite, Firestore, Firebase Auth, Cloud Functions, etc.)
  - Create .env.example template (all required variables with placeholder values)
  - Add code comments to complex logic (especially AI functions, sync logic, offline queue)
- ⬜ **Task 4.2.2:** Record demo video (5-7 minutes):
  - Real-time messaging between two devices
  - Group chat with 3+ participants
  - Offline scenario
  - App lifecycle handling
  - All 5 AI features in action
  - Multi-step agent demo
- ⬜ **Task 4.2.3:** Write Persona Brainlift doc (1 page):
  - Why Content Creator persona
  - Pain points addressed
  - How each AI feature helps
  - Key technical decisions
- ⬜ **Task 4.2.4:** Build final production APK
- ⬜ **Task 4.2.5:** Create social post (X/LinkedIn):
  - 2-3 sentence description
  - Key features + persona
  - Demo video or screenshots
  - Tag @GauntletAI
- ⬜ **Task 4.2.6:** Submit to GauntletAI (GitHub repo + video + APK + brainlift + social link)

**Acceptance:** All submission materials ready, project submitted before deadline.

---

## **PRIORITY ORDER (BUILD SEQUENCE)**

### **Week 1 - MVP (Day 1-2)**
1. ✅ Complete Epic 1.1 (Project Setup)
2. ✅ Complete Epic 2.1 (Auth)
3. ✅ Complete Epic 2.2 (Basic Messaging) ← **MOST CRITICAL**
4. ✅ Complete Epic 2.3 (Chat List)
5. ✅ Complete Epic 2.4 (Read Receipts)
6. ✅ Complete Epic 2.5 (Typing Indicators)
7. ✅ Complete Epic 2.6 (Presence)
8. ✅ Complete Epic 2.7 (Group Chats)
9. ✅ Complete Epic 2.8 (Push Notifications)
10. ✅ Complete Epic 2.9 (Images)
11. ✅ Complete Epic 2.10 (Contact Discovery)
12. ✅ Complete Epic 2.11 (Polish & Testing)

**MVP Checkpoint (24 hours):** All messaging features work reliably on real device.

### **Week 1 - AI Features (Day 3-7)**
1. ✅ Complete Epic 3.1 (AI Infrastructure)
2. ✅ Complete Epic 3.2 (Auto-Categorization)
3. ✅ Complete Epic 3.3 (Response Drafting)
4. ✅ Complete Epic 3.4 (FAQ Auto-Responder)
5. ✅ Complete Epic 3.5 (Sentiment Analysis)
6. ✅ Complete Epic 3.6 (Collaboration Scoring)
7. ✅ Complete Epic 3.7 (Multi-Step Agent) ← **MOST COMPLEX**
8. ✅ Complete Epic 3.8 (AI Chat Interface - if time)
9. ✅ Complete Epic 4.1 (Testing & Bug Fixes)
10. ✅ Complete Epic 4.2 (Submission Materials)

**Final Submission (Day 7):** All features complete, demo recorded, materials submitted.

---

## **DEPENDENCIES**

- Epic 2.2 (Messaging) blocks all other MVP features
- Epic 2.1 (Auth) must complete before 2.2
- Epic 3.1 (AI Infrastructure) must complete before any AI features
- Epic 3.7 (Agent) requires 3.2-3.4 (uses categorization, FAQ matching, response drafting)

---

## **NOTES FOR LLM IMPLEMENTATION**

- **Build vertically:** Finish one Epic completely before moving to next
- **Test constantly:** Test on real Android device after each task
- **Keep it simple:** Don't over-engineer. Ship working features fast.
- **Prioritize reliability:** Messaging must be rock-solid before adding AI
- **Cache aggressively:** Reduce Firestore reads and OpenAI calls where possible
- **Handle errors gracefully:** Network issues, permission denials, API failures
- **Log everything:** Use console.log liberally for debugging
- **Commit often:** Small, focused commits per task

**If blocked:** Note the blocker, move to next independent task, come back later.

**If running out of time:** Cut Epic 3.8 (AI Chat Interface), focus on core AI features.

