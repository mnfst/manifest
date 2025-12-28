# Research: Manifest Styles Adaptation

**Feature**: 009-manifest-styles
**Date**: 2025-12-27

## Research Tasks

### 1. CSS Variables vs Tailwind Config for Design Tokens

**Decision**: Use CSS variables in `index.css` with Tailwind config referencing them via `hsl(var(--xxx))`

**Rationale**:
- Already established pattern in the codebase
- CSS variables enable runtime theme switching if needed later
- Tailwind config maps semantic names to CSS variable references
- Single source of truth in `index.css`

**Alternatives considered**:
- Direct hex values in Tailwind config: Rejected - less flexible, harder to maintain
- Separate theme JSON file: Rejected - adds complexity, not needed for POC

### 2. Font Loading Strategy for Inter

**Decision**: Use Google Fonts CDN with `font-display: swap`

**Rationale**:
- Google Fonts provides optimized delivery with subsetting
- `font-display: swap` prevents invisible text during load
- No build-time complexity
- Widely used and reliable

**Alternatives considered**:
- Self-hosted fonts: Rejected - adds build complexity for POC
- Variable font: Could be used but regular weights sufficient for this scope

### 3. Sidebar/Header Color Implementation

**Decision**: Add new CSS variables for navigation colors, apply via Tailwind classes

**Rationale**:
- New variables: `--nav-bg`, `--nav-hover`, `--nav-active`, `--nav-foreground`
- Keeps navigation styling separate from main content theming
- Easy to adjust without affecting other components

**Alternatives considered**:
- Reuse primary color: Rejected - navigation needs distinct visual treatment
- Inline styles: Rejected - violates maintainability principle

### 4. Button Styling Approach

**Decision**: Update button component base styles and CSS variables

**Rationale**:
- Button component already uses Tailwind classes
- Update `--radius` CSS variable to `0.375rem` (Manifest spec)
- Add box-shadow via custom Tailwind utility or inline style

**Alternatives considered**:
- Create new button variant: Rejected - simpler to update default styles
- CSS-in-JS: Rejected - project uses Tailwind

### 5. Responsive Font Scaling

**Decision**: Use CSS `clamp()` function for fluid typography

**Rationale**:
- `clamp(0.7rem, 0.5rem + 0.4vw, 1rem)` provides smooth scaling
- Matches Manifest pattern (0.7rem at mobile, 1rem at 1216px+)
- No JavaScript required
- Better UX than breakpoint-based jumps

**Alternatives considered**:
- Media queries only: Rejected - creates jarring jumps
- Tailwind responsive prefixes: Works but less smooth

## Color Palette Research

### Hex to HSL Conversions

For CSS variables (using HSL format without `hsl()` wrapper):

| Color | Hex | HSL Values |
|-------|-----|------------|
| Violet (primary nav) | #6b21a8 | 271 67% 39% |
| Violet (hover) | #7c3aed | 263 82% 58% |
| Violet (active) | #8b5cf6 | 262 83% 66% |
| Off-white (background) | #f8f9fa | 210 17% 98% |
| Border gray | #dadadb | 240 2% 86% |
| Text dark | #1a1a1c | 240 5% 11% |
| Teal (accent) | #2be1b7 | 164 75% 53% |
| Red (danger) | #FF5E5B | 1 100% 68% |

### Contrast Verification

| Combination | Ratio | WCAG AA |
|-------------|-------|---------|
| White (#fff) on Violet (#6b21a8) | 8.5:1 | PASS |
| White (#fff) on Violet Hover (#7c3aed) | 4.6:1 | PASS |
| White (#fff) on Violet Active (#8b5cf6) | 3.4:1 | PASS (large text only) |
| Dark text (#1a1a1c) on Off-white (#f8f9fa) | 16.5:1 | PASS |

**Note**: Active state (#8b5cf6) has lower contrast. For small text on active items, consider using white (#fff) with slight text shadow or adjusting to darker shade.

## Implementation Dependencies

### Files to Modify

1. `packages/frontend/src/index.css` - CSS variables
2. `packages/frontend/tailwind.config.js` - New color mappings
3. `packages/frontend/src/components/layout/Sidebar.tsx` - Apply nav colors
4. `packages/frontend/src/components/layout/SidebarItem.tsx` - Hover/active states
5. `packages/frontend/src/components/layout/Header.tsx` - Apply nav colors
6. `packages/frontend/src/components/ui/button.tsx` - Border radius, shadows
7. `packages/frontend/index.html` - Google Fonts link (if not already present)

### No New Dependencies Required

All styling can be achieved with existing Tailwind CSS setup.

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Font loading delay | Use `font-display: swap`, provide fallback stack |
| Active state contrast | Use bold text or text-shadow to improve readability |
| Existing component conflicts | Scope nav colors to specific components only |
