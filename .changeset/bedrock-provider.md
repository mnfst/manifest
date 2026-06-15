---
'manifest': patch
---

Add AWS Bedrock as an API-key provider using Bedrock Mantle's OpenAI-compatible endpoints. Bedrock vendor-prefixed model IDs now resolve model parameters, pricing, and capabilities through the underlying provider metadata while keeping the original Bedrock ID for inference.
