---
"manifest": patch
---

Speed up the dashboard, message log, and provider/subscription lists for high-volume tenants. Distinct model/provider lookups now use an index skip-scan instead of scanning a tenant's whole history, and the Overview derives its summary cards from the timeseries it already fetches (one fewer full-range scan). A covering index lets the Overview summary, timeseries, and cost-by-model aggregations run as index-only scans on every install (previously self-hosted had none). Postgres planner defaults (JIT off, larger work_mem, SSD-tuned random_page_cost) plus tighter autovacuum on agent_messages keep those aggregations off the heap, and a redundant index is dropped to lighten ingest.
