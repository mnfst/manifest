---
'manifest': minor
---

Auto-fix now gets a chance to heal requests naming an unavailable model (M302). When an explicit `model` resolves to no connected model and the agent has Auto-fix enabled, the failure is handed to the healing service as a synthetic model-not-found 404; a successful patch re-resolves routing and serves the repaired request, recording the real provider retry without inventing a provider attempt for the Manifest-blocked original. Agents without Auto-fix keep the friendly M302 response unchanged.
