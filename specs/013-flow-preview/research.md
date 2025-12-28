# Research: Flow Preview with Tabbed Interface

**Feature Branch**: `013-flow-preview`
**Created**: 2025-12-28

## Overview

This document consolidates research findings for implementing the flow preview feature. Since the Technical Context had no NEEDS CLARIFICATION items, research focused on best practices for the two key technical aspects: typing animations and ChatGPT UI styling.

---

## 1. Typing Animation Implementation

### Decision
Use `useState` + `useEffect` with `setTimeout` for character-by-character animation, including slight random timing variation for a natural feel.

### Rationale
- **setTimeout** is the best choice for typing animations because:
  - Allows variable delays between characters (natural typing is not uniform)
  - Lower overhead than `requestAnimationFrame` (designed for 60fps visual sync, overkill for text)
  - `setInterval` is too rigid and feels robotic
  - Easy cleanup with `clearTimeout`
- Adding ±20ms random variation creates human-like typing
- React hooks pattern with cleanup prevents memory leaks

### Implementation Pattern

```typescript
function useTypingAnimation({ text, speed = 80, randomVariation = 20 }) {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!text) return;

    let currentIndex = 0;
    let timeoutId: number;
    let isCancelled = false;

    const typeNextChar = () => {
      if (isCancelled) return;

      if (currentIndex < text.length) {
        setDisplayedText(text.slice(0, currentIndex + 1));
        currentIndex++;

        const variance = Math.random() * randomVariation * 2 - randomVariation;
        const delay = Math.max(10, speed + variance);
        timeoutId = window.setTimeout(typeNextChar, delay);
      } else {
        setIsComplete(true);
      }
    };

    typeNextChar();
    return () => {
      isCancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [text, speed, randomVariation]);

  return { displayedText, isComplete };
}
```

### Alternatives Considered

| Approach | Why Rejected |
|----------|--------------|
| `requestAnimationFrame` | Overkill for typing; designed for 60fps visual animations |
| `setInterval` | Fixed intervals feel robotic; harder to vary timing |
| External libraries (react-type-animation) | Adds dependency; simple use case doesn't warrant it |

---

## 2. ChatGPT UI Styling

### Decision
Implement dark theme styling matching ChatGPT's conversation interface using the existing color palette already defined in `chatgpt.ts`, extended with conversation-specific elements.

### Rationale
- Project already has ChatGPT styling in `packages/frontend/src/components/preview/styles/chatgpt.ts`
- Dark theme is specified in requirements
- Consistent with existing `ChatStyleWrapper` component patterns

### Color Palette (Dark Theme)

| Element | Hex | Usage |
|---------|-----|-------|
| Main background | `#212121` | Conversation area |
| User message bg | `#3e3f4a` | User bubbles (slightly lighter) |
| Assistant message bg | `#212121` | Assistant area (same as main bg) |
| Primary text | `#ececf1` | Message content |
| Muted text | `rgba(255,255,255,0.4)` | Timestamps, labels |
| Brand accent | `#10a37f` | Highlights, links (OpenAI green) |

### Visual Patterns

**Message Layout:**
- User messages: Right-aligned, accent/darker background
- Assistant messages: Left-aligned, transparent/neutral background
- Maximum content width: ~768px (3xl)
- Generous vertical spacing between messages

**Avatars:**
- User: Circle with user icon (right side of user message)
- Assistant: Circle with bot/sparkle icon (left side of assistant message)
- Size: 32-40px diameter

**Typography:**
- Font: System sans-serif stack (existing Tailwind defaults)
- Size: 14-16px for message content
- Line height: Relaxed (`leading-relaxed`)
- Off-white text on dark backgrounds for readability

### Existing Assets to Reuse

| Component | Path | Usage |
|-----------|------|-------|
| ChatStyleWrapper | `components/preview/ChatStyleWrapper.tsx` | Conversation container styling |
| ChatGPT styles | `components/preview/styles/chatgpt.ts` | Color tokens, theme values |
| LayoutRenderer | `components/editor/LayoutRenderer.tsx` | Render views in LLM response |
| ThemeProvider | `components/editor/ThemeProvider.tsx` | App theme injection |

### Alternatives Considered

| Approach | Why Rejected |
|----------|--------------|
| Light theme | Spec explicitly requires dark ChatGPT theme |
| Custom design | Spec requires matching ChatGPT look and feel |
| Claude styling | Spec specifically mentions ChatGPT simulation |

---

## 3. Component Architecture

### Decision
Create focused, single-responsibility components following existing patterns.

### Component Structure

```
FlowPreview (orchestrator)
├── ChatConversation (message list container)
│   ├── ChatMessage (individual message with avatar)
│   │   └── TypingAnimation (animated text for user message)
│   └── ChatMessage (LLM response)
│       └── LayoutRenderer (existing, renders component view)
```

Note: No empty state needed in FlowPreview since the Preview tab is disabled when there are no views.

### State Flow

1. Preview tab activated → FlowPreview mounts
2. FlowPreview triggers typing animation for user message (flow name)
3. Typing completes (~2s) → brief pause (~500ms-1s)
4. LLM response with component view appears
5. User can re-trigger animation by switching tabs

### Rationale
- Single responsibility for each component (SOLID principle)
- Reuses existing infrastructure (LayoutRenderer, ThemeProvider)
- State managed at FlowPreview level for animation sequencing
- Consistent with existing component patterns in the codebase

---

## 4. Tab Implementation

### Decision
Use a simple controlled tab component with local state in FlowDetail.

### Rationale
- No need for routing-based tabs (tab state doesn't need to be in URL)
- State preserved in FlowDetail component across tab switches
- Simple implementation with Tailwind for styling

### Tab Behavior
- Default: Build tab (FR-007)
- Preserve editing state across switches (FR-008)
- Instant switching, no page reload (FR-012)
- Tab state resets on page refresh (per assumptions)
- **Preview tab disabled when flow has no views** (FR-011) - prevents users from accessing an empty preview; tab becomes enabled once views are added

---

## Summary

All research items resolved. The implementation will:
1. Use custom `useTypingAnimation` hook with setTimeout and random variation
2. Apply ChatGPT dark theme styling using existing `chatgpt.ts` tokens
3. Reuse `ChatStyleWrapper`, `LayoutRenderer`, and `ThemeProvider` components
4. Create 3-4 new focused components (Tabs, FlowPreview, ChatConversation, TypingAnimation)
5. Manage state locally in FlowDetail with React useState
