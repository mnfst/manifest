---
'manifest': patch
---

Extract Wingman to a standalone hosted SPA at `wingman.manifest.build`.
The dashboard's bottom drawer stays dev-only (dead-code-eliminated from
production / self-hosted bundles) and now embeds the hosted build by
default. Contributors can still point it at a local Wingman with
`VITE_WINGMAN_URL`. Dev-mode CORS allow-lists the hosted origin so
contributors can use the hosted SPA against a local backend; production
never enables CORS, so nothing Wingman-related ships to self-hosted
deployments. The `packages/wingman/` workspace is removed; source moves
to https://github.com/mnfst/wingman.
