# Agentic UI Toolkit

A custom shadcn component registry built with Next.js 15 and Tailwind v4.

## Getting Started

### Install dependencies

```bash
npm install
```

### Serve the development UI

```bash
npm run dev
```

This starts the Next.js development server with Turbopack at `http://localhost:3000`.

### Build the registry

```bash
npm run registry:build
```

This generates static JSON files in `public/r/` that can be consumed by the shadcn CLI.

## Creating a New Component

1. **Create the component folder and file**

   ```
   registry/misc/<component-name>/<component-name>.tsx
   ```

   Example structure:
   ```
   registry/
   └── misc/
       └── my-component/
           └── my-component.tsx
   ```

2. **Write the component**

   ```tsx
   // registry/misc/my-component/my-component.tsx
   "use client"

   import { Card } from "@/components/ui/card"

   export function MyComponent() {
     return (
       <Card>
         <p>Hello from MyComponent!</p>
       </Card>
     )
   }
   ```

3. **Register the component in `registry.json`**

   ```json
   {
     "name": "my-component",
     "type": "registry:component",
     "title": "My Component",
     "description": "A description of my component.",
     "dependencies": ["lucide-react"],
     "registryDependencies": ["card"],
     "files": [
       {
         "path": "registry/misc/my-component/my-component.tsx",
         "type": "registry:component"
       }
     ]
   }
   ```

   - `dependencies`: npm packages required (e.g., `lucide-react`, `zod`)
   - `registryDependencies`: other shadcn components this depends on (e.g., `button`, `card`, `input`)

4. **Build the registry**

   ```bash
   npm run registry:build
   ```

5. **Preview the component** (optional)

   Import and render it in `app/page.tsx` to see it in the dev server.

## Installing Components

Users can install components from your registry using the shadcn CLI:

```bash
npx shadcn add my-component --registry https://your-registry-url
```

## Documentation

Visit the [shadcn documentation](https://ui.shadcn.com/docs/registry) for more details on the registry system.
