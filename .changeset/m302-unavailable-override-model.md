---
'manifest': patch
---

Return `M302` ("model not available") instead of `M101` ("no providers configured") when a pinned routing override names a model its connection no longer offers and no fallback route resolves. Only applies while the override's provider connection still exists, so a genuinely unconfigured agent keeps the neutral `M101`.
