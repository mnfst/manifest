import type { Metadata } from 'next'
import { readFileSync } from 'fs'
import { join } from 'path'

interface RegistryItem {
  name: string
  title: string
  description: string
  category: string
  preview?: string
}

interface Registry {
  items: RegistryItem[]
}

// Load registry data
function getRegistry(): Registry {
  try {
    const registryPath = join(process.cwd(), 'registry.json')
    const content = readFileSync(registryPath, 'utf-8')
    return JSON.parse(content)
  } catch {
    return { items: [] }
  }
}

// Find component in registry
function findComponent(blockName: string): RegistryItem | undefined {
  const registry = getRegistry()
  return registry.items.find((item) => item.name === blockName)
}

// Category display names
const categoryNames: Record<string, string> = {
  form: 'Forms',
  payment: 'Payment',
  blogging: 'Blogging',
  messaging: 'Messaging',
  events: 'Events',
  list: 'Lists & Tables',
  miscellaneous: 'Miscellaneous'
}

type Props = {
  params: Promise<{ category: string; block: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category, block } = await params
  const component = findComponent(block)

  const title = component?.title || block.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  const description = component?.description || `${title} component for building ChatGPT apps and agentic UIs.`
  const categoryName = categoryNames[category] || category

  // Preview image URL - will be populated by the preview generation workflow
  const previewImageUrl = component?.preview || `https://ui.manifest.build/previews/${block}.png`

  return {
    title: `${title} - ${categoryName} Component | Manifest UI`,
    description,
    keywords: [
      title,
      `${title} component`,
      `React ${title}`,
      `shadcn ${title}`,
      categoryName,
      'React component',
      'ChatGPT UI',
      'agentic UI'
    ],
    alternates: {
      canonical: `/blocks/${category}/${block}`
    },
    openGraph: {
      title: `${title} Component - Manifest UI`,
      description,
      url: `https://ui.manifest.build/blocks/${category}/${block}`,
      type: 'article',
      images: [
        {
          url: previewImageUrl,
          width: 1200,
          height: 630,
          alt: `${title} component preview`
        }
      ]
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} Component - Manifest UI`,
      description,
      images: [previewImageUrl]
    }
  }
}

export default function BlockLayout({
  children
}: {
  children: React.ReactNode
}) {
  return children
}
