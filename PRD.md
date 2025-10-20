# **MessageAI - WhatsApp Clone PRD**

## **1. Project Summary**

Build a WhatsApp-like messaging app for **Content Creators/Influencers** to manage hundreds of DMs efficiently with AI assistance. 

**MVP Scope:** Real-time 1:1 chat, group chat, offline persistence, read receipts, push notifications, optimistic UI, online/offline status.

**Full Scope:** MVP + 5 AI features (auto-categorization, response drafting, FAQ auto-responder, sentiment analysis, collaboration scoring) + Multi-Step Agent (handles daily DMs autonomously).

---

## **2. Core Goals**

- Users can send/receive messages in real-time across devices
- Messages persist locally and sync when online
- Group chats work with 3+ participants
- Read receipts and typing indicators function reliably
- AI categorizes messages (fan/business/spam/urgent) automatically
- AI drafts responses matching creator's voice
- AI agent handles FAQs and flags important messages autonomously

---

## **3. Non-Goals (MVP)**

- ❌ AI features (add post-MVP)
- ❌ Voice/video calls
- ❌ Message reactions/emoji picker
- ❌ Stories/Status updates
- ❌ End-to-end encryption (E2EE)
- ❌ Message editing/deletion
- ❌ Custom themes
- ❌ Advanced media (videos, documents, locations)
- ❌ Web/Desktop apps

---

## **4. Tech Stack**

| Layer | Technology | Why |
|-------|-----------|-----|
| **Frontend** | React Native (Expo) | Cross-platform, fast iteration, great DX |
| **UI Components** | React Native Paper + custom | Material Design 3 for Android WhatsApp look |
| **Local DB** | Expo SQLite | Offline persistence, query flexibility |
| **Backend** | Firebase (Firestore, Cloud Functions) | Real-time sync, serverless, handles presence |
| **Auth** | Firebase Auth (Phone + Email) | Built-in, production-ready |
| **Push** | Firebase Cloud Messaging (FCM) | Native notifications via Expo |
| **Storage** | Firebase Storage | Profile pics, media uploads |
| **AI** | OpenAI GPT-4 via Cloud Functions | Creator-focused AI, function calling support |
| **AI Framework** | AI SDK by Vercel (in Cloud Functions) | Clean API, streaming, tool use, works great with OpenAI |
| **Deployment** | Expo EAS Build → APK/AAB | Android priority, TestFlight later |

**Assumption:** User has OpenAI API key. AI calls happen server-side (Cloud Functions) to keep keys secure.

---

## **5. Feature Breakdown — Vertical Slices**

### **MVP-1: Basic Messaging**

**User Story:** As a creator, I want to send/receive text messages in real-time so I can communicate with fans.

**Acceptance Criteria:**
- [ ] Send text message → appears instantly (optimistic UI)
- [ ] Message persists in local SQLite
- [ ] Message syncs to Firestore
- [ ] Recipient receives message in real-time via Firestore listener
- [ ] Message shows states: sending → sent → delivered → read
- [ ] Works offline (queued messages send on reconnect)
- [ ] Timestamps display (relative: "2m ago", absolute: "10:45 AM")

**Data Model:**
```typescript
// Firestore: /chats/{chatId}/messages/{messageId}
{
  id: string
  chatId: string
  senderId: string
  text: string
  timestamp: Timestamp
  status: 'sending' | 'sent' | 'delivered' | 'read'
  readBy: string[] // userIds who read it
}

// SQLite: messages table
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  chatId TEXT NOT NULL,
  senderId TEXT NOT NULL,
  text TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  status TEXT NOT NULL,
  readBy TEXT, -- JSON array
  synced INTEGER DEFAULT 0
)
```

**API Endpoints:** None (direct Firestore SDK in React Native)

**Edge Cases:**
- No internet: queue in SQLite, show "sending" indicator
- App backgrounded: FCM delivers notification
- Rapid messages: batch writes, optimistic UI per message
- Concurrent edits: Firestore timestamp wins

---

### **MVP-2: User Profiles & Auth**

**User Story:** As a creator, I want to sign in and see my profile so others recognize me.

**Acceptance Criteria:**
- [ ] Phone number auth (OTP) or email/password
- [ ] Profile setup: display name, profile picture, bio
- [ ] Profile pictures upload to Firebase Storage
- [ ] Other users see my name/photo in chats

