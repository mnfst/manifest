---
"manifest": minor
---

Merge @mnfst/server into manifest plugin and replace better-sqlite3 with sql.js (WASM). Local mode no longer requires native C++ compilation — zero external build dependencies. Better Auth is skipped entirely in local mode; simple session endpoints serve loopback requests.
