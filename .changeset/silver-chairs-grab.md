---
"manifest": patch
---

fix: strip additional unsupported JSON Schema keywords from Gemini tool declarations

Gemini's `function_declarations` parameter schema accepts only a restricted
OpenAPI subset and hard-rejects unknown keywords with
`Unknown name "<field>" ... Cannot find field`. The sanitizer now also strips
`propertyNames`, `uniqueItems`, `multipleOf`, `contains`/`minContains`/`maxContains`,
`prefixItems`, `additionalItems`, `readOnly`, `writeOnly`, `deprecated`, and the
`$comment`/`$anchor`/`$dynamicRef`/`$dynamicAnchor`/`$vocabulary` meta-keywords,
preventing 400 errors when tools carry these common JSON Schema fields.
