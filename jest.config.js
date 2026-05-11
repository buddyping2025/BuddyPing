module.exports = {
  preset: 'react-native',
  setupFiles: ['<rootDir>/jest.setup.js'],
  // Mock CSS imports (NativeWind global stylesheet) so Jest doesn't try to
  // parse them as JS.
  moduleNameMapper: {
    '\\.(css|scss|sass)$': '<rootDir>/__mocks__/styleMock.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(' +
      'react-native|@react-native|@react-native-community|' +
      '@react-navigation|react-native-reanimated|react-native-worklets|' +
      'react-native-gesture-handler|react-native-safe-area-context|' +
      'react-native-screens|react-native-svg|' +
      '@react-native-async-storage|@react-native-google-signin|' +
      'react-native-onesignal|react-native-vision-camera|react-native-qrcode-svg|' +
      'react-native-background-fetch|react-native-geolocation-service|' +
      'react-native-url-polyfill|nativewind|react-native-css-interop|' +
      'lucide-react-native' +
    ')/)',
  ],
};
