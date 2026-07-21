# n8n-nodes-manifest

Use [Manifest](https://manifest.build) from n8n workflows. Manifest routes requests through the right AI model behind one OpenAI-compatible API.

## Operations

- List models from `GET /v1/models`
- Create chat completions with `POST /v1/chat/completions`
- Create Responses API calls with `POST /v1/responses`

## Response output

The node handles both response formats returned by Manifest:

- Buffered responses are returned as the API's JSON object.
- Streamed responses are returned as parsed server-sent events after the stream completes:

```json
{
  "responseMode": "stream",
  "events": [
    {
      "event": "message",
      "data": { "choices": [{ "delta": { "content": "Hello" } }] }
    },
    { "event": "message", "data": "[DONE]" }
  ]
}
```

The node waits for a streamed response to finish before passing its parsed events to the next workflow node. Do not set `stream` in **Additional Body**; the node ignores that field so response behavior remains consistent with the route configured in Manifest.

## Credentials

Create a **Manifest API** credential with:

- **Base URL**: `https://app.manifest.build` for Manifest Cloud, or your self-hosted URL.
- **API Key**: an agent API key from Manifest.

The credential sends requests with:

```text
Authorization: Bearer <your Manifest API key>
```

## Install

In n8n:

1. Go to **Settings** > **Community Nodes**.
2. Select **Install**.
3. Enter `n8n-nodes-manifest`.
4. Confirm the community-node warning and install.

For local development:

```bash
npm install
npm run dev
```

## Release

This package is designed to publish from GitHub Actions with npm provenance.

1. Update the package version in `package.json`, `package-lock.json`, and `CHANGELOG.md`.
2. Commit the change.
3. Push a tag named `n8n-nodes-manifest-v<version>`, for example:

```bash
git tag n8n-nodes-manifest-v0.1.0
git push origin n8n-nodes-manifest-v0.1.0
```

Configure npm Trusted Publishing for the GitHub workflow named `publish-n8n-node.yml`, or set an `NPM_TOKEN` repository secret. The workflow runs `npm run release`, which n8n uses to publish with npm provenance inside GitHub Actions.
