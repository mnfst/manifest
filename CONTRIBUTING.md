# Contributing to Manifest

This guide explains how to set up and work with the Manifest monorepo as a developer.

## Prerequisites

- Node.js 22+
- pnpm 9.15+
- [ngrok](https://ngrok.com/) (required for ChatGPT integration)

## Repository Structure

```
packages/
├── manifest-ui/   # Component registry (Next.js)
├── create-manifest/      # CLI for scaffolding new projects
└── starter/              # Starter template for new projects
```

## Getting Started

1. Clone the repository and install dependencies:

```bash
git clone https://github.com/mnfst/manifest.git
cd manifest
pnpm install
```

2. Install dependencies for the starter package (nested workspace):

```bash
cd packages/starter
pnpm install
cd ../..
```

3. Start the development servers:

```bash
pnpm run dev
```

This runs both packages in parallel via Turborepo:

- **Registry** at `http://localhost:3001` - Component documentation
- **Starter** at `http://localhost:3000` - Example MCP server

4. Install components from the registry using the shadcn CLI with the `@manifest-dev` namespace:

```bash
cd packages/starter/web
npx shadcn@latest add @manifest-dev/x-post
```

This downloads the component, installs dependencies, and creates the file in `src/components/`.

Browse available components at `http://localhost:3001`.

> ⚠ Make sure that your are not commiting files in the "starter" package unless you are working on this package.

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
| `pnpm run dev`   | Start all dev servers (registry + starter) |
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

### Starter

```bash
cd packages/starter
pnpm run dev          # Start MCP server on port 3000
pnpm run build        # Build for production
pnpm run inspector    # Open MCP Inspector
```

## Adding Components to the Registry

1. Create component files in `packages/manifest-ui/registry/misc/<component-name>/`
2. Add entry to `registry.json` with file paths and dependencies
3. Run `pnpm run registry:build` to generate the distributable JSON
4. Preview at `http://localhost:3001`

## Code Style

- Use [Prettier](https://prettier.io/) for formatting in starter packages
- Use ESLint for the registry package
- Run `pnpm run lint` before committing
- Run `pnpm run format` to auto-format code in the starter package
