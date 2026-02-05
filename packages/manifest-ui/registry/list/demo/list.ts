// Demo data for List category components
// This file contains sample data used for component previews and documentation

import type { Product } from '../types'

// Default products for ProductList
export const demoProducts: Product[] = [
  {
    name: "Air Force 1 '07",
    description: 'Nike',
    price: 119,
    image: 'https://ui.manifest.build/demo/shoe-1.png',
    rating: 4.9,
    badge: 'New',
    inStock: true
  },
  {
    name: 'Air Max 90',
    description: 'Nike',
    price: 140,
    image: 'https://ui.manifest.build/demo/shoe-2.png',
    rating: 4.8,
    inStock: true
  },
  {
    name: 'Air Max Plus',
    description: 'Nike',
    price: 170,
    originalPrice: 190,
    image: 'https://ui.manifest.build/demo/shoe-4.png',
    rating: 4.7,
    badge: '-10%',
    inStock: true
  },
  {
    name: 'Dunk Low',
    description: 'Nike',
    price: 115,
    image: 'https://ui.manifest.build/demo/shoe-3.png',
    rating: 4.6,
    inStock: true
  },
  {
    name: 'Jordan 1 Low',
    description: 'Nike',
    price: 135,
    image: 'https://ui.manifest.build/demo/shoe-1.png',
    rating: 4.8,
    inStock: true
  },
  {
    name: 'Blazer Mid',
    description: 'Nike',
    price: 105,
    image: 'https://ui.manifest.build/demo/shoe-2.png',
    rating: 4.5,
    inStock: true
  },
]

// Table columns
export const demoTableColumns = [
  { header: 'Name', accessor: 'name' },
  { header: 'Email', accessor: 'email' },
  { header: 'Status', accessor: 'status' },
]

// Table rows
export const demoTableRows = [
  { name: 'John Doe', email: 'john@example.com', status: 'Active' },
  { name: 'Jane Smith', email: 'jane@example.com', status: 'Pending' },
  { name: 'Bob Johnson', email: 'bob@example.com', status: 'Active' },
]

// Table variant: API Usage (default)
export const demoApiUsageColumns = [
  { header: 'Model', accessor: 'model', sortable: true },
  { header: 'Total Tokens', accessor: 'totalTokens', sortable: true, align: 'right' as const },
]

export const demoApiUsageRows = [
  { model: 'gpt-5', totalTokens: 2267482 },
  { model: 'claude-3.5-sonnet', totalTokens: 647528 },
  { model: 'gemini-pro', totalTokens: 428190 },
  { model: 'llama-3', totalTokens: 312475 },
]

// Table variant: Models (single select)
export const demoModelsColumns = [
  { header: 'Model', accessor: 'model', sortable: true },
  { header: 'Provider', accessor: 'provider', sortable: true },
  { header: 'Context Window', accessor: 'contextWindow', sortable: true, align: 'right' as const },
]

export const demoModelsRows = [
  { model: 'GPT-5', provider: 'OpenAI', contextWindow: '128K' },
  { model: 'Claude 3.5 Sonnet', provider: 'Anthropic', contextWindow: '200K' },
  { model: 'Gemini Pro', provider: 'Google', contextWindow: '1M' },
  { model: 'Llama 3', provider: 'Meta', contextWindow: '128K' },
]

// Table variant: Export Data (multi select)
export const demoExportColumns = [
  { header: 'Date', accessor: 'date', sortable: true },
  { header: 'Event', accessor: 'event', sortable: true },
  { header: 'Users', accessor: 'users', sortable: true, align: 'right' as const },
]

export const demoExportRows = [
  { date: '2025-01-15', event: 'Page View', users: 1243 },
  { date: '2025-01-15', event: 'Sign Up', users: 87 },
  { date: '2025-01-14', event: 'Page View', users: 1105 },
  { date: '2025-01-14', event: 'Purchase', users: 42 },
]
