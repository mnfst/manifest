# CLAUDE.md

This file provides guidance for Claude Code when working with this repository.

## Project Overview

Manifest is a monorepo containing tools for building MCP (Model Context Protocol) servers with agentic UI components.

## Repository Structure

```
packages/
├── manifest-ui/   # Component registry (Next.js) - port 3001
├── create-manifest/      # CLI for scaffolding new projects
└── starter/              # Starter template (nested pnpm workspace) - port 3000
    ├── server/           # MCP server (Express + TypeScript)
    └── web/              # Web client (Next.js)
```

## Important: Nested Workspace

The `packages/starter` directory is a **nested pnpm workspace** with its own `pnpm-lock.yaml`. You must install dependencies in both locations:

```bash
# Root dependencies
pnpm install

# Starter package dependencies (required!)
cd packages/starter && pnpm install
```

## Common Commands

```bash
# Start development (from root)
pnpm run dev

# Build all packages
pnpm run build

# Lint all packages
pnpm run lint

# Run tests
pnpm run test
```

## Development Workflow

1. Run `pnpm install` at the root
2. Run `pnpm install` in `packages/starter`
3. Run `pnpm run dev` to start both the registry (port 3001) and starter server (port 3000)

## Testing with ChatGPT

Use ngrok to expose the local MCP server:

```bash
ngrok http 3000
```

Connect using: `https://xxxx.ngrok-free.app/mcp`

## Key Files

- `/packages/starter/server/src/index.ts` - Main MCP server entry point
- `/packages/manifest-ui/registry.json` - Component registry definitions
- `/turbo.json` - Turborepo configuration

## Pull Request Guidelines

**CRITICAL**: When creating pull requests, you MUST use the PR template format from `.github/pull_request_template.md`.

### Required PR Body Format

Always structure PR bodies exactly like this:

```markdown
## Description

[Your description of changes goes here - explain WHAT changed and WHY]

## Related Issues

[Link related issues using #123 format, or write "None" if no related issues]

## How can it be tested?

[Step-by-step instructions for testing the changes]

## Check list before submitting

- [x] This PR is wrote in a clear language and correctly labeled
- [x] I have performed a self-review of my code (no debugs, no commented code, good naming, etc.)
- [ ] I wrote the relative tests
- [ ] I created a PR for the [documentation](https://github.com/mnfst/docs) if necessary and attached the link to this PR
```

### Rules

1. **NEVER** put description text before the `## Description` heading
2. **ALWAYS** fill in content UNDER each section heading
3. **ALWAYS** include all four sections even if some are "None" or "N/A"
4. **CHECK** the boxes that apply (change `[ ]` to `[x]`)
5. Use the HEREDOC format when calling `gh pr create`:

```bash
gh pr create --title "feat: your title" --body "$(cat <<'EOF'
## Description

Your description here.

## Related Issues

#123 or None

## How can it be tested?

1. Step one
2. Step two

## Check list before submitting

- [x] This PR is wrote in a clear language and correctly labeled
- [x] I have performed a self-review of my code (no debugs, no commented code, good naming, etc.)
- [ ] I wrote the relative tests
- [ ] I created a PR for the [documentation](https://github.com/mnfst/docs) if necessary and attached the link to this PR
EOF
)"
```

## Block Development Guidelines

**CRITICAL**: When adding or editing a block, you MUST update ALL related code across the codebase.

### Complete Update Requirement (CRITICAL)

**When modifying ANY aspect of a block, you MUST update EVERY place that references it.**

A block modification is NOT complete until you have updated:

| Location | What to Update |
|----------|----------------|
| `registry/<category>/<block>.tsx` | Component code, interfaces, props, default values |
| `app/blocks/[category]/[block]/page.tsx` | `usageCode`, component preview, block metadata, default data |
| `registry.json` | Version bump (PATCH/MINOR/MAJOR) |
| `changelog.json` | Changelog entry for the new version |

#### What Lives in `page.tsx`

The block detail page (`app/blocks/[category]/[block]/page.tsx`) contains:

1. **Block metadata** - `id`, `name`, `description`, `registryName`, `layouts`, `actionCount`
2. **Variants array** - Each variant has:
   - `id`, `name` - Variant identifier and display name
   - `component` - The actual React component with props for preview
   - `usageCode` - **String** that developers copy-paste (MUST match the component interface exactly)
3. **Default data** - Sample data used in the preview

#### Common Mistakes to Avoid

- Changing a prop name in the `.tsx` file but forgetting to update `usageCode`
- Removing a prop from the interface but leaving it in `usageCode`
- Adding a new required prop but not showing it in `usageCode`
- Updating default values in the component but not reflecting them in preview data

#### Verification Steps

