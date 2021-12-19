/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: 'jest-preset-angular',
  moduleFileExtensions: ['ts', 'html', 'js', 'json', 'mjs'],
  moduleNameMapper: {
    '^lodash-es$': 'lodash',
    '^lodash-es/(.*)$': 'lodash/$1',
    '^@(iharbeck)/(ngx-virtual-scroller)$':
      '<rootDir>/node_modules/@$1/$2/fesm2015/$1-$2.mjs',
    '^src/(.*)': '<rootDir>/src/$1',
  },
  setupFiles: ['fake-indexeddb/auto'],
  setupFilesAfterEnv: ['<rootDir>/src/setup-jest.ts'],
  testPathIgnorePatterns: ['<rootDir>/cypress/'],
  transformIgnorePatterns: ['node_modules/(?!.*\\.mjs$)'],
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.spec.json',
      stringifyContentPathRegex: '\\.(html|svg)$',
      isolatedModules: true,
    },
  },
};
