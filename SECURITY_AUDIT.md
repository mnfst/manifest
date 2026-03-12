# OWASP Top 10 Security Audit Report

**Platform:** Manifest
**Date:** 2026-03-12
**Scope:** Full platform (backend, frontend, OpenClaw plugin) — both **local** and **cloud** modes
**Methodology:** OWASP Top 10:2021

---

## Executive Summary

The Manifest platform demonstrates strong security fundamentals: strict CSP via Helmet, session-based auth with Better Auth, parameterized queries via TypeORM, and proper input validation. However, the audit identified **4 critical**, **6 high**, **10 medium**, and **5 low** severity findings across both deployment modes.

| Severity | Count | Highest-Impact Finding |
|----------|-------|------------------------|
| Critical | 4 | SSRF via custom provider base_url (A10) |
| High | 6 | Plaintext API key token cached in memory (A02) |
| Medium | 10 | Provider error body forwarded to client (A04) |
| Low | 5 | No request timeout configuration (A05) |

---

## A01:2021 — Broken Access Control

### FINDING A01-1: SessionGuard Always Returns True (HIGH)

**Files:** `packages/backend/src/auth/session.guard.ts:40-41`

The `SessionGuard` always returns `true`, regardless of whether authentication succeeded. It relies on the `ApiKeyGuard` running second to reject unauthenticated requests. If guard ordering changes or `ApiKeyGuard` throws an unhandled error, requests pass through unauthenticated.

```typescript
// Always pass — let ApiKeyGuard handle unauthenticated requests
return true;
```

**Impact:** Authentication bypass if guard chain order is disrupted.
**Mode:** Cloud only (local mode uses `LocalAuthGuard` which properly returns `false`).
**Recommendation:** `SessionGuard` should throw `UnauthorizedException` when no session is found *and* no `X-API-Key` header is present, rather than delegating rejection to a downstream guard.

### FINDING A01-2: @CurrentUser() Decorator Returns Undefined Without Validation (MEDIUM)

**File:** `packages/backend/src/auth/current-user.decorator.ts`

The decorator extracts `request.user` without checking it exists. Controllers using `@CurrentUser() user: AuthUser` may receive `undefined` if guards didn't set it.

**Impact:** Potential `undefined` dereference in controllers, leading to 500 errors or bypassed tenant filtering.
**Recommendation:** Add a runtime check: throw `UnauthorizedException` if `request.user` is `undefined`.

### FINDING A01-3: Local Mode Loopback IP Trust Without Proxy Awareness (MEDIUM)

**Files:** `packages/backend/src/otlp/guards/otlp-auth.guard.ts:59`, `packages/backend/src/auth/local-auth.guard.ts:30`, `packages/backend/src/main.ts:70`

All three locations use `request.ip` against a hardcoded `LOOPBACK_IPS` set. In local mode, `trust proxy` is disabled (`main.ts:61`). If the local instance runs behind a reverse proxy (nginx, Docker network), `request.ip` reflects the proxy's IP, not the client's.

```typescript
const isLocal = process.env['MANIFEST_MODE'] === 'local' && LOOPBACK_IPS.has(request.ip ?? '');
```

**Impact:** Auth bypass for OTLP ingestion if local mode runs behind a proxy; or false rejections of legitimate local traffic.
**Mode:** Local only.
**Recommendation:** Document that local mode must not run behind a reverse proxy, or add IPv4-mapped IPv6 variants and Docker bridge IPs.

### FINDING A01-4: SkipThrottle on Proxy Controller (MEDIUM)

**File:** `packages/backend/src/routing/proxy/proxy.controller.ts:32`

The `@SkipThrottle()` decorator exempts the entire proxy controller from the global `ThrottlerGuard`. While a custom `ProxyRateLimiter` exists, it uses in-memory state that resets on restart and lacks the robustness of the NestJS throttler.

