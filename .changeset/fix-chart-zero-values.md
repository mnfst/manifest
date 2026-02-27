---
"manifest": patch
---

Fix absurd trend percentages (e.g. -34497259%) when overview metrics are zero or near-zero. Backend computeTrend() now uses epsilon comparison and clamps output to ±999%. Frontend trendBadge() suppresses badges when the metric value itself is effectively zero. Chart Y-axes no longer collapse when all data points are zero.
