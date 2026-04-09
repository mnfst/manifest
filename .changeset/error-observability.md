---
"manifest": patch
---

Add error observability for diagnosing HTTP 400 spikes

- Add Express-level HTTP error logging middleware that logs all 4xx/5xx responses with request metadata (method, URL, status, user-agent, IP)
- Add `error_http_status` column to `agent_messages` table so proxy errors record the upstream HTTP status code (400, 500, 503, etc.) for queryable diagnostics
- Remove `forbidNonWhitelisted: true` from the global ValidationPipe — `whitelist: true` already strips unknown fields silently, the `forbidNonWhitelisted` setting was rejecting requests with extra fields as 400 errors
- Expand proxy error log line to include provider, model, and tier context (up from 200 to 500 chars of error body)
