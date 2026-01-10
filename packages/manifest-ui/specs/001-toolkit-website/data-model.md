# Data Model: Manifest UI Website

**Feature**: 001-toolkit-website
**Date**: 2025-12-05
**Updated**: 2025-12-08

## Overview

This document defines the data structures used in the Manifest UI website. All data is static and embedded in the codebase - no database or API required.

## Entities

### 1. Block

Represents a reusable UI block from the registry. A block can have multiple **variants** (e.g., with image, without image, compact, horizontal).

**Source**: `registry.json`

```typescript
interface Block {
  name: string // Unique identifier, used in CLI (e.g., "inline-blog-post-card")
  type: 'registry:component'
  title: string // Display name (e.g., "Blog Post Card")
  description: string // Brief description of the block
  dependencies: string[] // npm package dependencies (e.g., ["lucide-react"])
  registryDependencies: string[] // Other shadcn components required (e.g., ["button", "card"])
  files: BlockFile[] // Source files for the block
}

interface BlockFile {
  path: string // Relative path (e.g., "registry/inline/inline-blog-post-card.tsx")
  type: 'registry:component'
}
```

**Validation Rules**:

- `name` must be unique across all blocks
- `name` must be kebab-case
- `files` must have at least one entry
- `path` must point to existing file

### 2. BlockVariant

Represents a specific configuration/variant of a block. Multiple variants share the same registry component but with different props.

**Source**: Static data in `app/blocks/page.tsx`

```typescript
interface BlockVariant {
  id: string // Unique variant identifier (e.g., "blog-post-card-horizontal")
  name: string // Display name (e.g., "Horizontal")
  component: React.ReactNode // Rendered variant with specific props
}
```

### 3. Category

Groups related blocks for sidebar navigation. Each block in a category can have multiple variants.

**Source**: Static data in `lib/blocks-categories.ts` and `app/blocks/page.tsx`

```typescript
interface Category {
  id: string // Unique identifier (e.g., "blog")
  name: string // Display name (e.g., "Blogging")
  blocks: BlockGroup[] // Block groups in this category
}

interface BlockGroup {
  id: string // Block identifier (e.g., "blog-post-card")
  name: string // Display name (e.g., "Post Card")
  registryName: string // Name in registry for install command (e.g., "inline-blog-post-card")
  variants: BlockVariant[] // All variants of this block
}
```

**Current Categories**:

1. Blogging - Post card, Post detail, Post list, Post Carousel
2. Payment - Payment form, Payment confirmation, Payment method
3. Products - Product card, Product list, Product carousel, pickers
4. Selection - Option list, tag selects, quick replies
5. Status & Progress - Progress steps, status badges
6. Lists & Tables -
7. Messaging - Message bubbles, chat conversations
8. Social Posts -
9. Miscellaneous - Stats cards, weather widget, etc.

### 3. UseCase

Represents a demo scenario on the homepage.

**Source**: Static data in `app/page.tsx`

```typescript
interface UseCase {
  id: string // Unique identifier (e.g., "product-selection")
  label: string // Tab label (e.g., "Product selection")
  messages: ChatMessage[] // Conversation messages
}
```

### 4. ChatMessage

A message in the chat demo interface.

```typescript
interface ChatMessage {
  id: string // Unique message ID
  role: 'user' | 'assistant'
  content: string // Text content of the message
  component?: React.ReactNode // Optional embedded block (for assistant messages)
}
```

**Rules**:

- User messages never have `component`
- Assistant messages may have `component` to demonstrate inline blocks

### 5. AIInterface

Represents ChatGPT or Claude demo interface style.

```typescript
type AIInterface = 'chatgpt' | 'claude'
```

**Styling Differences**:

- ChatGPT: Rounded bubbles, OpenAI-style colors
- Claude: Anthropic-style interface, different avatar

## Relationships

```
Category (1) ──────────< BlockGroup (many)
    │
    └── Sidebar navigation groups blocks by category

BlockGroup (1) ────────< BlockVariant (many)
    │
    └── Each block group contains multiple variants

UseCase (1) ──────────< ChatMessage (many)
    │
    └── Each use case is a conversation demonstrating blocks

ChatMessage (1) ─ ─ ─ ─ > Block (0..1)
    │
    └── Assistant messages may embed a block component
```

