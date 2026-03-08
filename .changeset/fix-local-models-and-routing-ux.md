---
"manifest": patch
---

Fix missing canonical provider models in local mode and improve routing page UX

- Create canonical model entries (e.g. `gemini-2.5-pro` with provider "Google") during pricing sync when no seeded entry exists, fixing local mode showing only OpenRouter-branded models
- Replace full tier list refetch with local state mutations on model change, reset, and fallback operations for instant UI updates
- Add loading indicator ("Changing...") on the Change button while model override is saving
- Add toast notification when removing a fallback model
