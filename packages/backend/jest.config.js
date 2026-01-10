/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts', 'tsx'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)sx?$': '@swc/jest',
  },
  collectCoverageFrom: [
    '**/*.(t|j)s',
    '**/*.(t|j)sx',
    '!**/*.module.ts',
    '!**/main.ts',
    '!**/*.entity.ts',
  ],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    // Map workspace packages to their TypeScript sources
    '^@chatgpt-app-builder/shared$': '<rootDir>/../../shared/src/index.ts',
    '^@chatgpt-app-builder/nodes$': '<rootDir>/../../nodes/src/index.ts',
    // Handle .js extensions in imports (ESM style) - strip .js and resolve to .ts
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
