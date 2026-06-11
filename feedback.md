## UI Review — Design Anomalies Found

I went through the current state of the branch on a local instance and found 10 UI issues that need attention before we ship. Code-level review is clean (see /review above), these are all UX/design items.

### 1. Legacy "Connect providers" modal still present
The old modal with Subscription/API Keys/Local tabs still shows up on the agent Routing page and Playground. This should have been removed with the global-providers pivot. I'll remove it and replace with the new flow (see #4).

### 2. "Manage" modal needs rework
On provider detail pages, clicking "Manage" opens a modal titled "Connect providers" with a back arrow. It should show the provider name, have an X close button instead of the back arrow, and include a field to rename the connection.

### 3. Rename should always be available
Currently you can only rename a connection when you have 2+ keys. Rename should work with a single connection too. Pen icon on hover in the list, inline field with Save/Cancel.

### 4. Replace connect button with contextual cards
Instead of a "Connect providers" button on Routing and Playground, show three horizontal cards (Subscriptions / BYOK / Local) linking to the respective pages when no connections exist. Once at least one connection is connected, hide them entirely since the sidebar handles navigation.

### 5. Workspace page container width
The harnesses list page has narrower containers than other pages. Should match the Subscriptions page width.

### 6. Charts issues
Two problems: (a) still using line charts instead of the expected bar charts, (b) GlobalOverview charts show no data despite recent messages existing. Individual agent overview works fine.

### 7. Remove "Add" button on provider pages
The top-level "Add subscription" / "Add provider" button on provider list pages is redundant. Adding happens through the provider cards in the list.

### 8. Naming consistency
Sidebar should read "Provider Connections" as section title with "Subscriptions", "BYOK", "Local" as sub-items. URLs, H1 titles, and all references need to match.

### 9. Routing tab layout
The layout has unnecessary separators and doesn't match the target design. Should show provider icons + connection count, then sub-tabs, then content — clean and airy, no extra dividers.

### 10. Limits page width
The Limits/Guardrails content doesn't use the full container width. Should match other pages.

---

I'll open a follow-up design branch targeting this one to fix all of these. None block the current code changes (which are solid), but they need to land before we ship the full stack.
