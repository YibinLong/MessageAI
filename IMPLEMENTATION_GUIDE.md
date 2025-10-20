# **MessageAI - Implementation Guide**

*Quick reference for building tasks from TASK_LIST.md*

---

## **Tech Stack**

| Layer | Technology |
|-------|-----------|
| **Frontend** | React Native (Expo ~51.0.0) + TypeScript |
| **UI** | React Native Paper (Material Design 3) |
| **Local DB** | Expo SQLite |
| **Backend** | Firebase (Firestore, Cloud Functions, Auth, Storage, FCM) |
| **Presence** | Firebase Realtime Database |
| **AI** | OpenAI GPT-4 via Cloud Functions + AI SDK by Vercel |
| **State** | Zustand |

---

## **Core Data Models**

### **Firestore Schema**

```typescript
// /users/{userId}
{
  id: string
  email?: string
  phone?: string
  displayName: string
  photoURL?: string
  bio?: string
  online: boolean
  lastSeen: Timestamp
  createdAt: Timestamp
}

// /users/{userId}/chatIds/{chatId}
{ exists: true } // For querying user's chats

// /users/{userId}/tokens/{tokenId}
{ token: string, platform: 'android' | 'ios' } // FCM tokens

// /users/{userId}/faqs/{faqId}
{ question: string, answer: string, usageCount: number }

// /users/{userId}/agentSettings
{ enabled: boolean, enabledChats: string[], autoRespondFans: boolean, autoArchiveSpam: boolean }

// /users/{userId}/agentLogs/{logId}
{ timestamp: Timestamp, action: string, chatId: string, messageId?: string, reason?: string }

// /chats/{chatId}
{
  id: string
  type: '1:1' | 'group'
  participants: string[] // userIds
  name?: string // For groups
  photoURL?: string // For groups
  admins?: string[] // For groups
  lastMessage: {
    text: string
    senderId: string
    timestamp: Timestamp
  }
  updatedAt: Timestamp
  createdBy: string
}

// /chats/{chatId}/messages/{messageId}
{
  id: string
  chatId: string
  senderId: string
  type: 'text' | 'image'
  text?: string
  mediaURL?: string
  mediaPath?: string
  timestamp: Timestamp
  status: 'sending' | 'sent' | 'delivered' | 'read'
  readBy: string[]
  // AI fields (post-MVP)
  aiCategory?: 'fan' | 'business' | 'spam' | 'urgent'
  aiSentiment?: 'positive' | 'neutral' | 'negative'
  aiUrgency?: number // 1-5
  aiCollaborationScore?: number // 1-10
}

// /chats/{chatId}/typing/{userId}
{ isTyping: boolean, timestamp: Timestamp }
```

### **Firebase Realtime Database (Presence)**

```javascript
// /status/{userId}
{ online: boolean, lastSeen: number }
```

### **SQLite Schema**

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  displayName TEXT NOT NULL,
  photoURL TEXT,
  bio TEXT,
  online INTEGER DEFAULT 0,
  lastSeen INTEGER
);

CREATE TABLE chats (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT,
  photoURL TEXT,
  participants TEXT NOT NULL, -- JSON array
  lastMessageText TEXT,
  lastMessageSenderId TEXT,
  lastMessageTimestamp INTEGER,
  updatedAt INTEGER,
  synced INTEGER DEFAULT 0
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  chatId TEXT NOT NULL,
  senderId TEXT NOT NULL,
  type TEXT DEFAULT 'text',
  text TEXT,
  mediaURL TEXT,
  timestamp INTEGER NOT NULL,
  status TEXT NOT NULL,
  readBy TEXT, -- JSON array
  synced INTEGER DEFAULT 0
);

CREATE INDEX idx_messages_chatId ON messages(chatId, timestamp DESC);
CREATE INDEX idx_chats_updatedAt ON chats(updatedAt DESC);
```

---

## **Critical Patterns**

### **1. Send Message Flow (Offline-First)**

```typescript
// 1. Optimistic UI: Add to SQLite with status='sending'
await db.execAsync(`INSERT INTO messages ...`);
setMessages(prev => [...prev, newMessage]); // Show immediately