**Impact:** Rate-limit bypass via rapid proxy requests after server restart.
**Recommendation:** Use the global throttler as a baseline and layer the custom rate limiter on top.

### FINDING A01-5: Notification Trigger-Check Has No Ownership Scope (MEDIUM)

**File:** `packages/backend/src/notifications/notifications.controller.ts`

`POST /api/v1/notifications/trigger-check` allows any authenticated user to manually trigger the notification cron check. While gated by session auth, there is no validation that the triggered check is scoped to the requesting user's data. This could allow a user to trigger notification checks (and potentially emails) for other users' agents.

**Impact:** Cross-user notification triggering; potential email spam to other users.
**Mode:** Cloud.
**Recommendation:** Scope `trigger-check` to the requesting user's tenant, or restrict to admin role.

### FINDING A01-6: Telemetry Ingestion Accepts Null Tenant (MEDIUM)

**File:** `packages/backend/src/telemetry/telemetry.service.ts`

When `TenantCacheService.resolve()` returns `null` (no tenant found for userId), the telemetry service inserts records with `tenant_id: null`. These orphaned records bypass tenant-scoped analytics queries, creating phantom data invisible to any user.

**Impact:** Data integrity issue; orphaned telemetry records not visible in dashboards.
**Mode:** Both.
**Recommendation:** Reject telemetry events when tenant cannot be resolved. Return a clear error indicating the agent needs to be onboarded first.

---

## A02:2021 — Cryptographic Failures

### FINDING A02-1: Hardcoded Static Salt in API Key Hashing (CRITICAL)

**File:** `packages/backend/src/common/utils/hash.util.ts:3`

```typescript
const HASH_SALT = 'manifest-api-key-salt';
```

All API keys use the same static salt for scrypt hashing. This defeats the purpose of salting:
- Enables precomputed rainbow tables targeting this specific salt
- All keys with the same plaintext produce the same hash, enabling batch attacks
- The salt is committed to source code (public knowledge)

**Impact:** If the database is compromised, brute-forcing API keys is significantly cheaper than with per-key random salts.
**Mode:** Both local and cloud.
**Recommendation:** Generate a random 16-byte salt per key, store it alongside the hash (e.g., `salt:hash` format). Update `hashKey()` to accept and return the salt.

### FINDING A02-2: Plaintext API Key Tokens Stored in OtlpAuthGuard Cache (HIGH)

**File:** `packages/backend/src/otlp/guards/otlp-auth.guard.ts:138`

```typescript
this.cache.set(token, { tenantId: ..., agentId: ..., ... });
```

Full plaintext API key tokens are used as cache keys. In a memory dump, heap snapshot, or debugging session, all recently-used API keys are exposed in cleartext.

**Impact:** Key material exposure via memory inspection or core dumps.
**Mode:** Both.
**Recommendation:** Use the token hash as the cache key instead of the plaintext token.

### FINDING A02-3: Encryption Secret Falls Back to Session Secret (MEDIUM)

**File:** `packages/backend/src/common/utils/crypto.util.ts:13`

```typescript
const key = process.env['MANIFEST_ENCRYPTION_KEY'] || process.env['BETTER_AUTH_SECRET'];
```

Provider API keys (AES-256-GCM encrypted) fall back to `BETTER_AUTH_SECRET` when `MANIFEST_ENCRYPTION_KEY` is not set. Reusing the session-signing secret for data encryption weakens both: compromising one exposes the other.

**Impact:** Single point of failure for both session integrity and data encryption.
**Mode:** Cloud primarily (local mode uses generated auth secret).
**Recommendation:** Require `MANIFEST_ENCRYPTION_KEY` to be set separately in production. Log a warning if fallback is used.

### FINDING A02-4: Local Config File Stores Secrets in Plaintext (MEDIUM)

**File:** `packages/backend/src/common/constants/local-mode.constants.ts:46-48`

```typescript
writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
```

