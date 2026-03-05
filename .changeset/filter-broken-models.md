---
"manifest": patch
---

Remove broken models from catalog and add Moonshot provider endpoint

- Remove models that don't exist or return errors: gpt-5.3, gpt-5.3-codex, gpt-5.3-mini, grok-2, minimax-m2-her, minimax-01, nova-pro, nova-lite, nova-micro
- Rename mistral-large to mistral-large-latest and codestral to codestral-latest
- Add Moonshot provider endpoint for kimi-k2 model
