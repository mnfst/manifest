# Quickstart: Flow Preview with Tabbed Interface

**Feature Branch**: `013-flow-preview`
**Created**: 2025-12-28

## Overview

This guide provides step-by-step instructions for implementing the flow preview feature. The feature adds a tabbed interface (Build / Preview / Usage) to the flow detail page, with the Preview tab displaying a simulated ChatGPT conversation.

---

## Prerequisites

- Node.js 18+ installed
- Repository cloned and dependencies installed (`npm install`)
- Familiarity with React, TypeScript, and Tailwind CSS
- Understanding of existing FlowDetail page structure

---

## Implementation Order

### Phase 1: Tab Infrastructure (Estimated: 2-3 tasks)

1. **Create Tabs Component**
   - Location: `packages/frontend/src/components/common/Tabs.tsx`
   - Simple controlled tab component with Tailwind styling
   - Props: `activeTab`, `onTabChange`, `tabs` array
   - Support for disabled tabs (Preview disabled when no views)

2. **Integrate Tabs into FlowDetail**
   - Modify: `packages/frontend/src/pages/FlowDetail.tsx`
   - Add tab state (`useState<FlowDetailTab>('build')`)
   - Insert tab bar below the flow info header
   - Conditionally render content based on active tab

3. **Implement Usage Tab Placeholder**
   - Simple "Coming Soon..." centered message
   - Can be inline in FlowDetail or extracted to component

### Phase 2: Typing Animation (Estimated: 1-2 tasks)

4. **Create useTypingAnimation Hook**
   - Location: `packages/frontend/src/hooks/useTypingAnimation.ts`
   - Implement character-by-character animation with setTimeout
   - Add random timing variation for natural feel
   - Include proper cleanup to prevent memory leaks

5. **Create TypingAnimation Component (Optional)**
   - Location: `packages/frontend/src/components/preview/TypingAnimation.tsx`
   - Wrapper component that uses the hook
   - Displays animated text with optional cursor

### Phase 3: Chat Conversation UI (Estimated: 2-3 tasks)

6. **Create ChatMessage Component**
   - Location: `packages/frontend/src/components/preview/ChatMessage.tsx`
   - Avatar (user icon or bot icon based on role)
   - Message bubble with appropriate styling
   - Support for both text content and React node content

7. **Create ChatConversation Component**
   - Location: `packages/frontend/src/components/preview/ChatConversation.tsx`
   - Container with ChatGPT dark theme styling
   - Renders list of ChatMessage components
   - Manages animation phase transitions

### Phase 4: Flow Preview Integration (Estimated: 2-3 tasks)

8. **Create FlowPreview Component**
   - Location: `packages/frontend/src/components/preview/FlowPreview.tsx`
   - Orchestrates the preview experience
   - Uses ChatConversation for conversation UI
   - Uses LayoutRenderer for component view in LLM response
   - Note: Component assumes views exist (tab is disabled otherwise)

9. **Integrate FlowPreview into FlowDetail**
   - Render FlowPreview when Preview tab is active
   - Pass flow and app data
   - Handle animation restart on tab switch

10. **Polish and Edge Cases**
    - Handle long flow names (truncation)
    - Handle flows with no mock data (use defaults)
    - Test rapid tab switching
    - Verify Preview tab is disabled when no views exist

---

## Key Files to Modify

| File | Change Type | Description |
|------|-------------|-------------|
| `FlowDetail.tsx` | MODIFY | Add tab state, tab bar, conditional content rendering |
| `Tabs.tsx` | CREATE | Reusable tab component |
| `useTypingAnimation.ts` | CREATE | Animation hook |
| `ChatMessage.tsx` | CREATE | Individual message component |
| `ChatConversation.tsx` | CREATE | Conversation container |
| `FlowPreview.tsx` | CREATE | Main preview orchestrator |

---

## Existing Components to Reuse

| Component | Import From | Usage |
|-----------|-------------|-------|
| `LayoutRenderer` | `../components/editor/LayoutRenderer` | Render views in LLM response |
| `ThemeProvider` | `../components/editor/ThemeProvider` | Apply app theme |
| `chatgptStyles` | `../components/preview/styles/chatgpt` | Color tokens |

---

## Development Workflow

```bash
# Start development server
npm run dev

# Navigate to any flow detail page
# http://localhost:5173/app/{appId}/flow/{flowId}

# Test tab switching and preview animation
```

---

## Testing Checklist

### Tab Functionality
- [ ] Build tab shows existing flow diagram editor
- [ ] Preview tab shows ChatGPT conversation simulation (when flow has views)
- [ ] Preview tab is disabled when flow has no views
- [ ] Usage tab shows "Coming Soon..." message
- [ ] Default tab is Build on page load
- [ ] Tab state preserved across switches (no data loss)

### Preview Animation
- [ ] User message appears with typing animation
- [ ] Typing completes within ~2 seconds
- [ ] Brief pause after typing (thinking simulation)
- [ ] LLM response appears with component view
- [ ] Animation restarts when switching away and back to Preview

### Visual Fidelity
- [ ] Dark theme matches ChatGPT styling
- [ ] User message has user avatar and right-aligned styling
- [ ] LLM response has bot avatar and left-aligned styling
- [ ] Component view renders correctly with mock data

### Edge Cases
- [ ] Long flow names are truncated appropriately
- [ ] Flows with no views have Preview tab disabled
- [ ] Flows with no mock data render with defaults
- [ ] Rapid tab switching doesn't cause glitches
- [ ] Adding first view enables Preview tab dynamically

---

## Code Patterns

### Tab State Pattern
```tsx
const [activeTab, setActiveTab] = useState<FlowDetailTab>('build');
const [previewKey, setPreviewKey] = useState(0);

const handleTabChange = (tab: FlowDetailTab) => {
  setActiveTab(tab);
  if (tab === 'preview') {
    setPreviewKey(prev => prev + 1); // Restart animation
  }
};
```

### Animation Sequencing Pattern
```tsx
// In FlowPreview
const [phase, setPhase] = useState<PreviewAnimationPhase>('typing');

// Typing complete → start thinking delay
const handleTypingComplete = () => {
  setPhase('thinking');
  setTimeout(() => setPhase('response'), 750);
};
```

### Conditional Rendering Pattern
```tsx
{activeTab === 'build' && (
  <FlowDiagram ... />
)}
{activeTab === 'preview' && (
  <FlowPreview key={previewKey} flow={flow} app={app} />
)}
{activeTab === 'usage' && (
  <div className="flex-1 flex items-center justify-center">
    <p className="text-muted-foreground">Coming Soon...</p>
  </div>
)}
```

---

## Success Criteria Verification

| Criteria | How to Verify |
|----------|---------------|
| Tab switching <300ms | Visual check, no perceptible lag |
| Animation <4s total | Stopwatch or browser devtools |
| ChatGPT visual fidelity | Compare with actual ChatGPT interface |
| No regressions in Build | All existing functionality still works |
| Tab state persistence | Edit in Build, switch to Preview, switch back - edits preserved |
