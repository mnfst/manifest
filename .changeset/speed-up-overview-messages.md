---
"manifest": patch
---

Speed up Overview and Messages pages

- Parallelize messages endpoint DB queries (count, data, models run concurrently via Promise.all)
- Show stale data during SSE refetches instead of flashing skeleton loaders
- Debounce cost filter inputs on Messages page (400ms) to prevent rapid-fire API calls