The local config file (`~/.openclaw/manifest/config.json`) stores `authSecret`, `localPassword`, `emailApiKey`, and `apiKey` as plaintext JSON. File permissions (`0o600`) are set but rely on the OS honoring them; no encryption at rest.

**Impact:** Full secret disclosure if home directory is compromised (backup, shared filesystem, malware).
**Mode:** Local only.
**Recommendation:** Encrypt the config file using a machine-derived key (e.g., OS keychain integration).

### FINDING A02-5: Hardcoded Default Database Credentials (MEDIUM)

**Files:** `packages/backend/src/auth/auth.instance.ts:21`, `packages/backend/src/database/datasource.ts:21`

```typescript
const databaseUrl = process.env['DATABASE_URL'] ?? 'postgresql://myuser:mypassword@localhost:5432/mydatabase';
```

If `DATABASE_URL` is not set, the application silently falls back to hardcoded example credentials. In a misconfigured production deployment, this could connect to an unintended database.

**Impact:** Unintended database connection with weak credentials.
**Mode:** Cloud.
**Recommendation:** Throw an error if `DATABASE_URL` is not set when `MANIFEST_MODE !== 'local'`.

---

## A03:2021 — Injection

### FINDING A03-1: SQL Injection — Low Risk (INFO)

All database queries use TypeORM `QueryBuilder` with parameterized values. The `agent_name` field in `RangeQueryDto` accepts any string but is always used as a parameter (`:agentName`), not concatenated into SQL.

The only raw SQL is in `database-seeder.service.ts` (seed data), which uses numbered `$1` placeholders correctly.

**Status:** No SQL injection vulnerabilities found.

### FINDING A03-2: XSS — Low Risk (INFO)

The frontend uses SolidJS, which escapes all template interpolations by default. No `innerHTML`, `dangerouslySetInnerHTML`, or `eval()` calls were found. Helmet enforces strict CSP (`script-src: 'self'`).

**Status:** No XSS vulnerabilities found.

### FINDING A03-3: Command Injection — Not Applicable (INFO)

No `exec()`, `spawn()`, or shell command execution found in application code. The platform doesn't invoke system commands based on user input.

**Status:** Not applicable.

---

## A04:2021 — Insecure Design

### FINDING A04-1: Provider Error Body Forwarded to Client (MEDIUM)

**File:** `packages/backend/src/routing/proxy/proxy.controller.ts:106-147`

```typescript
const errorBody = await providerResponse.text();
// ...
res.send(errorBody);
```

When the upstream LLM provider returns an error, the full error body is forwarded to the client. If SSRF is exploited (A10-1), this leaks internal service responses (Kubernetes metadata, internal API errors, etc.).

**Impact:** Information disclosure via error responses from internal services.
**Mode:** Both.
**Recommendation:** Wrap provider errors in a sanitized envelope. Log the full error server-side; return only status code and a generic message to the client.

### FINDING A04-2: Cached Key Remains Valid After Revocation (MEDIUM)

**File:** `packages/backend/src/otlp/guards/otlp-auth.guard.ts:99-108`

When an API key is revoked (deleted or deactivated in the database), the in-memory cache entry remains valid for up to 5 minutes. During this window, the revoked key can still authenticate.

**Impact:** Delayed revocation — compromised keys usable for up to 5 minutes after revocation.
**Mode:** Both.
**Recommendation:** On key revocation/rotation, call `invalidateCache(token)` or `clearCache()`. The methods exist (lines 156-162) but are not called from the key rotation flow.

### FINDING A04-3: Fire-and-Forget Audit Updates (LOW)

**Files:** `packages/backend/src/common/guards/api-key.guard.ts:54-56`, `packages/backend/src/otlp/guards/otlp-auth.guard.ts:128-130`

```typescript
this.apiKeyRepo.update(...).catch(() => {});
```

`last_used_at` updates are fire-and-forget with swallowed errors. The audit trail for key usage is unreliable — failed updates are silently discarded.

