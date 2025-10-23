# MessageAI - WhatsApp Clone with AI Features

An AI-powered messaging platform designed for content creators to manage fan interactions at scale.

A full-featured real-time messaging app built with React Native and Firebase, designed for content creators to manage fan interactions with AI-powered assistance.

> **Note:** This project is built for evaluation against the [MessageAI Rubric](docs/MessageAI_Rubric.md).

## 🎯 Overview

MessageAI is a production-ready messaging platform with:
- **Real-time messaging** with sub-200ms delivery
- **Offline-first architecture** with automatic sync
- **Group chat** support with typing indicators and read receipts
- **Push notifications** for background/closed app states
- **AI-powered features** for content creator workflows

## 🛠️ Tech Stack

- **Frontend:** React Native (Expo), TypeScript, React Native Paper
- **Backend:** Firebase (Firestore, Cloud Functions, Storage, Auth, Realtime Database)
- **Local Storage:** Expo SQLite (offline persistence)
- **AI:** OpenAI GPT-4 (via Cloud Functions)
- **State Management:** Zustand
- **Notifications:** Expo Notifications + Firebase Cloud Messaging

## 🚀 Quick Start

### 1. Create `.env` file

Create a `.env` file in the project root with your Firebase configuration:

```bash
EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key_here
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
EXPO_PUBLIC_FIREBASE_DATABASE_URL=https://your_project.firebaseio.com
EXPO_PUBLIC_ENV=development
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Start Development Server

```bash
npm start
```

### 4. Run on Device

- Install **Expo Go** app on your Android device (from Google Play Store)
- Scan the QR code shown in the terminal
- Create an account or sign in to start messaging

## ✨ Implemented Features

### Core Messaging (35/35 points target)
- ✅ **Real-time messaging** with optimistic updates
- ✅ **Offline support** with local SQLite persistence and automatic sync
- ✅ **Group chats** with member management
- ✅ **Typing indicators** and online presence
- ✅ **Read receipts** for message tracking
- ✅ **Image sharing** with Firebase Storage
- ✅ **Connection status** indicators

### Mobile App Quality (20/20 points target)
- ✅ **App lifecycle handling** (background/foreground/force quit)
- ✅ **Push notifications** when app is closed
- ✅ **Optimistic UI** for instant message display
- ✅ **Keyboard handling** with proper input positioning
- ✅ **Profile management** with photo upload

### Authentication & Security
- ✅ **Email/password authentication** with Firebase Auth
- ✅ **Profile setup** with display name and photo
- ✅ **Secure Firebase rules** for Firestore, Storage, and Realtime Database
- ✅ **User presence tracking** (online/offline/last seen)

## 📁 Project Structure

```
/
├── app/                        # Expo Router screens
│   ├── (auth)/                # Authentication flow
│   │   ├── signin.tsx         # Sign in screen
│   │   ├── signup.tsx         # Sign up screen
│   │   └── profile-setup.tsx  # Profile creation
│   └── (app)/                 # Main app screens
│       ├── index.tsx          # Chat list
│       ├── chat/[chatId].tsx  # Individual chat screen
│       ├── new-chat.tsx       # Start new chat
│       ├── create-group.tsx   # Create group chat
│       └── edit-profile.tsx   # Edit user profile
├── components/                # Reusable UI components
│   ├── ChatListItem.tsx      # Chat preview in list
│   ├── MessageBubble.tsx     # Individual message display
│   ├── MessageInput.tsx      # Message composition
│   ├── TypingIndicator.tsx   # Typing animation
│   └── ConnectionBanner.tsx  # Offline/online indicator
├── services/                  # Backend services
│   ├── firebase.ts           # Firebase initialization
│   ├── auth.ts               # Authentication service
│   ├── chatService.ts        # Chat management
│   ├── messageService.ts     # Message operations
│   ├── userService.ts        # User profiles
│   ├── presenceService.ts    # Online/offline tracking
│   ├── typingService.ts      # Typing indicators
│   ├── notificationService.ts # Push notifications
│   └── sqlite.ts             # Local database
├── stores/                    # State management
│   └── authStore.ts          # Auth state (Zustand)
├── types/                     # TypeScript definitions
│   └── index.ts              # Message, Chat, User types
├── functions/                 # Firebase Cloud Functions
│   └── src/
│       ├── index.ts          # Entry point
│       └── notifications.ts  # Push notification triggers
└── docs/                      # Documentation
    └── MessageAI_Rubric.md   # Grading rubric