**Data Model:**
```typescript
// Firestore: /users/{userId}
{
  id: string
  phone?: string
  email?: string
  displayName: string
  photoURL?: string
  bio?: string
  createdAt: Timestamp
  lastSeen: Timestamp
  online: boolean
}
```

**Edge Cases:**
- Duplicate phone numbers: Firebase Auth handles
- Missing profile pic: show initials avatar
- Large images: compress before upload (max 1MB)

---

### **MVP-3: Chat List & Conversations**

**User Story:** As a creator, I want to see all my conversations in one place so I can manage DMs.

**Acceptance Criteria:**
- [ ] Chat list shows: contact name, last message preview, timestamp, unread count
- [ ] Sorted by most recent message first
- [ ] Tap chat → open conversation screen
- [ ] Pull-to-refresh updates chat list
- [ ] Works offline (shows cached data)

**Data Model:**
```typescript
// Firestore: /chats/{chatId}
{
  id: string
  type: '1:1' | 'group'
  participants: string[] // userIds
  lastMessage: {
    text: string
    senderId: string
    timestamp: Timestamp
  }
  updatedAt: Timestamp
  createdBy: string
}

// Firestore: /users/{userId}/chatIds (for querying user's chats)
{
  [chatId]: true
}
```

---

### **MVP-4: Read Receipts & Typing Indicators**

**User Story:** As a creator, I want to see when fans read my messages and when they're typing.

**Acceptance Criteria:**
- [ ] Double checkmark (✓✓) shows when message delivered
- [ ] Blue checkmarks show when read
- [ ] Typing indicator appears when other person is typing
- [ ] Typing indicator disappears after 3s of inactivity

**Data Model:**
```typescript
// Firestore: /chats/{chatId}/typing/{userId}
{
  isTyping: boolean
  timestamp: Timestamp
}
// Use Firestore TTL or manual cleanup
```

**Implementation:**
- Listen to `onChangeText` → debounce → update Firestore typing status
- Listen to typing collection → show "User is typing..." banner

---

### **MVP-5: Group Chats**

**User Story:** As a creator, I want to message multiple people at once for collaborations.

**Acceptance Criteria:**
- [ ] Create group with 3+ participants
- [ ] Group name and optional group photo
- [ ] All participants see messages in real-time
- [ ] Message shows sender name/photo (since multiple senders)
- [ ] Read receipts show count: "Read by 3"

**Data Model:**
```typescript
// Firestore: /chats/{chatId}
{
  type: 'group'
  name: string
  photoURL?: string
  participants: string[]
  admins: string[] // creators who can add/remove members
  ...
}
```

---

### **MVP-6: Push Notifications**

**User Story:** As a creator, I want to receive notifications when I get new messages.

**Acceptance Criteria:**
- [ ] Notification shows: sender name, message preview
- [ ] Tap notification → open conversation
- [ ] Works when app is backgrounded or closed
- [ ] Works in foreground (optional toast)
- [ ] User can enable/disable notifications per chat

**Implementation:**
- Firebase Cloud Function triggers on new message
- Sends FCM notification to recipient's device tokens
- Store device tokens in Firestore `/users/{userId}/tokens`

---

### **MVP-7: Online/Offline Presence**

**User Story:** As a creator, I want to see if fans are online.

**Acceptance Criteria:**
- [ ] Green dot shows when user is online
- [ ] "Last seen" timestamp shows when user was last active
- [ ] Updates within 5 seconds of status change

**Implementation:**
- Use Firebase Realtime Database for presence (more reliable than Firestore)
- Update `lastSeen` on app foreground/background
- Listen to `/status/{userId}` for online status

---

### **MVP-8: Media Support (Images)**

**User Story:** As a creator, I want to send/receive images in chats.

**Acceptance Criteria:**
- [ ] Pick image from gallery
- [ ] Image uploads to Firebase Storage
- [ ] Image displays inline in chat (thumbnail + full view on tap)
- [ ] Shows upload progress
- [ ] Works offline (queued uploads)

**Data Model:**
```typescript
// Extend messages table/collection
{
  ...message,
  type: 'text' | 'image'
  mediaURL?: string // Firebase Storage URL
  mediaPath?: string // Storage path for deletion
  uploadProgress?: number // 0-100, local only
}
```

---

## **6. Post-MVP AI Features**

### **AI-1: Auto-Categorization**

**User Story:** As a creator with 100+ daily DMs, I want messages auto-tagged so I can prioritize.

**Acceptance Criteria:**
- [ ] Each message gets category: `fan`, `business`, `spam`, `urgent`
- [ ] Categories display as colored tags in chat list
- [ ] Filter chats by category
- [ ] AI runs on new message arrival (Cloud Function)

