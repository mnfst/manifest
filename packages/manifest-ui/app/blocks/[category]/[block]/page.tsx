import { Suspense } from 'react'
import { blockCategories } from '@/lib/blocks-categories'
import { BlockPageClient } from './block-page-client'

/**
 * Generate static params for all block pages at build time.
 * This enables Static Site Generation (SSG) for each /blocks/[category]/[block] route,
 * ensuring full HTML is pre-rendered and served to crawlers for SEO.
 */
export function generateStaticParams() {
  return blockCategories.flatMap((category) =>
    category.blocks.map((block) => ({
      category: category.id,
      block: block.id,
    }))
  )
}

export default async function BlockPage({
  params,
}: {
  params: Promise<{ category: string; block: string }>
}) {
  const { category, block } = await params

  return (
    <Suspense
      fallback={<div className="flex min-h-[calc(100vh-3.5rem)] bg-card" />}
    >
      <BlockPageClient categorySlug={category} blockSlug={block} />
    </Suspense>
  )
}
