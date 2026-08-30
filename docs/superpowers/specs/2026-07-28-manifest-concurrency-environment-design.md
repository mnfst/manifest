# Manifest Concurrency Environment Design

## Goal

Make Manifest's per-agent in-flight request limit configurable through
`MANIFEST_CONCURRENCY_MAX`, then deploy the pinned custom image with a limit of
40 while preserving the current default of 10.

## Context

The deployed Manifest image is revision
`097c8f1a5151de5ab666586c61f39e13d59cb8dc`. In that revision,
`ProxyRateLimiter` uses a hardcoded `CONCURRENCY_MAX = 10`. The live
self-hosted instance recorded 1,360 M203 rejections in the six hours examined,
so the existing guard is constraining the intended parallel workload.

The repository's reproducible self-hosted deployment template lives at
`docker/docker-compose.yml`, with optional settings documented in
`docker/.env.example`. Deployment-specific `.env` files and image overrides
remain untracked so machine paths and local tags do not enter the template.
The change was developed from the exact deployed revision before integration.

## Selected Approach

Patch the pinned Manifest source and build a local Docker image. This keeps the
change reviewable and testable and avoids modifying a running container or
performing a build-time text replacement.

The application will read `MANIFEST_CONCURRENCY_MAX` when a
`ProxyRateLimiter` instance is constructed:

- an unset variable preserves the upstream default of 10;
- a plain decimal positive safe integer sets the per-agent concurrency limit;
- an empty, padded, prefixed, exponent-form, fractional, zero, negative,
  non-numeric, or unsafe value falls back to 10.

The deployment will set `MANIFEST_CONCURRENCY_MAX=40`, pass it into the
Manifest container through Compose, and use a locally tagged image built from
the pinned source.

## Code Changes

### Proxy limiter

`packages/backend/src/routing/proxy/proxy-rate-limiter.ts` will replace the
hardcoded limit with:

- a default-limit constant;
- a small environment-value parser with strict positive-safe-integer
  validation;
- an instance field initialized from the environment;
- the existing M203 comparison against that instance field.

The limiter's public API and error behavior remain unchanged.

### Tests

`packages/backend/src/routing/proxy/__tests__/proxy-rate-limiter.spec.ts` will
add behavioral coverage for:

- the unchanged default limit of 10 when the variable is absent;
- a configured limit of 40;
- fallback to 10 for representative invalid values;
- environment restoration between tests so the suite cannot leak process
  state.

The test will be written and observed failing before the production code is
changed.

### Deployment

`docker/docker-compose.yml` will pass `MANIFEST_CONCURRENCY_MAX` to the
application container with a default of 10. `docker/.env.example` will document
the optional setting and its plain-positive-integer contract.

A deployment that needs a higher limit will set it in its untracked `.env`:

```dotenv
MANIFEST_CONCURRENCY_MAX=40
```

A locally built image can be selected through an untracked Compose override;
the repository template will not contain a machine-specific image tag. The
PostgreSQL service, volume, credentials, provider configuration, ports, and
other runtime settings will not change.

## Build and Rollout

Build the custom image from the repository's existing production Dockerfile
and tag it with the pinned upstream revision plus a local concurrency suffix.
Run the relevant unit test and production build before changing the live
Compose files.

After the image exists locally:

1. Validate the resolved Compose configuration without printing secrets.
2. Recreate only the Manifest application service.
3. Leave the PostgreSQL service and volume running.
4. Wait for the application health check to report healthy.
5. Confirm the running container received
   `MANIFEST_CONCURRENCY_MAX=40`.
6. Send a normal authenticated gateway request and confirm a successful
   response.

The limiter's exact boundary behavior is verified in the unit suite rather
than by sending 41 paid or long-running provider requests.

## Failure Handling and Rollback

Invalid environment values fail closed to the upstream default of 10 rather
than preventing startup or removing protection.

If the custom image fails to build or its tests fail, the live deployment is
not modified. If the recreated application container fails its health or
gateway checks, restore the previous upstream image reference and recreate
only the Manifest service. The database and named volume remain untouched
throughout.

## Success Criteria

- The rate-limiter test proves the default boundary remains 10.
- The test proves a configured value of 40 permits 40 slots and rejects the
  41st with M203.
- Invalid values fall back to 10.
- The production Docker image builds successfully from the pinned revision.
- The live Manifest container is healthy and receives
  `MANIFEST_CONCURRENCY_MAX=40`.
- A normal authenticated request succeeds after deployment.
- PostgreSQL remains healthy and its persistent volume is unchanged.
