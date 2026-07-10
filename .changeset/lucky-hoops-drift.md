---
'manifest': patch
---

Drop two unused indexes on `agent_messages`, reclaiming about 1 GB and removing an index write from every message insert.
