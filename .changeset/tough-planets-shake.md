"manifest-backend": patch
---

Stop cross-auth credential fallback when an auth type is explicitly requested.
Requests that resolve to `auth_type: api_key` now only use API key credentials (and likewise for `subscription`) instead of silently decrypting another auth record.
