# Research: Manifest UI Website

**Feature**: 001-toolkit-website
**Date**: 2025-12-05

## Overview

This document captures research findings and design decisions for the Manifest UI website implementation.

## Technology Decisions

### 1. Code Syntax Highlighting

**Decision**: Use CSS-only code styling with Tailwind
**Rationale**:
- No runtime JavaScript overhead
- Consistent with existing shadcn/ui patterns
- Sufficient for displaying installation commands and simple usage examples
- Avoids adding Prism, Shiki, or other syntax highlighting libraries
**Alternatives Considered**:
- Shiki: Too heavy for simple code blocks, requires server processing
- Prism: Would add JS bundle size
- highlight.js: Same concerns as Prism

### 2. Copy-to-Clipboard Implementation

**Decision**: Use native Clipboard API with custom React hook
**Rationale**:
- Native browser API, no dependencies
- Well-supported across modern browsers
- Simple feedback UX (icon change on copy)
**Implementation**:
```typescript
async function copyToClipboard(text: string) {
  await navigator.clipboard.writeText(text)
}
```

### 3. Block Data Source

**Decision**: Parse `registry.json` at build time + static category mapping
**Rationale**:
- registry.json is the source of truth per constitution
- Categories are defined in blocks page data (existing pattern)
- No runtime fetching needed
**Data Structure**:
- Block metadata from registry.json: name, title, description, dependencies, registryDependencies, files
- Category grouping: hardcoded in blocks page (existing pattern works well)

### 4. Chat Demo Implementation

**Decision**: Extend existing ChatDemo component, add Claude variant
**Rationale**:
- ChatGPT-style demo already exists and works well
- Claude variant follows same pattern with different styling
- Sub-tabs allow switching between AI interfaces within each use case
**Structure**:
- Use case tabs (parent): Product Selection, Payment, Booking, etc.
- AI interface sub-tabs (child): ChatGPT, Claude

### 5. Responsive Strategy

**Decision**: Mobile-first with Tailwind breakpoints
**Rationale**:
- Tailwind already configured with responsive utilities
- Existing blocks designed for 300-500px inline width
- Sidebar collapses to hamburger menu on mobile
**Breakpoints**:
- Mobile: < 640px (sm) - single column, collapsible sidebar
- Tablet: 640px - 1024px (sm-lg) - sidebar visible, narrow content
- Desktop: > 1024px (lg) - full sidebar, wide content area

### 6. Theme Switching

**Decision**: Use existing next-themes setup
**Rationale**:
- Already configured in the project
- Blocks already support light/dark via CSS variables
- No additional work needed
**Existing Setup**:
- ThemeProvider in layout.tsx
- CSS variables for theming in globals.css

## Component Patterns

### Block Preview Container

**Pattern**: Isolated container with border, respects block's internal padding
**Implementation**:
- Rounded border container
- Block rendered inside with appropriate padding per block type
- Responsive width (full on mobile, constrained on desktop)

### Installation Section

**Pattern**: Single command with copy button
**Format**:
```
npx shadcn add <block-name>
```
**Features**:
- Copy button with visual feedback (checkmark on success)
- Dependencies listed below if registryDependencies present

### Usage Section

**Pattern**: Code block with import and basic usage
**Format**:
```tsx
import { BlockName } from "@/registry/path/block-name"

export function Example() {
  return <BlockName />
}
```
**Features**:
- Copy button for code
- Props shown if relevant

## Data Model Summary

### Block (from registry.json)
- name: string (unique identifier, used in CLI)
- title: string (display name)
- description: string
- type: "registry:component"
- dependencies: string[] (npm packages)
- registryDependencies: string[] (other shadcn components)
- files: { path: string, type: string }[]

### Category (static mapping)
- id: string
- name: string
- blocks: Block[]

### UseCase (static data)
- id: string
- label: string
- messages: ChatMessage[]

### ChatMessage
- id: string
- role: "user" | "assistant"
- content: string
- component?: ReactNode (optional embedded block)

## No Unresolved Items

All technical decisions have been made. No NEEDS CLARIFICATION items remain from the plan phase.
