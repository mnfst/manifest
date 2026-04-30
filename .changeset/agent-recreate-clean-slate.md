---
"manifest": patch
---

Recreating an agent with a deleted agent's name no longer surfaces the deleted agent's messages, costs, or routing config. Deletion now hard-clears denormalised rows and invalidates the resolve/routing caches.
