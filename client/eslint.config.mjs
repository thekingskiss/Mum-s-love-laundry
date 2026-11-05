import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

// Catches real mistakes (undefined names, hooks used wrongly, unused code)
// rather than enforcing style; formatting is left to .editorconfig/.prettierrc.
export default [
  { ignores: ['dist/**', 'dist-e2e/**', 'node_modules/**'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    plugins: { react, 'react-hooks': reactHooks },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser },
    },
    settings: { react: { version: 'detect' } },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      'react/prop-types': 'off', // the app doesn't use PropTypes
      'react/no-unescaped-entities': 'off', // apostrophes in text are fine in JSX
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // `motion` is used as <motion.div>, which the base rule can't see.
      'no-unused-vars': ['warn', { varsIgnorePattern: '^(motion|_)', argsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    files: ['**/*.test.{js,jsx}', 'src/test/**'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: { 'react/display-name': 'off' },
  },
  {
    files: ['*.config.js', '*.config.mjs'],
    languageOptions: { globals: { ...globals.node } },
  },
];
