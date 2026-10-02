import js from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import { defineConfig, includeIgnoreFile } from 'eslint/config';
import { globSync } from 'fs';
import path from 'path';
import tseslint from 'typescript-eslint';

const prettierIgnorePaths = globSync('**/.prettierignore', {
  exclude: (file) => file.includes('node_modules'),
}).map((file) => path.resolve(file));

export default defineConfig([
  {
    files: ['**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}'],
  },
  includeIgnoreFile(prettierIgnorePaths, { gitignoreResolution: true }),
  {
    languageOptions: {
      // globals: globals.node,
      parserOptions: {
        projectService: true,
        // tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      '@typescript-eslint/no-extraneous-class': ['error', { allowStaticOnly: true }],
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'warn',
      '@typescript-eslint/prefer-regexp-exec': 'warn',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowAny: false }],
      '@typescript-eslint/no-confusing-void-expression': [
        'error',
        {
          ignoreArrowShorthand: true,
        },
      ],
      '@typescript-eslint/promise-function-async': 'error',
      '@typescript-eslint/no-misused-spread': 'warn',
    },
  },
  eslintPluginPrettierRecommended,
]);
