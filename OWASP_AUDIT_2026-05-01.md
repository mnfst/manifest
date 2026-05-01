# OWASP Top 10 Security Audit — 2026-05-01

**Repository:** mnfst/manifest  
**Audit date:** 2026-05-01  
**Auditor:** OWASP security review (Claude Code)  
**Scope:** Full codebase — `packages/backend`, `packages/frontend`, `packages/shared`, CI/CD pipelines, Docker image

---

## Executive Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High     | 3 |
| Medium   | 7 |
| Low      | 8 |
| Info     | 4 |
| **Total** | **22** |

**Top 3 risks:**

1. **Vulnerable dependencies (A06-H1/H2)** — `undici ≤6.23.0` ships HTTP request-smuggling and DoS CVEs; `vite` has path-traversal + WebSocket file-read CVEs. Neither is exploitable in the production runtime image, but both are exploitable in the CI/CD build environment.
2. **Unpinned GitHub Actions (A08-H1)** — All CI/CD workflows use floating semver tags (`@v4`, `@v5`). A compromised upstream action repository would silently execute attacker code inside the build pipeline, potentially poisoning the published Docker image.
3. **Shared encryption/session secret (A02-M1)** — When `MANIFEST_ENCRYPTION_KEY` is not configured, at-rest encryption of stored LLM provider API keys falls back to `BETTER_AUTH_SECRET`. One leaked secret compromises both session authentication and every stored provider credential.

---

## Findings Table

| ID | Severity | OWASP | Title | File(s) |
|----|----------|-------|-------|---------|
| F-01 | **High** | A06 | `undici ≤6.23.0` — HTTP smuggling + DoS CVEs | `package-lock.json` |
| F-02 | **High** | A06 | `vite` — path traversal + arbitrary file read | `package-lock.json` |
| F-03 | **High** | A08 | Unpinned GitHub Actions (floating tags) | `.github/workflows/*.yml` |
| F-04 | **Medium** | A02 | `MANIFEST_ENCRYPTION_KEY` falls back to session secret | `src/common/utils/crypto.util.ts:35–56` |
| F-05 | **Medium** | A07 | Email verification bypassed when no email provider is configured | `src/auth/auth.instance.ts:64` |
| F-06 | **Medium** | A05 | `upgrade-insecure-requests` unconditionally disabled in CSP | `src/main.ts:46` |
| F-07 | **Medium** | A05 | HSTS disabled by default; requires operator opt-in | `src/main.ts:21` |
| F-08 | **Medium** | A08 | External data fetched from GitHub Raw URL without integrity check | `src/free-models/free-models-sync.service.ts:30–31` |
| F-09 | **Medium** | A10 | DNS rebinding TOCTOU window between SSRF validation and fetch | `src/routing/proxy/provider-client.ts:130–137` |
| F-10 | **Medium** | A04 | Setup wizard `POST /api/v1/setup/admin` permanently public — first caller wins | `src/setup/setup.controller.ts:30–36` |
| F-11 | **Low** | A02 | Encryption key stored in plaintext inside `keyCache` map key | `src/common/utils/crypto.util.ts:22–23` |
| F-12 | **Low** | A02 | Google Gemini API key appended to URL query string — exposed in access logs | `src/routing/proxy/provider-client.ts:202` |
| F-13 | **Low** | A02 | Legacy static-salt scrypt hashes still accepted for pre-migration API keys | `src/common/utils/hash.util.ts:3–34` |
| F-14 | **Low** | A09 | OAuth provider error response body logged verbatim without scrubbing | `src/routing/oauth/openai-oauth.service.ts:98–99` |
| F-15 | **Low** | A07 | Minimum password length is 8 characters | `src/auth/auth.instance.ts:63` |
| F-16 | **Low** | A01 | `Host` header controls OAuth callback `backendUrl` | `src/routing/oauth/openai-oauth.controller.ts:49` |
| F-17 | **Low** | A07 | Dev-mode and self-hosted loopback bypass assigns first tenant context | `src/otlp/guards/agent-key-auth.guard.ts:192–212` |
| F-18 | **Low** | A09 | First 8 chars of rejected agent key logged | `src/otlp/guards/agent-key-auth.guard.ts:151` |
| F-19 | **Info** | A05 | `ValidationPipe` missing `forbidNonWhitelisted: true` | `src/main.ts:67–72` |
| F-20 | **Info** | A09 | `console.log()` in migration files (bypasses structured logger) | `src/database/migrations/1771900000000-EncryptApiKeys.ts:45` |
| F-21 | **Info** | A03 | `innerHTML` with highlight.js output in frontend (safe — hljs escapes) | `packages/frontend/src/components/CodeBlock.tsx:18` |
| F-22 | **Info** | A02 | Default `BETTER_AUTH_URL=http://localhost:3001` may produce non-Secure cookies | `src/auth/auth.instance.ts:50` |

