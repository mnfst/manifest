---
"manifest": patch
---

Patch five high-severity Dependabot alerts in transitive dependencies.

- `fast-uri` 3.1.0 → 3.1.2 (path traversal + host confusion, dev-only via `@nestjs/schematics`).
- `kysely` 0.28.14 → 0.28.17 via `better-auth` 1.4 → 1.6 (JSON-path injection in `JSONPathBuilder`, runtime).
- `undici` 5.x → 6.25 via `@codecov/vite-plugin` 1 → 2 (HTTP smuggling + CRLF injection, dev/build only).

No behavior change. Better Auth bump is patch-compatible (1.4 → 1.6) — login, register, OAuth round-trips verified locally.
