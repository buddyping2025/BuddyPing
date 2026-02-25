module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    'transform-inline-environment-variables',
    'nativewind/babel',
    'react-native-reanimated/plugin', // MUST be last
  ],
};
