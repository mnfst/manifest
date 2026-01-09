# Quickstart: Backend Test Suite - App Module

**Feature Branch**: `001-backend-test-suite`
**Date**: 2026-01-08

## Prerequisites

- Node.js >= 18.0.0
- pnpm (package manager)
- Repository cloned locally

## Running Tests

### Run All Backend Tests

```bash
cd packages/backend
pnpm test
```

### Run Tests in Watch Mode

```bash
cd packages/backend
pnpm test:watch
```

### Run Tests with Coverage

```bash
cd packages/backend
pnpm test:cov
```

### Run Specific Test File

```bash
cd packages/backend
pnpm test -- src/app/app.service.spec.ts
```

## Expected Output

Successful test run displays:

```
PASS  src/app/app.service.spec.ts
PASS  src/app/app.controller.spec.ts

Test Suites: 2 passed, 2 total
Tests:       XX passed, XX total
Snapshots:   0 total
Time:        X.XXs
```

## Test File Locations

| File | Purpose |
|------|---------|
| `src/app/app.service.spec.ts` | Unit tests for AppService |
| `src/app/app.controller.spec.ts` | Unit tests for AppController |

## Configuration Files

| File | Purpose |
|------|---------|
| `jest.config.js` | Jest configuration |
| `package.json` | Test scripts in `scripts` section |

## Common Issues

### Tests Fail with Module Resolution Errors

Ensure dependencies are installed:
```bash
pnpm install
```

### TypeScript Errors in Tests

Check that `@types/jest` is installed:
```bash
pnpm add -D @types/jest
```

### Slow Test Execution

The project uses `@swc/jest` for fast TypeScript compilation. If tests are slow, verify Jest config uses SWC transformer.

## Adding New Tests

1. Create test file alongside source: `src/<module>/<file>.spec.ts`
2. Follow existing patterns in `app.service.spec.ts`
3. Run tests to verify: `pnpm test`

## Test Development Workflow

```bash
# 1. Start watch mode
pnpm test:watch

# 2. Edit test file - tests re-run automatically

# 3. Press 'p' to filter by pattern (e.g., 'app.service')

# 4. Press 'q' to quit watch mode
```

## Coverage Report

After running `pnpm test:cov`, view the HTML report:

```bash
open coverage/lcov-report/index.html  # macOS
xdg-open coverage/lcov-report/index.html  # Linux
```

Target: >80% coverage for App module files.
