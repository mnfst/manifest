---
"manifest": patch
---

Fix per-agent routing migration failing on users with multiple agents. Drop old unique indexes before the fan-out INSERT to prevent duplicate key violations on (user_id, provider).