---

## Detailed Findings

---

### F-01 — High — A06 Vulnerable & Outdated Components  
**`undici ≤6.23.0`: HTTP request smuggling, DoS, CRLF injection**

**File:** `package-lock.json` (transitive: `@nestjs/cli` → `@angular-devkit` → `undici`)

```
undici  <=6.23.0
  GHSA-2mjp-6q6p-2qxm  HTTP Request/Response Smuggling
  GHSA-g9mf-h72j-4rw9  Unbounded decompression via Content-Encoding (DoS)
  GHSA-vrm6-8vpv-qv8q  Unbounded memory in WebSocket permessage-deflate
  GHSA-v9p9-hfj2-hcw8  WebSocket crash on invalid server_max_window_bits
  GHSA-4992-7rv2-5pvq  CRLF injection via `upgrade` option
```

**Exploit scenario:** `undici` is a dev/build dependency via `@nestjs/cli` and is not present in the production Dockerfile's distroless runtime image. The HTTP smuggling and CRLF CVEs are exploitable if the vulnerable `undici` instance is used to make HTTP requests during CI build steps — potentially poisoning upstream fetch caches. A CI-time CRLF injection into a shared proxy would be invisible to production scanners.

**Remediation:**
```bash
npm audit fix     # resolves the undici chain automatically
```
Pin `@nestjs/cli` to a version that depends on `undici ≥6.24.0`. Verify with `npm ls undici`.

---

### F-02 — High — A06 Vulnerable & Outdated Components  
**`vite`: path traversal + arbitrary file read via WebSocket**

**File:** `package-lock.json`  
**Affected:** `packages/frontend/node_modules/vite` (dev dependency); also `vite-node`

```
vite  <=6.4.1 || 7.0.0 - 7.3.1
  GHSA-4w7w-66w2-5vf9  Path traversal in optimized deps `.map` handling
  GHSA-v2wj-q39q-566r  `server.fs.deny` bypassed with query strings
  GHSA-p9ff-h696-f583  Arbitrary file read via dev-server WebSocket
```

**Exploit scenario:** A developer running `vite dev` on an interface reachable from other machines (e.g., `--host 0.0.0.0` in a CI container or Docker dev environment) can have arbitrary files (including `.env` secrets) read by any client that can reach the Vite WebSocket port. The `server.fs.deny` bypass means explicit deny-lists are ineffective.

**Remediation:**
```bash
cd packages/frontend && npm install vite@latest
```
Confirm the resolved version is ≥6.4.2 (or ≥7.3.2 on the 7.x track). Never expose the Vite dev server externally.

---

### F-03 — High — A08 Software & Data Integrity Failures  
**GitHub Actions use floating semver tags — supply chain risk**

**Files:**  
- `.github/workflows/ci.yml` lines 16, 17, 65, 75, 101, 130
- `.github/workflows/docker.yml` lines 50, 52, 54, 80, 82, 84, 86, 112, 127, 150, 153, 178
- `.github/workflows/release.yml`

```yaml
# ci.yml — representative examples
- uses: actions/checkout@v4           # floating tag
- uses: actions/setup-node@v4         # floating tag
- uses: codecov/codecov-action@v5     # floating tag
# docker.yml
- uses: docker/setup-buildx-action@v3
- uses: docker/build-push-action@v6
- uses: docker/login-action@v3
- uses: docker/metadata-action@v5
- uses: sigstore/cosign-installer@v3
```

**Exploit scenario:** If a maintainer of any referenced action repository (e.g., `actions/checkout`, `docker/build-push-action`) is compromised, they can push a new commit to the floating tag without changing the tag name. The next pipeline run silently executes the attacker's code with write access to `DOCKERHUB_TOKEN` and `CODECOV_TOKEN` secrets, enabling image poisoning or token exfiltration.

**Remediation:** Pin every `uses:` line to a full commit SHA:

```yaml
# before
- uses: actions/checkout@v4
# after
- uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2
```

Use a tool such as [Dependabot `update-type: pin`](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuration-options-for-the-dependabot.yml-file) or `pinact` to automate SHA pinning. Note: the Dockerfile *already* pins all base images by digest — the same discipline should be applied to Actions.

---

