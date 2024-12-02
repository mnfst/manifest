/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  moduleNameMapper: {
    '^@repo/types$': '<rootDir>/../core/types/src/index.ts',
    '^@repo/helpers$': '<rootDir>/../core/helpers/src/index.ts'
  }
}
