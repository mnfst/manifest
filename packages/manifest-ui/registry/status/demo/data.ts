// Demo data for Status category components
// This file contains sample data used for component previews and documentation

export const demoProgressSteps = [
  { label: 'Cart', status: 'completed' as const },
  { label: 'Shipping', status: 'current' as const },
  { label: 'Payment', status: 'pending' as const },
  { label: 'Confirm', status: 'pending' as const },
]

export const demoStatusBadge = {
  status: 'processing' as const,
  label: 'Processing',
}