### F-04 — Medium — A02 Cryptographic Failures  
**`MANIFEST_ENCRYPTION_KEY` not required; falls back to `BETTER_AUTH_SECRET`**

**File:** `packages/backend/src/common/utils/crypto.util.ts:35–56`

```typescript
export function getEncryptionSecret(): string {
  const dedicated = process.env['MANIFEST_ENCRYPTION_KEY'];
  if (dedicated && dedicated.length >= 32) {
    return dedicated;
  }

  // Falling back to BETTER_AUTH_SECRET means a single secret leak compromises
  // both session signing and stored provider/OAuth keys.
  const sessionSecret = process.env['BETTER_AUTH_SECRET'];
  if (sessionSecret && sessionSecret.length >= 32) {
    if (!warnedAboutSecretReuse && process.env['NODE_ENV'] === 'production') {
      warnedAboutSecretReuse = true;
      logger.warn('MANIFEST_ENCRYPTION_KEY not set — falling back to BETTER_AUTH_SECRET ...');
    }
    return sessionSecret;                   // ← both secrets share one root
  }
  ...
}
```

**Exploit scenario:** An attacker who obtains `BETTER_AUTH_SECRET` (e.g., via a configuration leak, exposed `.env`, or compromised secrets manager) can both forge arbitrary session cookies *and* decrypt every LLM provider API key stored in the `user_providers.api_key_encrypted` column. The fallback is documented and warned about in production, but because it is not enforced as an error, most self-hosted deployments silently use one secret for two cryptographic purposes.

**Remediation:** Add `MANIFEST_ENCRYPTION_KEY` to the required-variables check in `auth.instance.ts` (similar to `BETTER_AUTH_SECRET`). In the meantime, document prominently in `docker/.env.example` and `packages/backend/.env.example` that operators *must* set `MANIFEST_ENCRYPTION_KEY` separately.

```typescript
// crypto.util.ts — enforce at startup
if (!dedicated || dedicated.length < 32) {
  throw new Error(
    'MANIFEST_ENCRYPTION_KEY must be set to ≥32 chars. Generate with: openssl rand -hex 32'
  );
}
```

---

### F-05 — Medium — A07 Identification & Authentication Failures  
**Email verification disabled when no email provider is configured**

**File:** `packages/backend/src/auth/auth.instance.ts:61–65`

```typescript
emailAndPassword: {
  enabled: true,
  minPasswordLength: 8,
  requireEmailVerification: !isDev && hasEmailProvider,  // ← false when no mailer
  ...
}
```

Where `hasEmailProvider` is `false` if neither `EMAIL_API_KEY`/`EMAIL_PROVIDER` nor the legacy `MAILGUN_API_KEY`/`MAILGUN_DOMAIN` pair is set.

**Exploit scenario:** A self-hosted deployment without a configured email provider accepts registrations with arbitrary, unverified email addresses. An attacker can register as `admin@target.com` or impersonate any address for phishing or to claim ownership of a branded email address in the system. Because email verification is the only identity proof, the entire `user` table lacks proof of address.

**Remediation:** Require email verification unconditionally in production, or surface a prominent startup warning when `NODE_ENV=production` and no email provider is set. Consider allowing a `SKIP_EMAIL_VERIFICATION=1` opt-out for operators who understand the trade-off.

---

### F-06 — Medium — A05 Security Misconfiguration  
**`upgrade-insecure-requests` unconditionally disabled in CSP**

**File:** `packages/backend/src/main.ts:43–46`

```typescript
contentSecurityPolicy: {
  directives: {
    ...
    upgradeInsecureRequests: null,  // hardcoded null — always omitted
  },
},
```

**Exploit scenario:** Even when Manifest is deployed behind HTTPS (with `BETTER_AUTH_URL=https://...`), browsers do not receive the `upgrade-insecure-requests` CSP directive. If any page asset or API call uses an absolute `http://` URL (e.g., due to a misconfigured proxy or a hardcoded URL in JavaScript), the browser won't automatically upgrade it to HTTPS. An active network attacker on the path between the browser and Manifest can intercept those HTTP sub-requests and inject content, steal session cookies from the HTTP response, or perform credential stuffing.

**Remediation:** Conditionally enable the directive when HSTS is active:

```typescript
...(hstsEnabled ? {} : { upgradeInsecureRequests: null }),
```

---

### F-07 — Medium — A05 Security Misconfiguration  
**HSTS disabled by default; requires explicit HTTPS opt-in**

**File:** `packages/backend/src/main.ts:20–21`

```typescript
const betterAuthUrl = process.env['BETTER_AUTH_URL'] || '';
const hstsEnabled = /^https:\/\//i.test(betterAuthUrl);
```

