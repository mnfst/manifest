# @mnfst/server

## 5.3.4

### Patch Changes

- 3006ee5: Add postinstall check for better-sqlite3 native module and CI verification step
- 388730a: Remove unnecessary time (HH:MM) from x-axis labels on dashboard charts when using the "Last 7 days" filter

## 5.3.3

### Patch Changes

- ebd8913: Fix better-sqlite3 version conflict causing silent failures on macOS and improve error messages for native module issues

## 5.3.2

### Patch Changes

- 1440512: Fix notification cron: hourly alerts never triggered because the evaluation window was empty, and failed email sends prevented retries

## 5.3.0

### Minor Changes

- dfa7025: Import all OpenRouter models instead of a curated subset, add price history tracking, unresolved model detection, and a live search/filter UI for the model prices page.

## 5.2.11

### Patch Changes

- 0cc919c: Fix manifest plugin not being published with @mnfst/server dependency; add startup pre-flight check
- e491d5e: Add GitHub star button to header

## 5.2.10

### Patch Changes

- 6c2e828: Improve local mode first-visit UX: skip redundant setup modal for local-agent, print dashboard URL from @mnfst/server, and show contextual verify step in local mode

## 5.2.9

### Patch Changes

- 388b714: Add `@mnfst/server` as a dependency of the `manifest` plugin so local mode works out of the box

## 5.2.8

### Patch Changes

- bd821f3: Expand model pricing: add normalizer for variant model names and 10 new models (GPT-5.3, GLM-4, Nova, Qwen 3)

## 5.2.7

### Patch Changes

- 16984c3: Add anonymous product telemetry via PostHog

## 5.2.6

### Patch Changes

- 43e9c48: Show all messages by default and change overview default to 7 days

## 5.2.5

### Patch Changes

- 3371a9f: Fix dynamic imports and dependency resolution for local-install mode

## 5.2.4

### Patch Changes

- fda9600: Add README, LICENSE, and improve package metadata for npm discoverability

## 5.2.3

### Patch Changes

- ee5d607: Add repository field for npm provenance validation

## 5.2.2

### Patch Changes

- bea1c4b: Publish @mnfst/server package

## 5.2.0

### Minor Changes

- 2f31261: Add local mode with embedded SQLite server and rename server package to @mnfst/server