After ANY component change:
1. Read the component `.tsx` file to understand the current interface
2. Read the `page.tsx` block definition to see current `usageCode`
3. Ensure `usageCode` exactly matches the component's interface
4. Ensure the preview component uses the correct props
5. Bump version in `registry.json`
6. Add changelog entry in `changelog.json`

### Required Files to Update

When creating or modifying a block, update these files:

1. **Component file**: `packages/manifest-ui/registry/<category>/<block-name>.tsx`
2. **Registry definition**: `packages/manifest-ui/registry.json`
3. **Block demo with usage example**: `packages/manifest-ui/app/blocks/[category]/[block]/page.tsx`
4. **Sidebar navigation** (if new block): `packages/manifest-ui/app/blocks/page.tsx`
5. **Category navigation** (if new): `packages/manifest-ui/lib/blocks-categories.ts`

### Avatar Pattern (IMPORTANT)

**All components with avatars MUST support both image URLs and letter fallbacks.**

When a component displays an avatar (e.g., in messaging, comments, profiles), implement this pattern:

```typescript
// In the component's data interface
data?: {
  avatarUrl?: string       // Image URL (optional, takes priority over letter)
  avatarFallback?: string  // Letter fallback (e.g., "S" for Sarah)
  // ... other props
}
```

**Implementation:**
- If `avatarUrl` is provided and loads successfully → show the image
- If `avatarUrl` fails to load OR is not provided → show letter in a colored circle
- Always require `avatarFallback` (letter) as the fallback

**usageCode example:**
```tsx
<MessageBubble
  data={{
    avatarUrl: "https://i.pravatar.cc/150?u=sarah",  // Optional image URL
    avatarFallback: "S",  // Letter fallback (required)
    // ...
  }}
/>
```

This ensures components gracefully handle missing or broken avatar images.

### Usage Example Requirements

Every block variant in `app/blocks/[category]/[block]/page.tsx` MUST have a `usageCode` field with a comprehensive example that demonstrates:

1. **All common props** - Show the typical props a developer would use
2. **Realistic demo data** - Use meaningful placeholder data, not just "test" or "foo"
3. **Action handlers** - Include `console.log` examples for all actions
4. **Proper prop categories** - Use the standard `data`, `actions`, `appearance`, `control` structure

### Props Structure Pattern

All blocks follow this consistent props pattern:

```typescript
export interface BlockProps {
  data?: {
    // Content/configuration - titles, items, amounts, etc.
  }
  actions?: {
    // Event handlers - onSubmit, onClick, onSelect, etc.
  }
  appearance?: {
    // Visual/styling - variant, currency, columns, theme, etc.
  }
  control?: {
    // State/loading - isLoading, value, disabled, etc.
  }
}
```

### Complete Usage Example Template

When adding a block to `app/blocks/page.tsx`, follow this pattern:

```typescript
{
  id: "my-block",
  name: "My Block",
  description: "A brief description of what this block does",
  registryName: "my-block",
  layouts: ["inline", "fullscreen"],
  actionCount: 2,
  variants: [
    {
      id: "default",
      name: "Default",
      component: <MyBlock {...defaultProps} />,
      usageCode: `<MyBlock
  data={{
    title: "Welcome to My Block",
    items: [
      {
        id: "1",
        name: "First Item",
        description: "Description of first item",
        price: 29.99,
        image: "/demo/item-1.png"
      },
      {
        id: "2",
        name: "Second Item",
        description: "Description of second item",
        price: 49.99,
        image: "/demo/item-2.png"
      }
    ]
  }}
  appearance={{
    variant: "default",
    currency: "USD",
    columns: 2
  }}
  actions={{
    onItemSelect: (item) => console.log("Selected:", item),
    onSubmit: (data) => console.log("Submitted:", data)
  }}
  control={{
    isLoading: false
  }}
/>`
    },
    {
      id: "compact",
      name: "Compact",
      component: <MyBlock {...compactProps} />,
      usageCode: `<MyBlock
  data={{
    title: "Compact View",
    items: [{ id: "1", name: "Item", price: 19.99 }]
  }}
  appearance={{ variant: "compact" }}
  actions={{ onItemSelect: (item) => console.log(item) }}
/>`
    }
  ]
}
```

### Version Bump Requirements (CRITICAL)

**Every modification to a block's source files MUST include a version bump in `registry.json`.**

This is enforced by automated tests that will fail if:
1. You modified any file in `registry/**/*.tsx`
2. But did NOT update the corresponding component's `version` in `registry.json`

#### Semantic Versioning Guide

| Change Type | Version Bump | Examples |
|-------------|--------------|----------|
| **PATCH** | `1.0.0` → `1.0.1` | Bug fixes, styling fixes, refactoring without API changes |
| **MINOR** | `1.0.0` → `1.1.0` | New features, new optional props, new variants |
| **MAJOR** | `1.0.0` → `2.0.0` | Breaking changes: removing/renaming props, changing behavior |

#### Example

