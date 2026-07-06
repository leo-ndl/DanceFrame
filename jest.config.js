module.exports = {
  preset: 'react-native',
  setupFiles: [
    './node_modules/react-native-gesture-handler/jestSetup.js',
  ],
  moduleNameMapper: {
    'react-native-linear-gradient': '<rootDir>/__mocks__/react-native-linear-gradient.js',
    'react-native-svg': '<rootDir>/__mocks__/react-native-svg.js',
    'react-native-mmkv': '<rootDir>/__mocks__/react-native-mmkv.js',
    'react-native-reanimated': '<rootDir>/node_modules/react-native-reanimated/mock.js',
    'react-native-safe-area-context': '<rootDir>/node_modules/react-native-safe-area-context/jest/mock.tsx',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|react-native-gesture-handler|react-native-reanimated|react-native-safe-area-context|react-native-svg|react-native-screens|@react-navigation)/)',
  ],
};
