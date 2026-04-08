---
"manifest": patch
---

fix: use space-separated local-time timestamps to match SQLite storage format

Two issues caused the "Last 24 hours" overview to show no data for non-UTC users:

1. Messages were inserted with `new Date().toISOString()` (UTC) but query cutoffs used
   `formatLocalIso()` (local time), creating a timezone offset mismatch.
2. `formatLocalIso()` used 'T' as the date-time separator, but SQLite stores timestamps
   with a space separator. Since space (0x20) < 'T' (0x54), all same-day cutoff
   comparisons failed — the "Last 7 days" range worked only because the date portion
   difference masked the separator mismatch.
