module.exports = {
  extends: '../../.eslintrc.yaml',
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: './tsconfig.eslint.json',
    sourceType: 'module',
    ecmaVersion: 2020,
    extraFileExtensions: ['.svelte', '.cjs']
  },
  env: {
    browser: true,
    es2017: true,
    node: true
  },
  rules: {
    'import/extensions': 'off',
    'import/no-extraneous-dependencies': 'off'
  },
  overrides: [
    {
      files: ['service-worker.ts'],
      rules: {
        'header/header': 'off'
      }
    }
  ]
};
