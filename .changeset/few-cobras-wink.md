---
'manifest': patch
---

Normalize OpenAI-style tool call IDs when forwarding chat completions to Mistral so fallback requests remain compatible with Mistral's 9-character alphanumeric tool-call ID requirement.
