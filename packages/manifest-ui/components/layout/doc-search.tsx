'use client'

import { DocSearch } from '@docsearch/react'
import '@docsearch/css'

const ALGOLIA_APP_ID = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID ?? 'EITZO53M8Q'
const ALGOLIA_API_KEY =
  process.env.NEXT_PUBLIC_ALGOLIA_API_KEY ?? 'd7375b1f79c39ac4cfdbd70127888215'
const ALGOLIA_INDEX_NAME =
  process.env.NEXT_PUBLIC_ALGOLIA_INDEX_NAME ?? 'Manifest UI Website'

function deduplicateResults<T extends { url: string }>(items: T[]): T[] {
  const pagesWithSections = new Set(
    items
      .filter((item) => item.url.includes('#'))
      .map((item) => item.url.split('#')[0])
  )
  return items.filter((item) => {
    if (item.url.includes('#')) return true
    return !pagesWithSections.has(item.url)
  })
}

export function AlgoliaDocSearch() {
  return (
    <DocSearch
      appId={ALGOLIA_APP_ID}
      apiKey={ALGOLIA_API_KEY}
      indexName={ALGOLIA_INDEX_NAME}
      placeholder="Search components..."
      transformItems={deduplicateResults}
    />
  )
}
