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

## Block Development Guidelines

**CRITICAL**: When adding or editing a block, you MUST include a comprehensive usage example.

### Required Files to Update

When creating or modifying a block, update these files:

1. **Component file**: `packages/agentic-ui-toolkit/registry/<category>/<block-name>.tsx`
2. **Registry definition**: `packages/agentic-ui-toolkit/registry.json`
3. **Block demo with usage example**: `packages/agentic-ui-toolkit/app/blocks/page.tsx`
4. **Category navigation** (if new): `packages/agentic-ui-toolkit/lib/blocks-categories.ts`

### Usage Example Requirements

Every block variant in `app/blocks/page.tsx` MUST have a `usageCode` field with a comprehensive example that demonstrates:

1. **All common props** - Show the typical props a developer would use
2. **Realistic demo data** - Use meaningful placeholder data, not just "test" or "foo"
3. **Action handlers** - Include `console.log` examples for all actions
4. **Proper prop categories** - Use the standard `data`, `actions`, `appearance`, `control` structure

### Props Structure Pattern

All blocks follow this consistent props pattern:

```typescript
export interface BlockProps {
  data?: {
    // Content/configuration - titles, items, amounts, etc.
  }
  actions?: {
    // Event handlers - onSubmit, onClick, onSelect, etc.
  }
  appearance?: {
    // Visual/styling - variant, currency, columns, theme, etc.
  }
  control?: {
    // State/loading - isLoading, value, disabled, etc.
  }
}
```

### Complete Usage Example Template

When adding a block to `app/blocks/page.tsx`, follow this pattern:

```typescript
{
  id: "my-block",
  name: "My Block",
  description: "A brief description of what this block does",
  registryName: "my-block",
  layouts: ["inline", "fullscreen"],
  actionCount: 2,
  variants: [
    {
      id: "default",
      name: "Default",
      component: <MyBlock {...defaultProps} />,
      usageCode: `<MyBlock
  data={{
    title: "Welcome to My Block",
    items: [
      {
        id: "1",
        name: "First Item",
        description: "Description of first item",
        price: 29.99,
        image: "/demo/item-1.png"
      },
      {
        id: "2",
        name: "Second Item",
        description: "Description of second item",
        price: 49.99,
        image: "/demo/item-2.png"
      }
    ]
  }}
  appearance={{
    variant: "default",
    currency: "USD",
    columns: 2
  }}
  actions={{
    onItemSelect: (item) => console.log("Selected:", item),
    onSubmit: (data) => console.log("Submitted:", data)
  }}
  control={{
    isLoading: false
  }}
/>`
    },
    {
      id: "compact",
      name: "Compact",
      component: <MyBlock {...compactProps} />,
      usageCode: `<MyBlock
  data={{
    title: "Compact View",
    items: [{ id: "1", name: "Item", price: 19.99 }]
  }}
  appearance={{ variant: "compact" }}
  actions={{ onItemSelect: (item) => console.log(item) }}
/>`
    }
  ]
}
```

### Version Bump Requirements (CRITICAL)

**Every modification to a block's source files MUST include a version bump in `registry.json`.**

This is enforced by automated tests that will fail if:
1. You modified any file in `registry/**/*.tsx`
2. But did NOT update the corresponding component's `version` in `registry.json`

#### Semantic Versioning Guide

| Change Type | Version Bump | Examples |
|-------------|--------------|----------|
| **PATCH** | `1.0.0` → `1.0.1` | Bug fixes, styling fixes, refactoring without API changes |
| **MINOR** | `1.0.0` → `1.1.0` | New features, new optional props, new variants |
| **MAJOR** | `1.0.0` → `2.0.0` | Breaking changes: removing/renaming props, changing behavior |

#### Example

```json
// Before modifying message-bubble.tsx
{ "name": "message-bubble", "version": "1.0.0", ... }

// After bug fix - bump PATCH
{ "name": "message-bubble", "version": "1.0.1", ... }
```

### Checklist for Block Changes

Before submitting a PR with block changes:

- [ ] **Version bumped in `registry.json`** (REQUIRED - tests will fail otherwise)
- [ ] Component implements the standard props pattern (`data`, `actions`, `appearance`, `control`)
- [ ] Block is registered in `registry.json` with correct dependencies
- [ ] Block demo added to `app/blocks/page.tsx` with ALL variants
- [ ] EVERY variant has a `usageCode` field with comprehensive example
- [ ] Usage example shows realistic data (not placeholder text like "test" or "foo")
- [ ] All action handlers are demonstrated with `console.log` examples
- [ ] New category added to `blocks-categories.ts` if needed

## Package-Specific Guidance

See individual package `CLAUDE.md` files for package-specific guidance:
- `packages/agentic-ui-toolkit/CLAUDE.md` - UI toolkit development guidelines
