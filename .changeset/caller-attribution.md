---
"manifest": minor
---

feat: capture caller attribution headers on proxy requests

Every request to `/v1/chat/completions` now has its HTTP headers classified
into a new `caller_attribution` JSON field on the agent message. The
classifier understands the OpenRouter attribution convention
(`HTTP-Referer`, `X-OpenRouter-Title` / `X-Title`, `X-OpenRouter-Categories`)
as well as Stainless-generated SDK fingerprints (`x-stainless-lang`,
package version, runtime / os / arch) used by the official OpenAI and
Anthropic SDKs, plus common raw clients like `curl`, `python-requests`,
`node-fetch` and `axios`. Values are sanitised (control chars stripped,
capped length) and the referer is normalised to its origin.

The data is stored on every successful, failed, and fallback message so
it's available for future analytics surfaces.
