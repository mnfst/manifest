---
'manifest': patch
---

Cost each request with the price of the provider that actually served it. The pricing cache was keyed by model name alone, so every provider selling a model wrote to the same key and only the last one survived — 24 providers list `deepseek-v4-pro`, and DeepSeek is not the one that won. A request to DeepSeek's own API was billed at OpenCode Zen's resale rate, roughly 3.7x the real price on an agent-shaped token mix.