```json
// Before modifying message-bubble.tsx
{ "name": "message-bubble", "version": "1.0.0", ... }

// After bug fix - bump PATCH
{ "name": "message-bubble", "version": "1.0.1", ... }
```

### Changelog Requirements (CRITICAL)

**Every version MUST have a corresponding changelog entry in `changelog.json`.**

This is enforced by automated tests that will fail if:
1. A component has a version in `registry.json`
2. But does NOT have a changelog entry for that version in `changelog.json`

#### Changelog File Structure

The changelog is stored in `packages/manifest-ui/changelog.json`:

```json
{
  "components": {
    "component-name": {
      "1.0.0": "Initial release with core features",
      "1.0.1": "Fixed a display issue on mobile devices",
      "1.1.0": "Added new compact variant"
    }
  }
}
```

#### Changelog Entry Guidelines

1. **Keep it simple** - One sentence, non-technical if possible
2. **Focus on user impact** - What changed from the user's perspective
3. **Be specific** - Avoid vague descriptions like "bug fixes"

**Good examples:**
- "Initial release with text, image, and voice message support"
- "Fixed images not loading on slow connections"
- "Added dark mode support"
- "Improved accessibility with better screen reader support"

**Bad examples:**
- "Bug fixes" (too vague)
- "Refactored internal state management" (too technical)
- "Updated dependencies" (not user-facing)

### Events Category Guidelines (CRITICAL)

**When creating or modifying Events category components, follow these guidelines:**

#### Event Data Structure

All event components use a shared `Event` interface:

```typescript
type EventLocationType = "physical" | "online" | "hybrid"

interface Event {
  id: string
  title: string
  category: string             // "Music", "Comedy", "Classes", "Nightlife", "Sports"
  locationType?: EventLocationType // defaults to "physical"
  venue?: string               // Optional for online events
  neighborhood?: string
  city?: string                // Optional for online events
  onlineUrl?: string           // For online/hybrid events
  startDateTime: string        // ISO format: "2025-01-11T21:00:00Z"
  endDateTime?: string         // ISO format: "2025-01-12T03:00:00Z"
  priceRange: string           // "$45 - $150", "Free"
  image?: string
  vibeTags?: VibeTag[]         // ["High energy", "Late night", "Dressy"]
  vibeDescription?: string
  aiSummary?: string           // AI-generated match explanation
  lineup?: string[]
  eventSignal?: EventSignal
  ticketSignal?: TicketSignal
  organizerRating?: number
  reviewCount?: number
  hasMultipleDates?: boolean
  discount?: string
}
```

#### Event Location Types

Events can be physical, online, or hybrid:
- `physical` - In-person event with venue and city (default)
- `online` - Virtual event with `onlineUrl`, no venue/city required
- `hybrid` - Both in-person and online, has venue/city AND `onlineUrl`

#### Date/Time Formatting

Store dates as ISO 8601 strings. The component automatically formats for display:
- **Today**: "Tonight 9:00 PM - 3:00 AM"
- **Tomorrow**: "Tomorrow 8:00 PM"
- **Future dates**: "Jan 15 7:00 PM"

```typescript
// Example usage
startDateTime: "2025-01-11T21:00:00Z"  // 9 PM UTC
endDateTime: "2025-01-12T03:00:00Z"    // 3 AM UTC next day
```

#### Signal Types

**Event Signals** - Status indicators for events:

```typescript
type EventSignal =
  | "going-fast"       // Orange - "Going Fast"
  | "popular"          // Pink - "Popular"
  | "just-added"       // Blue - "Just Added"
  | "sales-end-soon"   // Red - "Sales End Soon"
  | "few-tickets-left" // Orange - "Few Tickets Left"
  | "canceled"         // Gray - "Canceled"
  | "ended"            // Gray - "Ended"
  | "postponed"        // Yellow - "Postponed"
```

**Ticket Signals** - Status indicators for ticket availability:

```typescript
type TicketSignal =
  | "discount-applied"       // Green - "Discount Applied"
  | "few-tickets-left"       // Orange - "Few Tickets Left"
  | "less-than-10-remaining" // Orange - "Less than 10 Remaining"
  | "more-than-11-remaining" // Gray - "More than 11 Remaining"
  | "not-yet-on-sale"        // Blue - "Not Yet On Sale"
  | "sales-end-soon"         // Red - "Sales End Soon"
  | "sales-ended"            // Gray - "Sales Ended"
  | "sold-out"               // Red - "Sold Out"
  | "unavailable"            // Gray - "Unavailable"
  | "unlocked"               // Green - "Unlocked"
```

**Vibe Tags** - Descriptive tags for event atmosphere (multiple selection):

