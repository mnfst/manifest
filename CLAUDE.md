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

## Pull Request Guidelines

**CRITICAL**: When creating pull requests, you MUST use the PR template format from `.github/pull_request_template.md`.

### Required PR Body Format

Always structure PR bodies exactly like this:

```markdown
## Description

[Your description of changes goes here - explain WHAT changed and WHY]

## Related Issues

[Link related issues using #123 format, or write "None" if no related issues]

## How can it be tested?

[Step-by-step instructions for testing the changes]

## Check list before submitting

- [x] This PR is wrote in a clear language and correctly labeled
- [x] I have performed a self-review of my code (no debugs, no commented code, good naming, etc.)
- [ ] I wrote the relative tests
- [ ] I created a PR for the [documentation](https://github.com/mnfst/docs) if necessary and attached the link to this PR
```

### Rules

1. **NEVER** put description text before the `## Description` heading
2. **ALWAYS** fill in content UNDER each section heading
3. **ALWAYS** include all four sections even if some are "None" or "N/A"
4. **CHECK** the boxes that apply (change `[ ]` to `[x]`)
5. Use the HEREDOC format when calling `gh pr create`:

```bash
gh pr create --title "feat: your title" --body "$(cat <<'EOF'
## Description

Your description here.

## Related Issues

#123 or None

## How can it be tested?

1. Step one
2. Step two

## Check list before submitting

- [x] This PR is wrote in a clear language and correctly labeled
- [x] I have performed a self-review of my code (no debugs, no commented code, good naming, etc.)
- [ ] I wrote the relative tests
- [ ] I created a PR for the [documentation](https://github.com/mnfst/docs) if necessary and attached the link to this PR
EOF
)"
```

## Package-Specific Guidance

See individual package `CLAUDE.md` files for package-specific guidance:
- `packages/agentic-ui-toolkit/CLAUDE.md` - UI toolkit development guidelines