// 2. Sync to Firestore
try {
  await addDoc(collection(db, `chats/${chatId}/messages`), {
    ...newMessage,
    timestamp: serverTimestamp(),
    status: 'sent'
  });
  // 3. Update SQLite status
  await db.execAsync(`UPDATE messages SET status='sent', synced=1 WHERE id=?`, [messageId]);
} catch (error) {
  // Keep as 'sending', retry on reconnect
}
```

### **2. Receive Message Flow**

```typescript
// Firestore listener
onSnapshot(query(collection(db, `chats/${chatId}/messages`), orderBy('timestamp')), 
  (snapshot) => {
    snapshot.docChanges().forEach(async (change) => {
      if (change.type === 'added') {
        const msg = change.doc.data();
        // Write to SQLite
        await db.execAsync(`INSERT OR REPLACE INTO messages ...`);
        // Update UI
        setMessages(prev => [...prev, msg]);
        // Mark as delivered
        if (msg.senderId !== currentUserId) {
          await updateDoc(doc(db, `chats/${chatId}/messages/${msg.id}`), {
            status: 'delivered'
          });
        }
      }
    });
  }
);
```

### **3. Read Receipts**

```typescript
// When user opens chat or scrolls to message
const markAsRead = async (chatId: string, messageIds: string[]) => {
  const batch = writeBatch(db);
  messageIds.forEach(msgId => {
    batch.update(doc(db, `chats/${chatId}/messages/${msgId}`), {
      status: 'read',
      readBy: arrayUnion(currentUserId)
    });
  });
  await batch.commit();
};
```

### **4. Typing Indicators**

```typescript
// Debounced (500ms)
const updateTypingStatus = debounce(async (isTyping: boolean) => {
  await setDoc(doc(db, `chats/${chatId}/typing/${currentUserId}`), {
    isTyping,
    timestamp: serverTimestamp()
  });
  // Auto-clear after 3s
  if (isTyping) {
    setTimeout(() => updateTypingStatus(false), 3000);
  }
}, 500);
```

### **5. Presence (Realtime DB)**

```typescript
import { ref, onValue, onDisconnect, set } from 'firebase/database';

// On app foreground
const presenceRef = ref(rtdb, `status/${userId}`);
await set(presenceRef, { online: true, lastSeen: Date.now() });

// Auto-set offline on disconnect
onDisconnect(presenceRef).set({ online: false, lastSeen: Date.now() });

// Listen to presence
onValue(ref(rtdb, `status/${userId}`), (snapshot) => {
  const status = snapshot.val();
  updateUI(status);
});
```

### **6. Image Upload**

```typescript
import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

// 1. Pick & compress
const result = await ImagePicker.launchImageLibraryAsync({
  mediaTypes: ImagePicker.MediaTypeOptions.Images,
  quality: 0.7, // Compress
  allowsEditing: true
});

// 2. Upload with progress
const storageRef = ref(storage, `media/${userId}/${messageId}.jpg`);
const uploadTask = uploadBytesResumable(storageRef, blob);

uploadTask.on('state_changed', 
  (snapshot) => {
    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
    setUploadProgress(progress);
  },
  (error) => { /* handle */ },
  async () => {
    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
    // 3. Create message with mediaURL
    await sendMessage({ type: 'image', mediaURL: downloadURL });
  }
);
```

---

## **AI Implementation Patterns**

### **Cloud Function Structure**

```typescript
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';

export const categorizeMessage = onDocumentCreated(
  'chats/{chatId}/messages/{messageId}',
  async (event) => {
    const message = event.data?.data();
    
    const result = await generateObject({
      model: openai('gpt-4'),
      schema: z.object({
        category: z.enum(['fan', 'business', 'spam', 'urgent']),
        sentiment: z.enum(['positive', 'neutral', 'negative']),
        urgency: z.number().min(1).max(5),
        collaborationScore: z.number().min(1).max(10)
      }),
      prompt: `You are analyzing DMs for a content creator. Categorize this message:\n\n"${message.text}"\n\nConsider: tone, intent, potential business value.`
    });
    
    await event.data.ref.update({
      aiCategory: result.object.category,
      aiSentiment: result.object.sentiment,
      aiUrgency: result.object.urgency,
      aiCollaborationScore: result.object.collaborationScore
    });
  }
);
```

### **Response Drafting (RAG)**

```typescript
export const draftResponse = onCall(async (request) => {
  const { chatId, messageText, userId } = request.data;
  
  // 1. Retrieve creator's past messages (RAG)
  const pastMessages = await admin.firestore()
    .collectionGroup('messages')
    .where('senderId', '==', userId)
    .orderBy('timestamp', 'desc')
    .limit(10)
    .get();
  
  const context = pastMessages.docs.map(d => d.data().text).join('\n');
  
  // 2. Generate responses
  const result = await generateObject({
    model: openai('gpt-4'),
    schema: z.object({
      responses: z.array(z.string()).length(3)
    }),
    prompt: `You are the creator. Draft 3 reply variations matching your style:\n\nYour past messages:\n${context}\n\nNew message to reply to:\n"${messageText}"`
  });
  
  return { drafts: result.object.responses };
});
```

### **Multi-Step Agent**

```typescript
import { generateText } from 'ai';

