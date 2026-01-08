import globals from 'globals'
import pluginJs from '@eslint/js'
import tseslint from 'typescript-eslint'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}']
  },
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        tsconfigRootDir: __dirname,
        project: ['./tsconfig.json', './tsconfig.app.json']
      }
    }
  },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_'
        }
      ]
    }
  }
]
