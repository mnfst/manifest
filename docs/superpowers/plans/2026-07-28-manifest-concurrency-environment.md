# Manifest Concurrency Environment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Manifest's per-agent in-flight request limit configurable and deploy the pinned custom image with `MANIFEST_CONCURRENCY_MAX=40`.

**Architecture:** Read and validate the environment variable when each `ProxyRateLimiter` instance is constructed, preserving 10 as the safe default. Build the existing production Dockerfile from the exact deployed upstream revision, then point the existing Compose deployment at that local image while leaving PostgreSQL untouched.

**Tech Stack:** TypeScript, NestJS, Jest, npm workspaces, Docker BuildKit, Docker Compose, PowerShell

---

## File Structure

- `packages/backend/src/routing/proxy/proxy-rate-limiter.ts`: parse the environment variable and enforce the configured instance limit.
- `packages/backend/src/routing/proxy/__tests__/proxy-rate-limiter.spec.ts`: prove default, configured, and invalid-value boundaries.
- `C:\Users\diego\manifest\docker-compose.yml`: select the pinned local image and pass the environment variable.
- `C:\Users\diego\manifest\.env`: set the live value to 40.

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

it.each(['', '0', '-1', '1.5', 'not-a-number', '9007199254740992'])(
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
  const configured = Number(process.env.MANIFEST_CONCURRENCY_MAX);
  return Number.isSafeInteger(configured) && configured > 0
    ? configured
    : DEFAULT_CONCURRENCY_MAX;
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

Expected: 35 tests pass, including the configured limit of 40 and six invalid-value cases.

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

### Task 4: Configure the live Compose deployment

**Files:**
- Modify: `C:\Users\diego\manifest\docker-compose.yml`
- Modify: `C:\Users\diego\manifest\.env`

- [ ] **Step 1: Select the custom image**

Change the Manifest service image from:

```yaml
image: manifestdotbuild/manifest:latest
```

to:

```yaml
image: manifest-local:097c8f1a-concurrency-env
```

- [ ] **Step 2: Pass the concurrency setting**

Add beside the existing proxy timeout variables:

```yaml
- MANIFEST_CONCURRENCY_MAX=${MANIFEST_CONCURRENCY_MAX:-10}
```

- [ ] **Step 3: Set the live value**

Add to `C:\Users\diego\manifest\.env`:

```dotenv
MANIFEST_CONCURRENCY_MAX=40
```

- [ ] **Step 4: Validate Compose without exposing resolved secrets**

Run:

```powershell
docker compose config --quiet
```

Expected: exit 0 and no output.

### Task 5: Deploy and verify

**Files:**
- Verify: `C:\Users\diego\manifest\docker-compose.yml`
- Verify: `C:\Users\diego\manifest\.env`

- [ ] **Step 1: Record the PostgreSQL container and volume identity**

Run:

```powershell
docker inspect mnfst-postgres-1 --format '{{.Id}} {{range .Mounts}}{{.Name}} {{end}}'
```

Expected: the current PostgreSQL container ID and `manifest_pgdata`.

- [ ] **Step 2: Recreate only the Manifest service**

Run:

```powershell
docker compose up -d --no-deps --force-recreate manifest
```

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
docker compose config --quiet
docker compose ps
git status --short
```

Expected: all limiter tests pass, lint exits 0, Compose validates, both services are healthy, and Git shows no uncommitted source changes other than local `.codegraph` metadata.