```typescript
type VibeTag =
  | "All night"        | "Beginner-friendly" | "Casual"
  | "Classic"          | "Cocktails"         | "Creative"
  | "Date night"       | "Discover"          | "Dressy"
  | "Educational"      | "Exciting"          | "Family-friendly"
  | "Fun"              | "Hands-on"          | "High energy"
  | "Interactive"      | "Intimate"          | "Late night"
  | "Outdoor"          | "Relaxing"          | "Social"
  | "Sophisticated"    | "Tasting"           | "Underground"
  | "Upscale"          | "Views"             | "Wellness"
```

#### Event Detail Sections

The `event-detail` component has 11 sections in this order:
1. Image header with title overlay
2. Event basics (date, time, price, location)
3. AI match explanation (optional, personalized recommendation)
4. About section (description)
5. Good to know (accessibility, dress code, age restriction)
6. Organizer info (name, rating, verified badge)
7. Location with map
8. Amenities (parking, food, etc.)
9. Policies (refund, entry requirements)
10. FAQ (expandable questions)
11. CTAs (Get Tickets, Share, Save)

#### EventList Requirements

Like PostList, the `EventList` component requires sufficient demo data:
- Include at least 10 events in `usageCode` for grid/carousel demos
- Use diverse categories and price ranges
- Include various event signals to show all badge types

#### Ticket Selection Flow

The ticket selection follows this pattern:
1. `ticket-select` - Simple quantity picker for single ticket type
2. `tier-select` - Multiple tiers with individual quantities
3. `event-checkout` - Order summary with fees breakdown
4. `event-confirmation` - Booking confirmation with QR code

### PostList Block Requirements (CRITICAL)

**The PostList block MUST always have exactly 15 posts in its `usageCode` data.**

This is required because:
1. The PostList component does NOT have default posts - it requires data to be passed
2. Users copy-paste the usage code to test in MCP Jam - they need complete data
3. 15 posts provides a realistic dataset for pagination and scrolling demos

When updating PostList variants in `app/blocks/page.tsx` or `app/blocks/[category]/[block]/page.tsx`:
- Always include all 15 posts in the `data.posts` array
- Use the standard 15 demo posts (Sarah Chen, Alex Rivera, Jordan Kim, etc.)
- Never use placeholders like `[...]` or truncated arrays

### Checklist for Block Changes

Before submitting a PR with block changes:

**Synchronization (CRITICAL):**
- [ ] **Component interface matches `usageCode`** - Every prop in the interface is shown in usageCode
- [ ] **`usageCode` uses correct prop names** - No stale/renamed props in usageCode
- [ ] **Preview component uses current props** - The `<Component />` in variants uses the right props
- [ ] **Default values are consistent** - Defaults in component match what's shown in preview

**Versioning (REQUIRED):**
- [ ] **Version bumped in `registry.json`** (tests will fail otherwise)
- [ ] **Changelog entry added in `changelog.json`** (tests will fail otherwise)

**Quality:**
- [ ] Component implements the standard props pattern (`data`, `actions`, `appearance`, `control`)
- [ ] Block is registered in `registry.json` with correct dependencies
- [ ] EVERY variant has a `usageCode` field with comprehensive example
- [ ] Usage example shows realistic data (not placeholder text like "test" or "foo")
- [ ] All action handlers are demonstrated with `console.log` examples
- [ ] New category added to `blocks-categories.ts` if needed
- [ ] **PostList block has exactly 15 posts in usageCode** (if modifying PostList)

## Package-Specific Guidance

See individual package `CLAUDE.md` files for package-specific guidance:
- `packages/manifest-ui/CLAUDE.md` - UI toolkit development guidelines

## SEO Guidelines for ui.manifest.build

The manifest-ui package powers https://ui.manifest.build. Follow these SEO best practices:

### Automated SEO Tests

SEO requirements are enforced by tests in `__tests__/seo.test.ts`. Run `pnpm test` to verify:
- Meta tags configuration
- Sitemap and robots.txt presence
- Structured data (JSON-LD)
- Heading hierarchy
- Image alt text

### Key SEO Files

| File | Purpose |
|------|---------|
| `app/layout.tsx` | Global metadata, JSON-LD structured data |
| `app/sitemap.ts` | Dynamic sitemap generation |
| `app/robots.ts` | Crawler directives |
| `app/blocks/layout.tsx` | /blocks page metadata |

### When Adding New Pages

1. **Add page-specific metadata** using Next.js Metadata API
2. **Update sitemap.ts** to include the new route
3. **Use semantic HTML** - one `<h1>` per page, proper heading hierarchy
4. **Add alt text** to all images

### When Modifying Existing Pages

1. **Preserve heading structure** - don't remove or duplicate `<h1>`
2. **Keep alt text** on images descriptive and relevant
3. **Run SEO tests** before committing: `pnpm test`

### Image Best Practices

- Always include descriptive `alt` attributes
- Use Next.js `Image` component when possible for optimization
- Keep OG images under 100KB

