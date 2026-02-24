# manifest

## 5.6.5

### Patch Changes

- 973702b: Fix Model Prices page showing only 31 models: add error handling in OpenRouter sync loop so one bad model doesn't crash the entire sync, trigger sync on startup when data is stale, and always upsert curated seed models on restart

## 5.6.4

### Patch Changes

- c5e7207: Reduce npm package size by ~60%: subset Boxicons font to 5 used icons, optimize SVGs with SVGO, replace dark SVG duplicates with CSS filter, and remove unused assets (logo.png, og-image.png)
- 54cd181: Revert per-user email provider configuration (#819)

## 5.6.3

### Patch Changes

- 070f100: Separate env variable reads from network code in product telemetry to avoid OpenClaw "credential harvesting" false-positive warning

## 5.6.2

### Patch Changes

- 9bdaa46: fix: remove private workspace packages from devDependencies to fix standalone npm install

## 5.6.1

### Patch Changes

- af2ff12: Fire agent_created product telemetry event in local mode when a new tenant/agent is created via LocalBootstrapService.

## 5.6.0

### Minor Changes

- 532b6ce: Merge @mnfst/server into manifest plugin and replace better-sqlite3 with sql.js (WASM). Local mode no longer requires native C++ compilation — zero external build dependencies. Better Auth is skipped entirely in local mode; simple session endpoints serve loopback requests.

## 5.5.0

### Minor Changes

- 0a252e6: Default mode changed from cloud to local — zero-config install now starts an embedded SQLite server. Content capture and faster metrics (10s) enabled automatically in local mode.

## 5.3.4

### Patch Changes

- 3006ee5: Add postinstall check for better-sqlite3 native module and CI verification step
- Updated dependencies [3006ee5]
- Updated dependencies [388730a]
  - @mnfst/server@5.3.4

## 5.3.1

### Patch Changes

- 6904ab9: Remove filesystem access from product telemetry opt-out check and bundle skill file at build time

## 5.2.11

### Patch Changes

- 0cc919c: Fix manifest plugin not being published with @mnfst/server dependency; add startup pre-flight check
- Updated dependencies [0cc919c]
- Updated dependencies [e491d5e]
  - @mnfst/server@5.2.11

## 5.2.7

### Patch Changes

- 16984c3: Add anonymous product telemetry via PostHog

## 5.2.4

### Patch Changes

- fda9600: Add README, LICENSE, and improve package metadata for npm discoverability

## 5.2.1

### Patch Changes

- b3971d5: Remove skills folder from the published package

## 5.2.0

### Minor Changes

- 2f31261: Add local mode with embedded SQLite server and rename server package to @mnfst/server