export const aiAgent = onSchedule('every 5 minutes', async (event) => {
  // Get all creators with agent enabled
  const users = await admin.firestore().collection('users')
    .where('agentSettings.enabled', '==', true).get();
  
  for (const userDoc of users.docs) {
    const userId = userDoc.id;
    
    // Get unread messages
    const unreadMessages = await getUnreadMessages(userId);
    
    for (const msg of unreadMessages) {
      // Use AI SDK with tools
      const result = await generateText({
        model: openai('gpt-4'),
        prompt: `You are an AI assistant managing DMs for a content creator. Handle this message: "${msg.text}"`,
        tools: {
          categorizeMessage: { /* ... */ },
          matchFAQ: { /* ... */ },
          sendResponse: { /* ... */ },
          flagForReview: { /* ... */ },
          archiveChat: { /* ... */ }
        }
      });
      
      // Log action
      await admin.firestore().collection(`users/${userId}/agentLogs`).add({
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        action: result.toolCalls[0].toolName,
        chatId: msg.chatId,
        messageId: msg.id
      });
    }
  }
});
```

---

## **Security Rules (Firestore)**

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

---

## **Key Dependencies**

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

**Cloud Functions:**
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

---

## **Performance Rules**

- **Pagination:** Load 20 messages per page
- **Debouncing:** Typing indicators 500ms, presence updates 1s
- **Caching:** Store user profiles in Zustand, avoid repeated Firestore reads
- **Image compression:** Max 1MB before upload
- **Firestore indexes:** 
  - `chats` by `updatedAt`
  - `messages` by `chatId + timestamp`
- **Batch writes:** Use `writeBatch()` for multiple updates
- **Offline queue:** Retry failed operations on reconnect

---

## **Common Pitfalls**

1. **Timestamp conflicts:** Always use `serverTimestamp()` for Firestore, never `Date.now()`
2. **Listener leaks:** Unsubscribe from Firestore listeners in cleanup (`useEffect` return)
3. **SQLite transactions:** Wrap bulk inserts in transactions for speed
4. **Read receipt loops:** Only update if status actually changes
5. **AI costs:** Cache common responses, batch requests, set rate limits
6. **FCM tokens:** Update on app launch, handle token refresh
7. **Presence edge case:** User closes app without triggering `onDisconnect` → use heartbeat fallback
8. **Group chat receipts:** Use counts, not individual checkmarks (UX overload)

---

## **Testing Checklist**

- [ ] Send message online → appears instantly both devices
- [ ] Send message offline → queues → syncs on reconnect
- [ ] Receive message while app closed → FCM notification → tap → opens chat
- [ ] Read receipts update correctly (sending → sent → delivered → read)
- [ ] Typing indicator appears/disappears correctly
- [ ] Group chat (3+ users) all features work
- [ ] Image upload with progress, displays correctly
- [ ] Presence updates within 5 seconds
- [ ] App force-quit → reopen → all data persists
- [ ] AI categorization runs on new messages
- [ ] Agent handles messages correctly without user interaction

---

## **Environment Variables**

### Frontend `.env`
```bash
EXPO_PUBLIC_FIREBASE_API_KEY=AIza...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=messageai-xxx.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=messageai-xxx
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=messageai-xxx.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
EXPO_PUBLIC_FIREBASE_APP_ID=1:123456789:android:abc123
```

### Cloud Functions
```bash
# Set via: firebase functions:config:set openai.key="sk-proj-..."
OPENAI_API_KEY=sk-proj-...
```

---

## **Build Commands**

```bash
# Local development
npm start

# Firebase emulators
firebase emulators:start

# Deploy functions
firebase deploy --only functions

# Build Android APK
eas build --profile preview --platform android

# View function logs
firebase functions:log --only categorizeMessage
```

---

**Remember:** Build vertically (one feature at a time), test on real device constantly, keep it simple.

