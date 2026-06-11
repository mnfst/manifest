---
"manifest": patch
---

Fix token/cost limits never blocking (or alerting) when the server's timezone isn't UTC. `computePeriodBoundaries`/`computePeriodResetDate` built their window in UTC, but `agent_messages.timestamp` rows are stored in the process's local time — so on a non-UTC host the window's upper bound sat behind the stored rows by the TZ offset and the consumption SUM read ~0, meaning hard limits silently never tripped and threshold alerts never fired. Boundaries are now computed in local time (matching `computeCutoff`), via a new `toLocalSqlTimestamp` helper.
