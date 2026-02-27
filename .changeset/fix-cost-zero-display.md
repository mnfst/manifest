---
"manifest": patch
---

Fix cost display showing $0.00 for sub-cent costs and negative costs

- Small positive costs (< $0.01) now display as "< $0.01" instead of misleading "$0.00"
- Negative costs (from failed pricing lookups) now display as "—" (unknown) instead of "$0.00"
- Backend aggregation queries (SUM) now exclude negative costs to prevent corrupted totals
- Added sqlSanitizeCost helper to filter invalid cost data at the query level
