# Data Model: Agentic UI Toolkit Website

**Feature**: 001-toolkit-website
**Date**: 2025-12-05

## Overview

This document defines the data structures used in the Agentic UI Toolkit website. All data is static and embedded in the codebase - no database or API required.

## Entities

### 1. Block

Represents a reusable UI block from the registry.

**Source**: `registry.json`

```typescript
interface Block {
  name: string              // Unique identifier, used in CLI (e.g., "inline-card-form")
  type: "registry:component"
  title: string             // Display name (e.g., "Inline Card Form")
  description: string       // Brief description of the block
  dependencies: string[]    // npm package dependencies (e.g., ["lucide-react"])
  registryDependencies: string[]  // Other shadcn components required (e.g., ["button", "card"])
  files: BlockFile[]        // Source files for the block
}

interface BlockFile {
  path: string              // Relative path (e.g., "registry/inline/inline-card-form.tsx")
  type: "registry:component"
}
```

**Validation Rules**:
- `name` must be unique across all blocks
- `name` must be kebab-case
- `files` must have at least one entry
- `path` must point to existing file

### 2. Category

Groups related blocks for sidebar navigation.

**Source**: Static data in `app/blocks/page.tsx`

```typescript
interface Category {
  id: string                // Unique identifier (e.g., "payment")
  name: string              // Display name (e.g., "Payment")
  blocks: BlockItem[]       // Blocks in this category
}

interface BlockItem {
  id: string                // Block identifier (matches Block.name)
  name: string              // Display name
  component: React.ReactNode  // Rendered block component
  padding?: "none" | "sm" | "md" | "lg" | "mobile"  // Preview container padding
}
```

**Current Categories**:
1. Payment - Payment forms, confirmations, methods
2. Products - Product grids, carousels, pickers
3. Selection - Option lists, tag selects, quick replies
4. Status & Progress - Progress steps, status badges
5. Lists & Tables - Data tables with selection
6. Miscellaneous - Stats cards, weather widget, etc.

### 3. UseCase

Represents a demo scenario on the homepage.

**Source**: Static data in `app/page.tsx`

```typescript
interface UseCase {
  id: string                // Unique identifier (e.g., "product-selection")
  label: string             // Tab label (e.g., "Product selection")
  messages: ChatMessage[]   // Conversation messages
}
```

### 4. ChatMessage

A message in the chat demo interface.

```typescript
interface ChatMessage {
  id: string                // Unique message ID
  role: "user" | "assistant"
  content: string           // Text content of the message
  component?: React.ReactNode  // Optional embedded block (for assistant messages)
}
```

**Rules**:
- User messages never have `component`
- Assistant messages may have `component` to demonstrate inline blocks

### 5. AIInterface

Represents ChatGPT or Claude demo interface style.

```typescript
type AIInterface = "chatgpt" | "claude"
```

**Styling Differences**:
- ChatGPT: Rounded bubbles, OpenAI-style colors
- Claude: Anthropic-style interface, different avatar

## Relationships

```
Category (1) ──────────< Block (many)
    │
    └── Sidebar navigation groups blocks by category

UseCase (1) ──────────< ChatMessage (many)
    │
    └── Each use case is a conversation demonstrating blocks

ChatMessage (1) ─ ─ ─ ─ > Block (0..1)
    │
    └── Assistant messages may embed a block component
```

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

| Component | State | Type |
|-----------|-------|------|
| Blocks Page | Selected block ID | URL query param (`?block=...`) |
| Blocks Page | Expanded categories | useState (array of category IDs) |
| Homepage | Active use case tab | Tabs component (controlled) |
| Homepage | Active AI interface | Sub-tabs component (controlled) |
| Code Block | Copy success state | useState (boolean, auto-reset) |

## File Locations

| Data | Location |
|------|----------|
| Block registry | `registry.json` |
| Category definitions | `app/blocks/page.tsx` |
| Use case definitions | `app/page.tsx` |
| Block components | `registry/*/` |
