import eslint from '@eslint/js';
import { fixupPluginRules } from '@eslint/compat';
import headers from 'eslint-plugin-headers';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import rxjs from 'eslint-plugin-rxjs';
import tseslint from 'typescript-eslint';
import eslintPluginSvelte from 'eslint-plugin-svelte';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintPluginPrettierRecommended,
  {
    ignores: ['**/build/*', '**/.svelte-kit/*', '**/*.d.ts', '**/service-worker.ts']
  },
  {
    languageOptions: {
      parserOptions: {
        parser: '@typescript-eslint/parser',
        ecmaVersion: 2020,
        extraFileExtensions: ['.svelte'],
        projectService: {
          allowDefaultProject: ['*.js', '*.cjs', '*.mjs', '.prettierrc.cjs', 'tailwindcss/*.cjs']
        },
        sourceType: 'module',
        tsconfigRootDir: import.meta.dirname
      }
    },
    name: 'root',
    plugins: {
      headers,
      rxjs: fixupPluginRules(rxjs)
    },
    rules: {
      'no-return-assign': ['error', 'except-parens'],
      'no-underscore-dangle': 'off',
      '@typescript-eslint/no-use-before-define': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'prettier/prettier': [
        'error',
        {
          endOfLine: 'auto'
        }
      ]
    }
  },
  {
    files: ['**/!(*.d).ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }
      ],
      'headers/header-format': [
        'error',
        {
          content: `@license BSD-3-Clause\nCopyright (c) {year}, ッツ Reader Authors\nAll rights reserved.`,
          source: 'string',
          style: 'jsdoc',
          trailingNewlines: 2,
          preservePragmas: false,
          variables: {
            year: `${new Date().getFullYear()}`
          }
        }
      ]
    }
  },
  {
    files: ['**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs'
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off'
    }
  },
  {
    ...eslintPluginSvelte.configs['flat/recommended'],
    files: ['*.svelte'],
    languageOptions: {
      parserOptions: { parser: '@typescript-eslint/parser' }
    },
    rules: {
      'except-parens': 'off',
      quotes: ['error', 'single', { avoidEscape: true, allowTemplateLiterals: true }]
    }
  }
);
