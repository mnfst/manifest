import { blockCategories } from '@/lib/blocks-categories'
import { ArrowRight, FolderPlus, Rocket } from 'lucide-react'
import dynamic from 'next/dynamic'
import Link from 'next/link'

const CodeBlock = dynamic(
  () => import('./code-block').then((m) => m.CodeBlock),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-lg bg-muted p-4 h-12 animate-pulse" />
    )
  }
)

const tailwindCssConfig = `@import "tailwindcss";

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}

:root {
  --radius: 0.625rem;
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --chart-1: oklch(0.646 0.222 41.116);
  --chart-2: oklch(0.6 0.118 184.714);
  --chart-3: oklch(0.398 0.07 227.392);
  --chart-4: oklch(0.828 0.189 84.429);
  --chart-5: oklch(0.769 0.188 70.08);
  --sidebar: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0.145 0 0);
  --sidebar-primary: oklch(0.205 0 0);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.97 0 0);
  --sidebar-accent-foreground: oklch(0.205 0 0);
  --sidebar-border: oklch(0.922 0 0);
  --sidebar-ring: oklch(0.708 0 0);
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.145 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.145 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.985 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.269 0 0);
  --input: oklch(0.269 0 0);
  --ring: oklch(0.439 0 0);
  --chart-1: oklch(0.488 0.243 264.376);
  --chart-2: oklch(0.696 0.17 162.48);
  --chart-3: oklch(0.769 0.188 70.08);
  --chart-4: oklch(0.627 0.265 303.9);
  --chart-5: oklch(0.645 0.246 16.439);
  --sidebar: oklch(0.205 0 0);
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: oklch(0.488 0.243 264.376);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.269 0 0);
  --sidebar-accent-foreground: oklch(0.985 0 0);
  --sidebar-border: oklch(0.269 0 0);
  --sidebar-ring: oklch(0.439 0 0);
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}`

export function GettingStarted() {
  return (
    <div className="max-w-3xl mx-auto space-y-12">
      <div>
        <h1 className="text-2xl font-bold">Getting Started</h1>
        <p className="text-muted-foreground mt-2">
          Manifest UI is a shadcn/ui library for building ChatGPT Apps.
        </p>
      </div>

      {/* Start from scratch */}
      <section id="start-from-scratch" className="space-y-6 scroll-mt-8">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <Rocket className="h-5 w-5" />
          </div>
          <h2 className="text-xl font-semibold">Start from scratch</h2>
        </div>

        <p className="text-muted-foreground">
          The fastest way to get started is to use the{' '}
          <a
            href="https://docs.skybridge.tech/home"
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-primary"
          >
            Alpic SkyBridge
          </a>{' '}
          starter with Manifest UI. It creates a ready-to-go app with Manifest
          UI configured out of the box.
        </p>

        <CodeBlock code="npx create-skybridge@latest my-app --repo github:alpic-ai/skybridge/examples/manifest-ui" />
      </section>

      {/* Add Manifest UI to your project */}
      <section className="space-y-12 scroll-mt-8">
        <div id="add-to-existing">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <FolderPlus className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-semibold">
              Add Manifest UI to your project
            </h2>
          </div>
          <p className="text-muted-foreground mt-2">
            Already have an existing project? Follow these steps to add Manifest
            UI.
          </p>
        </div>

        {/* Step 1: Initialize shadcn/ui */}
        <div className="space-y-6">
          <h3 className="text-lg font-semibold">
            1. Initialize shadcn/ui
          </h3>

          <p className="text-muted-foreground">
            Make sure you have shadcn/ui initialized in your project. If not,
            see{' '}
            <a
              href="https://ui.shadcn.com/docs/installation"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-primary"
            >
              the shadcn/ui installation guide
            </a>
            .
          </p>

          <CodeBlock code="npx shadcn@latest init" />
        </div>

        {/* Step 2: Configure Tailwind CSS */}
        <div id="configure-styles" className="space-y-6">
          <h3 className="text-lg font-semibold">
            2. Configure Tailwind CSS v4 theme
          </h3>

          <p className="text-muted-foreground">
            Manifest UI blocks use Tailwind CSS v4 with CSS custom properties
            for theming. Add the following configuration to your main CSS file
            (e.g.{' '}
            <code className="text-sm bg-muted px-1.5 py-0.5 rounded">
              globals.css
            </code>{' '}
            or{' '}
            <code className="text-sm bg-muted px-1.5 py-0.5 rounded">
              index.css
            </code>
            ).
          </p>

          <p className="text-sm text-muted-foreground">
            If you initialized your project with{' '}
            <code className="bg-muted px-1.5 py-0.5 rounded">
              npx shadcn@latest init
            </code>
            , this may already be configured. If blocks aren&apos;t rendering
            correctly, verify your CSS includes this setup:
          </p>

          <div className="max-h-96 overflow-y-auto rounded-lg border">
            <CodeBlock code={tailwindCssConfig} language="css" />
          </div>
        </div>

        {/* Step 3: Add a block */}
        <div id="add-block" className="space-y-6">
          <h3 className="text-lg font-semibold">3. Add a block</h3>

          <p className="text-muted-foreground">
            Browse to the block you want to use and run the provided command to
            add it to your project. For example, to add the Table block:
          </p>

          <CodeBlock code="npx shadcn@latest add @manifest/table" />
        </div>
      </section>

      {/* Next Step */}
      <section className="space-y-4 pt-4 border-t">
        <h2 className="text-lg font-semibold">Next Step</h2>
        <Link
          href={
            blockCategories[0]?.blocks[0]
              ? `/blocks/${blockCategories[0].id}/${blockCategories[0].blocks[0].id}`
              : '/blocks'
          }
          className="inline-flex items-center gap-2 text-primary hover:underline"
        >
          Explore blocks
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </div>
  )
}