**Impact:** Incomplete audit trail for API key usage tracking.
**Mode:** Both.
**Recommendation:** Log update failures at `warn` level (OTLP guard does this; API key guard does not).

### FINDING A04-4: FIFO Cache Eviction Enables DoS (LOW)

**File:** `packages/backend/src/otlp/guards/otlp-auth.guard.ts:133-136`

Cache eviction uses FIFO (deletes first inserted key), not LRU. An attacker can evict legitimate cached keys by flooding with requests using different valid tokens, forcing expensive DB lookups.

**Impact:** Performance degradation under targeted attack.
**Recommendation:** Use an LRU cache implementation.

---

## A05:2021 — Security Misconfiguration

### FINDING A05-1: Email Verification Disabled in Development (MEDIUM)

**File:** `packages/backend/src/auth/auth.instance.ts:74`

```typescript
requireEmailVerification: !isDev && !isLocalMode,
```

Email verification is skipped in development mode. If a development instance is accidentally exposed to the internet, accounts can be created with unverified emails.

**Impact:** Account creation without email ownership proof in dev.
**Mode:** Cloud (dev).
**Recommendation:** Acceptable if dev instances are properly isolated. Document this behavior.

### FINDING A05-2: CORS Regex Allows All Localhost Ports (LOW)

**File:** `packages/backend/src/main.ts:44`

```typescript
origin: process.env['CORS_ORIGIN'] || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
```

In dev mode, any localhost port is allowed as a CORS origin. While restricted to dev (`NODE_ENV !== 'production'`), if `NODE_ENV` is misconfigured, this could allow cross-origin requests from any localhost service.

**Impact:** Low — limited to development environments.
**Recommendation:** Acceptable for development. Ensure `NODE_ENV=production` is enforced in deployment pipelines.

### FINDING A05-3: No Server Request Timeout (LOW)

**File:** `packages/backend/src/main.ts`

No HTTP server timeout is configured. The provider client has a 180-second timeout (`PROVIDER_TIMEOUT_MS`), but the NestJS server itself has no request timeout, enabling slow-loris attacks.

**Impact:** Potential DoS via slow HTTP clients holding connections indefinitely.
**Recommendation:** Set `server.setTimeout()` to a reasonable value (e.g., 300 seconds).

### FINDING A05-4: Better Auth Secret Validation Skipped in Test (LOW)

**File:** `packages/backend/src/auth/auth.instance.ts:31`

```typescript
if (!isLocalMode && nodeEnv !== 'test' && (!betterAuthSecret || betterAuthSecret.length < 32)) {
```

The 32-character minimum for `BETTER_AUTH_SECRET` is bypassed when `NODE_ENV=test`. Tests can run with weak or empty secrets.

**Impact:** Tests may not catch secret-related issues.
**Recommendation:** Use a fixed test secret of proper length rather than skipping validation.

### FINDING A05-5: Seed Data Uses Weak Hardcoded Credentials (MEDIUM)

**File:** `packages/backend/src/database/database-seeder.service.ts:18-21, 70-73`

```typescript
const SEED_API_KEY = 'dev-api-key-manifest-001';
const SEED_OTLP_KEY = 'mnfst_dev-otlp-key-001';
// Admin password:
password: 'manifest',
```

Seed data uses weak, predictable credentials. While gated by `SEED_DATA=true` and dev/test environments, these credentials are committed to source code and could be used if seeding runs accidentally in production.

**Impact:** Known default credentials if seeding is inadvertently enabled.
**Mode:** Both (when `SEED_DATA=true`).
**Recommendation:** Add an explicit check that prevents seeding when `NODE_ENV=production`, regardless of `SEED_DATA` value.

---

## A06:2021 — Vulnerable and Outdated Components

### FINDING A06-1: Dependency Audit (INFO)

