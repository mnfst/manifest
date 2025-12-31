'use client'

import { ArrowRight, FolderPlus, Rocket } from 'lucide-react'
import Link from 'next/link'
import dynamic from 'next/dynamic'

const CodeBlock = dynamic(
  () => import('./code-block').then((m) => m.CodeBlock),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-lg bg-muted p-4 h-12 animate-pulse" />
    )
  }
)

export function GettingStarted() {
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-12">
      <div>
        <h1 className="text-2xl font-bold">Getting Started</h1>
        <p className="text-muted-foreground mt-2">
          Manifest UI is a shadcn/ui component library for building ChatGPT
          Apps. You can either start a new project with Manifest UI pre-installed
          or add Manifest UI to your existing app:
        </p>
      </div>

      {/* Navigation Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={() => scrollToSection('start-from-scratch')}
          className="group flex flex-col items-start gap-3 p-6 rounded-xl border-2 border-border bg-card hover:border-primary hover:bg-accent/50 transition-all duration-200 text-left cursor-pointer"
        >
          <div className="p-3 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
            <Rocket className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Start from scratch</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Create a new ChatGPT app with Manifest UI
            </p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all mt-auto" />
        </button>

        <button
          onClick={() => scrollToSection('add-to-existing')}
          className="group flex flex-col items-start gap-3 p-6 rounded-xl border-2 border-border bg-card hover:border-primary hover:bg-accent/50 transition-all duration-200 text-left cursor-pointer"
        >
          <div className="p-3 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
            <FolderPlus className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Add to existing</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Add Manifest UI to your project
            </p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all mt-auto" />
        </button>
      </div>

      {/* Start from Scratch Section */}
      <section id="start-from-scratch" className="space-y-6 pt-8 scroll-mt-8">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <Rocket className="h-5 w-5" />
          </div>
          <h2 className="text-xl font-semibold">Start from scratch</h2>
        </div>

        <p className="text-muted-foreground">
          If you want to start creating a ChatGPT app using Manifest UI
          components but don&apos;t know where to start, this is for you!
        </p>

        <p className="text-muted-foreground">
          Manifest starter app is a starter template that serves a ChatGPT App
          with Manifest UI components using TypeScript and the{' '}
          <a
            href="https://www.skybridge.tech/"
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-primary"
          >
            Skybridge
          </a>{' '}
          library for live reloads and simpler API. Simply run this command:
        </p>

        <CodeBlock code="npx create-manifest@latest my-chatgpt-app" />

        <p className="text-muted-foreground">
          This will create the starter ChatGPT app, install the dependencies and
          run it on port 3000, making the MCP server available at{' '}
          <code className="text-sm bg-muted px-1.5 py-0.5 rounded">
            http://localhost:3000/mcp
          </code>
          .
        </p>

        <p className="text-muted-foreground">
          You can test it with tools like{' '}
          <a
            href="https://mcpjam.com"
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-primary"
          >
            MCP Jam
          </a>{' '}
          and{' '}
          <a
            href="https://modelcontextprotocol.io/docs/tools/inspector"
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-primary"
          >
            MCP Inspector
          </a>
          , but if you want to see your app in ChatGPT, you will need one more
          step as ChatGPT only accepts <code className="text-sm bg-muted px-1.5 py-0.5 rounded">https</code> URLs. Install{' '}
          <a
            href="https://ngrok.com"
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-primary"
          >
            ngrok
          </a>{' '}
          and proxy the port to a remote URL:
        </p>

        <CodeBlock code="ngrok http 3000" />

        <p className="text-muted-foreground">
          Then go to ChatGPT, create a new app in{' '}
          <span className="font-medium text-foreground">Settings &gt; Apps</span>{' '}
          and add the ngrok URL to connect it.
        </p>
      </section>

      {/* Add to Existing Section */}
      <section id="add-to-existing" className="space-y-6 pt-8 border-t scroll-mt-8">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <FolderPlus className="h-5 w-5" />
          </div>
          <h2 className="text-xl font-semibold">Add to existing project</h2>
        </div>

        <p className="text-muted-foreground">
          Make sure you have shadcn/ui initialized in your project. If not, see{' '}
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

        <div className="space-y-4">
          <h3 className="text-md font-semibold">Using a block</h3>
          <p className="text-sm text-muted-foreground">
            Simply browse to the block you want to use and run the provided
            command to add it to your project. For example, to add the Table
            block:
          </p>
          <CodeBlock code="npx shadcn@latest add @manifest/table" />
        </div>
      </section>

      {/* Next Step */}
      <section className="space-y-4 pt-4 border-t">
        <h2 className="text-lg font-semibold">Next Step</h2>
        <Link
          href="/blocks?block=order-confirm"
          className="inline-flex items-center gap-2 text-primary hover:underline"
        >
          Explore blocks
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </div>
  )
}
