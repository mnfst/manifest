---
'manifest': patch
---

Store the full provider error envelope on Auto-fix rows. They previously kept only the error's message text, dropping its `type`, `param` and `code` — so re-reading such a row identified the failure differently from the live report of that same failure.
