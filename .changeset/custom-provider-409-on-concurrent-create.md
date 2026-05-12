---
'manifest': patch
---

Translate concurrent-insert unique-violation on `POST /api/v1/routing/:agentName/custom-providers` into HTTP 409 instead of 500. The find-then-insert pre-check in `CustomProviderService.create()` was racy against the `(agent_id, name)` unique index — two parallel requests with the same provider name could both pass the pre-check, then the second insert raised `QueryFailedError` and bubbled past the controller as a 500. Now the insert is wrapped and unique-violation `QueryFailedError`s are translated into the same `ConflictException` the pre-check produces, matching the convention already used for the symmetric race on `Agent` creation in `agents.controller.ts`. Non-unique errors (connection drops, etc.) continue to propagate unchanged.