```

## 🔐 Security

Security rules have been deployed for:
- **Firestore:** Users can only read/write their own data and chats they're in
- **Storage:** Users can only upload to their own folders
- **Realtime Database:** Users can only update their own presence status

## 🤖 AI Features (In Development)

The following AI features are designed for content creators managing fan interactions:

1. **Auto-categorization** - Sort messages by type (fan/business/spam/urgent)
2. **Response drafting** - Generate replies matching creator's voice
3. **FAQ auto-responder** - Handle common questions automatically
4. **Sentiment analysis** - Flag concerning or priority messages
5. **Collaboration scoring** - Identify partnership opportunities
6. **Multi-step autonomous agent** - Complex workflow automation

> See [PRD.md](PRD.md) for detailed feature specifications.

### AI Rate Limiting

To prevent abuse and control costs, AI features are rate-limited:

- **Limit**: 100 AI calls per hour per user
- **Scope**: Applies to user-initiated AI calls (drafting, agent, AI chat)
- **Auto-triggers**: Categorization and FAQ detection are unlimited (essential UX)
- **Reset**: Automatically resets every hour

If you hit the limit, you'll see a friendly message telling you when you can try again.

**Affected Features:**
- ✅ Response drafting (Epic 3.3)
- ✅ AI Agent runs (Epic 3.7)
- ✅ AI Chat messages (Epic 3.8)
- ⚠️ Auto-categorization (Unlimited - happens automatically)
- ⚠️ FAQ detection (Unlimited - happens automatically)

## 📝 Development Commands

```bash
# Start Expo development server
npm start

# Kill all Expo/Metro processes (if stuck)
./kill-expo.sh

# Run on Android
npm run android

# Run on iOS (requires Mac)
npm run ios

# Build Cloud Functions
cd functions && npm run build

# Deploy security rules
firebase deploy --only firestore:rules,storage:rules,database:rules

# Deploy Cloud Functions
firebase deploy --only functions

# View Cloud Functions logs
firebase functions:log
```

## 📱 Testing & Deployment Options

Choose the appropriate testing method based on what features you need to verify:

### **Option 1: Local Development (Hot Reload)**

**Best for:** Daily development, instant updates, quick iteration

```bash
npm start
```

**On Physical Android:**
- Install "Expo Go" from Play Store
- Scan QR code from terminal
- ✅ Instant updates, hot reload
- ❌ Can't test notifications (Expo Go limitation)
- ⚠️ Terminal must stay running

**On Emulator:**
```bash
# Start emulator, then:
npm start
# Press 'a' to open on Android emulator
```

---

### **Option 2: Development Build (Full Testing)**

**Best for:** Testing notifications, full features

```bash
# One-time: Login to EAS
npx eas login

# Build APK (takes ~10-20 min)
eas build --profile development --platform android

# Install APK on phone, then:
npm start
# Press 's' to switch to development build
```

- ✅ Notifications work
- ✅ Still has hot reload
- ⚠️ Terminal must be running for updates

---

### **Option 3: Share with Others (Standalone)**

**Best for:** Letting friends/testers try your app

```bash
# Build standalone APK
eas build --profile preview --platform android

# Share the .apk file (Google Drive, email, etc.)
```

- ✅ Complete standalone app
- ✅ Works independently
- ❌ No hot reload
- ✅ Your terminal does NOT need to run

---

### **Quick Decision Tree:**

| I want to... | Command | Terminal Running? |
|-------------|---------|-------------------|
| Code and test quickly | `npm start` + Expo Go | ✅ Yes |
| Test notifications | `eas build --profile development` | ✅ Yes (for updates) |
| Share with friend | `eas build --profile preview` | ❌ No |
| Publish to Play Store | `eas build --profile production` | ❌ No |

---

## 🔧 Troubleshooting

### Port 8081 Already in Use
Run the kill script:
```bash
./kill-expo.sh
npm start
```

### Project Incompatible with Expo Go
Your packages need updating:
```bash
npx expo install --fix -- --legacy-peer-deps
```

### Firebase Connection Failed
- Check that `.env` file exists with correct values
- Verify Firebase project is created and services are enabled
- Check internet connection

### SQLite Errors
- Make sure Expo SQLite is installed: `npm install expo-sqlite`
- Restart the Expo development server

### App Won't Load
- Clear Expo cache: `expo start -c`
- Reinstall dependencies: `rm -rf node_modules && npm install`

## 📚 Documentation

- **[PRD.md](PRD.md)** - Product Requirements Document (features, tech stack, design decisions)
- **[TASK_LIST.md](TASK_LIST.md)** - Detailed task breakdown for all development phases
- **[docs/MessageAI_Rubric.md](docs/MessageAI_Rubric.md)** - Grading criteria and evaluation rubric
- **[docs/](docs/)** - Additional implementation guides and testing documentation

## 📊 Rubric Alignment

This project targets the following scoring breakdown:
- **Core Messaging Infrastructure** (35 points) - Real-time delivery, offline support, group chats
- **Mobile App Quality** (20 points) - Lifecycle handling, performance, UX
- **AI Features** (30 points) - 5 required features + advanced capability
- **Technical Implementation** (10 points) - Architecture, auth, data management
- **Documentation & Deployment** (5 points) - Repository setup, deployment

Target Grade: **A (90-100 points)**
