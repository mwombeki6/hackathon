# BlockEngage Mobile App

React Native + Expo application for the BlockEngage blockchain-powered task management platform.

## Features

- **Cross-platform**: Runs on iOS, Android, and Web
- **Blockchain Integration**: Connects to AlphachainLive network
- **Task Management**: Create, assign, and track tasks with token rewards
- **Gamification**: Daily streaks, leagues, head-to-head challenges
- **Real-time Updates**: Live notifications and data synchronization
- **Modern UI**: Beautiful, responsive design with animations

## Quick Start

### Prerequisites
- Node.js 18+
- Expo CLI (`npm install -g @expo/cli`)

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm start

# Run on specific platform
npm run web      # Web browser
npm run android  # Android emulator/device
npm run ios      # iOS simulator/device
```

### Environment Setup

1. Copy `.env.example` to `.env`
2. Update `API_URL` to point to your backend server
3. Ensure backend server is running on the specified URL

## Project Structure

```
src/
├── components/          # Reusable UI components
├── navigation/          # Navigation configuration
├── screens/            # Screen components
├── services/           # API and external services
└── store/              # Redux store and slices
```

## Key Components

- **AuthNavigator**: Handles login/register flow
- **MainTabs**: Bottom tab navigation for main app
- **DashboardScreen**: Overview with stats and quick actions
- **TasksScreen**: Task management with filtering
- **LeaguesScreen**: League participation and leaderboards
- **ProfileScreen**: User profile and settings

## Web Deployment

```bash
# Build for web
npm run build:web

# Serve locally
npm run serve
```

## API Integration

The app connects to the BlockEngage backend API for:
- User authentication and profiles
- Task CRUD operations
- League management
- Blockchain interactions
- Real-time notifications

## State Management

Uses Redux Toolkit with:
- **authSlice**: User authentication state
- **tasksSlice**: Task management state
- **leaguesSlice**: League and competition state
- **userSlice**: Dashboard and user data

Authentication tokens are securely stored using Expo SecureStore.
