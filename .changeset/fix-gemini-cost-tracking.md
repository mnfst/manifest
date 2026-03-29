---
"manifest": patch
---

fix: resolve $0.00 cost tracking for Google Gemini models

Fixes an issue where Gemini 2.5 Pro showed $0.00 costs despite active token usage.
Root cause: GitHub Copilot's zero-pricing models.dev entries overwrote Google's real pricing
in the pricing cache. Also adds daily cache reload and Google variant model name normalization.
