import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import globals from 'globals';
import eslintConfigPrettier from 'eslint-config-prettier';

export default [
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.js'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
      },
      globals: {
        ...globals.node,
        ...globals.es6,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      // 基本的なルール
      'no-console': 'warn',
      'no-unused-vars': 'off', // TypeScriptでチェックされるため
      // 先頭がアンダースコアの引数は無視（Fastifyのハンドラ等で未使用의引数があるため）
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  // examples 内は学習・実行例のため console を許可
  {
    files: ['examples/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  // ストリームのデバッグログは運用上有用なため許可
  {
    files: ['service/routes/stream.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  eslintConfigPrettier,
];
