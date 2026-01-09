import { blockCategories } from '@/lib/blocks-categories'

// Build a map of category slug -> category data for quick lookup
export function getCategoryBySlug(slug: string) {
  return blockCategories.find((c) => c.id === slug)
}

// Build a map of block ID -> category ID for quick lookup
export function getCategoryForBlock(blockId: string): string | null {
  for (const category of blockCategories) {
    if (category.blocks.some((b) => b.id === blockId)) {
      return category.id
    }
  }
  return null
}

// Get block data by category and block slug
export function getBlockBySlug(categorySlug: string, blockSlug: string) {
  const category = getCategoryBySlug(categorySlug)
  if (!category) return null
  return category.blocks.find((b) => b.id === blockSlug) || null
}

// Generate all possible block paths for static generation
export function getAllBlockPaths(): { category: string; block: string }[] {
  const paths: { category: string; block: string }[] = []
  for (const category of blockCategories) {
    for (const block of category.blocks) {
      paths.push({ category: category.id, block: block.id })
    }
  }
  return paths
}

// Get URL for a block
export function getBlockUrl(categoryId: string, blockId: string): string {
  return `/blocks/${categoryId}/${blockId}`
}

// Get URL for a block with variant anchor
export function getBlockVariantUrl(
  categoryId: string,
  blockId: string,
  variantId: string
): string {
  return `/blocks/${categoryId}/${blockId}#${variantId}`
}
