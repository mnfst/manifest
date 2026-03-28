---
"manifest": patch
---

fix: remove manifest-shared from dependencies to fix plugin npm install failure

The manifest-shared package is not published on npm but was listed as a dependency,
causing `npm install` to fail with a 404 when installing the plugin. Since manifest-shared
is already vendored in `dist/node_modules/manifest-shared/` by the build script, removing
it from dependencies lets Node.js resolve it at runtime without npm intervention.
