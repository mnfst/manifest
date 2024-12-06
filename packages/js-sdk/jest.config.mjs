/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  testPathIgnorePatterns: ['/example'],
  moduleNameMapper: {
    '^@repo/types$': '<rootDir>/../core/types/src',
  },
}