**Exploit scenario:** Operators who deploy Manifest behind an HTTPS reverse proxy (Nginx, Traefik, Cloudflare) without setting `BETTER_AUTH_URL=https://...` will silently serve responses without the `Strict-Transport-Security` header. Browsers will not pin the domain as HTTPS-only, allowing downgrade attacks (e.g., SSLstrip) and session-cookie theft over HTTP connections that the proxy hasn't yet upgraded.

The startup warning at `main.ts:169–179` is logged but many operators only review logs reactively.

**Remediation:** Emit a startup *error* (not just a warning) when `NODE_ENV=production`, `BIND_ADDRESS` is non-loopback, and `BETTER_AUTH_URL` is missing or HTTP. Document the `MANIFEST_DISABLE_HSTS=1` opt-out for HTTP-only LAN installs in the Docker README prominently.

---

### F-08 — Medium — A08 Software & Data Integrity Failures  
**External data fetched from GitHub Raw URL without integrity verification**

**File:** `packages/backend/src/free-models/free-models-sync.service.ts:30–31, 69`

```typescript
const GITHUB_RAW_URL =
  'https://raw.githubusercontent.com/mnfst/awesome-free-llm-apis/main/data.json';

// ...fetched on startup and every midnight, cached in-process:
const res = await fetch(GITHUB_RAW_URL);
```

**Exploit scenario:** The `main` branch of `mnfst/awesome-free-llm-apis` is fetched at boot and nightly without any content-hash or signature verification. A compromised GitHub account for `mnfst`, a MITM between the server and GitHub's CDN, or a GitHub infrastructure incident could deliver a malicious `data.json`. Because the response is parsed with `res.json()` and the `url` / `baseUrl` fields of each provider are returned directly to the browser via `/api/v1/public-stats/free-models`, a crafted payload could embed JavaScript-injection strings or internal redirect URLs that are rendered in the frontend.

**Remediation:**
1. Pin to an immutable commit SHA instead of `main`:
   ```
   https://raw.githubusercontent.com/mnfst/awesome-free-llm-apis/<sha>/data.json
   ```
2. Validate the fetched JSON against a strict schema (e.g., with `zod`) before caching, rejecting entries with unexpected `url` values.
3. Consider bundling the data in the repo and updating it via PR rather than fetching at runtime.

---

### F-09 — Medium — A10 Server-Side Request Forgery  
**DNS rebinding TOCTOU window between SSRF validation and actual fetch**

**Files:**  
- `packages/backend/src/common/utils/url-validation.ts:127–141` (DNS resolution in validation)  
- `packages/backend/src/routing/proxy/provider-client.ts:130–137` (re-validation before forward)

```typescript
// provider-client.ts — re-validates URL immediately before fetch
if (endpoint.requiresSsrfRevalidation) {
  try {
    await validatePublicUrl(url, { allowPrivate: isSelfHosted() });  // resolves DNS
  } catch (err) { throw ... }
}
// ... small async gap ...
return this.executeFetch(url, finalHeaders, requestBody, signal, ...);  // DNS resolved again
```

**Exploit scenario (theoretical):** An attacker controls a public hostname with a very short TTL (e.g., 1 s). During `validatePublicUrl`, the hostname resolves to a legitimate public IP. Between the validation call returning and `fetch()` initiating the TCP connection, the DNS record switches to `169.254.169.254` (AWS/GCP metadata). The metadata response is then forwarded to the attacker as an LLM "provider" response.

The threat is mitigated significantly by:
- `requiresSsrfRevalidation` forcing a second DNS check immediately before the forward.
- `redirect: 'error'` in the probe path preventing redirect-based bypasses.
- The cloud-metadata IP block in `validatePublicUrl` (always blocked, even in `allowPrivate` mode).

Practical exploitation requires sub-second DNS TTL propagation, precise timing, and cooperative upstream infrastructure — the residual risk is low but worth tracking.

**Remediation:** Where performance allows, resolve the hostname to an IP inside `validatePublicUrl`, compare it against the block-lists, and connect to the IP directly (bypassing DNS at fetch time). Node.js `fetch` does not natively support connecting-by-IP with an arbitrary `Host` header, so this may require a custom lookup + socket approach or a dedicated HTTP client.

---

### F-10 — Medium — A04 Insecure Design  
**Setup wizard `POST /api/v1/setup/admin` is permanently public — first caller wins**

**File:** `packages/backend/src/setup/setup.controller.ts:30–36`

