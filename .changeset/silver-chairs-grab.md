---
"manifest": patch
---

fix: Gemini adapter — strip unsupported schema keywords, merge parallel tool responses, and inject missing thought signatures

The Gemini adapter now strips additional JSON Schema keywords that Google's
`function_declarations` parameter schema rejects (`propertyNames`,
`uniqueItems`, `multipleOf`, `contains`/`minContains`/`maxContains`,
`prefixItems`, `additionalItems`, `readOnly`, `writeOnly`, `deprecated`,
and `$comment`/`$anchor`/`$dynamicRef`/`$dynamicAnchor`/`$vocabulary`).

It merges consecutive parallel tool responses into a single Gemini user turn,
matching Google's requirement that N functionCall parts be answered by exactly
N functionResponse parts in one turn.

When a functionCall part has no `thought_signature` from the client or cache
(e.g. after a fallback from another model), the adapter now injects the
documented dummy signature so Gemini 3.x does not reject the request with
"Function call is missing a thought_signature".
