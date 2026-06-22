---
"manifest": patch
---

Speed up the dashboard, message log, and provider/subscription lists for high-volume tenants. Distinct model/provider lookups now use an index skip-scan instead of scanning a tenant's whole history, and the Overview derives its summary cards from the timeseries it already fetches (one fewer full-range scan). Postgres planner defaults (JIT off, larger work_mem, SSD-tuned random_page_cost) plus tighter autovacuum on agent_messages keep the heavy aggregations on index-only scans, and a redundant index is dropped to lighten ingest.