The platform uses well-maintained dependencies:
- **NestJS 11** — current major version
- **TypeORM 0.3** — current stable
- **Better Auth** — actively maintained auth library
- **Helmet** — standard security middleware
- **SolidJS** — modern reactive framework with built-in XSS protection

**Recommendation:** Run `npm audit` regularly and integrate into CI. Pin dependency versions in `package-lock.json`.

---

## A07:2021 — Identification and Authentication Failures

### FINDING A07-1: Timing-Unsafe DB Key Lookup (HIGH)

**File:** `packages/backend/src/common/guards/api-key.guard.ts:49-50`

```typescript
const hash = hashKey(apiKey);
const found = await this.apiKeyRepo.findOne({ where: { key_hash: hash } });
```

The DB lookup timing leaks whether a hash exists. While the env-based key check uses `timingSafeEqual` (line 76), the DB lookup path has no timing protection. An attacker can distinguish "valid hash, found in DB" from "invalid hash, not found" by measuring response time.

**Impact:** API key enumeration via timing side-channel.
**Mode:** Both.
**Recommendation:** Add a constant-time delay or dummy lookup on cache misses to normalize response timing.

### FINDING A07-2: No Account Lockout or Brute-Force Protection on Login (MEDIUM)

**File:** `packages/backend/src/auth/auth.instance.ts`

Better Auth handles login, but no account lockout policy is configured. The global `ThrottlerGuard` provides rate limiting (default: 100 req/60s per IP), but this is a general limit — not specific to failed login attempts.

**Impact:** Brute-force attacks against user passwords at up to 100 attempts per minute.
**Mode:** Cloud.
**Recommendation:** Configure Better Auth's `rateLimit` plugin or add a login-specific rate limiter with progressive delays after failed attempts.

### FINDING A07-3: Minimum Password Length Only 8 Characters (LOW)

**File:** `packages/backend/src/auth/auth.instance.ts:73`

```typescript
minPasswordLength: 8,
```

8 characters meets the minimum NIST recommendation but is on the lower end. No password complexity requirements (uppercase, numbers, symbols) are enforced.

**Impact:** Weak passwords permitted.
**Recommendation:** Consider increasing to 10+ characters or integrating a password strength checker (e.g., zxcvbn). At minimum, check against common password lists.

---

## A08:2021 — Software and Data Integrity Failures

### FINDING A08-1: No Subresource Integrity (SRI) on Self-Hosted Assets (LOW)

**File:** `packages/frontend/index.html`

While the CSP correctly restricts to `'self'` origins, the self-hosted CSS and font files don't use SRI hashes. If an attacker gains write access to the static file directory, they could modify these files.

**Impact:** Low — requires file system access, which implies deeper compromise.
**Recommendation:** Consider SRI for critical static assets in production builds.

### FINDING A08-2: Changeset Enforcement (INFO — Positive)

The CI pipeline enforces changesets on every PR, and the release workflow uses Changesets for version management. This provides good software supply chain integrity for npm publishing.

**Status:** Well-implemented.

---

## A09:2021 — Security Logging and Monitoring Failures

### FINDING A09-1: Partial API Key Prefix Logged on Rejection (MEDIUM)

**File:** `packages/backend/src/otlp/guards/otlp-auth.guard.ts:120`

```typescript
this.logger.warn(`Rejected unknown OTLP key: ${token.substring(0, 8)}...`);
```

8 characters of rejected tokens are logged. While useful for debugging, this reveals the key prefix to anyone with log access, aiding targeted attacks.

**Impact:** Partial key material in logs.
**Mode:** Both.
**Recommendation:** Log only 4 characters or use a hash prefix instead.

### FINDING A09-2: No Audit Logging for Authentication Success (MEDIUM)

**Files:** All guard files

Guards log rejections (`warn` level) but not successful authentications. There is no audit trail showing which user/key accessed what endpoint and when.

