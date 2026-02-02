import { blockCategories } from '@/lib/blocks-categories'
import { ArrowRight, FolderPlus } from 'lucide-react'
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

export function GettingStarted() {
  return (
    <div className="max-w-3xl mx-auto space-y-12">
      <div>
        <h1 className="text-2xl font-bold">Getting Started</h1>
        <p className="text-muted-foreground mt-2">
          Manifest UI is a shadcn/ui library for building ChatGPT Apps.
        </p>
      </div>

      {/* Add to Existing Section */}
      <section id="add-to-existing" className="space-y-6 scroll-mt-8">
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
