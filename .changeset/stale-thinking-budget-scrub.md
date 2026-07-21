---
'manifest': patch
---

Fix Anthropic 400 "thinking.adaptive.budget_tokens: Extra inputs are not permitted": when configured model params rewrite a nested request root (e.g. flip `thinking.type` to `adaptive`), caller-sent siblings that the MPS catalog knows but the resolved model's spec no longer defines (like a legacy `thinking.budget_tokens`) are now scrubbed from the outbound body instead of riding into a wire shape the provider rejects.