**Implementation:**
- Cloud Function triggers on message create
- Call OpenAI GPT-4 with prompt: "Categorize this DM for a content creator: {message text}"
- Use function calling to return structured category
- Store in message doc: `aiCategory: 'fan' | 'business' | 'spam' | 'urgent'`

---

### **AI-2: Response Drafting (Creator Voice)**

**User Story:** As a creator, I want AI to draft replies matching my style.

**Acceptance Criteria:**
- [ ] "Draft Reply" button in chat
- [ ] AI generates 3 reply options based on conversation history
- [ ] User can pick, edit, or regenerate
- [ ] AI learns from creator's past messages (RAG pipeline)

**Implementation:**
- RAG: Vector embeddings of creator's past messages (OpenAI embeddings API)
- Store in Firestore `/users/{userId}/messageEmbeddings`
- On "Draft Reply": retrieve similar past messages → pass to GPT-4 with prompt:
  - "You are {creator name}. Draft a reply to this message matching their tone and style."
- Return 3 variations

---

### **AI-3: FAQ Auto-Responder**

**User Story:** As a creator, I want AI to answer common questions automatically.

**Acceptance Criteria:**
- [ ] Creator can define FAQs in settings (Q&A pairs)
- [ ] AI detects if incoming message matches FAQ
- [ ] Auto-sends response or suggests response to creator
- [ ] Tracks which FAQs are used most

**Implementation:**
- Store FAQs in Firestore `/users/{userId}/faqs`
- On new message: Cloud Function calls GPT-4 with FAQ list:
  - "Does this message match any of these FAQs? If yes, which one?"
- Use function calling to return FAQ ID
- Auto-send or show suggestion

---

### **AI-4: Sentiment Analysis**

**User Story:** As a creator, I want to see if messages are positive, negative, or neutral.

**Acceptance Criteria:**
- [ ] Each message shows sentiment icon (😊😐😞)
- [ ] Can filter by sentiment
- [ ] Urgent negative messages flagged

**Implementation:**
- Cloud Function on message create
- GPT-4 prompt: "Analyze sentiment: {message text}"
- Function calling returns: `{ sentiment: 'positive' | 'neutral' | 'negative', urgency: 1-5 }`
- Store in message doc

---

### **AI-5: Collaboration Opportunity Scoring**

**User Story:** As a creator, I want to identify business opportunities in DMs.

**Acceptance Criteria:**
- [ ] Messages scored 1-10 for collaboration potential
- [ ] High-score messages highlighted in chat list
- [ ] Can filter by score threshold

**Implementation:**
- GPT-4 prompt: "Rate this DM's collaboration potential for a content creator (1-10)"
- Looks for: brand mentions, payment offers, collab keywords
- Store score in message doc

---

### **AI-6: Multi-Step Agent (Advanced Feature)**

**User Story:** As a creator with 200+ daily DMs, I want an AI agent to handle routine messages autonomously.

**Acceptance Criteria:**
- [ ] Agent runs every 5 minutes (Cloud Scheduler)
- [ ] Reads unread messages, categorizes, and acts:
  - Fan messages → auto-respond with friendly reply
  - FAQs → auto-respond with FAQ answer
  - Business/urgent → flag for creator review (notification)
  - Spam → auto-archive
- [ ] Agent logs actions in Firestore
- [ ] Creator can enable/disable agent per chat
- [ ] Creator reviews agent actions in "Agent Activity" screen

**Implementation:**
- Cloud Function triggered by Cloud Scheduler (every 5 min)
- Query unread messages for creator
- AI SDK multi-step workflow:
  1. Categorize message (tool: `categorizeMessage`)
  2. Check if FAQ match (tool: `matchFAQ`)
  3. Draft response if needed (tool: `draftResponse`)
  4. Send message or flag for review (tools: `sendMessage`, `flagForReview`)
- Store agent logs: `/users/{userId}/agentLogs/{logId}`

**Tools for Agent:**
```typescript
tools: [
  categorizeMessage({ messageId, chatId }),
  matchFAQ({ messageText }),
  draftResponse({ chatId, messageText, conversationHistory }),
  sendMessage({ chatId, text }),
  flagForReview({ chatId, messageId, reason }),
  archiveChat({ chatId })
]
```

---

## **7. System Design**

