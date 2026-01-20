# Docker Deployments

This directory contains Docker configurations for deployable packages in the monorepo.

## Directory Structure

```
docker/
└── manifest/           # Manifest application (backend + frontend)
    ├── Dockerfile      # Multi-stage build for the Manifest app
    ├── docker-compose.yml
    └── .dockerignore
```

## Manifest

The `manifest/` directory contains Docker configuration for the Manifest application, which includes:
- `packages/shared` - Shared types and utilities
- `packages/nodes` - Node type definitions
- `packages/backend` - NestJS API
- `packages/frontend` - React SPA

### Building

From the repository root:

```bash
docker build -f docker/manifest/Dockerfile -t manifest:latest .
```

### Running with Docker Compose

```bash
cd docker/manifest
docker compose up
```

Or from the repository root:

```bash
docker compose -f docker/manifest/docker-compose.yml up
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Host port to expose | `3001` |
| `OPENAI_API_KEY` | OpenAI API key for AI functionality | - |

### Volumes

The compose file defines two persistent volumes:
- `app-data` - SQLite database storage
- `app-uploads` - Uploaded files storage

## Adding New Deployments

To add Docker configuration for a new deployable package:

1. Create a new directory: `docker/<package-name>/`
2. Add a `Dockerfile` that builds from repo root context
3. Add `docker-compose.yml` with `context: ../..`
4. Add `.dockerignore` for build exclusions
5. Document the new deployment in this README
