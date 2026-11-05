import js from '@eslint/js';
import globals from 'globals';

// Catches real mistakes (undefined names, unreachable code, duplicate keys)
// rather than enforcing style; formatting is left to .editorconfig/.prettierrc.
export default [
  { ignores: ['node_modules/**', 'uploads/**'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_|^next$', caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    // Tests are ES modules (Vitest).
    files: ['tests/**/*.js'],
    languageOptions: { sourceType: 'module' },
  },
];