**Flow:**
1. **Frontend (React Native + Expo):** UI, local SQLite cache, Firestore listeners for real-time sync
2. **Firestore:** Real-time DB for messages, chats, users, presence
3. **Cloud Functions:** AI processing (categorization, drafting, agent), push notifications, background jobs
4. **Firebase Storage:** Media uploads (images, profile pics)
5. **Firebase Realtime Database:** Online/offline presence (more reliable than Firestore for presence)
6. **OpenAI API (via Cloud Functions):** GPT-4 for all AI features, AI SDK for agent orchestration

**Data Flow (Send Message):**
- User types → optimistic UI adds to SQLite + screen
- React Native writes to Firestore `/chats/{chatId}/messages/{messageId}`
- Firestore listener on recipient's device triggers → message appears
- Cloud Function triggers → AI categorization → updates message doc
- FCM sends push notification if recipient offline

**Offline Handling:**
- SQLite stores all messages locally
- On app open: sync SQLite ↔ Firestore (conflict resolution: server timestamp wins)
- Queued messages (status: 'sending') retry on reconnect

---

## **8. Detailed Requirements**

### **Core Libraries**

```json
{
  "dependencies": {
    "expo": "~51.0.0",
    "expo-router": "~3.5.0",
    "react-native-paper": "^5.12.0",
    "expo-sqlite": "~14.0.0",
    "firebase": "^10.12.0",
    "@react-native-firebase/app": "^20.0.0",
    "@react-native-firebase/firestore": "^20.0.0",
    "@react-native-firebase/auth": "^20.0.0",
    "@react-native-firebase/storage": "^20.0.0",
    "@react-native-firebase/messaging": "^20.0.0",
    "expo-image-picker": "~15.0.0",
    "expo-notifications": "~0.28.0",
    "date-fns": "^3.0.0",
    "zustand": "^4.5.0"
  }
}
```

### **Cloud Functions Libraries**

```json
{
  "dependencies": {
    "firebase-functions": "^5.0.0",
    "firebase-admin": "^12.0.0",
    "ai": "^3.1.0",
    "openai": "^4.47.0",
    "zod": "^3.23.0"
  }
}
```

### **Validation**

- Use Zod for API payloads in Cloud Functions
- Example: `messageSchema = z.object({ chatId: z.string(), text: z.string().max(10000) })`

### **Security Rules (Firestore)**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId;
    }
    
    match /chats/{chatId} {
      allow read: if request.auth.uid in resource.data.participants;
      allow create: if request.auth != null;
      allow update: if request.auth.uid in resource.data.participants;
      
      match /messages/{messageId} {
        allow read: if request.auth.uid in get(/databases/$(database)/documents/chats/$(chatId)).data.participants;
        allow create: if request.auth.uid in get(/databases/$(database)/documents/chats/$(chatId)).data.participants;
      }
    }
  }
}
```

### **Performance**

- Paginate messages (20 per page)
- Index Firestore: `chats` by `updatedAt`, `messages` by `chatId + timestamp`
- Compress images before upload (max 1MB)
- Debounce typing indicators (500ms)
- Cache user profiles in Zustand store (avoid repeated Firestore reads)

---

## **9. Environment Setup**

### **Frontend `.env`**

```bash
# Firebase Config (from Firebase Console)
EXPO_PUBLIC_FIREBASE_API_KEY=AIza...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=messageai-xxx.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=messageai-xxx
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=messageai-xxx.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
EXPO_PUBLIC_FIREBASE_APP_ID=1:123456789:android:abc123

# Environment
EXPO_PUBLIC_ENV=development # or production
```

**How to get:** Firebase Console → Project Settings → Your apps → Config object

### **Cloud Functions `.env`**

```bash
# OpenAI API Key
OPENAI_API_KEY=sk-proj-...

# Firebase Project (auto-set by Firebase CLI)
FIREBASE_CONFIG={"projectId":"messageai-xxx",...}

# Environment
NODE_ENV=development # or production
```

**How to get OpenAI key:** https://platform.openai.com/api-keys

**Set in Cloud Functions:**
```bash
firebase functions:config:set openai.key="sk-proj-..."
```

---

## **10. `.gitignore`**

```gitignore
# Expo
.expo/
.expo-shared/
dist/
web-build/
expo-env.d.ts

# Node
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Environment
.env
.env.local
.env.*.local
.runtimeconfig.json

# Firebase
.firebase/
firebase-debug.log
firestore-debug.log
ui-debug.log
functions/.runtimeconfig.json

# SQLite
*.db
*.db-journal

