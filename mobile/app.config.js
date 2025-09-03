import 'dotenv/config';

export default {
  expo: {
    name: 'BlockEngage',
    slug: 'blockengage',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    splash: {
      image: './assets/icon.png',
      resizeMode: 'contain',
      backgroundColor: '#6366f1'
    },
    assetBundlePatterns: [
      '**/*'
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.blockengage.app'
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#6366f1'
      },
      package: 'com.blockengage.app'
    },
    web: {
      favicon: './assets/favicon.png',
      bundler: 'metro'
    },
    extra: {
      apiUrl: process.env.API_URL || 'http://localhost:3000/api',
    },
    plugins: [
      [
        'expo-font',
        {
          fonts: ['@expo/vector-icons']
        }
      ]
    ]
  }
};
