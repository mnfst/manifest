# generator Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-12-22

## Active Technologies
- TypeScript 5.7.2, Node.js >=18.0.0 + NestJS 10.4.15, React 18.3.1, Vite 6.0.5, TypeORM 0.3.20, LangChain 0.3.26 (002-mcp-server-flow)
- SQLite (better-sqlite3 11.7.0), TypeORM with auto-sync (POC mode) (002-mcp-server-flow)
- TypeScript 5.7.2 (monorepo with 3 packages) (003-app-list-header)
- SQLite via TypeORM (existing App entity, no schema changes) (003-app-list-header)
- TypeScript 5.x (all packages) + NestJS 10.x, TypeORM, React 18.x, React Router 7.x, Tailwind CSS (004-4-mcp-flow-publication)
- SQLite (TypeORM) (004-4-mcp-flow-publication)
- TypeScript 5.7.2 (monorepo with 3 packages: backend, frontend, shared) + NestJS 10.4.15 (backend), React 18.3.1 + Vite 6.0.5 (frontend), TypeORM 0.3.20 (ORM) (005-app-flow-management)
- SQLite via better-sqlite3 11.7.0, TypeORM with auto-sync (POC mode) (005-app-flow-management)
- TypeScript 5.7.2, Node.js >=18.0.0 + React 18.3.1, NestJS 10.4.15, Vite 6.0.5, Tailwind CSS 3.4.17, lucide-react (new) (006-manifest-ui-blocks)
- SQLite (TypeORM) - no schema changes required (006-manifest-ui-blocks)
- TypeScript 5.7.2, React 18.3.1 + Tailwind CSS 3.4.17, Vite 6.0.5, lucide-react (009-manifest-styles)
- N/A (styling only, no data persistence) (009-manifest-styles)
- TypeScript 5.7.2 + React 18.3.1, NestJS 10.4.15, Vite 6.0.5, Tailwind CSS 3.4.17, lucide-react (012-app-detail-improvements)
- SQLite via TypeORM (better-sqlite3 11.7.0) (012-app-detail-improvements)

- TypeScript 5.x (all packages) (001-chatgpt-app-builder)

## Project Structure

```text
backend/
frontend/
tests/
```

## Commands

npm test && npm run lint

## Code Style

TypeScript 5.x (all packages): Follow standard conventions

## Recent Changes
- 012-app-detail-improvements: Added TypeScript 5.7.2 + React 18.3.1, NestJS 10.4.15, Vite 6.0.5, Tailwind CSS 3.4.17, lucide-react
- 001-flow-creation: Added TypeScript 5.7.2, Node.js >=18.0.0
- 009-manifest-styles: Added TypeScript 5.7.2, React 18.3.1 + Tailwind CSS 3.4.17, Vite 6.0.5, lucide-react


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
