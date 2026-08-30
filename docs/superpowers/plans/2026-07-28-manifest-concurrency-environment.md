# Manifest Concurrency Environment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Manifest's per-agent in-flight request limit configurable and deploy the pinned custom image with `MANIFEST_CONCURRENCY_MAX=40`.

**Architecture:** Read and validate the environment variable when each `ProxyRateLimiter` instance is constructed, preserving 10 as the safe default. Build the existing production Dockerfile from the exact deployed upstream revision, then configure the repository's Compose template to pass the setting while leaving PostgreSQL untouched. The template fixes the published `manifestdotbuild/manifest` repository, so `MANIFEST_VERSION` selects only a tag from that repository; a locally built image must be selected with a deployment-specific Compose override.

**Tech Stack:** TypeScript, NestJS, Jest, npm workspaces, Docker BuildKit, Docker Compose, PowerShell

---

## File Structure

- `packages/backend/src/routing/proxy/proxy-rate-limiter.ts`: parse the environment variable and enforce the configured instance limit.
- `packages/backend/src/routing/proxy/__tests__/proxy-rate-limiter.spec.ts`: prove default, configured, and invalid-value boundaries.
- `docker/docker-compose.yml`: pass the environment variable into the Manifest service.
- `docker/.env.example`: document the optional value for self-hosted deployments.
- A deployment-local `.env` or Compose override: set the live value and, when needed, select a local image without committing machine-specific paths or tags.

### Task 1: Add failing configuration-boundary tests

**Files:**
- Modify: `packages/backend/src/routing/proxy/__tests__/proxy-rate-limiter.spec.ts`

- [ ] **Step 1: Isolate environment state in the fixture**

Add a saved environment value and make every test begin with the variable unset:

```typescript
describe('ProxyRateLimiter', () => {
  let limiter: ProxyRateLimiter;
  const originalConcurrencyMax = process.env.MANIFEST_CONCURRENCY_MAX;

  beforeEach(() => {
    delete process.env.MANIFEST_CONCURRENCY_MAX;
    limiter = new ProxyRateLimiter();
  });

  afterEach(() => {
    limiter.onModuleDestroy();
    if (originalConcurrencyMax === undefined) {
      delete process.env.MANIFEST_CONCURRENCY_MAX;
    } else {
      process.env.MANIFEST_CONCURRENCY_MAX = originalConcurrencyMax;
    }
  });
```

- [ ] **Step 2: Add behavioral tests for configured and invalid limits**

Add these cases inside `describe('acquireSlot / releaseSlot', ...)`:

```typescript
it('uses MANIFEST_CONCURRENCY_MAX when it is a positive integer', () => {
  limiter.onModuleDestroy();
  process.env.MANIFEST_CONCURRENCY_MAX = '40';
  limiter = new ProxyRateLimiter();

  for (let i = 0; i < 40; i++) {
    expect(() => limiter.acquireSlot('user-1')).not.toThrow();
  }
  expect(() => limiter.acquireSlot('user-1')).toThrow(HttpException);
});

it.each([
  '',
  '0',
  '-1',
  '1.5',
  'not-a-number',
  '9007199254740992',
  '0x10',
  '0b101',
  '2e1',
  ' 40 ',
])(
  'falls back to 10 when MANIFEST_CONCURRENCY_MAX is %p',
  (configuredValue) => {
    limiter.onModuleDestroy();
    process.env.MANIFEST_CONCURRENCY_MAX = configuredValue;
    limiter = new ProxyRateLimiter();

    for (let i = 0; i < 10; i++) {
      expect(() => limiter.acquireSlot('user-1')).not.toThrow();
    }
    expect(() => limiter.acquireSlot('user-1')).toThrow(HttpException);
  },
);
```

- [ ] **Step 3: Run the focused test and verify RED**

Run:

```powershell
npm test --workspace=manifest-backend -- --runInBand src/routing/proxy/__tests__/proxy-rate-limiter.spec.ts
```

