module.exports = {
  expo: {
    name: "MessageAI",
    slug: "messageai",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    scheme: "messageai",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    assetBundlePatterns: ["**/*"],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.messageai.app"
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      package: "com.messageai.app",
      permissions: [
        "android.permission.CAMERA",
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.READ_MEDIA_IMAGES",
        "android.permission.INTERNET",
        "android.permission.ACCESS_NETWORK_STATE",
        "android.permission.VIBRATE",
        "android.permission.POST_NOTIFICATIONS"
      ],
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? "./google-services.json",
      softwareKeyboardLayoutMode: "pan"
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    plugins: [
      "expo-router",
      [
        "expo-notifications",
        {
          icon: "./assets/notification-icon.png",
          color: "#ffffff"
        }
      ],
      "expo-sqlite"
    ],
    experiments: {
      typedRoutes: true
    },
    extra: {
      eas: {
        projectId: "4ab787d1-ecb2-4a1b-8f42-5718515ecfc5"
      }
    }
  }
};