## Block Page Structure

Each block page displays **all variants** of a block with a minimal, clean UI.

### Page Layout

```
┌─────────────────────────────────────────────────────────┐
│  Block Title (e.g., "Post Card")                        │
│  Brief description                                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Variant 1: "Default"                            │   │
│  │  ┌─────────────────────────────────────────┐    │   │
│  │  │  [Preview]  [Code]                      │    │   │
│  │  │  [npx ▾] [pnpm ▾] [yarn ▾] [bunx ▾]    │    │   │
│  │  ├─────────────────────────────────────────┤    │   │
│  │  │                                         │    │   │
│  │  │        Live component preview           │    │   │
│  │  │                                         │    │   │
│  │  └─────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Variant 2: "No Image"                          │   │
│  │  ┌─────────────────────────────────────────┐    │   │
│  │  │  [Preview]  [Code]                      │    │   │
│  │  │  [npx ▾] [pnpm ▾] [yarn ▾] [bunx ▾]    │    │   │
│  │  ├─────────────────────────────────────────┤    │   │
│  │  │                                         │    │   │
│  │  │        Live component preview           │    │   │
│  │  │                                         │    │   │
│  │  └─────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Variant 3: "Compact"                           │   │
│  │  ...                                            │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Per-Variant UI Elements

Each variant section contains:

1. **Variant Name** - Simple text label (e.g., "Default", "No Image", "Horizontal")

2. **Tab Bar** with two tabs:

   - **Preview** (default) - Shows live component
   - **Code** - Shows source code with syntax highlighting

3. **Install Command** - Inline with tabs, showing:

   - Package manager selector: `npx` | `pnpm` | `yarn` | `bunx`
   - Command with copy button
   - Commands for each package manager:
     - npx: `npx shadcn@latest add @manifest/{name}`
     - pnpm: `pnpm dlx shadcn@latest add @manifest/{name}`
     - yarn: `npx shadcn@latest add @manifest/{name}`
     - bunx: `bunx --bun shadcn@latest add @manifest/{name}`

4. **Content Area**:
   - When "Preview" tab active: Live rendered component
   - When "Code" tab active: Syntax-highlighted source code with copy button

### Design Principles

- **Minimal UI**: No unnecessary containers, borders, or backgrounds
- **No nested tabs within components**: Tabs only at variant level
- **Direct preview**: Components render directly without wrappers
- **Consistent spacing**: Clean vertical rhythm between variants
- **Mobile responsive**: Stack elements vertically on small screens

## Data Flow

```
registry.json
     │
     ▼
┌─────────────────┐
│  Build Time     │
│  Parse blocks   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│  Categories     │     │   Use Cases     │
│  (static data)  │     │  (static data)  │
└────────┬────────┘     └────────┬────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│  Blocks Page    │     │    Homepage     │
│  Sidebar + View │     │  Tabbed Demos   │
└─────────────────┘     └─────────────────┘
```

## State Management

**No global state required.** All state is local to components:

| Component       | State                     | Type                             |
| --------------- | ------------------------- | -------------------------------- |
| Blocks Page     | Selected block ID         | URL query param (`?block=...`)   |
| Blocks Page     | Expanded categories       | useState (array of category IDs) |
| Variant Section | Active tab (preview/code) | useState per variant             |
| Variant Section | Selected package manager  | useState (default: npx)          |
| Homepage        | Active use case tab       | Tabs component (controlled)      |
| Homepage        | Active AI interface       | Sub-tabs component (controlled)  |
| Code Block      | Copy success state        | useState (boolean, auto-reset)   |

## File Locations

| Data                     | Location                   |
| ------------------------ | -------------------------- |
| Block registry           | `registry.json`            |
| Category definitions     | `lib/blocks-categories.ts` |
| Block page with variants | `app/blocks/page.tsx`      |
| Use case definitions     | `app/page.tsx`             |
| Block components         | `registry/*/`              |
