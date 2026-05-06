# Manifest Wingman

A standalone, single-page playground for sending test requests to a Manifest gateway while
impersonating any of the agents Manifest tracks: **OpenClaw**, **Hermes**, **OpenAI SDK**,
**Vercel AI SDK**, **LangChain**, plain **cURL**, or a raw fetch with no fingerprint.

Useful for:

- Verifying routing decisions (which tier did Manifest pick for this prompt?).
- Inspecting how the proxy classifies different SDKs from their User-Agent / `X-Stainless-*` headers.
- Reproducing a customer report end-to-end without touching the real CLI.
- Onboarding contributors who want to see what an OpenClaw or Hermes request actually looks like.

## Running locally

```bash
# In one terminal — the Manifest backend on :3001 (see packages/backend/README)
npm run start:dev --workspace=packages/backend

# In another — wingman on :3002
npm run dev --workspace=manifest-wingman
# → http://localhost:3002
```

Wingman proxies `/v1/*` and `/api/*` to `http://localhost:3001` so requests stay same-origin and
sidestep CORS.

### Env overrides

| Variable                | Default | Purpose                                     |
| ----------------------- | ------- | ------------------------------------------- |
| `WINGMAN_PORT`          | `3002`  | Vite dev server port.                       |
| `WINGMAN_BACKEND_PORT`  | `3001`  | Manifest backend port that Vite proxies to. |

The Base URL, API key, and model are also configurable from the connection bar at the top of the
page and persisted to `localStorage`. Manifest's "Wingman" header button (visible only in dev mode)
opens this app with `?baseUrl=` already filled in.

## How it's wired

- **`src/profiles.ts`** — catalog of every supported agent/SDK shape. Adding a new one means
  adding one entry: headers, system prompt, body builder, code snippet builder. The UI picks up
  the new tile automatically.
- **`src/send.ts`** — single fetch wrapper that captures status, latency, request/response
  headers, and parses JSON when possible. Filters out forbidden headers (`User-Agent`, `Sec-*`,
  `Cookie`, etc.) that browsers refuse to set on fetch and surfaces them in the UI.
- **`src/App.tsx`** — composes the layout: connection bar → profile tiles → form (system prompt,
  user message) → header editor → SDK code preview → response panel.

## Caveats

Browsers don't let JavaScript override `User-Agent`, `Cookie`, or any `Sec-*` header on `fetch`.
That means impersonating SDK fingerprints from the browser is partial — Manifest will still see
the browser's real User-Agent. The Header editor flags which entries got dropped so you know.

For a full-fidelity impersonation, run the equivalent `curl` snippet shown in the SDK preview
panel from the terminal — Wingman generates a faithful command line for each profile.

## Deployment

Wingman is a developer tool. It's intentionally not deployed alongside the backend, doesn't ship
in the Docker image, and is excluded from changesets. To preview the production build locally:

```bash
npm run build --workspace=manifest-wingman
npm run preview --workspace=manifest-wingman
```
