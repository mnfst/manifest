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
- Vite for building web components
- Example flow (GameBoy emulator)

## Requirements

- Node.js 18+
- npm 9+

## After Creation

Your project will be running at `http://localhost:3000`.

To restart the dev server later:

```bash
cd my-app
npm run dev
```

## Available Scripts

Inside the created project, you can run:

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Run production build

## Learn More

- [Manifest Documentation](https://manifest.build)
- [MCP Protocol](https://modelcontextprotocol.io)

## License

MIT