Expected: the configured-limit test fails because the 11th acquisition still throws M203 under the hardcoded limit of 10.

### Task 2: Implement strict environment parsing

**Files:**
- Modify: `packages/backend/src/routing/proxy/proxy-rate-limiter.ts`

- [ ] **Step 1: Replace the hardcoded constant with a default and parser**

Replace `const CONCURRENCY_MAX = 10;` with:

```typescript
const DEFAULT_CONCURRENCY_MAX = 10;

function readConcurrencyMax(): number {
  const raw = process.env.MANIFEST_CONCURRENCY_MAX;
  if (!raw || !/^[1-9]\d*$/.test(raw)) return DEFAULT_CONCURRENCY_MAX;

  const configured = Number(raw);
  return Number.isSafeInteger(configured) ? configured : DEFAULT_CONCURRENCY_MAX;
}
```

- [ ] **Step 2: Store the validated value per limiter instance**

Add this field beside the existing maps:

```typescript
private readonly concurrencyMax = readConcurrencyMax();
```

Change the acquisition boundary:

```typescript
if (current >= this.concurrencyMax) {
  throw new ManifestError('M203', HttpStatus.TOO_MANY_REQUESTS);
}
```

- [ ] **Step 3: Run the focused test and verify GREEN**

Run:

```powershell
npm test --workspace=manifest-backend -- --runInBand src/routing/proxy/__tests__/proxy-rate-limiter.spec.ts
```

Expected: 39 tests pass, including the configured limit of 40 and ten invalid-value cases.

- [ ] **Step 4: Run backend lint and production build**

Run:

```powershell
npm run lint --workspace=manifest-backend
npm run build --workspace=manifest-shared
npm run build --workspace=manifest-backend
```

Expected: all commands exit 0 with no TypeScript or ESLint errors.

- [ ] **Step 5: Commit the tested source change**

Run:

```powershell
git add packages/backend/src/routing/proxy/proxy-rate-limiter.ts packages/backend/src/routing/proxy/__tests__/proxy-rate-limiter.spec.ts
git commit -m "feat: configure Manifest concurrency limit"
```

Expected: one commit containing only the limiter and its tests.

### Task 3: Build and inspect the pinned custom image

**Files:**
- Use: `docker/Dockerfile`

- [ ] **Step 1: Build the image**

Run:

```powershell
docker build --file docker/Dockerfile --tag manifest-local:097c8f1a-concurrency-env .
```

Expected: Docker exits 0 and creates `manifest-local:097c8f1a-concurrency-env`.

- [ ] **Step 2: Inspect the image**

Run:

```powershell
docker image inspect manifest-local:097c8f1a-concurrency-env --format '{{.Id}} {{.Config.User}} {{json .Config.Cmd}}'
```

Expected: an image ID, the non-root runtime user, and `packages/backend/dist/main.js`.

### Task 4: Configure the Compose deployment

**Files:**
- Modify: `docker/docker-compose.yml`
- Modify: `docker/.env.example`
- Configure locally: `docker/.env` or a deployment-specific Compose override (untracked)

- [ ] **Step 1: Pass the concurrency setting**

Add beside the existing proxy timeout variables in `docker/docker-compose.yml`:

```yaml
- MANIFEST_CONCURRENCY_MAX=${MANIFEST_CONCURRENCY_MAX:-10}
```

- [ ] **Step 2: Document the optional setting**

Add to `docker/.env.example`:

```dotenv
# Per-agent concurrent in-flight request limit. Must be a plain positive integer.
# MANIFEST_CONCURRENCY_MAX=10
```

- [ ] **Step 3: Configure the deployment-local value**

Set the live value in the untracked `docker/.env` used by the deployment:

```dotenv
MANIFEST_CONCURRENCY_MAX=40
```

`MANIFEST_VERSION` changes only the tag in the fixed `manifestdotbuild/manifest` image reference; it cannot select `manifest-local`. When validating the locally built image rather than the published image, select it with an untracked Compose override such as:

