# TML Moodboard - Mobile App

Cross-platform mobile app for AI-powered moodboard creation, built with React Native and Expo.

## Features

- **URL Scraping**: Paste any product URL to extract product data
- **AI Enrichment**: Automatic tag, color, and material extraction using Claude Opus 4.5
- **Smart Labels**: AI-guided label placement on moodboards
- **Semantic Search**: Find products using natural language queries
- **Interactive Canvas**: Drag-and-drop product arrangement with gestures
- **Cross-Platform**: iOS, Android, and Web support

## Tech Stack

- **Framework**: React Native with Expo
- **Language**: TypeScript
- **Navigation**: React Navigation
- **State Management**: Zustand
- **Gestures**: React Native Gesture Handler + Reanimated
- **HTTP Client**: Axios
- **Storage**: MMKV + Expo Secure Store

## Getting Started

### Prerequisites

- Node.js 20+
- npm or yarn
- Expo CLI
- iOS Simulator (Mac) or Android Emulator

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android

# Run on web
npm run web
```

### Environment Setup

Copy `.env.example` to `.env` and configure:

```env
EXPO_PUBLIC_API_URL=https://your-backend.vercel.app
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Project Structure

```
mobile/
├── App.tsx                 # App entry point
├── src/
│   ├── components/         # Reusable UI components
│   │   └── MoodboardCanvas.tsx
│   ├── constants/          # Theme and API config
│   │   ├── theme.ts
│   │   └── api.ts
│   ├── hooks/              # Custom React hooks
│   ├── navigation/         # Navigation configuration
│   │   └── AppNavigator.tsx
│   ├── screens/            # Screen components
│   │   ├── HomeScreen.tsx
│   │   ├── ExploreScreen.tsx
│   │   ├── CreateScreen.tsx
│   │   ├── LibraryScreen.tsx
│   │   ├── ProfileScreen.tsx
│   │   ├── MoodboardDetailScreen.tsx
│   │   ├── AddProductScreen.tsx
│   │   └── SettingsScreen.tsx
│   ├── services/           # API client and services
│   │   └── api.ts
│   ├── store/              # Zustand state management
│   │   └── moodboardStore.ts
│   ├── types/              # TypeScript type definitions
│   │   └── index.ts
│   └── utils/              # Utility functions
├── app.json                # Expo configuration
├── eas.json                # EAS Build configuration
└── tsconfig.json           # TypeScript configuration
```

## Building for Production

### Using EAS Build (Recommended)

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Configure project
eas build:configure

# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android

# Build for both
eas build --platform all
```

### Local Development Build

```bash
# Create development build for iOS
npx expo run:ios

# Create development build for Android
npx expo run:android
```

## API Integration

The app connects to the TML backend for:

- `/api/scrape` - URL scraping with Puppeteer
- `/api/enrich` - AI product enrichment
- `/api/search` - Semantic search
- `/api/smart-labels` - AI label placement
- `/api/theme` - Theme generation
- `/api/layout` - Auto-layout

All AI features are powered by Claude Opus 4.5.

## Contributing

1. Follow existing code patterns
2. Use TypeScript strictly
3. Test on both iOS and Android
4. Update types when adding API integrations

## License

Private - All rights reserved
