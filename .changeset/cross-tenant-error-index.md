---
"manifest": patch
---

Add a timestamp-leading partial index for cross-tenant error scans. The Cloud control plane's hourly error-insights rollup scans agent_messages by time window across all tenants, but the only error index was tenant-leading — so each run scanned every error row ever recorded (cost growing with total accumulated errors), which turned into multi-minute scans that saturated the database. A timestamp-leading partial index over error rows turns those into windowed range scans (measured 110ms/29k buffers down to 2ms/274 buffers on ~2M error rows). The index stays partial so write amplification on ingest is negligible.