**Impact:** Cannot detect compromised accounts through usage pattern analysis.
**Recommendation:** Add structured audit logging for successful auth events, at least for sensitive operations (key rotation, agent creation, provider configuration).

### FINDING A09-3: Silent Error Swallowing in API Key Guard (LOW)

**File:** `packages/backend/src/common/guards/api-key.guard.ts:56`

```typescript
.catch(() => {});
```

The `last_used_at` update failure is completely silently. The OTLP guard at least logs a warning; the API key guard does not.

**Impact:** Lost audit information without any indication.
**Recommendation:** Add `.catch((err) => this.logger.warn(...))` consistent with the OTLP guard.

---

## A10:2021 — Server-Side Request Forgery (SSRF)

### FINDING A10-1: Custom Provider Base URL Enables SSRF (CRITICAL)

**Files:**
- `packages/backend/src/routing/dto/custom-provider.dto.ts:54`
- `packages/backend/src/routing/proxy/provider-endpoints.ts:101-110`
- `packages/backend/src/routing/proxy/provider-client.ts:146`

The custom provider feature allows users to specify arbitrary `base_url` values. The DTO validates it is a URL (`@IsUrl({ require_tld: false, require_protocol: true })`), but does **not** validate:
- URL scheme (allows `http://`, not just `https://`)
- Destination hostname/IP (allows private ranges, localhost, metadata services)
- No DNS resolution validation

The URL flows through `buildCustomEndpoint()` → `ProviderClient.forward()` → `fetch(url, ...)` with no SSRF protection.

**Attack Scenarios:**
1. **Cloud metadata theft:** `base_url: "http://169.254.169.254/latest/meta-data/"` → IAM credential theft
2. **Internal port scanning:** `base_url: "http://10.0.0.1:8080"` → map internal services
3. **Kubernetes service discovery:** `base_url: "http://prometheus:9090"` → access monitoring data
4. **Localhost services:** `base_url: "http://127.0.0.1:5432"` → probe database port

**Impact:** Full SSRF — read internal services, steal cloud credentials, map infrastructure.
**Mode:** Both (custom providers available in both modes).
**Recommendation:** Implement URL validation that:
1. Requires `https://` scheme only (except for known local development URLs)
2. Resolves DNS and rejects private/reserved IP ranges (RFC 1918, link-local, loopback)
3. Blocklists cloud metadata IPs (`169.254.169.254`)
4. Optionally allowlists known LLM provider domains

### FINDING A10-2: Ollama Host Configurable via Environment Variable (HIGH)

**File:** `packages/backend/src/common/constants/ollama.ts:2-3`

```typescript
export const OLLAMA_HOST = process.env['OLLAMA_HOST'] || 'http://localhost:11434';
```

The Ollama endpoint is configurable via environment variable with no URL validation. While this requires server-side env access (not user-controllable), it's a hardcoded SSRF target if the environment is misconfigured.

**Impact:** SSRF via environment misconfiguration.
**Mode:** Both.
**Recommendation:** Validate that `OLLAMA_HOST` is a loopback address or a known Ollama server.

### FINDING A10-3: Provider Error Responses Leak Internal Data (HIGH)

**File:** `packages/backend/src/routing/proxy/proxy.controller.ts:106-147`

When SSRF is exploited, error responses from internal services are forwarded directly to the attacker:

```typescript
const errorBody = await providerResponse.text();
res.send(errorBody);
```

Combined with A10-1, this allows reading responses from internal services.

**Impact:** Information disclosure from internal services via SSRF.
**Mode:** Both.
**Recommendation:** Never forward raw provider error bodies. Return a sanitized error with only the HTTP status code.

### FINDING A10-4: API Key Exfiltration via Custom Provider SSRF (CRITICAL)

**File:** `packages/backend/src/routing/proxy/provider-client.ts:126-128`

When a custom provider is used, the user's configured API key for that provider is sent in the `Authorization: Bearer <key>` header to the custom endpoint. If the endpoint is attacker-controlled (via SSRF), the API key is exfiltrated.

