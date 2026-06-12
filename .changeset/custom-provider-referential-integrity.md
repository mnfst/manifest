---
"manifest": patch
---

Deleting a custom provider can no longer leave orphaned key or routing data behind: the link between custom providers and their stored keys is now enforced by the database (with automatic cleanup of any pre-existing orphans), and creating or deleting a custom provider is atomic.