```typescript
@Public()
@Post('admin')
@HttpCode(HttpStatus.CREATED)
async createAdmin(@Body() dto: CreateAdminDto): Promise<{ ok: true }> {
  await this.setupService.createFirstAdmin(dto);
  return { ok: true };
}
```

The setup endpoint is decorated `@Public()` — it accepts requests from any network without any authentication, IP restriction, or time-limited window.

**Exploit scenario:** An attacker who can reach a newly deployed, internet-facing Manifest instance before the legitimate operator can `POST /api/v1/setup/admin` with their own email and password, claiming the admin account and locking out the real administrator. The endpoint has no expiry: even days after deployment it remains callable (the only guard is the `user` table being empty). `GET /api/v1/setup/status` (`needsSetup: true`) reveals to any unauthenticated client that the instance is unclaimed.

The Postgres advisory lock (`pg_advisory_lock`) serialises concurrent legitimate setup calls, but provides no protection against an attacker racing the operator.

**Remediation options:**
- Restrict `POST /api/v1/setup/admin` to loopback or a configurable CIDR during first-run (e.g. `ADMIN_SETUP_ALLOWED_CIDR` env var).
- Generate a one-time token at startup, log it to stdout, and require it in the request body. The operator must have shell access to the server to read it — a natural out-of-band proof of legitimate access.
- Time-limit the open window to 15 minutes after first boot.

---

### F-11 — Low — A02 Cryptographic Failures  
**Google Gemini API key appended to URL query string — exposed in access logs**

**File:** `packages/backend/src/routing/proxy/provider-client.ts:202`

```typescript
// Google requires the key as a query parameter
let url = `${endpoint.baseUrl}${endpoint.buildPath(bareModel)}?key=${apiKey}`;
```

The NestJS debug logger at line 124 correctly scrubs the key:
```typescript
this.logger.debug(`Forwarding to ${endpointKey}: ${url.replace(/key=[^&]+/, 'key=***')}`);
```

**Exploit scenario:** The unredacted `url` (with `?key=…`) is passed directly to Node.js `fetch()`. Any infrastructure component logging outbound HTTP requests at the TCP/HTTP level — reverse proxy access logs, cloud load-balancer logs, APM tools, network packet captures — captures the full URL including the plaintext API key. The NestJS structured logger redacts it, but the infrastructure layer receives it in the clear.

**Remediation:** If the Google API supports it, pass the key via the `x-goog-api-key` or `Authorization: Bearer` header rather than as a query parameter. If query-string is unavoidable, document this exposure in deployment guides and recommend disabling upstream request URL logging.

---

### F-12 — Low — A02 Cryptographic Failures  
**Legacy static-salt scrypt hashes still accepted for pre-migration API keys**

**File:** `packages/backend/src/common/utils/hash.util.ts:3–34`

```typescript
/** @deprecated Static salt used by legacy hashes — only for backward-compat verification. */
const LEGACY_SALT = 'manifest-api-key-salt';

export function verifyKey(input: string, stored: string): boolean {
  // ...
  // Legacy: static salt, 64-char hex hash
  const legacyHashBuf = scryptSync(input, LEGACY_SALT, KEY_LENGTH);
  return timingSafeEqual(legacyHashBuf, storedBuf);
}
```

**Exploit scenario:** API keys hashed before migration `1771500000000-HashApiKeys.ts` used the globally constant salt `manifest-api-key-salt`. An attacker with read access to the `agent_api_keys` table (e.g., via database backup leak) can precompute a rainbow table against the known salt, eliminating the scrypt salt-guessing factor and reducing brute-force cost significantly. New keys use per-key salts (`salt_hex:hash_hex` format) and are not affected.

**Remediation:** Force rotation of all API keys still carrying the legacy 64-character hex hash format. Add a startup check:
```sql
SELECT COUNT(*) FROM agent_api_keys WHERE key_hash NOT LIKE '%:%';
```
Alert operators if non-zero keys remain unrotated.

---

### F-13 — Low — A09 Security Logging & Monitoring Failures  
**OAuth provider error response body logged verbatim without secret scrubbing**

**File:** `packages/backend/src/routing/oauth/openai-oauth.service.ts:98–99`

```typescript
if (!response.ok) {
  const text = await response.text();
  this.logger.error(`OpenAI token exchange failed: ${text}`);   // raw body — no scrubbing
  throw new Error('Token exchange failed');
}
```

The same pattern exists at lines 140 and 192 (token refresh and revocation). The `scrubSecrets()` utility in `common/utils/secret-scrub.ts` is available but not applied here.

