# Manifest Nodes

Node type definitions for the Manifest flow editor.

## Overview

This package contains the definitions for all available node types in the visual builder:

- Input/Output nodes
- Logic nodes (conditions, loops)
- Integration nodes (API calls, webhooks)
- AI nodes (LLM prompts, embeddings)

## Usage

Nodes are imported by both the backend (for execution) and frontend (for the editor UI).

```typescript
import { NodeDefinitions } from '@manifest/nodes';
```
