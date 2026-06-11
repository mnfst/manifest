# UI Anomalies — PR #2193 Review

## Anomaly 1 — Remove legacy "Connect providers" modal

**What**: The "Connect providers" modal (with Subscription / API Keys / Local tabs) still appears on the agent Routing page and the Playground. It was supposed to be removed after the global-providers pivot.

**Fix**: Delete the modal component and all call sites that open it from agent detail pages and Playground. Replaced by Anomaly 4's behavior.

**Files likely involved**: `ProviderSelectModal`, `Routing.tsx`, `Playground.tsx`

---

## Anomaly 2 — "Manage" modal on provider detail page

**What**: When clicking "Manage" on a provider detail page (e.g. OpenAI at `/providers/connections/:id`), the modal that opens has several issues:
- Title says "Connect providers" instead of the provider name (e.g. "OpenAI")
- A back arrow on the top-left that shouldn't be there
- No way to rename the connection

**Fix**:
- Change title to the provider name (e.g. "OpenAI") or "Manage connection"
- Replace the back arrow with an X close button on the top-right
- Add an editable field showing the connection name (label) with save/cancel

**Files likely involved**: `ConnectionDetail.tsx` or its manage modal component

---

## Anomaly 3 — Inline rename on provider list pages (always available)

**What**: On provider list pages (Subscriptions, BYOK, Local), there is no way to rename a connection when you only have one. Rename should always be available, not just when 2+ keys exist.

**Expected behavior**:
- Each connection row shows a "Rename" button (and a trash icon if removable)
- Clicking Rename: the name becomes an inline text field with Save / Cancel buttons (see reference screenshot)
- Validation: error if the new name already exists on another connection of the same provider
- The rename propagates to all routes/connections referencing that label
- Also available from the provider list pages via a pen icon on hover over the name

**Reference design**: Field with current name + Save (dark) + Cancel buttons inline

**Files likely involved**: `ProviderKeyForm.tsx`, provider list components, `provider.service.ts` (backend rename already works)

---

## Anomaly 4 — Replace "Connect providers" button with contextual cards

**What**: On agent detail (Routing tab) and Playground, the "Connect providers" button and its modal should never appear. Instead:

**When NO connections exist** (no subscription, no API key, no local):
- Show three cards in a horizontal row:
  - **Subscriptions**: link to subscriptions page, count of available connections, short description ("Use your existing paid plans. You can add several from the same provider.")
  - **BYOK**: link to BYOK page, count, description
  - **Local**: link to local page, count, description

**When at least ONE connection exists** (any type):
- Show nothing. The sidebar already provides navigation to provider pages.

**Applies to both**: Agent detail Routing tab AND Playground page.

**Fix**: Create a `NoConnectionsCard` component with three horizontal cards. Conditionally render it based on total connection count. Remove all "Connect providers" button/modal references from these pages.

**Files likely involved**: `Routing.tsx`, `Playground.tsx`, new component `NoConnectionsPrompt.tsx`

---

## Anomaly 5 — Workspace page container too narrow

**What**: The harnesses list page (Workspace) has containers that are narrower than other pages like Subscriptions.

**Fix**: Align the container max-width / layout to match the Subscriptions page.

**Files likely involved**: `Workspace.tsx`, layout CSS

---

## Anomaly 6 — Charts on Overview page

**What**: Two issues:
1. Charts should be bar charts (new design), but still show the old line charts
2. On GlobalOverview (all agents), charts don't display data despite recent messages existing. Works fine on individual agent overview.

**Fix**:
1. Replace line chart components with bar chart variants on Overview pages
2. Debug why GlobalOverview timeseries data is empty — likely a query or groupBy issue when no specific agent is selected

**Files likely involved**: `GlobalOverview.tsx`, `AgentOverview.tsx`, chart components, analytics query services

---

## Anomaly 7 — Remove top-level "Add" button on provider pages

**What**: The "Add subscription" / "Add provider" button at the top of provider list pages (Subscriptions, BYOK, Local) should be removed. Users add providers via the buttons on each supported provider card in the list.

**Fix**: Remove the top-right add button from these pages.

**Files likely involved**: `Subscriptions.tsx` (or equivalent), `Byok.tsx`, `Local.tsx`

---

## Anomaly 8 — Consistent naming across sidebar, URLs, and titles

**What**: Provider-related labels are inconsistent across the app.

**Expected naming**:
- Sidebar section title: "Provider Connections"
- Sub-items: "Subscriptions", "BYOK", "Local"
- URLs, H1 page titles, and all references must use the same terms consistently

**Fix**: Audit all references (sidebar, URLs, page titles, breadcrumbs) and unify naming.

**Files likely involved**: `Sidebar.tsx`, route definitions in `index.tsx`, page components, breadcrumb components

---

## Anomaly 9 — Routing tab layout cleanup

**What**: The agent detail Routing tab has a messy layout with an unnecessary separator between the tabs and the content area.

**Expected design** (from reference screenshot):
- Below tabs: a row with provider icons (connected providers) + "N connections" text, then right-aligned "Refresh models" and "Response mode: Buffered" buttons
- Below that: sub-tabs (Default / Task-specific / Custom)
- Below that: descriptive text ("Pick one model and up to 5 fallbacks...")
- Below that: routing content (model card, fallbacks)
- No parasitic separators between these elements. Clean, airy layout.

**Fix**: Restructure the Routing tab layout to match the reference. Remove extra `<hr>` or border elements.

**Files likely involved**: `Routing.tsx`, routing CSS

---

## Anomaly 10 — Limits page full-width container

**What**: The Limits (Guardrails) page content doesn't take the full container width. It's narrower than other pages.

**Fix**: Match the container width to the rest of the agent detail pages (same max-width as Subscriptions, Overview, etc.).

**Files likely involved**: `Limits.tsx`, layout CSS

---

## Implementation Plan

### Step 0 — Branch setup
1. Create a new branch from `test/limits-and-provider-stack`: `fix/ui-design-anomalies`
2. All work happens on this branch
3. Final PR targets `test/limits-and-provider-stack` (Guillaume's branch)

### Step 1 — Quick CSS fixes (Anomalies 5, 10)
- Fix container widths on Workspace and Limits pages
- Low risk, fast wins

### Step 2 — Remove legacy modal and top buttons (Anomalies 1, 7)
- Remove "Connect providers" modal from Routing and Playground
- Remove "Add" buttons from provider list pages
- Clean dead code

### Step 3 — Naming consistency (Anomaly 8)
- Rename sidebar items, URLs, page titles
- Single pass across all files

### Step 4 — Manage modal redesign (Anomaly 2)
- Fix title, replace back arrow with X, add rename field

### Step 5 — Inline rename on provider lists (Anomaly 3)
- Enable rename for single-key connections
- Add pen icon on hover, inline edit UX
- Validation for duplicate names

### Step 6 — No-connections prompt cards (Anomaly 4)
- New component with three horizontal cards
- Conditional rendering based on connection count
- Wire into Routing tab and Playground

### Step 7 — Routing tab layout (Anomaly 9)
- Restructure layout to match reference design
- Remove parasitic separators

### Step 8 — Charts (Anomaly 6)
- Switch to bar charts
- Debug GlobalOverview data loading issue
- This is the most complex step, may need separate investigation

### Step 9 — Tests and coverage
- Update/add tests for all changed components
- Ensure 100% line coverage per project rules