# OS
.DS_Store
*.swp
*.swo
*~

# IDE
.vscode/
.idea/
*.iml

# Testing
coverage/

# Builds
*.apk
*.aab
*.ipa
```

---

## **11. Testing & QA**

### **Test Framework**

- **Frontend:** Jest + React Native Testing Library
- **Cloud Functions:** Jest + Firebase emulators

### **Test Strategy**

**MVP Phase:** Manual testing only (speed > coverage)
- Test on real Android device
- Test scenarios:
  1. Send message (online)
  2. Send message (offline → online)
  3. Receive message (foreground/background/closed)
  4. Group chat (3+ users)
  5. Read receipts
  6. Typing indicators
  7. Image upload

**Post-MVP:** Add unit tests for AI features
- Test AI categorization accuracy
- Test FAQ matching
- Test agent decision logic

### **Sample Test**

```typescript
// functions/src/__tests__/categorizeMessage.test.ts
import { categorizeMessage } from '../ai/categorize';

describe('categorizeMessage', () => {
  it('categorizes fan message correctly', async () => {
    const result = await categorizeMessage('OMG love your videos!! 🔥');
    expect(result.category).toBe('fan');
  });
  
  it('categorizes business message correctly', async () => {
    const result = await categorizeMessage('Hi, I represent Brand X. Interested in a collaboration?');
    expect(result.category).toBe('business');
  });
});
```

### **Run Commands**

```bash
# Frontend
npm test

# Cloud Functions
cd functions && npm test

# Firebase Emulators (full local stack)
firebase emulators:start
```

---

## **12. Debugging & Logging**

### **Frontend Logging**

```typescript
// utils/logger.ts
export const log = {
  info: (msg: string, data?: any) => {
    if (__DEV__) console.log(`[INFO] ${msg}`, data);
  },
  error: (msg: string, error?: any) => {
    console.error(`[ERROR] ${msg}`, error);
    // TODO: Send to Sentry in production
  },
  debug: (msg: string, data?: any) => {
    if (__DEV__) console.debug(`[DEBUG] ${msg}`, data);
  }
};
```

### **Cloud Functions Logging**

```typescript
import { logger } from 'firebase-functions';

logger.info('Message categorized', { messageId, category });
logger.error('AI call failed', { error });
```

**View logs:**
```bash
firebase functions:log --only categorizeMessage
```

### **Enable Debug Mode**

```bash
# Expo
EXPO_PUBLIC_DEBUG=true npm start

# Firebase Emulators
firebase emulators:start --inspect-functions
```

---

## **13. External Setup Instructions**

### **Firebase Setup**

1. **Create Firebase Project:**
   - Go to https://console.firebase.google.com
   - Click "Add project" → Name: "MessageAI" → Enable Google Analytics (optional)

2. **Enable Services:**
   - **Authentication:** Enable "Phone" and "Email/Password" providers
   - **Firestore:** Create database (start in test mode, update security rules later)
   - **Storage:** Enable (start in test mode)
   - **Realtime Database:** Enable (for presence)
   - **Cloud Functions:** Upgrade to Blaze plan (required for external API calls)
   - **Cloud Messaging:** Automatically enabled

3. **Add Android App:**
   - Click "Add app" → Android
   - Package name: `com.yourname.messageai` (must match `app.json`)
   - Download `google-services.json` → place in `android/app/`

4. **Add iOS App (later):**
   - Click "Add app" → iOS
   - Bundle ID: `com.yourname.messageai`
   - Download `GoogleService-Info.plist` → place in `ios/`

5. **Get Config:**
   - Project Settings → Your apps → SDK setup and configuration → Config object
   - Copy to `.env` as shown in section 9

6. **Deploy Security Rules:**
   ```bash
   firebase deploy --only firestore:rules
   firebase deploy --only storage:rules
   ```

### **OpenAI Setup**

1. Go to https://platform.openai.com/api-keys
2. Click "Create new secret key" → Name: "MessageAI"
3. Copy key (starts with `sk-proj-...`)
4. Add to Cloud Functions:
   ```bash
   firebase functions:config:set openai.key="sk-proj-..."
   ```
5. Set billing limit (recommended: $10/month for testing)

### **Expo Setup**

1. Install Expo CLI:
   ```bash
   npm install -g expo-cli eas-cli
   ```

2. Create Expo account: https://expo.dev/signup

3. Login:
   ```bash
   expo login
   ```

4. Link project:
   ```bash
   expo init messageai --template blank-typescript
   cd messageai
   eas init
   ```

5. Configure EAS Build (`eas.json`):
   ```json
   {
     "build": {
       "development": {
         "developmentClient": true,
         "distribution": "internal"
       },
       "preview": {
         "distribution": "internal",
         "android": {
           "buildType": "apk"
         }
       },
       "production": {
         "android": {
           "buildType": "apk"
         }
       }
     }
   }
   ```

---

## **14. CORS Configuration**

Not needed for this architecture (React Native calls Firebase SDK directly, Cloud Functions call OpenAI server-side).

If building web version later: Enable CORS in Cloud Functions:
```typescript
import * as cors from 'cors';
const corsHandler = cors({ origin: true });
```

---

## **15. Deployment Plan**

### **Local Development**

```bash
# 1. Install dependencies
npm install
cd functions && npm install && cd ..

