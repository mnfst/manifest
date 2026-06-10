---
"manifest": patch
---

fix: Gemini adapter — strip unsupported schema keywords and merge parallel tool responses

The Gemini adapter now strips additional JSON Schema keywords that Google's
`function_declarations` parameter schema rejects (`propertyNames`,
`uniqueItems`, `multipleOf`, `contains`/`minContains`/`maxContains`,
`prefixItems`, `additionalItems`, `readOnly`, `writeOnly`, `deprecated`,
and `$comment`/`$anchor`/`$dynamicRef`/`$dynamicAnchor`/`$vocabulary`).

It also merges consecutive parallel tool responses into a single Gemini
user turn, matching Google's requirement that N functionCall parts be
answered by exactly N functionResponse parts in one turn.