**Exploit scenario:** Some OAuth providers echo back credential fragments in error responses. These would appear verbatim in structured logs and be forwarded to any connected SIEM, log aggregator, or crash reporter.

**Remediation:**
```typescript
import { scrubSecrets } from '../../common/utils/secret-scrub';
this.logger.error(`OpenAI token exchange failed: ${scrubSecrets(text)}`);
```

---

### F-14 — Low — A02 Cryptographic Failures  
**Encryption key stored in plaintext as part of `keyCache` Map key**

**File:** `packages/backend/src/common/utils/crypto.util.ts:22–23`

```typescript
function deriveKey(secret: string, salt: Buffer): Buffer {
  const cacheKey = `${secret.length}:${secret}:${salt.toString('base64')}`;
  //                                   ^^^^^^^^ raw secret in Map key
  const cached = keyCache.get(cacheKey);
  ...
  keyCache.set(cacheKey, derived);
  return derived;
}
```

**Exploit scenario:** The `keyCache` Map stores both the derived key (as a `Buffer` value) *and* the raw secret (as a substring of the string key). A heap dump, memory forensic, or core dump of the Node.js process exposes the encryption secret in addition to the derived key. This is doubly concerning because the same `BETTER_AUTH_SECRET` may be used as the encryption secret (F-04).

**Remediation:** Key the cache by a HMAC or hash of `(secret, salt)` rather than the raw secret:

```typescript
const cacheKey = createHmac('sha256', secret).update(salt).digest('hex');
```

---

### F-15 — Low — A07 Identification & Authentication Failures  
**Minimum password length is 8 characters**

**File:** `packages/backend/src/auth/auth.instance.ts:63`

```typescript
emailAndPassword: {
  enabled: true,
  minPasswordLength: 8,    // NIST SP 800-63B §5.1.1.1: minimum 8, encourage more
```

**Exploit scenario:** An 8-character password can be brute-forced in feasible time on modern hardware (especially common dictionary-based passwords). The per-endpoint rate limiting (20 attempts / 15 min for sign-in) significantly reduces the practical risk, but the password minimum itself provides minimal structural resistance.

**Remediation:** Increase `minPasswordLength` to 12, which is the practical safe floor given current cracking speeds. Also consider integrating a breached-password check (e.g., `haveibeenpwned` API or a local bloom filter) so users cannot register with known-compromised passwords.

---

### F-16 — Low — A01 Broken Access Control  
**`Host` header controls OAuth callback `backendUrl`**

**File:** `packages/backend/src/routing/oauth/openai-oauth.controller.ts:49`

```typescript
@Get('authorize')
async authorize(@Query('agentName') agentName: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
  ...
  const backendUrl = `${req.protocol}://${req.get('host')}`;  // ← Host header spoofable
  const url = await this.oauthService.generateAuthorizationUrl(agent.id, user.id, backendUrl);
  return { url };
}
```

**Exploit scenario:** If an attacker can send a request to `/api/v1/oauth/openai/authorize` with a forged `Host: evil.com` header (possible when the backend is directly reachable without a proxy that strips and overwrites the `Host` header), `backendUrl` becomes `https://evil.com`. This URL is stored in the pending OAuth state and used to construct the redirect URL after token exchange. The token (or at minimum, confirmation of a successful exchange) could be forwarded to `evil.com`.

Impact is limited because: (a) the `@CurrentUser()` guard requires the request to already be authenticated; (b) OpenAI's authorization server validates the registered callback domain.

**Remediation:** Derive `backendUrl` from the trusted `BETTER_AUTH_URL` environment variable instead of from the incoming `Host` header:

```typescript
const backendUrl = this.config.get<string>('BETTER_AUTH_URL') ?? `${req.protocol}://${req.get('host')}`;
```

---

### F-17 — Low — A07 Identification & Authentication Failures  
**Dev-mode loopback bypass assigns first active tenant context**

**Files:**  
- `packages/backend/src/otlp/guards/agent-key-auth.guard.ts:192–212`
- `packages/backend/src/auth/session.guard.ts:93–101`

```typescript
// agent-key-auth.guard.ts — dev loopback: no auth needed
private async resolveDevContext(): Promise<IngestionContext | null> {
  ...
  const keyRecord = await this.keyRepo.findOne({
    where: { is_active: true },    // ← returns the FIRST active key found (any tenant)
    relations: ['agent', 'tenant'],
  });
  ...
}

