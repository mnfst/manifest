---
"manifest": patch
---

Reduce TypeORM connection pool from 20 to 5 per replica to avoid exhausting PgBouncer client connections during rolling deploys.
