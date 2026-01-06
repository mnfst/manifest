# Research: Node Library Sidedrawer

**Feature**: Node Library Sidedrawer
**Branch**: `001-node-library`
**Date**: 2026-01-06

## Research Topics

### 1. Sidedrawer Animation Pattern

**Decision**: Use CSS transitions with Tailwind utility classes

**Rationale**:
- The codebase already uses Tailwind CSS animations (`animate-in fade-in zoom-in-95 duration-200` in StepTypeDrawer)
- No external animation library (Framer Motion, etc.) is currently installed
- CSS transitions are performant and achieve 60fps on modern browsers
- Adding an animation library would increase bundle size unnecessarily for this use case

**Implementation Approach**:
- Use `transform: translateX()` for slide-in/slide-out animation
- Tailwind classes: `transition-transform duration-300 ease-out`
- Closed state: `-translate-x-full` (off-screen left)
- Open state: `translate-x-0` (visible)
- Background overlay with `opacity` transition for smooth fade

**Alternatives Considered**:
| Alternative | Rejected Because |
|-------------|------------------|
| Framer Motion | Adds ~20KB to bundle, overkill for simple slide animation |
| CSS @keyframes | More complex for interruptible animations, Tailwind transitions sufficient |
| React Transition Group | Additional dependency, CSS transitions native and performant |

---

### 2. Navigation Animation (Groups → Nodes)

**Decision**: Use horizontal slide transition with stacked views

**Rationale**:
- Provides clear visual feedback of "drilling down" into a group
- Matches common mobile navigation patterns users are familiar with
- Can be implemented with CSS transforms without additional libraries

**Implementation Approach**:
- Container with `overflow-hidden` to clip content during transition
- Two view states rendered: groups list and nodes list
- Groups slide left when entering node view, nodes slide in from right
- Back navigation reverses the animation
- Use `transition-transform duration-200` for snappy feel

**Animation States**:
```
Root Level:        [Groups] visible, [Nodes] off-screen right
Transitioning In:  [Groups] sliding left, [Nodes] sliding in from right
Node Level:        [Groups] off-screen left, [Nodes] visible
Transitioning Out: [Groups] sliding in from left, [Nodes] sliding right
```

**Alternatives Considered**:
| Alternative | Rejected Because |
|-------------|------------------|
| Fade transition | Less intuitive for hierarchical navigation |
| Accordion/expand | Doesn't match sidedrawer metaphor, wastes vertical space |
| Instant swap | No visual feedback, disorienting for users |

---

### 3. Node Grouping Strategy

**Decision**: Create logical groups based on node function

**Rationale**:
- Current system has 3 node types: Interface, Return, CallFlow
- These map naturally to functional categories
- Grouping provides room for future node types without UI redesign

**Proposed Groups**:

| Group | Icon | Color | Nodes |
|-------|------|-------|-------|
| **Display** | `Layout` | Blue (#3B82F6) | Interface |
| **Output** | `FileOutput` | Green (#22C55E) | Return |
| **Flow Control** | `GitBranch` | Purple (#A855F7) | CallFlow |

**Node Configuration Structure**:
```typescript
interface NodeTypeConfig {
  type: NodeType;
  name: string;
  description: string;
  icon: LucideIcon;
  color: {
    bg: string;      // e.g., 'bg-blue-100'
    bgHover: string; // e.g., 'bg-blue-200'
    text: string;    // e.g., 'text-blue-600'
  };
  group: string;
}

interface NodeGroup {
  id: string;
  name: string;
  icon: LucideIcon;
  color: { bg: string; bgHover: string; text: string; };
  nodes: NodeTypeConfig[];
}
```

**Alternatives Considered**:
| Alternative | Rejected Because |
|-------------|------------------|
| Flat list (no groups) | Doesn't scale as more node types are added |
| Alphabetical grouping | No logical relationship, poor discoverability |
| Single "All Nodes" group | Defeats purpose of hierarchical navigation |

---

### 4. Search Implementation

**Decision**: Client-side filtering with case-insensitive substring match

**Rationale**:
- Small dataset (3 node types currently, unlikely to exceed 20-30)
- Instant feedback requirement (<100ms)
- No backend API changes needed

**Implementation Approach**:
- Search input with `onChange` handler (controlled component)
- Filter nodes by checking if `name.toLowerCase().includes(searchTerm.toLowerCase())`
- Debounce not needed for small dataset
- Show flat list of matching nodes (bypass group structure when searching)
- Clear search returns to group view

**Search UX**:
- Search bar only visible at root level (per spec)
- Placeholder: "Search nodes..."
- Clear button (X) when search has text
- Empty state message when no matches: "No nodes match your search"

**Alternatives Considered**:
| Alternative | Rejected Because |
|-------------|------------------|
| Fuzzy search (fuse.js) | Overkill for 3-30 items, adds bundle size |
| Backend search API | Unnecessary latency, data is already local |
| Debounced search | Not needed for small dataset, adds perceived delay |

---

### 5. Sidedrawer Positioning & Layout

**Decision**: Fixed position adjacent to main sidebar with collapsible toggle

**Rationale**:
- Spec requires "next to the sidebar" positioning
- Must not overlap canvas content
- Foldable behavior allows user to reclaim screen space

**Layout Strategy**:
```
+----------+------------------+----------------------+
| Sidebar  | Node Library     | Canvas (React Flow)  |
| (fixed)  | (collapsible)    | (fills remaining)    |
+----------+------------------+----------------------+
```

**Implementation**:
- Sidebar: fixed left, existing component unchanged
- Node Library: positioned to right of sidebar, width ~280px
- Canvas container: flex-1, adjusts based on Node Library state
- Toggle button: chevron icon at the edge of the library when closed

**Z-index Considerations**:
- Sidebar: existing z-index
- Node Library: z-40 (below modals z-50)
- Canvas: default stacking

**Alternatives Considered**:
| Alternative | Rejected Because |
|-------------|------------------|
| Overlay drawer | Covers canvas, poor UX for frequent use |
| Tab within sidebar | Sidebar has different purpose, mixing concerns |
| Floating panel | Inconsistent with sidedrawer spec requirement |

---

### 6. State Management

**Decision**: Local component state with lifted open/closed state

**Rationale**:
- Node Library state is UI-only, no persistence needed
- Parent component (FlowDetail or layout) controls visibility
- Internal state manages current view (groups/nodes) and search

**State Structure**:
```typescript
// Parent controls
interface NodeLibraryProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectNode: (nodeType: NodeType) => void;
  disabledTypes?: NodeType[];
}

// Internal state
const [currentView, setCurrentView] = useState<'groups' | 'nodes'>('groups');
const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
const [searchTerm, setSearchTerm] = useState('');
```

**Alternatives Considered**:
| Alternative | Rejected Because |
|-------------|------------------|
| Global state (Redux/Zustand) | Overkill for UI-only state, not persisted |
| URL state | Navigation not tied to browser history |
| Context provider | Unnecessary indirection for single consumer |

---

## Summary

All research topics resolved. Key decisions:
1. **Animations**: CSS transitions with Tailwind (existing pattern)
2. **Navigation**: Horizontal slide between groups and nodes
3. **Grouping**: 3 functional groups (Display, Output, Flow Control)
4. **Search**: Client-side case-insensitive filtering
5. **Positioning**: Fixed next to sidebar, collapsible
6. **State**: Local component state, parent controls visibility

No external libraries required. Implementation uses existing tech stack (React, Tailwind, Lucide icons).
