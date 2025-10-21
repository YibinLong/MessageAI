#!/bin/bash

# MessageAI - Kill Expo/Metro Processes
# This script stops all running Expo and Metro Bundler processes

echo "🛑 Stopping Expo and Metro Bundler processes..."

# Kill processes using port 8081 (Metro Bundler)
echo "Checking port 8081..."
lsof -ti:8081 | xargs kill -9 2>/dev/null && echo "✅ Killed processes on port 8081" || echo "ℹ️  No processes found on port 8081"

# Kill processes using port 8082 (sometimes used by Expo)
echo "Checking port 8082..."
lsof -ti:8082 | xargs kill -9 2>/dev/null && echo "✅ Killed processes on port 8082" || echo "ℹ️  No processes found on port 8082"

# Kill any running expo processes
echo "Killing Expo processes..."
pkill -f "expo start" 2>/dev/null && echo "✅ Killed Expo processes" || echo "ℹ️  No Expo processes found"

# Kill any running node processes related to Metro
echo "Killing Metro Bundler processes..."
pkill -f "react-native" 2>/dev/null && echo "✅ Killed React Native processes" || echo "ℹ️  No React Native processes found"
pkill -f "metro" 2>/dev/null && echo "✅ Killed Metro processes" || echo "ℹ️  No Metro processes found"

echo ""
echo "✨ Done! All Expo/Metro processes stopped."
echo "You can now run: npm start"

