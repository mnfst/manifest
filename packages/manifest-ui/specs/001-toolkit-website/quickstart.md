# Quickstart: Manifest UI Website

**Feature**: 001-toolkit-website
**Date**: 2025-12-05

## Prerequisites

- Node.js 18+
- pnpm (recommended) or npm
- Existing manifest-ui package setup

## Development

### Start the dev server

```bash
cd packages/manifest-ui
pnpm dev
```

The site runs at `http://localhost:3000`

### Available pages

| Page | URL | Description |
|------|-----|-------------|
| Homepage | `/` | Use case demos with ChatGPT/Claude interfaces |
| Blocks | `/blocks` | Block catalog with sidebar navigation |
| Block Detail | `/blocks?block=<id>` | Individual block view |

## Key Files

### Pages

- `app/page.tsx` - Homepage with tabbed use case demos
- `app/blocks/page.tsx` - Blocks catalog with sidebar

### Components

- `components/chat/chat-demo.tsx` - ChatGPT-style chat interface
- `components/chat/claude-demo.tsx` - Claude-style chat interface (to be added)
- `components/ui/*` - shadcn base components

### Data

- `registry.json` - Block registry (source of truth)
- Use cases defined inline in `app/page.tsx`
- Categories defined inline in `app/blocks/page.tsx`

## Adding a New Block

1. Create block file in `registry/<category>/<block-name>.tsx`
2. Add entry to `registry.json`:
   ```json
   {
     "name": "block-name",
     "type": "registry:component",
     "title": "Block Name",
     "description": "Description of the block",
     "dependencies": [],
     "registryDependencies": [],
     "files": [
       {
         "path": "registry/<category>/<block-name>.tsx",
         "type": "registry:component"
       }
     ]
   }
   ```
3. Add to category in `app/blocks/page.tsx`
4. Run `pnpm registry:build` to generate distributable JSON
5. (Optional) Add to homepage use case demo

## Adding a New Use Case

1. Open `app/page.tsx`
2. Add new entry to `useCases` array:
   ```typescript
   {
     id: 'use-case-id',
     label: 'Use Case Label',
     messages: [
       { id: '1', role: 'user', content: 'User message' },
       { id: '2', role: 'assistant', content: 'Assistant message', component: <BlockComponent /> },
     ],
   }
   ```
3. Tab automatically appears in navigation

## Theme Support

The site supports light/dark themes via `next-themes`:

- Theme toggle in header
- Blocks automatically adapt via CSS variables
- No additional configuration needed

## Building for Production

```bash
pnpm build
pnpm start
```

## Common Tasks

### Update block metadata

Edit `registry.json` and run `pnpm registry:build`

### Add new category

Add to `categories` array in `app/blocks/page.tsx`

### Change category order

Reorder `categories` array in `app/blocks/page.tsx`

### Modify chat demo styling

Edit `components/chat/chat-demo.tsx` for ChatGPT style
Edit `components/chat/claude-demo.tsx` for Claude style
