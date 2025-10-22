# MessageAI - WhatsApp Clone with AI Features

A full-featured messaging app built with React Native and Firebase, enhanced with AI-powered features for content creators.

## ✅ Phase 1: Setup Complete!

### What's Configured:

- ✅ **Expo React Native** project with TypeScript
- ✅ **Firebase** services connected:
  - Firestore (real-time database)
  - Storage (for images/media)
  - Realtime Database (for presence)
  - Authentication (email/password)
  - Cloud Functions (TypeScript)
- ✅ **SQLite** local database for offline storage
- ✅ **Security Rules** deployed
- ✅ **Project Structure** organized and ready

### Tech Stack:

- **Frontend:** React Native (Expo), TypeScript, React Native Paper
- **Backend:** Firebase (Firestore, Cloud Functions, Storage, Auth)
- **Local Storage:** Expo SQLite
- **AI:** OpenAI GPT-4 (via Cloud Functions) - will be added in Phase 3
- **State Management:** Zustand

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
- The app will launch with a test screen

### 5. Test Firebase Connection

On the test screen, press:
- **Test Firebase** - Verifies Firestore connection
- **Test SQLite** - Verifies local database works

Both should show ✅ status.

## 📁 Project Structure

```
/
├── app/                    # Expo Router screens
│   ├── _layout.tsx        # Root layout with providers
│   └── index.tsx          # Test screen (will become chat list)
├── components/            # Reusable UI components
├── services/              # Backend services
│   ├── firebase.ts        # Firebase SDK initialization
│   └── sqlite.ts          # Local database service
├── types/                 # TypeScript type definitions
│   └── index.ts           # Message, Chat, User types
├── utils/                 # Helper functions
├── constants/             # App constants
├── functions/             # Firebase Cloud Functions
│   └── src/
│       └── index.ts       # Cloud Functions entry point
├── firestore.rules        # Firestore security rules
├── storage.rules          # Storage security rules
├── database.rules.json    # Realtime DB security rules
└── firebase.json          # Firebase configuration
```

## 🔐 Security

Security rules have been deployed for:
- **Firestore:** Users can only read/write their own data and chats they're in
- **Storage:** Users can only upload to their own folders
- **Realtime Database:** Users can only update their own presence status

## 🧪 Testing Cloud Functions

Cloud Functions are initialized but not yet deployed. To deploy them:

```bash
cd functions
npm run build
cd ..
firebase deploy --only functions
```

## 📱 Next Steps (Phase 2: MVP Development)

1. Build authentication screens (sign up, sign in)
2. Create user profile setup
3. Implement 1:1 messaging
4. Add chat list
5. Build message UI with optimistic updates
6. Add read receipts & typing indicators
7. Implement group chats
8. Add push notifications
9. Support image messaging

## 🤖 AI Features (Phase 3)

After MVP is complete:
1. Auto-categorization (fan/business/spam/urgent)
2. Response drafting (matching creator's voice)
3. FAQ auto-responder
4. Sentiment analysis
5. Collaboration opportunity scoring
6. Multi-step autonomous agent

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

## 📱 How to Test the App

### **Option 1: Local Development (Hot Reload)**

**Best for:** Daily coding, instant updates

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

### "Port 8081 already in use"
Run the kill script:
```bash
./kill-expo.sh
npm start
```

### "Project is incompatible with this version of Expo Go"
Your packages need updating:
```bash
npx expo install --fix -- --legacy-peer-deps
```

## 🐛 Troubleshooting

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
- **[TASK_LIST.md](TASK_LIST.md)** - Detailed task breakdown for all phases
- **[docs/IMPLEMENTATION_GUIDE.md](docs/IMPLEMENTATION_GUIDE.md)** - Technical implementation details

## 🎯 Phase 1 Status: COMPLETE ✅

All setup tasks completed successfully! Ready to begin Phase 2 (MVP development).
