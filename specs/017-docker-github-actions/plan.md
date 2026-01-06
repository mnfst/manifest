# Implementation Plan: Docker Deployment with GitHub Actions

**Branch**: `017-docker-github-actions` | **Date**: 2025-12-29 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/017-docker-github-actions/spec.md`

## Summary

Implement Docker containerization for the ChatGPT App Builder monorepo with memory-efficient builds and automated CI/CD via GitHub Actions for DockerHub deployment. The solution uses multi-stage builds, limited npm concurrency, and layer caching to ensure reliable builds within GitHub Actions resource constraints.

## Technical Context

**Language/Version**: TypeScript 5.7.2, Node.js 20 LTS
**Primary Dependencies**: NestJS 10.x (backend), React 18.x + Vite 6.x (frontend), TypeORM (ORM)
**Storage**: SQLite via better-sqlite3 (mounted volume for persistence)
**Testing**: Manual testing of Docker build and container functionality (POC phase)
**Target Platform**: Linux containers (amd64), deployed via DockerHub
**Project Type**: Web application (monorepo with backend + frontend + shared packages)
**Performance Goals**: Build completes in <10 minutes, final image <500MB
**Constraints**: <2GB memory during build (GitHub Actions limit), Alpine-based for minimal size
**Scale/Scope**: Single Docker image serving both frontend static files and backend API

## Constitution Check

*GATE: POC Phase - Testing and performance requirements relaxed*

| Requirement | Status | Notes |
|------------|--------|-------|
| Testing | DEFERRED | POC phase - manual testing acceptable |
| Security | PARTIAL | Docker best practices (non-root, minimal base) |
| Performance | GOAL | Memory-efficient build is critical for CI |

## Project Structure

### Documentation (this feature)

```text
specs/017-docker-github-actions/
├── spec.md              # Feature specification
├── plan.md              # This file
└── tasks.md             # Implementation tasks
```

### Source Code (repository root)

```text
# New files to be created:
/
├── Dockerfile                        # Multi-stage build for monorepo
├── docker-compose.yml                # Local development orchestration
├── .dockerignore                     # Build context exclusions
└── .github/
    └── workflows/
        └── docker-publish.yml        # GitHub Actions workflow

# Existing structure (no changes):
packages/
├── backend/                          # NestJS API server
│   ├── src/
│   └── dist/                         # Build output
├── frontend/                         # React + Vite SPA
│   ├── src/
│   └── dist/                         # Build output (static files)
└── shared/                           # TypeScript type library
    └── dist/                         # Build output
```

**Structure Decision**: Single Docker image approach - backend serves frontend static files. This simplifies deployment and reduces complexity for POC.

## Architecture Design

### Build Strategy: Multi-Stage Build

```
Stage 1: deps       - Install all npm dependencies (cached layer)
Stage 2: build      - Build all packages (shared → backend → frontend)
Stage 3: production - Minimal runtime with only production artifacts
```

### Memory Optimization Strategies

1. **Limited npm concurrency**: `npm ci --maxsockets=2` reduces parallel downloads
2. **Sequential package builds**: Build shared → backend → frontend sequentially
3. **Alpine base image**: Minimal OS footprint
4. **Layer caching**: Dependencies cached separately from source code
5. **Production-only deps**: Final image excludes devDependencies

### Runtime Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| PORT | 3001 | Backend API port |
| NODE_ENV | production | Runtime environment |
| OPENAI_API_KEY | (required) | OpenAI API key |

### File Serving Strategy

The backend NestJS server will serve:
- `/api/*` - Backend API endpoints
- `/*` - Frontend static files from `/app/frontend/dist`

## Complexity Tracking

No constitution violations - this is infrastructure/DevOps work.

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| OOM during npm install | Limit npm max-sockets to 2, use `--prefer-offline` |
| OOM during TypeScript compilation | Use `--max-old-space-size=1536` for Node |
| Large final image | Alpine base, multi-stage to exclude devDeps |
| Slow builds | Proper layer caching, BuildKit enabled |
| DockerHub rate limits | Authenticated access via secrets |