```yaml
services:
  manifest:
    image: manifest-local:097c8f1a-concurrency-env
```

Pass that override to every validation and deployment command with `-f <override-file>`. Do not commit the override or a machine-specific image tag to `docker/docker-compose.yml`.

- [ ] **Step 4: Validate Compose without exposing resolved secrets**

From the repository root, run the published-image configuration with:

```powershell
docker compose --env-file docker/.env -f docker/docker-compose.yml config --quiet
```

For a local image, append the untracked override selected in Step 3:

```powershell
docker compose --env-file docker/.env -f docker/docker-compose.yml -f <override-file> config --quiet
```

Expected: exit 0 and no output.

### Task 5: Deploy and verify

**Files:**
- Verify: `docker/docker-compose.yml`
- Verify locally: `docker/.env` and any deployment-specific override

- [ ] **Step 1: Record the PostgreSQL container and volume identity**

Run:

```powershell
docker inspect mnfst-postgres-1 --format '{{.Id}} {{range .Mounts}}{{.Name}} {{end}}'
```

Expected: the current PostgreSQL container ID and `manifest_pgdata`.

- [ ] **Step 2: Recreate only the Manifest service**

Run from the repository root. For the locally built image, include the deployment-specific override explicitly:

```powershell
docker compose --env-file docker/.env -f docker/docker-compose.yml -f <override-file> up -d --no-deps --force-recreate manifest
```

Omit the second `-f` only when deploying the published `manifestdotbuild/manifest:${MANIFEST_VERSION}` image.

Expected: only `mnfst-manifest-1` is recreated.

- [ ] **Step 3: Wait for application health**

Run:

```powershell
$deadline = (Get-Date).AddMinutes(3)
do {
  $health = docker inspect mnfst-manifest-1 --format '{{.State.Health.Status}}'
  if ($health -eq 'healthy') { break }
  Start-Sleep -Seconds 3
} while ((Get-Date) -lt $deadline)
if ($health -ne 'healthy') { throw "Manifest health is $health" }
```

Expected: `healthy` before the deadline.

- [ ] **Step 4: Verify the selected image and environment without exposing secrets**

Run:

```powershell
docker inspect mnfst-manifest-1 --format '{{.Config.Image}}'
docker inspect mnfst-manifest-1 --format '{{range .Config.Env}}{{println .}}{{end}}' |
  Select-String '^MANIFEST_CONCURRENCY_MAX='
```

Expected:

```text
manifest-local:097c8f1a-concurrency-env
MANIFEST_CONCURRENCY_MAX=40
```

- [ ] **Step 5: Verify authenticated gateway access without printing the key**

Run:

```powershell
$manifestKey = (Get-Content -Raw -LiteralPath '.mnfst-key').Trim()
$response = Invoke-RestMethod -Uri 'http://127.0.0.1:2099/v1/models' `
  -Headers @{ Authorization = "Bearer $manifestKey" }
if (-not $response.data -or $response.data.Count -lt 1) {
  throw 'Manifest returned no models'
}
"models=$($response.data.Count)"
```

Expected: a positive model count.

- [ ] **Step 6: Confirm PostgreSQL was not recreated**

Rerun:

```powershell
docker inspect mnfst-postgres-1 --format '{{.Id}} {{range .Mounts}}{{.Name}} {{end}}'
```

Expected: the same container ID and `manifest_pgdata` recorded in Step 1.

- [ ] **Step 7: Run final source and deployment verification**

Run:

```powershell
npm test --workspace=manifest-backend -- --runInBand src/routing/proxy/__tests__/proxy-rate-limiter.spec.ts
npm run lint --workspace=manifest-backend
docker compose --env-file docker/.env -f docker/docker-compose.yml -f <override-file> config --quiet
docker compose --env-file docker/.env -f docker/docker-compose.yml -f <override-file> ps
git status --short
```

Expected: all limiter tests pass, lint exits 0, Compose validates, both services are healthy, and Git shows no uncommitted source changes other than local `.codegraph` metadata.
