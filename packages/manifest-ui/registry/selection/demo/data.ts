// Demo data for Selection category components
// This file contains sample data used for component previews and documentation

import type { Option } from '../types'

// Default options for OptionList
export const demoOptions: Option[] = [
  { label: 'Standard shipping', description: '3-5 business days' },
  { label: 'Express shipping', description: '1-2 business days' },
  { label: 'Store pickup', description: 'Available in 2h' },
]

// Quick reply options
export const demoQuickReplies = [
  { label: 'Yes, please' },
  { label: 'No, thanks' },
  { label: 'Tell me more' },
]

// Tag select options
export const demoTags: { id: string; label: string; color: 'red' | 'yellow' | 'green' }[] = [
  { id: '1', label: 'Important', color: 'red' },
  { id: '2', label: 'In Progress', color: 'yellow' },
  { id: '3', label: 'Done', color: 'green' },
]
