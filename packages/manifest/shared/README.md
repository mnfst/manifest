# Manifest Shared

Shared types and utilities used across Manifest packages.

## Overview

This package contains code shared between the backend and frontend:

- TypeScript type definitions
- Validation schemas
- Utility functions
- Constants

## Usage

```typescript
import { FlowDefinition, NodeConfig } from '@manifest/shared';
```

## Building

This package must be built before running the backend or frontend:

```bash
pnpm --filter @manifest/shared build
```
