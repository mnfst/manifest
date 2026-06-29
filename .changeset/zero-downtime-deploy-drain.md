---
"manifest": patch
---

Stop rolling deploys from dropping requests. During a deploy the old replicas got SIGTERM and closed their socket immediately while the Railway edge was still routing to them, so a chunk of requests failed for the length of the deploy window. The server now drains on SIGTERM: the health probe at /api/v1/health reports 503 so the edge deregisters the replica, and the process keeps serving for SHUTDOWN_DRAIN_MS (default 10s) before closing connections. railway.toml gains overlapSeconds and drainingSeconds so the new deployment overlaps the old one and the drain finishes before SIGKILL.
