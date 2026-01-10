# Research: Backend Test Suite - App Module

**Feature Branch**: `001-backend-test-suite`
**Date**: 2026-01-08
**Status**: Complete

## Research Questions

### 1. Jest Configuration for NestJS

**Decision**: Use Jest with SWC transformer (`@swc/jest`) for faster test execution.

**Rationale**:
- The project already has `@swc/core` and `@swc/cli` as devDependencies
- SWC provides significantly faster TypeScript compilation than ts-jest
- NestJS officially supports both ts-jest and @swc/jest transformers
- Avoids adding ts-jest as another dependency

**Alternatives Considered**:
- `ts-jest`: More mature but slower; project already has SWC infrastructure
- `esbuild-jest`: Fast but less mature NestJS integration

**Configuration Pattern**:
```javascript
// jest.config.js
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': '@swc/jest',
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
};
```

### 2. Testing Module Setup Pattern

**Decision**: Use NestJS TestingModule with manual mocking for explicit dependency control.

**Rationale**:
- Provides clear visibility into what dependencies are mocked
- Better IDE support for mock type safety
- Follows NestJS official documentation patterns
- Allows precise control over mock behavior

**Alternatives Considered**:
- `@golevelup/ts-jest` with `useMocker(createMock)`: Auto-mocks all dependencies but adds complexity
- Manual Jest mocks without TestingModule: Loses DI benefits

**Pattern**:
```typescript
const module: TestingModule = await Test.createTestingModule({
  providers: [
    AppService,
    {
      provide: getRepositoryToken(AppEntity),
      useValue: mockRepository,
    },
  ],
}).compile();
```

### 3. Mocking TypeORM Repositories

**Decision**: Create mock repository objects with Jest mock functions.

**Rationale**:
- TypeORM repositories have a known interface that can be partially mocked
- Only mock methods actually used by the service under test
- Use `getRepositoryToken()` from `@nestjs/typeorm` for proper DI token

**Pattern**:
```typescript
const mockRepository = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  remove: jest.fn(),
  createQueryBuilder: jest.fn(() => ({
    loadRelationCountAndMap: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  })),
};
```

### 4. Mocking External Services

**Decision**: Mock `AgentService` completely since it's an external dependency with LLM calls.

**Rationale**:
- AgentService makes external API calls to LLM providers
- Unit tests must not make network requests
- Mock at the service level, not at the HTTP level

**Pattern**:
```typescript
const mockAgentService = {
  generateApp: jest.fn(),
  processChat: jest.fn(),
};
```

### 5. Controller Testing Approach

**Decision**: Use NestJS TestingModule to test controller methods directly with mocked services.

**Rationale**:
- Controller unit tests verify request handling and response shaping
- Mocked services isolate controller logic
- Direct method calls (not HTTP requests) for true unit testing
- HTTP/E2E testing is out of scope for this phase

**Alternatives Considered**:
- Supertest HTTP testing: Better for integration/e2e tests
- Direct instantiation without TestingModule: Loses NestJS DI benefits

### 6. Test File Naming and Location

**Decision**: Co-locate test files with source files using `.spec.ts` suffix.

**Rationale**:
- Follows NestJS CLI conventions
- Easy navigation between source and test files
- Tests are discoverable via `testRegex: '.*\\.spec\\.ts$'`

**File Structure**:
```
src/app/
├── app.controller.ts
├── app.controller.spec.ts  # Controller tests
├── app.service.ts
├── app.service.spec.ts     # Service tests
├── app.entity.ts
└── app.module.ts
```

### 7. Test Organization Pattern

**Decision**: Use `describe` blocks for class/method grouping with descriptive `it` statements.

**Rationale**:
- Clear test output showing which method is being tested
- Easy to find tests for specific functionality
- Follows Jest and NestJS community conventions

**Pattern**:
```typescript
describe('AppService', () => {
  describe('create', () => {
    it('should create an app with valid input', async () => {});
    it('should generate a unique slug', async () => {});
  });

  describe('findById', () => {
    it('should return app when found', async () => {});
    it('should return null when not found', async () => {});
  });
});
```

### 8. Required Dependencies

**Decision**: Add minimal testing dependencies to `devDependencies`.

**Packages to Add**:
- `@nestjs/testing`: NestJS testing utilities
- `jest`: Test runner (if not already present via NestJS CLI)
- `@types/jest`: Jest type definitions
- `@swc/jest`: SWC transformer for Jest

**Already Available**:
- `@swc/core`: SWC compiler (already in devDependencies)
- `typescript`: TypeScript compiler

### 9. Handling Async Operations

**Decision**: Use async/await with Jest's async assertion helpers.

**Rationale**:
- All service methods are async (return Promises)
- Jest handles async tests natively with async/await
- Use `expect().rejects.toThrow()` for error cases

**Pattern**:
```typescript
it('should throw NotFoundException for invalid id', async () => {
  mockRepository.findOne.mockResolvedValue(null);

  await expect(service.update('invalid-id', {}))
    .rejects.toThrow(NotFoundException);
});
```

### 10. Coverage Requirements

**Decision**: Target 80% coverage for App module as initial goal.

**Rationale**:
- Constitution specifies >80% line coverage as post-POC target
- Starting with App module establishes baseline
- Coverage can be measured per-file for focused improvement

**Jest Coverage Configuration**:
```javascript
collectCoverageFrom: [
  'app/**/*.(t|j)s',
  '!**/*.module.ts',  // Exclude module files (minimal logic)
],
coverageThreshold: {
  global: {
    statements: 80,
    branches: 80,
    functions: 80,
    lines: 80,
  },
},
```

## Sources

- [NestJS Official Testing Documentation](https://docs.nestjs.com/fundamentals/testing)
- [Ultimate Guide: NestJS Unit Testing and Mocking](https://www.tomray.dev/nestjs-unit-testing)
- [Unit Testing with NestJS and Jest Tutorial](https://medium.com/@jackallcock97/unit-testing-with-nestjs-and-jest-a-comprehensive-tutorial-464910f6c6ba)
- [Best Practices for Managing Test Data in NestJS](https://medium.com/@sildeswj/best-practices-for-managing-test-data-in-nestjs-with-jest-e4729769047b)
