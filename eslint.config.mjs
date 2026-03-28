import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettierConfig from 'eslint-config-prettier';

export default [
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**', '**/*.js', '**/*.mjs'],
  },
  {
    files: ['packages/shared/src/**/*.ts', 'packages/backend/src/**/*.ts', 'packages/frontend/src/**/*.ts', 'packages/frontend/src/**/*.tsx', 'packages/openclaw-plugins/manifest-model-router/src/**/*.ts', 'packages/openclaw-plugins/manifest/src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  prettierConfig,
];