```typescript
headers = endpoint.buildHeaders(apiKey, authType);
// ...
const response = await fetch(url, { method: 'POST', headers, body: ... });
```

**Impact:** Attacker can harvest API keys by pointing custom provider to their server.
**Mode:** Both.
**Recommendation:** This is mitigated if A10-1 is fixed (URL validation prevents arbitrary endpoints). Additionally, warn users when configuring custom provider URLs.

---

## Cross-Cutting Concerns

### Local Mode vs Cloud Mode Summary

| Finding | Local | Cloud | Notes |
|---------|-------|-------|-------|
| A01-1: SessionGuard always true | N/A | Yes | Local uses LocalAuthGuard |
| A01-3: Loopback IP trust | Yes | N/A | Local-only mechanism |
| A02-1: Hardcoded salt | Yes | Yes | Shared code path |
| A02-4: Plaintext config file | Yes | N/A | Local-only storage |
| A02-5: Default DB credentials | N/A | Yes | Cloud-only (PostgreSQL) |
| A05-5: Seed credentials | Yes | Yes | Both when SEED_DATA=true |
| A07-2: No login brute-force protection | N/A | Yes | Local skips Better Auth |
| A01-5: Notification trigger-check unscoped | N/A | Yes | Cloud-only (Better Auth) |
| A01-6: Telemetry null tenant | Yes | Yes | Orphaned records |
| A10-1: SSRF via custom provider | Yes | Yes | Feature available in both |

### Positive Security Controls

The following security measures are well-implemented:

1. **Helmet CSP** — Strict `'self'`-only policy with no external CDNs
2. **ValidationPipe** — Global whitelist validation with `forbidNonWhitelisted: true`
3. **Timing-safe comparison** — Used for env-based API key validation
4. **AES-256-GCM encryption** — Provider API keys encrypted at rest with proper random IV/salt
5. **Scrypt KDF** — Memory-hard key derivation (despite static salt issue)
6. **Better Auth integration** — Industry-standard session management with cookie-based auth
7. **SolidJS auto-escaping** — Framework prevents XSS by default
8. **TypeORM parameterization** — All queries use parameterized values
9. **CORS restricted to dev** — Production has no CORS enabled
10. **Body parsing control** — Disabled at NestJS level, manually configured with limits
11. **Frame ancestors: 'none'** — Prevents clickjacking
12. **Self-hosted assets** — No external CDN dependencies

---

## Remediation Priority

### Immediate (P0) — Fix Before Next Release

1. **A10-1:** Add SSRF protection to custom provider URL validation
2. **A02-1:** Replace static salt with per-key random salt
3. **A10-3:** Sanitize provider error responses

### Short-Term (P1) — Fix Within 2 Weeks

4. **A02-2:** Hash tokens before using as cache keys
5. **A01-1:** Make SessionGuard fail-closed
6. **A07-1:** Add constant-time normalization for DB key lookup
7. **A07-2:** Add login-specific rate limiting
8. **A02-5:** Fail if DATABASE_URL not set in cloud mode

### Medium-Term (P2) — Fix Within 1 Month

9. **A02-3:** Require separate MANIFEST_ENCRYPTION_KEY
10. **A04-2:** Invalidate cache on key revocation
11. **A09-2:** Add audit logging for auth events
12. **A05-5:** Prevent seeding in production mode
13. **A01-2:** Validate @CurrentUser() returns defined user
14. **A01-5:** Scope notification trigger-check to requesting user's tenant
15. **A01-6:** Reject telemetry events when tenant cannot be resolved

### Long-Term (P3) — Plan and Implement

14. **A02-4:** Encrypt local config file
15. **A04-4:** Replace FIFO cache with LRU
16. **A09-1:** Reduce logged key prefix to 4 chars
17. **A05-3:** Add server request timeout
18. **A07-3:** Increase minimum password length
