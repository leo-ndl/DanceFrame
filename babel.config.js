module.exports = {
  presets: ['@react-native/babel-preset'],
  plugins: [
    'react-native-reanimated/plugin',
    ["react-native-worklets-core/plugin"],
      [
      'module-resolver',
      {
        root: ['./src'],
        alias: {
          '@': './src',
          '@/assets': './src/assets',
        },
        extensions: [
          '.ios.ts',
          '.android.ts',
          '.ts',
          '.ios.tsx',
          '.android.tsx',
          '.tsx',
          '.jsx',
          '.js',
          '.json',
        ],
      },
    ],
  ],
};
