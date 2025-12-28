# Quickstart: Manifest Styles Adaptation

**Feature**: 009-manifest-styles
**Date**: 2025-12-27

## Overview

This feature updates the application's visual design to match the Manifest brand identity. The main changes are:

1. **Typography**: Inter font family for UI, monospace stack for code
2. **Color Palette**: Manifest-inspired colors with violet navigation
3. **Button Styling**: Updated border-radius and shadows
4. **Navigation**: Violet sidebar and header with light text

## Design Token Reference

### CSS Variables

Add/update in `packages/frontend/src/index.css`:

```css
:root {
  /* Navigation colors */
  --nav-bg: 271 67% 39%;           /* #6b21a8 */
  --nav-hover: 263 82% 58%;        /* #7c3aed */
  --nav-active: 262 83% 66%;       /* #8b5cf6 */
  --nav-foreground: 0 0% 100%;     /* #ffffff */

  /* Manifest palette */
  --background: 210 17% 98%;        /* #f8f9fa */
  --foreground: 240 5% 11%;         /* #1a1a1c */
  --border: 240 2% 86%;             /* #dadadb */

  /* Accent colors */
  --accent-success: 164 75% 53%;    /* #2be1b7 teal */
  --destructive: 1 100% 68%;        /* #FF5E5B red */

  /* Button radius */
  --radius: 0.375rem;
}
```

### Tailwind Config Updates

Add to `packages/frontend/tailwind.config.js`:

```javascript
theme: {
  extend: {
    colors: {
      nav: {
        DEFAULT: 'hsl(var(--nav-bg))',
        hover: 'hsl(var(--nav-hover))',
        active: 'hsl(var(--nav-active))',
        foreground: 'hsl(var(--nav-foreground))',
      },
      // ... existing colors
    },
    fontFamily: {
      sans: ['Inter', 'system-ui', 'sans-serif'],
      mono: ['Fira Code', 'SF Mono', 'Roboto Mono', 'Source Code Pro', 'Ubuntu Mono', 'monospace'],
    },
  },
}
```

## Component Styling Guide

### Sidebar

```tsx
// Sidebar.tsx
<aside className="w-56 bg-nav text-nav-foreground flex-shrink-0">
  {/* Logo area */}
  <div className="h-14 px-4 flex items-center border-b border-white/10">
    <span className="text-lg font-bold text-white">Manifest</span>
  </div>
  {/* Navigation */}
  <nav className="flex-1 p-3 space-y-1">
    {/* SidebarItems */}
  </nav>
</aside>
```

### SidebarItem

```tsx
// SidebarItem.tsx
<Link
  className={`
    flex items-center gap-3 px-3 py-2 rounded-lg transition-colors
    text-nav-foreground
    ${isActive
      ? 'bg-nav-active font-medium'
      : 'hover:bg-nav-hover'
    }
  `}
>
```

### Header

```tsx
// Header.tsx
<header className="bg-nav text-nav-foreground">
  <div className="h-14 px-4 flex items-center justify-between">
    {/* Content */}
  </div>
</header>
```

### Buttons

Update base styles in `button.tsx`:
- Border radius: Use `rounded-md` (maps to `--radius: 0.375rem`)
- Add box-shadow for depth: `shadow-sm hover:shadow`

## Font Loading

Add to `packages/frontend/index.html` `<head>`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Fira+Code:wght@400;500&display=swap" rel="stylesheet">
```

## Testing Checklist

- [ ] Sidebar displays violet background with white text
- [ ] Sidebar hover state shows lighter violet
- [ ] Sidebar active state shows even lighter violet
- [ ] Header displays violet background with white text
- [ ] Main content area uses off-white background
- [ ] All text is readable (contrast check)
- [ ] Buttons have rounded corners (0.375rem)
- [ ] Inter font loads and applies to body text
- [ ] Monospace font applies to code elements
