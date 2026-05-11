/* eslint-env jest */
require('react-native-gesture-handler/jestSetup');

// reanimated stub lives in __mocks__/react-native-reanimated.js — Jest
// auto-applies it because of the matching path.

jest.mock('react-native-onesignal', () => ({
  OneSignal: {
    Debug: {setLogLevel: jest.fn()},
    initialize: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
    User: {
      pushSubscription: {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        getIdAsync: jest.fn().mockResolvedValue(null),
      },
    },
    Notifications: {
      requestPermission: jest.fn().mockResolvedValue(true),
    },
  },
  LogLevel: {Warn: 4},
}));

jest.mock('react-native-background-fetch', () => ({
  __esModule: true,
  default: {
    configure: jest.fn().mockResolvedValue(0),
    finish: jest.fn(),
    registerHeadlessTask: jest.fn(),
    NETWORK_TYPE_ANY: 0,
  },
}));

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn().mockResolvedValue(true),
    signIn: jest.fn().mockResolvedValue({data: {idToken: null}}),
    signOut: jest.fn().mockResolvedValue(undefined),
  },
  statusCodes: {SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED'},
}));

jest.mock('react-native-vision-camera', () => ({
  Camera: () => null,
  useCameraDevice: () => undefined,
  useCodeScanner: () => ({}),
  useCameraPermission: () => ({
    hasPermission: false,
    requestPermission: jest.fn(),
  }),
}));

jest.mock('react-native-geolocation-service', () => ({
  __esModule: true,
  default: {
    getCurrentPosition: jest.fn(),
  },
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getSession: jest.fn().mockResolvedValue({data: {session: null}}),
      onAuthStateChange: jest
        .fn()
        .mockReturnValue({data: {subscription: {unsubscribe: jest.fn()}}}),
      getUser: jest.fn().mockResolvedValue({data: {user: null}}),
      signOut: jest.fn().mockResolvedValue({error: null}),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: jest.fn().mockResolvedValue({data: null, error: null}),
        }),
      }),
    }),
  }),
}));
