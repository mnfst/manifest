# create-manifest

Create a new Manifest MCP server project with a single command.

## Usage

```bash
npx create-manifest my-app
```

This will:

1. Create a new directory `my-app`
2. Copy the starter template
3. Install dependencies
4. Start the development server

## What's Included

The starter template includes:

- MCP server setup with Express
- TypeScript configuration
- Hot reload with Nodemon
- Vite for React widget development with HMR
- Prettier for code formatting

## Requirements

- Node.js 22+
- pnpm
- [ngrok](https://ngrok.com/) (for ChatGPT integration)

## After Creation

Your project will be running at `http://localhost:3000`.

The MCP endpoint is available at `http://localhost:3000/mcp`.

To connect to ChatGPT, expose your server with ngrok:

```bash
ngrok http 3000
```

Then use the ngrok URL with `/mcp` path in ChatGPT's connector settings.

To restart the dev server later:

```bash
cd my-app
pnpm run dev
```

## Available Scripts

Inside the created project, you can run:

- `pnpm dev` - Start development server with hot reload
- `pnpm build` - Build for production
- `pnpm start` - Run production build
- `pnpm lint` - Check code formatting
- `pnpm format` - Format code with Prettier

## Learn More

- [Model Context Protocol](https://modelcontextprotocol.io)

## License

MIT
