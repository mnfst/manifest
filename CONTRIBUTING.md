# Contributing to Manifest

This guide explains how to set up and work with the Manifest monorepo as a developer.

## Prerequisites

- Node.js 22+
- pnpm 9.15+
- [ngrok](https://ngrok.com/) (required for ChatGPT integration)

## Repository Structure

```
packages/
└── manifest-ui/   # Component registry (Next.js)
```

## Getting Started

1. Clone the repository and install dependencies:

```bash
git clone https://github.com/mnfst/manifest.git
cd manifest
pnpm install
```

2. Start the development server:

```bash
pnpm run dev
```

This starts the registry at `http://localhost:3001` - Component documentation.

Browse available components at `http://localhost:3001`.

## Connecting to ChatGPT

To test your MCP server with ChatGPT, you need ngrok to expose your local server:

1. Install ngrok from https://ngrok.com/download

2. Start your dev server:

```bash
pnpm run dev
```

3. In a separate terminal, start ngrok:

```bash
ngrok http 3000
```

4. Copy the ngrok URL and append `/mcp` to connect your MCP server to ChatGPT:

```
https://xxxx.ngrok-free.app/mcp
```

The MCP server endpoint is available at `/mcp`, not at the root path.

## Available Scripts

| Command          | Description                                |
| ---------------- | ------------------------------------------ |
| `pnpm run dev`   | Start dev server (registry)                |
| `pnpm run build` | Build all packages                         |
| `pnpm run lint`  | Lint all packages                          |
| `pnpm run test`  | Run tests                                  |

## Working with Individual Packages

### Registry (manifest-ui)

```bash
cd packages/manifest-ui
pnpm run dev          # Start dev server on port 3001
pnpm run registry:build  # Build registry JSON files
```

## Adding Components to the Registry

1. Create component files in `packages/manifest-ui/registry/misc/<component-name>/`
2. Add entry to `registry.json` with file paths and dependencies
3. Run `pnpm run registry:build` to generate the distributable JSON
4. Preview at `http://localhost:3001`

## Code Style

- Use ESLint for the registry package
- Run `pnpm run lint` before committing