# 2. Start Firebase emulators
firebase emulators:start

# 3. Start Expo (in new terminal)
npm start

# 4. Scan QR code with Expo Go app on Android
```

### **Production Deployment**

#### **Backend (Cloud Functions)**

```bash
# Deploy all functions
firebase deploy --only functions

# Deploy specific function
firebase deploy --only functions:categorizeMessage

# View logs
firebase functions:log
```

#### **Frontend (Android APK)**

```bash
# Build preview APK
eas build --profile preview --platform android

# Download APK (link provided after build)
# Install on Android device
```

**Required Environment Variables (EAS):**
- Set in Expo dashboard or `eas.json`
- All `EXPO_PUBLIC_*` vars from `.env`

#### **iOS (later)**

```bash
# Build for TestFlight
eas build --profile production --platform ios

# Submit to TestFlight
eas submit --platform ios
```

### **Database Migrations**

No explicit migrations needed (NoSQL). Schema changes:
1. Add new fields to Firestore docs (backward compatible)
2. Write Cloud Function to backfill existing docs if needed
3. Update security rules

---

## **16. Stretch Goals (Post-MVP + AI)**

**After all MVP + AI features are done:**

- [ ] Message reactions (👍❤️😂)
- [ ] Voice messages
- [ ] Video messages
- [ ] Message forwarding
- [ ] Message search (full-text)
- [ ] Dark mode
- [ ] Custom chat wallpapers
- [ ] Disappearing messages
- [ ] Archived chats
- [ ] Muted chats
- [ ] Pin chats to top
- [ ] Block/report users
- [ ] Export chat history
- [ ] Web app (via Expo Web)
- [ ] Desktop app (Electron)
- [ ] Message translation (inline, any language)
- [ ] Voice-to-text (for accessibility)
- [ ] Analytics dashboard (for creators)
- [ ] Monetization (premium features)

---

## **Key Technical Decisions**

1. **SQLite + Firestore Dual Storage:** SQLite for offline-first UX, Firestore for real-time sync. Trade-off: sync complexity, but necessary for robust offline support.

2. **AI in Cloud Functions (not frontend):** Keeps OpenAI API key secure, allows batching, easier to update prompts. Trade-off: latency, but worth it for security.

3. **React Native Paper:** Pre-built Material Design 3 components → faster Android WhatsApp look. Trade-off: less customization than fully custom components.

4. **Firebase over custom backend:** Real-time, presence, auth, push all built-in. Trade-off: vendor lock-in, but massive time savings for solo dev.

5. **AI SDK by Vercel:** Cleaner API than raw OpenAI SDK, built-in streaming and tool use. Trade-off: adds dependency, but makes agent code much simpler.

6. **Expo (not bare React Native):** Managed workflow, EAS Build, OTA updates. Trade-off: some native modules unavailable, but way faster to ship.

---

## **Next Steps**

1. **Create Firebase project** (see section 13)
2. **Set up local environment** (section 9, 15)
3. **Build MVP features in order** (section 5: MVP-1 → MVP-8)
4. **Test on real Android device** after each feature
5. **Deploy backend** (Cloud Functions)
6. **Build Android APK** (EAS Build)
7. **Implement AI features** (section 6: AI-1 → AI-6)
8. **Record demo video** (show all features)
9. **Write Persona Brainlift doc**
10. **Submit & share on social media**

**MVP Target:** Complete MVP-1 through MVP-8 in 24 hours (focus on core messaging reliability).

**Full Target:** Complete all AI features within 7 days.

---

**Remember:** Vertical slices. Don't parallelize features. Finish one fully before starting the next. Test on real device constantly.

