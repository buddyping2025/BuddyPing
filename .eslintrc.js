module.exports = {
  root: true,
  extends: '@react-native',
  ignorePatterns: [
    // Deno edge-function snippet checked in at the repo root — it isn't
    // part of the RN bundle and uses non-standard TS syntax (`!` non-null
    // assertion in a `.js` file) that the React Native ESLint preset
    // can't parse.
    'supabase_edgefunctions.js',
    'supabase/functions/**',
    'android/',
    'ios/',
    'build/',
  ],
};
