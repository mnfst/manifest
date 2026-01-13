'use client'

import { useParams } from 'next/navigation'
import { Suspense } from 'react'
import { previewComponents } from '@/lib/preview-components'
import { getPreviewBackground, PREVIEW_PADDING, PREVIEW_VIEWPORT } from '@/lib/preview-backgrounds'

/**
 * Preview page for generating component screenshots.
 * This page renders a single component in isolation with a colorful gradient background.
 *
 * Uses fixed positioning to cover the entire viewport, hiding header/footer.
 * Optimized for og:image resolution (1200x630).
 *
 * Usage: /preview/[component-name]
 * Example: /preview/message-bubble
 *
 * The page signals readiness for screenshot via a data attribute on the container.
 */
export default function PreviewPage() {
  const params = useParams()
  const componentName = params.component as string

  const config = previewComponents[componentName]

  if (!config) {
    return (
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-rose-400 to-orange-300"
        data-preview-ready="error"
        data-preview-component={componentName}
      >
        <div className="text-center p-8 bg-white rounded-xl shadow-2xl">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Component Not Found</h1>
          <p className="text-gray-600">No preview available for: {componentName}</p>
        </div>
      </div>
    )
  }

  const background = getPreviewBackground(config.category)

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
      style={{
        background: background.gradient,
        padding: PREVIEW_PADDING,
        width: '100vw',
        height: '100vh'
      }}
      data-preview-ready="true"
      data-preview-component={componentName}
      data-preview-category={config.category}
      data-preview-width={PREVIEW_VIEWPORT.width}
      data-preview-height={PREVIEW_VIEWPORT.height}
    >
      <Suspense
        fallback={
          <div className="animate-pulse bg-white/20 rounded-xl w-96 h-64" />
        }
      >
        <div
          className="bg-background rounded-xl shadow-2xl overflow-auto max-h-[calc(100vh-96px)]"
          style={{
            maxWidth: `calc(100vw - ${PREVIEW_PADDING * 2}px)`
          }}
        >
          <div className="p-6">
            {config.component}
          </div>
        </div>
      </Suspense>
    </div>
  )
}
