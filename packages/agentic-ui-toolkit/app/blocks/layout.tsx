import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'UI Components Gallery',
  description:
    'Browse 25+ beautifully designed React components for ChatGPT apps and agentic UIs. Payment forms, chat bubbles, product lists, social posts, and more. Copy and paste into your project.',
  keywords: [
    'React components',
    'ChatGPT UI components',
    'shadcn components',
    'payment components',
    'chat components',
    'product list',
    'form components',
    'agentic UI blocks'
  ],
  alternates: {
    canonical: '/blocks'
  },
  openGraph: {
    title: 'UI Components Gallery - Manifest UI',
    description:
      'Browse 25+ React components for building ChatGPT apps. Payment flows, chat interfaces, product lists, and more.',
    url: 'https://ui.manifest.build/blocks',
    type: 'website'
  },
  twitter: {
    title: 'UI Components Gallery - Manifest UI',
    description:
      'Browse 25+ React components for building ChatGPT apps and agentic UIs.'
  }
}

export default function BlocksLayout({
  children
}: {
  children: React.ReactNode
}) {
  return children
}
