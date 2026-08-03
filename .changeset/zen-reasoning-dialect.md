---
'manifest': patch
---

Keep `reasoning_content` on OpenCode Zen requests. The reasoning dialect is now decided by the models.dev reasoning capability instead of a model-family regex, so Zen's DeepSeek and codename reasoning models replay their thinking while Claude/GPT/Gemini/Grok slugs keep stripping it.
