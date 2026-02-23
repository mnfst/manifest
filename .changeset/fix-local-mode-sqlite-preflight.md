---
"@mnfst/server": patch
---

Fix local mode server failing silently when better-sqlite3 native binary is missing. The pre-flight check now instantiates an in-memory database to exercise the native addon, surfacing a clear error message before the backend import triggers the same failure deep in auth.instance.js. Also fixes AuthGuard showing a blank page during session checks by adding a loading state and refreshing the session after auto-login.
