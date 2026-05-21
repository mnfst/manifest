---
'manifest': patch
---

Fix provider disconnect cleanup so removing an OAuth subscription clears routes pinned to that auth type even when an API-key credential for the same provider remains connected.
