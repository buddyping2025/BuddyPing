require('dotenv').config();

module.exports = {
  presets: ['module:@react-native/babel-preset', 'nativewind/babel'],
  plugins: [
    'transform-inline-environment-variables',
    'react-native-reanimated/plugin', // MUST be last
  ],
};
