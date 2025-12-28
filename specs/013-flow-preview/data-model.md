# Data Model: Flow Preview with Tabbed Interface

**Feature Branch**: `013-flow-preview`
**Created**: 2025-12-28

## Overview

This feature is **frontend-only** with no new backend entities or API endpoints. The data model defines TypeScript interfaces for component props and state management.

---

## Component Interfaces

### Tab Types

```typescript
/**
 * Available tabs in the flow detail page
 */
type FlowDetailTab = 'build' | 'preview' | 'usage';

/**
 * Tab configuration for rendering
 */
interface TabConfig {
  id: FlowDetailTab;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  /** Whether the tab is disabled (e.g., Preview when no views) */
  disabled?: boolean;
}
```

### Typing Animation

```typescript
/**
 * Options for the typing animation hook
 */
interface UseTypingAnimationOptions {
  /** The text to animate */
  text: string;
  /** Base speed in milliseconds per character (default: 80) */
  speed?: number;
  /** Random variation ± milliseconds for natural feel (default: 20) */
  randomVariation?: number;
  /** Whether animation should start immediately (default: true) */
  autoStart?: boolean;
}

/**
 * Return value from useTypingAnimation hook
 */
interface UseTypingAnimationResult {
  /** Currently displayed text (progressively built) */
  displayedText: string;
  /** Whether the full text has been displayed */
  isComplete: boolean;
  /** Reset and restart the animation */
  restart: () => void;
}
```

### Chat Conversation

```typescript
/**
 * Message type in the simulated conversation
 */
type ChatMessageRole = 'user' | 'assistant';

/**
 * A message in the simulated ChatGPT conversation
 */
interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  content: string | React.ReactNode;
  isAnimating?: boolean;
}

/**
 * Props for the ChatConversation component
 */
interface ChatConversationProps {
  /** Messages to display */
  messages: ChatMessage[];
  /** Current animation phase */
  phase: 'typing' | 'thinking' | 'response' | 'complete';
  /** Callback when all animations complete */
  onAnimationComplete?: () => void;
}

/**
 * Props for individual ChatMessage component
 */
interface ChatMessageProps {
  message: ChatMessage;
  /** Show typing animation for user message */
  showTypingAnimation?: boolean;
  /** Callback when typing animation completes */
  onTypingComplete?: () => void;
}
```

### Flow Preview

```typescript
/**
 * Props for the FlowPreview component
 */
interface FlowPreviewProps {
  /** Flow data including name and views */
  flow: Flow;
  /** App data for theming */
  app: App;
}

/**
 * Animation phases for the preview sequence
 */
type PreviewAnimationPhase =
  | 'idle'        // Initial state, waiting to start
  | 'typing'      // User message being typed
  | 'thinking'    // Pause simulating LLM processing
  | 'response'    // LLM response appearing
  | 'complete';   // All animations done

/**
 * State for managing preview animation
 */
interface PreviewAnimationState {
  phase: PreviewAnimationPhase;
  /** Key to force re-mount and restart animation */
  animationKey: number;
}
```

### Tab Component

```typescript
/**
 * Props for the Tabs container
 */
interface TabsProps {
  /** Currently active tab */
  activeTab: FlowDetailTab;
  /** Callback when tab changes */
  onTabChange: (tab: FlowDetailTab) => void;
  /** Tab configurations */
  tabs: TabConfig[];
  /** Additional CSS classes */
  className?: string;
}

/**
 * Props for individual Tab button
 */
interface TabProps {
  tab: TabConfig;
  isActive: boolean;
  onClick: () => void;
}
```

---

## State Management

### FlowDetail Page State (Extended)

```typescript
// Existing state preserved...
const [app, setApp] = useState<App | null>(null);
const [flow, setFlow] = useState<Flow | null>(null);
// ... other existing state

// NEW: Tab state
const [activeTab, setActiveTab] = useState<FlowDetailTab>('build');

// NEW: Preview animation trigger (forces re-mount on tab switch)
const [previewKey, setPreviewKey] = useState(0);

// Handler for tab changes
const handleTabChange = (tab: FlowDetailTab) => {
  setActiveTab(tab);
  if (tab === 'preview') {
    // Increment key to restart animation when switching to preview
    setPreviewKey(prev => prev + 1);
  }
};
```

---

## Existing Types (Referenced)

These types already exist in the codebase and will be reused:

```typescript
// From @chatgpt-app-builder/shared
interface Flow {
  id: string;
  appId: string;
  name: string;
  description?: string;
  toolName: string;
  toolDescription: string;
  isActive: boolean;
  views?: View[];
  // ... other fields
}

interface View {
  id: string;
  flowId: string;
  name?: string;
  layoutTemplate: LayoutTemplate; // 'table' | 'post-list'
  mockData?: MockDataEntityDTO;
  order: number;
  // ... other fields
}

interface App {
  id: string;
  name: string;
  logoUrl?: string;
  themeVariables?: ThemeVariables;
  // ... other fields
}
```

---

## No Backend Changes

This feature requires **no changes** to:
- Backend entities
- Database schema
- API endpoints
- Backend services

All data needed for the preview (flow, views, mock data, app theme) is already fetched by the existing FlowDetail page.

---

## Validation Rules

| Field | Rule | Enforcement |
|-------|------|-------------|
| `activeTab` | Must be one of: 'build', 'preview', 'usage' | TypeScript union type |
| `flow.name` | Used as user message; truncate if > 200 chars | Component display logic |
| `flow.views` | If empty, disable Preview tab | Tab disabled state |
| Preview tab | Only clickable when `flow.views.length > 0` | Tab component logic |

---

## State Transitions

### Preview Animation State Machine

```
idle → typing → thinking → response → complete
  ↑                                       │
  └───────────────────────────────────────┘
              (tab switch triggers reset)
```

| Transition | Trigger | Duration |
|------------|---------|----------|
| idle → typing | Preview tab activated | Immediate |
| typing → thinking | All characters displayed | ~2 seconds (based on text length) |
| thinking → response | Timer expires | 500-1000ms |
| response → complete | Component view mounted | Immediate |
| complete → idle | Tab switched away and back | Immediate |
