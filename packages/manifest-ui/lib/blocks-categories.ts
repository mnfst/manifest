import registry from '@/registry.json'

// Shared block categories for sidebar navigation
// Categories and blocks are automatically derived from registry.json
export interface BlockCategory {
  id: string
  name: string
  blocks: { id: string; name: string }[]
}

// Map category IDs to display names
const categoryDisplayNames: Record<string, string> = {
  blogging: 'Blogging',
  events: 'Events',
  form: 'Forms',
  list: 'Lists & Tables',
  map: 'Map',
  messaging: 'Messaging',
  miscellaneous: 'Miscellaneous',
  payment: 'Payment',
  selection: 'Selection',
  social: 'Social',
  status: 'Status & Progress',
}

// Define the order of categories in the sidebar
const categoryOrder = [
  'blogging',
  'events',
  'form',
  'list',
  'map',
  'messaging',
  'miscellaneous',
  'payment',
  'selection',
  'social',
  'status',
]

// Group registry items by category
function buildBlockCategories(): BlockCategory[] {
  const categoryMap = new Map<string, { id: string; name: string }[]>()

  for (const item of registry.items) {
    // Skip non-component items (e.g. shared type definitions)
    if (item.type !== 'registry:block') continue

    // Support both 'categories' array (new format) and 'category' string (old format)
    const categories = item.categories
    if (!categories || categories.length === 0) continue

    // Use the first category (primary category)
    const category = categories[0]
    if (!categoryMap.has(category)) {
      categoryMap.set(category, [])
    }

    categoryMap.get(category)!.push({
      id: item.name,
      name: item.title,
    })
  }

  // Sort blocks alphabetically within each category
  for (const blocks of categoryMap.values()) {
    blocks.sort((a, b) => a.name.localeCompare(b.name))
  }

  // Build the categories array in the defined order
  const categories: BlockCategory[] = []

  for (const categoryId of categoryOrder) {
    const blocks = categoryMap.get(categoryId)
    if (blocks && blocks.length > 0) {
      categories.push({
        id: categoryId,
        name: categoryDisplayNames[categoryId] || categoryId,
        blocks,
      })
    }
  }

  // Add any categories not in the defined order (sorted alphabetically)
  const remainingCategories = Array.from(categoryMap.keys())
    .filter((id) => !categoryOrder.includes(id))
    .sort()

  for (const categoryId of remainingCategories) {
    const blocks = categoryMap.get(categoryId)
    if (blocks && blocks.length > 0) {
      categories.push({
        id: categoryId,
        name: categoryDisplayNames[categoryId] || categoryId,
        blocks,
      })
    }
  }

  return categories
}

export const blockCategories: BlockCategory[] = buildBlockCategories()
