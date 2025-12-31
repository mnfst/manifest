# Manifest Starter

A minimal TypeScript application demonstrating how to build an MCP server with widget rendering for ChatGPT.

![Demo](docs/demo.gif)

## Overview

This project shows how to integrate a TypeScript Express application with ChatGPT using the Model Context Protocol (MCP). It includes a working MCP server that exposes tools and resources callable from ChatGPT, with responses rendered natively. It also includes MCP tools without UI widgets.

## Getting Started

### Prerequisites

- Node.js 22+ (see `.nvmrc` for exact version)
- pnpm (install with `npm install -g pnpm`)
- [ngrok](https://ngrok.com/) (required for ChatGPT integration)

### Local Development with Hot Module Replacement (HMR)

This project uses Vite for React widget development with full HMR support, allowing you to see changes in real-time directly within ChatGPT conversations.

#### 1. Install Dependencies

```bash
pnpm install
```

#### 2. Start the Development Server

```bash
pnpm dev
```

This starts an Express server on port 3000 with:

- MCP endpoint at `/mcp` - the ChatGPT App Backend
- React application on Vite HMR dev server - the ChatGPT App Frontend

#### 3. Expose Your Local Server

In a separate terminal, expose your local server using ngrok:

```bash
ngrok http 3000
```

Copy the forwarding URL from ngrok output:

```
Forwarding     https://xxxx.ngrok-free.app -> http://localhost:3000
```

#### 4. Connect to ChatGPT

1. Enable **Settings > Connectors > Advanced > Developer mode** in the ChatGPT client
2. Navigate to **Settings > Connectors > Create**
3. Enter your ngrok URL with the `/mcp` path (e.g., `https://xxxx.ngrok-free.app/mcp`)
4. Click **Create**

#### 5. Test Your Integration

1. Start a new conversation in ChatGPT
2. Select your connector using the **+ button > Your connector**
3. Try prompting the model (e.g., "Show me pikachu details")

#### 6. Develop with HMR

Edit React components in `web/src/widgets/` and see changes instantly:

- Make changes to any component
- Save the file
- The widget updates automatically in ChatGPT without refreshing

**Note:** When you modify MCP server code (in `server/src/`), reload your connector in **Settings > Connectors > [Your connector] > Reload**.

## Widget Naming Convention

The endpoint name in your MCP server must match the file name of the corresponding React component in `web/src/widgets/`.

For example:

- Endpoint named `pokemon-card` requires `web/src/widgets/pokemon-card.tsx`
- The endpoint name and widget file name (without `.tsx`) must be identical

## Project Structure

```
.
├── server/
│   ├── src/
│   │   ├── server.ts     # MCP server with tool/resource registration
│   │   └── index.ts      # Express server definition
├── web/
│   └── src/
│       └── widgets/      # React widget components
```

## Available Scripts

| Command          | Description                              |
| ---------------- | ---------------------------------------- |
| `pnpm dev`       | Start development server with hot reload |
| `pnpm build`     | Build for production                     |
| `pnpm start`     | Run production build                     |
| `pnpm lint`      | Check code formatting with Prettier      |
| `pnpm format`    | Format code with Prettier                |
| `pnpm inspector` | Open MCP Inspector                       |

## Resources

- [Model Context Protocol Documentation](https://modelcontextprotocol.io/)
