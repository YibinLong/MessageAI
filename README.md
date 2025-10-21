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

### Option 1: Test on Your Phone (Easiest)

1. **Install Expo Go:**
   - Download "Expo Go" from Google Play Store (Android)
   - Open the app

2. **Start the dev server:**
   ```bash
   npm start
   ```

3. **Connect to your app:**
   - **Android:** Open Expo Go → Tap "Scan QR code" → Scan the QR in terminal
   - **iOS:** Open Camera app → Point at QR code → Tap notification

4. **Make sure:** Your phone and computer are on the **same WiFi network**

### Option 2: Test in Web Browser (Quick Debugging)

1. **Start the dev server:**
   ```bash
   npm start
   ```

2. **Press `w` in the terminal** - Opens in your browser
   - Good for: Quick testing, seeing console errors
   - Note: Some mobile-specific features won't work

### Option 3: Use Android Emulator (Advanced)

**If you have Android Studio installed:**

1. **Start the emulator** in Android Studio
2. **Start the dev server:**
   ```bash
   npm start
   ```
3. **Press `a` in the terminal** - Automatically opens in emulator

**Don't have Android Studio?** Download from: https://developer.android.com/studio

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
