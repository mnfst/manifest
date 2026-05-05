---
'manifest': patch
---

Fix silent failure when adding a fallback that shares a provider with an existing route. Adding an OpenAI API key model as a fallback to an OpenAI subscription model (or any other same-provider, different-auth combination) now persists correctly instead of showing a success toast and dropping the change. The frontend now sends the explicit `(provider, authType, model)` tuple alongside the model name so the backend can disambiguate when the same model id is offered by two connected providers. Affects both complexity tier and specificity ("custom") routing.