// session.guard.ts — self-hosted loopback: synthetic user
if (isSelfHosted() && isLoopbackPeer(request)) {
  (request as ...).user = { id: 'local', name: 'Local User', email: 'local@localhost' };
  return true;
}
```

**Exploit scenario:** In development mode, any process on `127.0.0.1` (including container-internal services that are inadvertently co-located) that calls the OTLP/proxy endpoints without an `Authorization` header receives the context of whatever tenant has the first active key in the database — which could be a real user's data in a shared dev environment. In self-hosted mode, all data is visible under the synthetic `local` user from loopback, which is intentional but warrants clear documentation for multi-user self-hosted deployments.

**Remediation:** In development mode, restrict the loopback bypass to a specific named agent (e.g., via `SEED_AGENT_ID` env var) rather than picking the first active key. Document explicitly in `SECURITY.md` that self-hosted loopback bypass is intentional and that operators running multi-user self-hosted deployments should not expose the loopback interface.

---

### F-18 — Low — A09 Security Logging & Monitoring Failures  
**First 8 characters of a rejected agent key are logged**

**File:** `packages/backend/src/otlp/guards/agent-key-auth.guard.ts:151`

```typescript
if (!keyRecord) {
  this.logger.warn(`Rejected unknown agent key: ${token.substring(0, 8)}...`);
  throw new UnauthorizedException('Invalid API key');
}
```

**Exploit scenario:** Agent keys start with the prefix `mnfst_` (6 chars), so the logged substring reveals `mnfst_X` plus one random character. In isolation this is negligible, but log aggregation platforms that retain logs indefinitely might accumulate partial key data that assists an attacker in key enumeration or confirming a partially compromised key. Log shipping to third-party SIEM tools increases the exposure surface.

**Remediation:** Log only the fixed prefix and nothing more:

```typescript
this.logger.warn(`Rejected unknown agent key (prefix: ${API_KEY_PREFIX}...)`);
```

---

### F-19 — Info — A05 Security Misconfiguration  
**`ValidationPipe` missing `forbidNonWhitelisted: true`**

**File:** `packages/backend/src/main.ts:67–72`

```typescript
app.useGlobalPipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,          // strips unknown properties — correct
    // forbidNonWhitelisted is NOT set — undocumented properties are silently stripped
  }),
);
```

`CLAUDE.md` documents: *"Global `ValidationPipe` with `whitelist: true`, `forbidNonWhitelisted: true`"* — but the code only sets `whitelist: true`. The omission is safe (unknown properties are silently removed rather than causing a validation error), but it means callers receive no feedback about mistyped property names, which can mask integration bugs.

**Remediation:** Add `forbidNonWhitelisted: true` and update `CLAUDE.md`. Audit existing E2E tests to ensure no test bodies contain extra properties that would now fail.

---

### F-20 — Info — A09 Security Logging & Monitoring Failures  
**`console.log()` in migration files bypasses structured logger**

**Files:**  
- `src/database/migrations/1771900000000-EncryptApiKeys.ts:45`  
- `src/database/migrations/1772843035514-AddPerformanceIndexes.ts:79`

```typescript
// EncryptApiKeys.ts:45
console.log(`Encrypted key ${id}`);      // bypasses NestJS ConsoleLogger
```

Migration output written via `console.log` is not captured by Nest's structured logger, may miss centralized log shipping, and does not carry log level or timestamp metadata. In production, ops teams monitoring logs for anomalies may miss migration progress/errors.

**Remediation:** Replace `console.log` with `queryRunner.connection.logger.log('info', '...')` or pass a NestJS `Logger` instance.

---

### F-21 — Info — A03 Injection  
**Frontend `innerHTML` with highlight.js output (safe)**

**Files:**  
- `packages/frontend/src/components/CodeBlock.tsx:18`  
- `packages/frontend/src/components/FrameworkSnippets.tsx:204`  
- `packages/frontend/src/components/HermesSetup.tsx:130`

```tsx
// CodeBlock.tsx:18
<code innerHTML={html()} />   // html() = highlight(props.code, props.language)
```

SolidJS's `innerHTML` prop bypasses framework-level escaping; however, highlight.js escapes all HTML entities in the input before wrapping tokens in `<span>` tags. The only user-controlled content that reaches `highlight()` is model/agent names and log snippets that are already sanitized at the data layer. Verified by inspection: no path exists from unvalidated user input to these `innerHTML` calls.

**No action required.** Documented for completeness.

---

### F-22 — Info — A02 Cryptographic Failures  
**Default `BETTER_AUTH_URL` is HTTP — may produce non-Secure session cookies in unconfigured deployments**

**File:** `packages/backend/src/auth/auth.instance.ts:50`

```typescript
baseURL: process.env['BETTER_AUTH_URL'] ?? `http://localhost:${port}`,
```

Better Auth derives cookie `Secure` flag and `SameSite` policy from `baseURL`. When `BETTER_AUTH_URL` is not set (defaults to `http://localhost:3001`), session cookies may be issued without the `Secure` attribute. In a production deployment reached via HTTPS without setting `BETTER_AUTH_URL`, the cookies would be accepted over both HTTP and HTTPS.

