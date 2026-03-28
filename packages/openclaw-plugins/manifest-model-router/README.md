# manifest-model-router

Cloud provider plugin for [Manifest](https://manifest.build) — the smart LLM router for [OpenClaw](https://openclaw.ai).

Picks the best model for each request based on a multi-dimension complexity score, balancing quality, speed, and cost automatically. Supports 10+ providers with tier-based routing and fallbacks.

## Install

```bash
openclaw plugins install manifest-model-router
openclaw providers setup manifest-model-router
openclaw gateway restart
```

The setup wizard prompts for your API key from [app.manifest.build](https://app.manifest.build). After setup, use `manifest/auto` as your model.

You can also set the key via environment variable for CI/CD: `export MANIFEST_API_KEY=mnfst_...`

## What it does

- Registers Manifest as a provider in OpenClaw with the `auto` model
- Interactive auth onboarding via `openclaw providers setup manifest-model-router`
- Agent tools: `manifest_usage`, `manifest_costs`, `manifest_health`
- `/manifest` status command

## Self-hosted / Local mode

For a self-hosted server with SQLite and a local dashboard, install the full package instead:

```bash
openclaw plugins install manifest
```

See the [manifest](https://www.npmjs.com/package/manifest) package.

## Contributing

This package lives at `packages/openclaw-plugins/manifest-model-router/` in the [mnfst/manifest](https://github.com/mnfst/manifest) monorepo.

```bash
npm run build --workspace=packages/openclaw-plugins/manifest-model-router   # esbuild bundle
npm test --workspace=packages/openclaw-plugins/manifest-model-router        # Jest tests
```

## Links

- [Dashboard](https://app.manifest.build)
- [Documentation](https://docs.manifest.build)
- [GitHub](https://github.com/mnfst/manifest)
