# Manifest Backend

NestJS backend API for the Manifest visual builder.

## Overview

This package provides the server-side functionality for Manifest, including:

- REST API endpoints
- Database management (SQLite, PostgreSQL, MySQL)
- Authentication and authorization
- Flow execution engine
- File storage (local and S3)

## Development

```bash
# From the monorepo root
pnpm run dev
```

The backend runs on port 3847 by default.

## Environment Variables

See `.env.example` for available configuration options.
