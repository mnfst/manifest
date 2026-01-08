# CLAUDE.md

This file provides guidance for Claude Code when working with this repository.

## Project Overview

Manifest is a monorepo containing tools for building MCP (Model Context Protocol) servers with agentic UI components.

## Repository Structure

```
packages/
├── agentic-ui-toolkit/   # Component registry (Next.js) - port 3001
├── create-manifest/      # CLI for scaffolding new projects
└── starter/              # Starter template (nested pnpm workspace) - port 3000
    ├── server/           # MCP server (Express + TypeScript)
    └── web/              # Web client (Next.js)
```

## Important: Nested Workspace

The `packages/starter` directory is a **nested pnpm workspace** with its own `pnpm-lock.yaml`. You must install dependencies in both locations:

```bash
# Root dependencies
pnpm install

# Starter package dependencies (required!)
cd packages/starter && pnpm install
```

## Common Commands

```bash
# Start development (from root)
pnpm run dev

# Build all packages
pnpm run build

# Lint all packages
pnpm run lint

# Run tests
pnpm run test
```

## Development Workflow

1. Run `pnpm install` at the root
2. Run `pnpm install` in `packages/starter`
3. Run `pnpm run dev` to start both the registry (port 3001) and starter server (port 3000)

## Testing with ChatGPT

Use ngrok to expose the local MCP server:

```bash
ngrok http 3000
```

Connect using: `https://xxxx.ngrok-free.app/mcp`

## Key Files

- `/packages/starter/server/src/index.ts` - Main MCP server entry point
- `/packages/agentic-ui-toolkit/registry.json` - Component registry definitions
- `/turbo.json` - Turborepo configuration
