# Manifest types

Utility types used by Manifest.

## Development

When updating this library, you may need to fetch your local copy of it instead of the published packages from other projects.

The `packages/core/admin` and `packages/core/manifest` projects in this repository have a command to do that it their package.json file. Simply run:

```bash
npm run link-local-types
```

## Build

```
npm run build
```

## Publish

```bash
npm run build
npm publish

# Alpha / Beta versions
npm publish --tag alpha
npm publish --tag beta
```
