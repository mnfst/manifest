---
'manifest': patch
---

Persist cached `reasoning_content` for DeepSeek-compatible tool-call turns in Postgres so cloud deployments with multiple backend instances can re-inject the required field on follow-up requests.
