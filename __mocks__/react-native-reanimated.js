/* eslint-env jest */
// Stub out the reanimated v4 surface area used by the app. The real
// library requires a native worklets runtime that doesn't exist in Jest.

const passthrough = ({children}) => children ?? null;

const Animated = {
  View: passthrough,
  Text: passthrough,
  ScrollView: passthrough,
  createAnimatedComponent: (C) => C,
};

const noop = () => {};
const ident = (v) => v;

const layoutAnim = {
  duration: () => layoutAnim,
  delay: () => layoutAnim,
  springify: () => layoutAnim,
};

module.exports = {
  __esModule: true,
  default: Animated,
  ...Animated,
  useSharedValue: (v) => ({value: v}),
  useAnimatedStyle: () => ({}),
  withSpring: ident,
  withTiming: ident,
  withRepeat: ident,
  withSequence: ident,
  interpolateColor: () => '#000000',
  Easing: {linear: () => 0, ease: () => 0},
  runOnJS: ident,
  runOnUI: ident,
  cancelAnimation: noop,
  FadeIn: layoutAnim,
  FadeInUp: layoutAnim,
  FadeInDown: layoutAnim,
  FadeOut: layoutAnim,
  FadeOutLeft: layoutAnim,
  ZoomIn: layoutAnim,
  LinearTransition: layoutAnim,
};
