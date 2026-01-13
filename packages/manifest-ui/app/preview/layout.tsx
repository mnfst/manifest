import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Component Preview - Manifest UI',
  description: 'Preview page for component screenshot generation',
  robots: {
    index: false,
    follow: false
  }
}

/**
 * Custom layout for preview pages that removes all chrome (header, footer).
 * This provides a clean canvas for screenshot generation.
 */
export default function PreviewLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <div className="preview-layout">
      {children}
    </div>
  )
}