**Remediation:** Document in deployment guides that `BETTER_AUTH_URL` *must* be set to the public HTTPS URL in production. Consider throwing a startup error when `NODE_ENV=production`, the binding address is non-loopback, and `BETTER_AUTH_URL` is unset or HTTP-only.

---

## Dependency Vulnerabilities Appendix

`npm audit --audit-level=high` output (2026-05-01):

| Package | Severity | CVE / Advisory | Fix |
|---------|----------|---------------|-----|
| `undici ≤6.23.0` | **High** | GHSA-2mjp-6q6p-2qxm (HTTP smuggling) | `npm audit fix` |
| `undici ≤6.23.0` | **High** | GHSA-g9mf-h72j-4rw9 (unbounded decompress) | `npm audit fix` |
| `undici ≤6.23.0` | **High** | GHSA-vrm6-8vpv-qv8q (WS memory) | `npm audit fix` |
| `undici ≤6.23.0` | **High** | GHSA-v9p9-hfj2-hcw8 (WS crash) | `npm audit fix` |
| `undici ≤6.23.0` | **High** | GHSA-4992-7rv2-5pvq (CRLF via upgrade) | `npm audit fix` |
| `vite ≤6.4.1` | **High** | GHSA-4w7w-66w2-5vf9 (path traversal) | `npm audit fix` |
| `vite ≤6.4.1` | **High** | GHSA-v2wj-q39q-566r (fs.deny bypass) | `npm audit fix` |
| `vite ≤6.4.1` | **High** | GHSA-p9ff-h696-f583 (WS file read) | `npm audit fix` |
| `ajv <8.17.1` | Moderate | GHSA-2g4f-4pwh-qvx6 (ReDoS) | `npm audit fix` |
| `postcss <8.5.10` | Moderate | GHSA-qx2v-qp2m-jg93 (XSS stringify) | `npm audit fix` |
| `uuid <14.0.0` | Moderate | GHSA-w5hq-g745-h8pq (buffer bounds) | `npm audit fix --force` (breaking) |

All `undici` and `vite` vulnerabilities are **dev/build-only** — they do not appear in the production distroless Docker image. The `uuid` vulnerability is in `typeorm` (runtime) but requires a caller to pass a `buf` argument to `v3`/`v5`/`v6`, which TypeORM does not do in its standard usage.

---

## Not-Applicable / Out-of-Scope Categories

| OWASP Category | Assessment |
|---------------|-----------|
| **A01 Broken Access Control (server-side)** | All analytics endpoints filter by `userId` via `addTenantFilter(qb, userId)`. Agent-scoped endpoints use `resolveAgentService.resolve(user.id, agentName)` which throws `NotFoundException` on cross-tenant access. The `@CurrentUser()` decorator throws 401 if `request.user` is unset, preventing unauthenticated access even when guards partially pass. IDOR risk assessed as low. One low-severity finding (F-16) recorded for OAuth `Host` header. |
| **A03 Injection (SQL)** | All database queries use TypeORM `QueryBuilder` with named parameters (`:param`) — no string concatenation in query bodies. The database seeder uses `dataSource.query(sql, [$1, $2])` parameterized form. No raw SQL interpolation found. Frontend `innerHTML` uses highlight.js with HTML escaping (F-17, Info). |
| **A04 Insecure Design** | Multi-tenant isolation is enforced at the data layer. Rate limiting covers auth endpoints (20 req/15 min for sign-in, 5 req/15 min for sign-up/password-reset). Secret hashing uses scrypt KDF. Provider API keys are AES-256-GCM encrypted at rest. No privilege escalation paths identified. |
| **A09 Security Logging (general)** | NestJS structured logging via `ConsoleLogger`. `secret-scrub.ts` redacts provider keys, Bearer tokens, and vendor-specific key patterns from error bodies before DB persistence. `request-headers.ts` strips `authorization`, `cookie`, `proxy-authorization`, and `x-api-key` before logging. Two minor findings recorded (F-14, F-16). |

---

*Audit performed by static code analysis and manual review. No dynamic testing (fuzzing, authenticated scanning) was conducted. Findings reflect the state of the codebase as of commit `HEAD` on 2026-05-01.*
