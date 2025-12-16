# Agentic Apps

MCP server for serving UI components to ChatGPT and other AI assistants.

## Setup

```bash
npm install
```

## Development

```bash
npm run dev
```

Starts the MCP server at `http://localhost:3000/mcp` with hot reload.

## Build

```bash
npm run build
```

Compiles TypeScript and bundles HTML templates from `src/web/` into single-file outputs in `dist/web/`.

## Docker

Build and run the container:

```bash
docker build -t agentic-apps .
docker run -p 3000:3000 agentic-apps
```

## Use in ChatGPT

Use `ngrok` package to expose your local machine to the web:

```bash
# Default port is 3000.
ngrok http <port>
```

Now you can [add your app to ChatGPT](https://developers.openai.com/apps-sdk/quickstart#add-your-app-to-chatgpt).
